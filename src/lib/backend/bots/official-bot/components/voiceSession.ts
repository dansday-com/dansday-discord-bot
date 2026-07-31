import { GoogleGenAI, Modality, Type } from '@google/genai';
import {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	entersState,
	VoiceConnectionStatus,
	AudioPlayerStatus,
	EndBehaviorType,
	StreamType,
	NoSubscriberBehavior
} from '@discordjs/voice';
import prism from 'prism-media';
import { Readable } from 'node:stream';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { writeVoiceState, clearVoiceState, VOICE_STATE_TTL_SEC } from './voiceControl.js';

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DISCORD_RATE = 48000;

const FRAME_MS = 20;
const FRAME_BYTES = (DISCORD_RATE / 1000) * FRAME_MS * 2 * 2;
const EMPTY = Buffer.alloc(0);

const SPEAK_GUARD_MS = 400;
const TURN_SILENCE_MS = 700;
const CLOSE_WAIT_MS = 3000;
const MAX_QUEUED_CHUNKS = 60;

const IDLE_TIMEOUT_MS = 60_000;
const IDLE_WARN_MS = IDLE_TIMEOUT_MS - 10_000;
const SESSION_MAX_MS = 15 * 60_000;
const SESSION_WARN_MS = 13.5 * 60_000;
const GOODBYE_GRACE_MS = 12_000;
const HEARTBEAT_MS = (VOICE_STATE_TTL_SEC / 2) * 1000;

const IDLE_GOODBYE_PROMPT =
	"Nobody has spoken for a while. Say a short, natural goodbye out loud — you're heading off since it's quiet, and they can call you back anytime. One sentence.";
const TIMEUP_GOODBYE_PROMPT =
	"Your time in this call is up. Say a short, natural goodbye out loud — you have to go, you're busy, you'll talk later. One sentence. Do not explain why.";

function downmixAndResample(pcm, fromRate, toRate, fromChannels, toChannels) {
	const inSamples = pcm.length / 2 / fromChannels;
	const outSamples = Math.floor((inSamples * toRate) / fromRate);
	const out = Buffer.alloc(outSamples * 2 * toChannels);

	for (let i = 0; i < outSamples; i++) {
		const srcIndex = Math.floor((i * fromRate) / toRate);
		let sample = 0;
		for (let c = 0; c < fromChannels; c++) {
			const offset = (srcIndex * fromChannels + c) * 2;
			if (offset + 1 < pcm.length) sample += pcm.readInt16LE(offset);
		}
		sample = Math.max(-32768, Math.min(32767, Math.round(sample / fromChannels)));
		for (let c = 0; c < toChannels; c++) {
			out.writeInt16LE(sample, (i * toChannels + c) * 2);
		}
	}
	return out;
}

