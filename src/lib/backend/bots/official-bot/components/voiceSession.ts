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
import { getEnabledWikis, buildWikiDeclaration, runWikiTool } from './wiki.js';
import { wakeModelAvailable, warmWakeModel, onWakeDetected, pushWakeAudio, dropWakeUser } from './wakeWord.js';

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DISCORD_RATE = 48000;

const FRAME_MS = 20;
const FRAME_BYTES = (DISCORD_RATE / 1000) * FRAME_MS * 2 * 2;
const EMPTY = Buffer.alloc(0);

const SPEAK_GUARD_MS = 400;
const TURN_SILENCE_MS = 700;
const VOICE_RMS_THRESHOLD = 900;
const VOICE_RMS_CEILING = 2_200;
const VOICE_RMS_RELEASE = 550;
const VOICE_ONSET_FRAMES = 3;
const VOICE_HANG_MS = 500;
const SPEECH_RECENT_MS = 3_000;
const NOISE_FLOOR_ALPHA = 0.002;
const NOISE_FLOOR_FALL_ALPHA = 0.05;
const NOISE_FLOOR_MARGIN = 2.2;
const MAX_TURN_MS = 60_000;
const CLOSE_WAIT_MS = 3000;
const MAX_QUEUED_CHUNKS = 60;

const GOODBYE_GRACE_MS = 12_000;
const ADDRESSED_WINDOW_MS = 15_000;
const MUTE_NOTICE_GRACE_MS = 6_000;
const MUTE_NOTICE_MAX_WAIT_MS = 15_000;
const HEARTBEAT_MS = (VOICE_STATE_TTL_SEC / 2) * 1000;

const WIKI_STALL_MS = 600;
const WIKI_STALL_GRACE_MS = 2_500;
const WIKI_TIMEOUT_MS = 12_000;
const SPEECH_DRAIN_MAX_MS = 20_000;

const WIKI_STALL_PROMPT =
	'[System] You are still looking that up. Say one short, natural line out loud right now to let them know you are checking, in the same language they are speaking — something like "let me check that" or "one sec". Say nothing else, do not guess the answer, and do not read this note aloud. The result arrives in a moment and you will answer properly then.';

const WIKI_FAILED_PROMPT =
	'[System] The wiki lookup failed and you have no result. Say one short line out loud right now telling them you could not reach the wiki and cannot check that at the moment, in the same language they are speaking. Do not guess, do not state any fact about the game, and do not read this note aloud.';

const WAKE_ACK_PROMPT =
	'[System] Someone just said the wake phrase and you are now listening. Say one very short acknowledgement out loud right now — just "yes?" or the equivalent in the language this server speaks. Two words at most. Do not answer anything yet, do not ask what they need, and do not read this note aloud.';