export function createVoiceSession({ client, config, botId, guildId, channelId, channelName, inviterId, textChannelId, onEnded }) {
	const speaking = new Map();
	const genai = new GoogleGenAI({ apiKey: config.api_key });
	const systemInstruction = (config.system_prompt ?? '').replace(/\{\{today\}\}/g, new Date().toISOString().slice(0, 10));

	let connection = null;
	let player = null;
	let outputStream = null;
	let session = null;
	let resumeHandle = null;
	let closed = false;
	let goodbyePending = false;

	let idleTimer = null;
	let idleWarnTimer = null;
	let sessionTimer = null;
	let sessionWarnTimer = null;
	let heartbeat = null;

	const playbackQueue = [];
	let pending = EMPTY;
	let pendingOffset = 0;
	let lastAudioAt = 0;
	let turnOpen = false;
	let turnTimer = null;
	let reconnecting = false;
	let closeWaiter = null;
	let leaveRequested = false;

	const stats = {
		chunksPlayed: 0,
		chunksDropped: 0,
		bytesOut: 0,
		bytesIn: 0,
		framesIn: 0,
		framesOut: 0,
		silenceOut: 0,
		framesDropped: 0,
		interrupts: 0,
		reconnects: 0,
		turns: 0,
		queueHigh: 0
	};

	async function say(text) {
		if (!session || goodbyePending) return;
		closeTurn();
		goodbyePending = true;
		try {
			session.sendRealtimeInput({ text });
			setTimeout(() => stop('goodbye_finished'), GOODBYE_GRACE_MS);
		} catch {
			await stop('goodbye_failed');
		}
	}

	function clearTimers() {
		for (const t of [idleTimer, idleWarnTimer, sessionTimer, sessionWarnTimer, turnTimer]) if (t) clearTimeout(t);
		turnTimer = null;
		if (heartbeat) clearInterval(heartbeat);
		idleTimer = idleWarnTimer = sessionTimer = sessionWarnTimer = heartbeat = null;
	}

	function touchIdle() {
		if (goodbyePending) return;
		if (idleTimer) clearTimeout(idleTimer);
		if (idleWarnTimer) clearTimeout(idleWarnTimer);
		idleWarnTimer = setTimeout(() => say(IDLE_GOODBYE_PROMPT), IDLE_WARN_MS);
		idleTimer = setTimeout(() => stop('idle_timeout'), IDLE_TIMEOUT_MS);
	}

	const transcriptBuffer = { user: '', assistant: '' };

	function flushTranscript(role) {
		const text = transcriptBuffer[role].trim();
		transcriptBuffer[role] = '';
		if (text.length < 2) return;
		db.appendBotAiMessage(botId, guildId, inviterId, role, text).catch(() => {});
	}

	function collectTranscript(role, fragment) {
		const other = role === 'user' ? 'assistant' : 'user';
		if (transcriptBuffer[other].trim()) flushTranscript(other);

		transcriptBuffer[role] += fragment;
		if (/[.!?]\s*$/.test(fragment) || transcriptBuffer[role].length > 1500) flushTranscript(role);
	}

	function botIsSpeaking() {
		return playbackQueue.length > 0 || pendingOffset < pending.length || Date.now() - lastAudioAt < SPEAK_GUARD_MS;
	}

	function openTurn() {
		if (turnOpen) return;
		turnOpen = true;
		stats.turns++;
		try {
			session.sendRealtimeInput({ activityStart: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn start (#${stats.turns})`);
	}

	function closeTurn() {
		if (!turnOpen || !session) return;
		turnOpen = false;
		if (turnTimer) {
			clearTimeout(turnTimer);
			turnTimer = null;
		}
		try {
			session.sendRealtimeInput({ activityEnd: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn end (#${stats.turns} frames=${stats.framesIn})`);
	}

	function bumpTurn() {
		if (turnTimer) clearTimeout(turnTimer);
		turnTimer = setTimeout(closeTurn, TURN_SILENCE_MS);
	}

	function playChunk(pcm24k) {
		if (closed) {
			stats.chunksDropped++;
			return;
		}
		playbackQueue.push(downmixAndResample(pcm24k, OUTPUT_RATE, DISCORD_RATE, 1, 2));
		stats.chunksPlayed++;
		lastAudioAt = Date.now();

		if (playbackQueue.length > stats.queueHigh) stats.queueHigh = playbackQueue.length;
		while (playbackQueue.length > MAX_QUEUED_CHUNKS) {
			playbackQueue.shift();
			stats.chunksDropped++;
			if (stats.chunksDropped % 25 === 1) logger.log(`⚠️ Voice AI playback queue over ${MAX_QUEUED_CHUNKS}, dropping oldest (high=${stats.queueHigh})`);
		}

		touchIdle();
	}

	function handleInterrupt() {
		stats.interrupts++;
		const cleared = playbackQueue.length;
		playbackQueue.length = 0;
		pending = EMPTY;
		pendingOffset = 0;
		logger.log(`🔊 Voice AI interrupted (cleared=${cleared} played=${stats.chunksPlayed})`);
	}

	function nextFrame() {
		const frame = Buffer.alloc(FRAME_BYTES);
		let filled = 0;

		while (filled < FRAME_BYTES) {
			if (pendingOffset >= pending.length) {
				const next = playbackQueue.shift();
				if (!next) break;
				pending = next;
				pendingOffset = 0;
			}
			const take = Math.min(FRAME_BYTES - filled, pending.length - pendingOffset);
			pending.copy(frame, filled, pendingOffset, pendingOffset + take);
			pendingOffset += take;
			filled += take;
		}

		stats.bytesOut += filled;
		stats.framesOut++;
		if (filled === 0) stats.silenceOut++;
		else lastAudioAt = Date.now();
		if (stats.framesOut % 500 === 0) {
			logger.log(`🔈 Voice AI ticker frames=${stats.framesOut} silence=${stats.silenceOut} audioBytes=${stats.bytesOut} queued=${playbackQueue.length}`);
		}
		return frame;
	}

	function startOutput() {
		outputStream = new Readable({
			highWaterMark: FRAME_BYTES * 8,
			read() {
				if (closed) {
					this.push(null);
					return;
				}
				this.push(nextFrame());
			}
		});
		outputStream.on('error', (err) => {
			if (closed) return;
			logger.log(`❌ Voice AI output stream error: ${err?.message || err}`);
		});

		const resource = createAudioResource(outputStream, { inputType: StreamType.Raw });
		player.play(resource);
		logger.log('🔊 Voice AI output stream started');
	}

	function handleToolCall(calls) {
		const responses = calls.map((call) => ({ id: call.id, name: call.name, response: { ok: true } }));

		try {
			session.sendToolResponse({ functionResponses: responses });
		} catch (err) {
			logger.log(`⚠️ Voice AI tool response failed: ${String(err)}`);
		}

		if (calls.some((call) => call.name === 'leave_voice')) {
			logger.log('🎙️ Voice AI leave requested by voice');
			leaveRequested = true;
			closeTurn();
			setTimeout(() => stop('user_request_voice'), GOODBYE_GRACE_MS);
		}
	}

	async function connectLive() {
		session = await genai.live.connect({
			model: config.voice_model,
			config: {
				responseModalities: [Modality.AUDIO],
				...(config.voice_name ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice_name } } } } : {}),
				...(systemInstruction ? { systemInstruction } : {}),
				inputAudioTranscription: {},
				outputAudioTranscription: {},
				contextWindowCompression: { slidingWindow: {} },
				sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
				realtimeInputConfig: {
					automaticActivityDetection: { disabled: true }
				},
				tools: [
					{
						functionDeclarations: [
							{
								name: 'leave_voice',
								description:
									'Leave the voice channel and end the call. Call this when the user asks you to leave, disconnect, hang up, go away, or says goodbye.',
								parameters: { type: Type.OBJECT, properties: {} }
							}
						]
					}
				]
			},
			callbacks: {
				onopen: () => logger.log(`🔊 Voice AI live session open (model=${config.voice_model})`),
				onmessage: (msg) => {
					if (msg.sessionResumptionUpdate?.newHandle) resumeHandle = msg.sessionResumptionUpdate.newHandle;
					if (msg.goAway) {
						logger.log(`⚠️ Voice AI goAway, timeLeft=${msg.goAway.timeLeft ?? '?'}`);
						reconnect().catch(() => {});
					}

					if (msg.toolCall?.functionCalls?.length) {
						handleToolCall(msg.toolCall.functionCalls);
						return;
					}

					const sc = msg.serverContent;
					if (!sc) return;

					if (sc.interrupted) {
						handleInterrupt();
						return;
					}

					for (const part of sc.modelTurn?.parts ?? []) {
						if (part.inlineData?.data) playChunk(Buffer.from(part.inlineData.data, 'base64'));
					}

					if (sc.inputTranscription?.text) collectTranscript('user', sc.inputTranscription.text);
					if (sc.outputTranscription?.text) collectTranscript('assistant', sc.outputTranscription.text);
				},
				onerror: (err) => logger.log(`❌ Voice AI session error: ${err?.message || String(err)}`),
				onclose: (e) => {
					logger.log(`🔊 Voice AI live session closed: ${e?.reason || 'no reason'} (closed=${closed} goodbye=${goodbyePending})`);
					if (closeWaiter) {
						closeWaiter();
						return;
					}
					if (!closed && !goodbyePending) reconnect().catch(() => {});
				}
			}
		});
	}

	async function reconnect() {
		if (closed || goodbyePending || reconnecting) return;
		reconnecting = true;
		stats.reconnects++;
		logger.log(`🔊 Voice AI reconnecting (attempt=${stats.reconnects} resume=${resumeHandle ? 'yes' : 'no'})`);

		turnOpen = false;
		if (turnTimer) {
			clearTimeout(turnTimer);
			turnTimer = null;
		}

		const old = session;
		session = null;
		if (old) {
			await new Promise((resolve) => {
				const done = setTimeout(resolve, CLOSE_WAIT_MS);
				closeWaiter = () => {
					clearTimeout(done);
					resolve(undefined);
				};
				try {
					old.close();
				} catch {
					clearTimeout(done);
					resolve(undefined);
				}
			});
			closeWaiter = null;
		}

		try {
			await connectLive();
		} catch (err) {
			logger.log(`❌ Voice AI reconnect failed: ${String(err)}`);
			await stop('reconnect_failed');
		} finally {
			reconnecting = false;
		}
	}

	function subscribeUser(userId) {
		if (speaking.has(userId)) return;

		const opus = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
		const decoder = new prism.opus.Decoder({ rate: DISCORD_RATE, channels: 2, frameSize: 960 });

		decoder.on('data', (pcm) => {
			if (closed || !session || goodbyePending || leaveRequested || botIsSpeaking()) {
				stats.framesDropped++;
				return;
			}
			const mono16k = downmixAndResample(pcm, DISCORD_RATE, INPUT_RATE, 2, 1);
			try {
				openTurn();
				session.sendRealtimeInput({ audio: { data: mono16k.toString('base64'), mimeType: `audio/pcm;rate=${INPUT_RATE}` } });
				stats.framesIn++;
				stats.bytesIn += mono16k.length;
				bumpTurn();
				if (stats.framesIn % 250 === 0) {
					logger.log(
						`🎙️ Voice AI in=${stats.framesIn}f/${stats.bytesIn}b out=${stats.chunksPlayed}c/${stats.bytesOut}b dropped=${stats.framesDropped}/${stats.chunksDropped}`
					);
				}
				touchIdle();
			} catch (err) {
				stats.framesDropped++;
				if (stats.framesDropped % 100 === 1) logger.log(`⚠️ Voice AI input dropped: ${String(err)}`);
			}
		});
		decoder.on('error', () => {});

		opus.pipe(decoder);
		speaking.set(userId, { opus, decoder });
	}

	function unsubscribeUser(userId) {
		const entry = speaking.get(userId);
		if (!entry) return;
		entry.opus.destroy();
		entry.decoder.destroy();
		speaking.delete(userId);
	}

	async function stop(reason) {
		if (closed) return;
		closed = true;
		clearTimers();

		flushTranscript('user');
		flushTranscript('assistant');

		for (const userId of [...speaking.keys()]) unsubscribeUser(userId);

		try {
			session?.close();
		} catch {}
		try {
			player?.stop();
			connection?.destroy();
		} catch {}

		await clearVoiceState(botId);
		await logger.log(
			`🔇 Voice AI left ${channelName || channelId} (${reason}) turns=${stats.turns} in=${stats.framesIn}f out=${stats.chunksPlayed}c dropped=${stats.framesDropped}/${stats.chunksDropped} queueHigh=${stats.queueHigh} interrupts=${stats.interrupts} reconnects=${stats.reconnects}`
		);
		onEnded?.(reason);
	}

	async function start() {
		const guild = client.guilds.cache.get(guildId);
		if (!guild) throw new Error('Guild not available');

		connection = joinVoiceChannel({
			channelId,
			guildId,
			adapterCreator: guild.voiceAdapterCreator,
			selfDeaf: false,
			selfMute: false
		});

		await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

		player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
		connection.subscribe(player);
		player.on('error', (err) => logger.log(`❌ Voice AI player error: ${err?.message || err}`));
		player.on('stateChange', (oldState, newState) => {
			if (closed || oldState.status === newState.status) return;
			logger.log(
				`🔊 Voice AI player ${oldState.status} -> ${newState.status} (frames=${stats.framesOut} silence=${stats.silenceOut} queued=${playbackQueue.length})`
			);
			if (newState.status === AudioPlayerStatus.Idle && !goodbyePending) {
				logger.log('⚠️ Voice AI player went idle unexpectedly, restarting output');
				startOutput();
			}
		});
		startOutput();

		await connectLive();

		connection.receiver.speaking.on('start', (userId) => {
			if (userId !== client.user?.id) subscribeUser(userId);
		});
		connection.receiver.speaking.on('end', () => touchIdle());

		const channel = guild.channels.cache.get(channelId);
		for (const [memberId, member] of channel?.members ?? []) {
			if (!member.user.bot && memberId !== client.user?.id) subscribeUser(memberId);
		}

		touchIdle();
		sessionWarnTimer = setTimeout(() => say(TIMEUP_GOODBYE_PROMPT), SESSION_WARN_MS);
		sessionTimer = setTimeout(() => stop('session_limit'), SESSION_MAX_MS);

		const state = { guildId, channelId, channelName, inviterId, textChannelId, startedAt: Date.now() };
		await writeVoiceState(botId, state);
		heartbeat = setInterval(() => {
			if (!closed) writeVoiceState(botId, state).catch(() => {});
		}, HEARTBEAT_MS);

		await logger.log(`🔊 Voice AI joined ${channelName || channelId}`);
	}

	return {
		start,
		stop,
		subscribeUser,
		unsubscribeUser,
		get inviterId() {
			return inviterId;
		},
		get channelId() {
			return channelId;
		}
	};
}