function rmsOf(pcm) {
	const samples = Math.floor(pcm.length / 2);
	if (!samples) return 0;
	let sum = 0;
	for (let i = 0; i < samples; i++) {
		const s = pcm.readInt16LE(i * 2);
		sum += s * s;
	}
	return Math.sqrt(sum / samples);
}

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

	let wikis: any[] = [];

	let connection: any = null;
	let player = null;
	let outputStream = null;
	let session = null;
	let resumeHandle = null;
	let closed = false;
	let goodbyePending = false;

	let heartbeat = null;

	const playbackQueue = [];
	let pending = EMPTY;
	let pendingOffset = 0;
	let lastAudioAt = 0;
	let wasPlaying = false;
	let turnOpen = false;
	let turnOpenedAt = 0;
	let turnTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnecting = false;
	let closeWaiter = null;
	let leaveRequested = false;
	let lastSpeakerId = '';
	let lockedSpeakerId = '';
	let turnOwnerId = '';
	let addressedUntil = 0;
	let selfMuted = false;
	let muteTimer: ReturnType<typeof setTimeout> | null = null;
	let muteAnnounced = false;
	let goodbyeAllowedUntil = 0;
	let speakAllowedUntil = 0;
	let offWakeDetected: (() => void) | null = null;

	const names = new Map();
	const ignoredBots = new Set();
	const voiceState = new Map();

	function isAddressed() {
		return Date.now() < addressedUntil;
	}

	function markAddressed({ verified = false } = {}) {
		const wasAddressed = isAddressed();

		if (muteAnnounced && !verified) {
			logger.log('🚦 Voice AI ignoring un-named wake during mute announcement');
			return wasAddressed;
		}

		const speaker = lastSpeakerId || loudestActiveSpeaker();
		if (!lockedSpeakerId && speaker) {
			lockedSpeakerId = speaker;
			logger.log(`🔒 Voice AI locked onto ${nameOf(lockedSpeakerId)} for this conversation`);
		} else if (!lockedSpeakerId) {
			logger.log('⚠️ Voice AI addressed but no speaker identified yet, staying open to anyone');
		} else if (speaker && speaker !== lockedSpeakerId && !wasAddressed) {
			logger.log(`🔄 Voice AI re-locking from ${nameOf(lockedSpeakerId)} to ${nameOf(speaker)}`);
			lockedSpeakerId = speaker;
		}

		addressedUntil = Date.now() + ADDRESSED_WINDOW_MS;
		muteAnnounced = false;
		setSelfMute(false);
		if (muteTimer) clearTimeout(muteTimer);
		muteTimer = setTimeout(announceMute, ADDRESSED_WINDOW_MS);
		return wasAddressed;
	}

	function finishConversation() {
		if (closed || goodbyePending) return;

		addressedUntil = 0;

		if (muteAnnounced && Date.now() <= goodbyeAllowedUntil) {
			logger.log('🔕 Voice AI already saying goodbye, letting it finish before muting');
			return;
		}

		if (muteTimer) clearTimeout(muteTimer);
		muteTimer = null;

		afterSpeaking('muting', () => {
			if (closed || isAddressed()) return;
			logger.log('🔇 Voice AI finished speaking, muting now');
			playbackQueue.length = 0;
			pending = EMPTY;
			pendingOffset = 0;

			releaseSpeakerLock();
			setSelfMute(true);
		});
	}

	function loudestActiveSpeaker() {
		let best = '';
		let bestAt = 0;
		for (const [userId, vad] of voiceState) {
			if (!vad.active || isBotUser(userId)) continue;
			if (vad.startedAt >= bestAt) {
				bestAt = vad.startedAt;
				best = userId;
			}
		}
		return best;
	}

	function keepAliveFromLockedSpeaker() {
		if (!lockedSpeakerId || goodbyePending || muteAnnounced) return;
		if (!isAddressed()) logger.log(`🔁 Voice AI re-opening window, ${nameOf(lockedSpeakerId)} is still talking`);
		extendAddressedWindow();
	}

	function extendWhileReplying() {
		if (!isAddressed() || goodbyePending || muteAnnounced) return;
		extendAddressedWindow();
	}

	function extendAddressedWindow() {
		addressedUntil = Date.now() + ADDRESSED_WINDOW_MS;
		muteAnnounced = false;
		if (muteTimer) clearTimeout(muteTimer);
		muteTimer = setTimeout(announceMute, ADDRESSED_WINDOW_MS);
	}

	function releaseSpeakerLock() {
		if (!lockedSpeakerId) return;
		logger.log(`🔓 Voice AI released lock on ${nameOf(lockedSpeakerId)}, open to anyone`);
		lockedSpeakerId = '';
	}

	function micIsOpenFor(userId) {
		if (!lockedSpeakerId) return true;
		if (userId === lockedSpeakerId) return true;
		return !isAddressed() && !muteAnnounced;
	}

	function announceMute() {
		muteTimer = null;
		if (closed || goodbyePending || selfMuted || muteAnnounced) return;

		if (botIsSpeaking()) {
			extendAddressedWindow();
			return;
		}

		if (isAddressed()) {
			muteTimer = setTimeout(announceMute, Math.max(SPEAK_GUARD_MS, addressedUntil - Date.now()));
			return;
		}

		muteAnnounced = true;
		const announcedAt = Date.now();
		const chunksAtAnnounce = stats.chunksPlayed;
		goodbyeAllowedUntil = announcedAt + MUTE_NOTICE_MAX_WAIT_MS;
		logger.log('🔕 Voice AI announcing mute before going quiet');
		sendSystemNote(
			`Say one short sentence out loud now: it has gone quiet, so you are muting yourself, and they just need to say "hey stupid" whenever they want you again. One sentence, casual, no explanation.`
		);
		muteTimer = setTimeout(function settleMute() {
			muteTimer = null;
			if (closed || selfMuted) return;

			const spoke = stats.chunksPlayed > chunksAtAnnounce;
			const waited = Date.now() - announcedAt;
			const expired = waited >= MUTE_NOTICE_MAX_WAIT_MS;

			if (!expired && (botIsSpeaking() || !spoke)) {
				muteTimer = setTimeout(settleMute, SPEAK_GUARD_MS);
				return;
			}

			if (expired && botIsSpeaking()) {
				logger.log('⚠️ Voice AI cutting off playback to finish muting');
				playbackQueue.length = 0;
				pending = EMPTY;
				pendingOffset = 0;
			}

			releaseSpeakerLock();
			setSelfMute(true);
		}, MUTE_NOTICE_GRACE_MS);
	}

	function announceWakePhrase() {
		if (closed || goodbyePending) return;

		const announcedAt = Date.now();
		const chunksAtAnnounce = stats.chunksPlayed;
		speakAllowedUntil = announcedAt + MUTE_NOTICE_MAX_WAIT_MS;
		logger.log('👋 Voice AI greeting the channel with the wake phrase');
		sendSystemNote(
			`Say one short sentence out loud right now to greet the channel: you have joined, you are going quiet, and anyone can wake you by saying "hey stupid". Say the wake phrase clearly so they hear exactly what to say. One casual sentence in the language this server speaks, no explanation, and do not read this note aloud.`
		);

		muteTimer = setTimeout(function settleGreeting() {
			muteTimer = null;
			if (closed || selfMuted || isAddressed()) return;

			const spoke = stats.chunksPlayed > chunksAtAnnounce;
			const waited = Date.now() - announcedAt;
			const expired = waited >= MUTE_NOTICE_MAX_WAIT_MS;

			if (!expired && (botIsSpeaking() || !spoke)) {
				muteTimer = setTimeout(settleGreeting, SPEAK_GUARD_MS);
				return;
			}

			if (expired && !spoke) logger.log('⚠️ Voice AI never spoke its greeting, muting anyway');
			setSelfMute(true);
		}, MUTE_NOTICE_GRACE_MS);
	}

	function nameOf(userId) {
		if (names.has(userId)) return names.get(userId);
		const member = client.guilds.cache.get(guildId)?.members?.cache?.get(userId);
		const name = member?.displayName || member?.user?.username || 'Unknown';
		names.set(userId, name);
		return name;
	}

	function rosterText() {
		const channel = client.guilds.cache.get(guildId)?.channels?.cache?.get(channelId);
		const people = [...(channel?.members ?? [])]
			.filter(([id, m]) => !m.user.bot && id !== client.user?.id)
			.map(([id]) => (id === inviterId ? `${nameOf(id)} (invited you)` : nameOf(id)));
		return people.length ? people.join(', ') : 'nobody';
	}

	function sendSystemNote(text) {
		if (!session || closed || goodbyePending) return;
		try {
			session.sendRealtimeInput({ text });
		} catch {}
	}

	function announceRoster() {
		sendSystemNote(`[System] People currently in the voice channel: ${rosterText()}. Address them by name when it feels natural. Do not read this note aloud.`);
	}

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
		queueHigh: 0,
		repliesSuppressed: 0,
		framesAsleep: 0,
		framesNoise: 0,
		framesOffTurn: 0
	};

	async function say(text) {
		if (!session || goodbyePending) return;
		closeTurn();
		goodbyePending = true;
		setSelfMute(false);
		try {
			session.sendRealtimeInput({ text });
			setTimeout(() => stop('goodbye_finished'), GOODBYE_GRACE_MS);
		} catch {
			await stop('goodbye_failed');
		}
	}

	function clearTimers() {
		for (const t of [turnTimer, muteTimer]) if (t) clearTimeout(t);
		turnTimer = muteTimer = null;
		if (heartbeat) clearInterval(heartbeat);
		heartbeat = null;
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

	function afterSpeaking(label, run, { graceMs = 0, maxWaitMs = SPEECH_DRAIN_MAX_MS } = {}) {
		const startedAt = Date.now();
		const chunksAtStart = stats.chunksPlayed;

		(function wait() {
			if (closed) return;

			const elapsed = Date.now() - startedAt;
			const spoke = stats.chunksPlayed > chunksAtStart;

			if ((botIsSpeaking() || (!spoke && elapsed < graceMs)) && elapsed < maxWaitMs) {
				setTimeout(wait, SPEAK_GUARD_MS);
				return;
			}

			if (elapsed >= maxWaitMs && botIsSpeaking()) {
				logger.log(`⚠️ Voice AI still speaking after ${Math.round(maxWaitMs / 1000)}s, continuing with ${label}`);
			}

			run();
		})();
	}

	function openTurn() {
		if (turnOpen) return;
		turnOpen = true;
		turnOpenedAt = Date.now();
		stats.turns++;
		try {
			session.sendRealtimeInput({ activityStart: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn start (#${stats.turns})`);
	}

	function closeTurn() {
		if (!turnOpen || !session) return;
		turnOpen = false;
		turnOwnerId = '';
		if (turnTimer) {
			clearTimeout(turnTimer);
			turnTimer = null;
		}
		try {
			session.sendRealtimeInput({ activityEnd: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn end (#${stats.turns} frames=${stats.framesIn})`);
	}

	function anyoneSpeaking() {
		for (const [userId, vad] of voiceState) {
			if (vad.active && micIsOpenFor(userId) && (!turnOwnerId || userId === turnOwnerId)) return true;
		}
		return false;
	}

	function claimTurnFor(userId) {
		if (!isAddressed()) return true;
		if (!turnOwnerId || turnOwnerId === userId) {
			turnOwnerId = userId;
			return true;
		}
		const owner = voiceState.get(turnOwnerId);
		if (!owner?.active) {
			turnOwnerId = userId;
			return true;
		}
		return false;
	}

	function bumpTurn() {
		if (turnTimer) clearTimeout(turnTimer);
		turnTimer = setTimeout(function settle() {
			const elapsed = Date.now() - turnOpenedAt;

			if (anyoneSpeaking() && elapsed < MAX_TURN_MS) {
				turnTimer = setTimeout(settle, TURN_SILENCE_MS);
				return;
			}

			if (anyoneSpeaking()) {
				logger.log(`⚠️ Voice AI turn stuck open past ${MAX_TURN_MS / 1000}s, forcing it closed`);
				for (const [userId, vad] of voiceState) {
					if (!micIsOpenFor(userId)) continue;
					vad.active = false;
					vad.onset = 0;
				}
			}
			closeTurn();
		}, TURN_SILENCE_MS);
	}

	function playChunk(pcm24k) {
		if (closed || selfMuted) {
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

		extendWhileReplying();
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

		if (selfMuted) {
			if (playbackQueue.length || pendingOffset < pending.length) {
				playbackQueue.length = 0;
				pending = EMPTY;
				pendingOffset = 0;
				stats.chunksDropped++;
				logger.log('🔇 Voice AI dropped playback that arrived while muted');
			}
			stats.framesOut++;
			stats.silenceOut++;
			return frame;
		}

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
		if (filled === 0) {
			stats.silenceOut++;
			if (wasPlaying) {
				wasPlaying = false;
				extendWhileReplying();
			}
		} else {
			lastAudioAt = Date.now();
			wasPlaying = true;
		}
		if (stats.framesOut % 500 === 0) {
			logger.log(
				`🔈 Voice AI ticker out=${stats.framesOut} silence=${stats.silenceOut} audioBytes=${stats.bytesOut} queued=${playbackQueue.length} | in=${stats.framesIn} asleep=${stats.framesAsleep} noise=${stats.framesNoise} subscribed=${voiceState.size} awake=${isAddressed()}`
			);
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

	function sendToolResponses(responses) {
		if (!responses.length || !session || closed) return;
		try {
			session.sendToolResponse({ functionResponses: responses });
		} catch (err) {
			logger.log(`⚠️ Voice AI tool response failed: ${String(err)}`);
		}
	}

	function handleToolCall(calls) {
		const wikiCalls = calls.filter((call) => call.name === 'search_wiki');
		const responses = calls.filter((call) => call.name !== 'search_wiki').map((call) => ({ id: call.id, name: call.name, response: { ok: true } }));

		sendToolResponses(responses);

		for (const call of wikiCalls) {
			if (!isAddressed()) {
				logger.log('🚫 Voice AI ignoring wiki lookup while asleep');
				sendToolResponses([{ id: call.id, name: call.name, response: { ok: false, reason: 'not_addressed' } }]);
				continue;
			}

			const query = call.args?.query ?? '';
			logger.log(`📖 Voice AI wiki lookup: "${query}" (${call.args?.wiki ?? 'default'})`);

			let settled = false;
			let stalled = false;
			const stallTimer = setTimeout(() => {
				if (settled || closed || goodbyePending || !isAddressed()) return;
				logger.log('⏳ Voice AI stalling out loud while the wiki lookup runs');
				stalled = true;
				extendAddressedWindow();
				sendSystemNote(WIKI_STALL_PROMPT);
			}, WIKI_STALL_MS);

			const keepAwake = setInterval(() => {
				if (settled || closed || goodbyePending) {
					clearInterval(keepAwake);
					return;
				}
				extendAddressedWindow();
			}, ADDRESSED_WINDOW_MS / 3);

			const finish = (response) => {
				if (settled) return;
				settled = true;
				clearTimeout(stallTimer);
				clearInterval(keepAwake);
				extendAddressedWindow();

				if (response?.ok === false) logger.log(`❌ Voice AI wiki lookup unusable: ${response.reason}`);

				const send = () => {
					if (closed) return;
					extendAddressedWindow();
					sendToolResponses([{ id: call.id, name: call.name, response }]);
					if (response?.ok === false) sendSystemNote(WIKI_FAILED_PROMPT);
				};

				if (stalled) afterSpeaking('the wiki answer', send, { graceMs: WIKI_STALL_GRACE_MS });
				else send();
			};

			const timeoutTimer = setTimeout(() => {
				if (settled) return;
				logger.log(`⏱️ Voice AI wiki lookup timed out after ${WIKI_TIMEOUT_MS / 1000}s`);
				finish({ ok: false, reason: 'timeout' });
			}, WIKI_TIMEOUT_MS);

			runWikiTool(wikis, call.args ?? {})
				.then((response) => {
					clearTimeout(timeoutTimer);
					finish(response);
				})
				.catch((err) => {
					clearTimeout(timeoutTimer);
					logger.log(`❌ Voice AI wiki lookup failed: ${String(err)}`);
					finish({ ok: false, reason: 'lookup_failed' });
				});
		}

		if (calls.some((call) => call.name === 'conversation_done')) {
			if (!isAddressed()) {
				logger.log('🚫 Voice AI ignoring done request while asleep');
				return;
			}

			if (lockedSpeakerId && lastSpeakerId && lastSpeakerId !== lockedSpeakerId) {
				logger.log(`🚫 Voice AI ignoring done request from ${nameOf(lastSpeakerId)} (talking with ${nameOf(lockedSpeakerId)})`);
			} else {
				logger.log(`✅ Voice AI done with ${nameOf(lockedSpeakerId) || 'this turn'}, releasing lock and muting`);
				finishConversation();
			}
		}

		if (calls.some((call) => call.name === 'leave_voice')) {
			if (!isAddressed()) {
				logger.log('🚫 Voice AI ignoring leave request while asleep (nobody said the wake phrase)');
				return;
			}

			if (lastSpeakerId && lastSpeakerId !== inviterId) {
				logger.log(`🚫 Voice AI ignoring leave request from ${nameOf(lastSpeakerId)} (only ${nameOf(inviterId)} can)`);
				sendSystemNote(
					`[System] ${nameOf(lastSpeakerId)} asked you to leave, but only ${nameOf(inviterId)} who invited you can end this call. Say one short line telling them that, and stay in the channel.`
				);
				return;
			}

			logger.log('🎙️ Voice AI leave requested by voice');
			leaveRequested = true;
			closeTurn();
			afterSpeaking('leaving', () => stop('user_request_voice'), { graceMs: GOODBYE_GRACE_MS });
		}
	}

	async function connectLive() {
		wikis = await getEnabledWikis(botId).catch(() => []);
		const wikiDeclaration = buildWikiDeclaration(wikis);
		if (wikiDeclaration) logger.log(`📚 Voice AI wiki lookup available: ${wikis.map((w) => w.name).join(', ')}`);

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
								name: 'conversation_done',
								description:
									'Stop listening and mute yourself immediately, while STAYING in the voice channel. Call this when the person you are currently talking with signals they are finished with you: "that is all", "done", "thanks, that is it", "mute yourself", "you can rest now", "okay that is enough". Call it straight away without saying anything back — you go silent the instant you call it, so any words would be cut off. Do NOT call it for a mid-conversation "ok" or "thanks" that is just filler while they keep talking to you, and do NOT use it when they want you to leave the channel entirely — that is leave_voice.',
								parameters: { type: Type.OBJECT, properties: {} }
							},
							{
								name: 'leave_voice',
								description:
									'Leave the voice channel and end the call. Only usable while you are awake — if nobody has said the wake phrase, you are asleep and must never call this. Call it when the person talking to you asks you to leave, disconnect or hang up, or says a real farewell meant to end the conversation ("goodbye", "see you later", "bye, talk to you tomorrow"). Say your own short goodbye out loud first, then call this. Do NOT call it for filler like "ok", "thanks", "alright", "hmm", for a pause in conversation, or when people say bye to each other rather than to you.',
								parameters: { type: Type.OBJECT, properties: {} }
							},
							...(wikiDeclaration
								? [
										{
											name: wikiDeclaration.name,
											description: wikiDeclaration.description,
											parameters: {
												type: Type.OBJECT,
												properties: {
													wiki: { type: Type.STRING, enum: wikis.map((w) => w.name), description: 'Which wiki to search.' },
													query: { type: Type.STRING, description: 'The item, fish, place or mechanic to look up. Keep it short.' },
													page: { type: Type.STRING, description: 'Optional exact page title to open directly, when you already know it.' },
													main_page: {
														type: Type.BOOLEAN,
														description:
															'Set true for anything current or newest — latest version, current update, versi terbaru, active event, current season. Searching those words returns an old page; the front page states the live version.'
													}
												},
												required: ['wiki', 'query']
											}
										}
									]
								: [])
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

					if (sc.interrupted) handleInterrupt();

					if (sc.inputTranscription?.text) collectTranscript('user', sc.inputTranscription.text);

					if (!isAddressed() && Date.now() > goodbyeAllowedUntil && Date.now() > speakAllowedUntil) {
						if (sc.modelTurn?.parts?.some((p) => p.inlineData?.data)) {
							stats.repliesSuppressed++;
							if (stats.repliesSuppressed % 10 === 1) {
								logger.log(`🙊 Voice AI staying silent, not addressed (suppressed=${stats.repliesSuppressed})`);
							}
						}
						return;
					}

					for (const part of sc.modelTurn?.parts ?? []) {
						if (part.inlineData?.data) playChunk(Buffer.from(part.inlineData.data, 'base64'));
					}

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
		turnOwnerId = '';
		for (const vad of voiceState.values()) {
			vad.active = false;
			vad.onset = 0;
		}
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

	function isBotUser(userId) {
		if (userId === client.user?.id) return true;
		const member = client.guilds.cache.get(guildId)?.members?.cache?.get(userId);
		if (member) return Boolean(member.user?.bot);
		return Boolean(client.users.cache.get(userId)?.bot);
	}

	function subscribeUser(userId) {
		if (speaking.has(userId)) return;
		if (isBotUser(userId)) {
			if (!ignoredBots.has(userId)) {
				ignoredBots.add(userId);
				logger.log(`🤖 Voice AI ignoring bot audio from ${nameOf(userId)}`);
			}
			return;
		}

		const opus = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
		const decoder = new prism.opus.Decoder({ rate: DISCORD_RATE, channels: 2, frameSize: 960 });

		const vad = { active: false, onset: 0, lastVoiceAt: 0, floor: 0, frames: 0, startedAt: 0 };
		voiceState.set(userId, vad);

		decoder.on('data', (pcm) => {
			if (closed || !session || goodbyePending || leaveRequested) {
				stats.framesDropped++;
				return;
			}

			const mono16k = downmixAndResample(pcm, DISCORD_RATE, INPUT_RATE, 2, 1);
			const rms = rmsOf(mono16k);

			if (botIsSpeaking()) {
				stats.framesDropped++;
				if (userId === lockedSpeakerId && rms >= VOICE_RMS_THRESHOLD) keepAliveFromLockedSpeaker();
				return;
			}

			const now = Date.now();
			const discordSpeaking = connection.receiver.speaking.users.has(userId);

			pushWakeAudio(userId, mono16k);

			if (!isAddressed()) {
				stats.framesAsleep++;
				return;
			}

			vad.frames++;
			if (!vad.active) {
				if (!vad.floor) vad.floor = rms;
				else if (rms < vad.floor) vad.floor += NOISE_FLOOR_FALL_ALPHA * (rms - vad.floor);
				else vad.floor += NOISE_FLOOR_ALPHA * (rms - vad.floor);
			}

			const openAt = Math.min(VOICE_RMS_CEILING, Math.max(VOICE_RMS_THRESHOLD, vad.floor * NOISE_FLOOR_MARGIN));

			if (rms >= openAt && discordSpeaking) {
				vad.onset++;
				vad.lastVoiceAt = now;
			} else if (vad.active && rms >= Math.min(VOICE_RMS_RELEASE, openAt * 0.6)) {
				vad.lastVoiceAt = now;
			} else {
				vad.onset = 0;
			}

			if (!vad.active && vad.onset >= VOICE_ONSET_FRAMES) {
				vad.active = true;
				vad.startedAt = now;
				logger.log(`🗣️ Voice AI speech from ${nameOf(userId)} (rms=${Math.round(rms)} floor=${Math.round(vad.floor)})`);
			}

			if (vad.active && now - vad.lastVoiceAt > VOICE_HANG_MS) {
				vad.active = false;
				vad.onset = 0;
			}

			if (userId === lockedSpeakerId && now - vad.lastVoiceAt < SPEECH_RECENT_MS) keepAliveFromLockedSpeaker();

			if (!vad.active) {
				stats.framesNoise++;
				return;
			}

			if (!micIsOpenFor(userId)) {
				stats.framesOffTurn++;
				if (stats.framesOffTurn % 250 === 1) {
					logger.log(`🙉 Voice AI ignoring ${nameOf(userId)} while talking with ${nameOf(lockedSpeakerId)}`);
				}
				return;
			}

			if (!claimTurnFor(userId)) {
				stats.framesOffTurn++;
				if (stats.framesOffTurn % 250 === 1) {
					logger.log(`⏳ Voice AI deferring ${nameOf(userId)} until ${nameOf(turnOwnerId)} finishes this turn`);
				}
				return;
			}

			try {
				if (userId !== lastSpeakerId) {
					lastSpeakerId = userId;
					if (isAddressed()) sendSystemNote(`[System] ${nameOf(userId)} is now speaking.`);
				}
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
		voiceState.delete(userId);
		dropWakeUser(userId);
		if (turnOwnerId === userId) turnOwnerId = '';
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

		offWakeDetected?.();
		offWakeDetected = null;

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
			`🔇 Voice AI left ${channelName || channelId} (${reason}) turns=${stats.turns} in=${stats.framesIn}f out=${stats.chunksPlayed}c dropped=${stats.framesDropped}/${stats.chunksDropped} noise=${stats.framesNoise} asleep=${stats.framesAsleep} offTurn=${stats.framesOffTurn} suppressed=${stats.repliesSuppressed} queueHigh=${stats.queueHigh} interrupts=${stats.interrupts} reconnects=${stats.reconnects}`
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

		const wakePending = wakeModelAvailable() ? warmWakeModel().catch(() => false) : Promise.resolve(false);

		offWakeDetected = onWakeDetected((userId, score) => {
			if (closed || isAddressed() || isBotUser(userId)) return;
			lastSpeakerId = userId;
			logger.log(`👋 Voice AI woken by ${nameOf(userId)} ("hey stupid" ${score.toFixed(2)})`);
			markAddressed({ verified: true });
			sendSystemNote(WAKE_ACK_PROMPT);
		});

		await connectLive();

		connection.receiver.speaking.on('start', (userId) => {
			if (userId !== client.user?.id) subscribeUser(userId);
		});

		const channel = guild.channels.cache.get(channelId);
		for (const [memberId, member] of channel?.members ?? []) {
			if (!member.user.bot && memberId !== client.user?.id) subscribeUser(memberId);
		}

		await ensureUnmuted();
		await ensureUndeafened();

		const wakeLoaded = await wakePending;
		logger.log(`👥 Voice AI participants: ${rosterText()} | wake=${wakeLoaded ? 'hey stupid (model ready)' : 'none — bot cannot be woken'}`);

		announceRoster();
		announceWakePhrase();

		const startedAt = Date.now();
		await writeVoiceState(botId, { guildId, channelId, channelName, inviterId, textChannelId, startedAt });
		heartbeat = setInterval(() => {
			if (!closed) writeVoiceState(botId, { guildId, channelId, channelName, inviterId, textChannelId, startedAt }).catch(() => {});
		}, HEARTBEAT_MS);

		await logger.log(`🔊 Voice AI joined ${channelName || channelId}`);
	}

	async function ensureUnmuted() {
		if (closed) return;
		const me = client.guilds.cache.get(guildId)?.members?.me;
		if (!me?.voice?.serverMute) return;

		try {
			await me.voice.setMute(false, 'Voice AI needs to speak');
			logger.log('🔊 Voice AI self-unmuted after server mute');
		} catch (err) {
			logger.log(`⚠️ Voice AI is server muted and cannot unmute itself (needs Mute Members): ${err?.message || err}`);
		}
	}

	async function ensureUndeafened() {
		if (closed) return;
		const me = client.guilds.cache.get(guildId)?.members?.me;
		if (!me?.voice?.serverDeaf) return;

		try {
			await me.voice.setDeaf(false, 'Voice AI needs to hear');
			logger.log('👂 Voice AI self-undeafened after server deafen');
		} catch (err) {
			logger.log(`⚠️ Voice AI is server deafened and cannot undeafen itself (needs Deafen Members): ${err?.message || err}`);
		}
	}

	function setSelfMute(muted) {
		if (closed || selfMuted === muted) return;
		if (muted) {
			muteAnnounced = false;
			goodbyeAllowedUntil = 0;
			playbackQueue.length = 0;
			pending = EMPTY;
			pendingOffset = 0;
		}
		try {
			connection.rejoin({ channelId, selfDeaf: false, selfMute: muted });
			selfMuted = muted;
			logger.log(muted ? '🔇 Voice AI muted (not addressed)' : '🎤 Voice AI unmuted (listening)');
		} catch (err) {
			logger.log(`⚠️ Voice AI could not toggle mute: ${err?.message || err}`);
		}
	}

	async function moveTo(nextChannelId, nextChannelName) {
		if (closed || nextChannelId === channelId) return;

		channelId = nextChannelId;
		channelName = nextChannelName || nextChannelId;

		try {
			connection.rejoin({ channelId: nextChannelId, selfDeaf: false, selfMute: selfMuted });
			await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
		} catch (err) {
			logger.log(`❌ Voice AI failed to return to inviter: ${err?.message || err}`);
			await stop('rejoin_failed');
			return;
		}

		for (const userId of [...speaking.keys()]) unsubscribeUser(userId);
		const channel = client.guilds.cache.get(guildId)?.channels?.cache?.get(nextChannelId);
		for (const [memberId, member] of channel?.members ?? []) {
			if (!member.user.bot && memberId !== client.user?.id) subscribeUser(memberId);
		}

		await ensureUnmuted();
		await ensureUndeafened();
		if (lockedSpeakerId && !speaking.has(lockedSpeakerId)) releaseSpeakerLock();
		announceRoster();
		logger.log(`🔊 Voice AI followed inviter back to ${channelName}`);
	}

	function noteJoined(userId) {
		if (closed || isBotUser(userId)) return;
		names.delete(userId);
		sendSystemNote(`[System] ${nameOf(userId)} joined the voice channel.`);
	}

	function noteLeft(userId) {
		if (closed || isBotUser(userId)) return;
		const name = nameOf(userId);
		names.delete(userId);
		if (lastSpeakerId === userId) lastSpeakerId = '';
		if (lockedSpeakerId === userId) releaseSpeakerLock();
		sendSystemNote(`[System] ${name} left the voice channel.`);
	}

	return {
		start,
		stop,
		subscribeUser,
		unsubscribeUser,
		ensureUnmuted,
		ensureUndeafened,
		moveTo,
		noteJoined,
		noteLeft,
		get inviterId() {
			return inviterId;
		},
		get channelId() {
			return channelId;
		}
	};
}
