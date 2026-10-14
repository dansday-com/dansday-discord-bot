import { GoogleGenAI, Modality, Type, Behavior, InteractionStatus, ThinkingLevel, TurnCompleteReason } from '@google/genai';
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
import { AttachmentBuilder } from 'discord.js';
import prism from 'prism-media';
import { Readable } from 'node:stream';
import { aiVoiceEndpoint } from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { writeVoiceState, clearVoiceState, VOICE_STATE_TTL_SEC } from './voiceControl.js';
import { getEnabledWikis, buildWikiDeclaration, runWikiTool } from './wiki.js';
import { buildSearchDeclaration, buildFetchDeclaration, runSearchTool, runFetchTool } from './webTools.js';
import { buildImageDeclaration, runImageTool } from './imageTools.js';
import { buildServerDeclarations, runServerTool, SERVER_TOOL_NAMES } from './serverTools.js';
import { resolveToolFeatures } from './aiToolShared.js';
import { buildAccountDeclarations, runAccountTool, ACCOUNT_TOOL_NAMES } from './accountTools.js';
import { buildKnowledgeDeclarations, runKnowledgeTool, KNOWLEDGE_TOOL_NAMES } from './knowledgeTools.js';
import { appendAiMessage } from './aiSession.js';
import { aiLanguageInstruction } from '../i18n.js';
import { wakeModelAvailable, warmWakeModel, onWakeDetected, pushWakeAudio, dropWakeUser } from './wakeWord.js';
import type { AiInput, Wiki } from '../../../../database.js';
import type { FunctionDeclaration, FunctionResponse, LiveServerContent, LiveServerMessage, Session } from '@google/genai';
import type { AudioPlayer, AudioReceiveStream, VoiceConnection } from '@discordjs/voice';
import type { Client, SendableChannels, VoiceBasedChannel } from 'discord.js';
import { SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';
import { isoDay } from '../../../../utils/datetime.js';

type VoiceSessionOptions = {
	client: Client;
	config: AiInput;
	botId: number;
	guildId: string;
	channelId: string;
	channelName: string;
	inviterId: string;
	textChannelId: string | null;
	onEnded?: (reason: string) => void;
};
type VadState = { active: boolean; onset: number; lastVoiceAt: number; floor: number; frames: number; startedAt: number; barge: number };
type LiveToolCall = { id?: string; name: string; args?: Record<string, unknown> };
type LookupState = { isSettled: boolean; hasSpokenFailure: boolean };

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DISCORD_RATE = 48000;

const FRAME_MS = 20;
const FRAME_BYTES = (DISCORD_RATE / SECOND_MS) * FRAME_MS * 2 * 2;
const EMPTY = Buffer.alloc(0);

const SPEAK_GUARD_MS = 400;
const SPEECH_TAIL_MS = 250;
const KNOWN_SERVER_KEYS = new Set(['serverContent', 'toolCall', 'toolCallCancellation', 'sessionResumptionUpdate', 'usageMetadata', 'setupComplete', 'goAway']);

const TURN_SILENCE_MS = 500;
const TURN_SETTLE_MIN_MS = 40;
const VOICE_RMS_THRESHOLD = 900;
const VOICE_RMS_CEILING = 2_200;
const VOICE_RMS_RELEASE = 550;
const VOICE_ONSET_FRAMES = 3;
const VOICE_HANG_MS = 500;
const BARGE_IN_RMS_MIN = 1_800;
const BARGE_IN_RMS_MARGIN = 1.8;
const BARGE_IN_FRAMES = 6;
const BARGE_IN_DEAF_MS = 700;
const NOISE_FLOOR_ALPHA = 0.002;
const NOISE_FLOOR_FALL_ALPHA = 0.05;
const NOISE_FLOOR_MARGIN = 2.2;
const NOISE_FLOOR_HOLD = 1.4;
const NOISE_FLOOR_MAX = 400;
const MAX_TURN_MS = 60_000;
const CLOSE_WAIT_MS = 3000;
const MAX_QUEUED_CHUNKS = 300;
const MAX_CHAT_MESSAGE_CHARS = 4000;
const OUTPUT_BUFFER_FRAMES = 2;
const OUTPUT_ENCODER_FRAMES = 2;
const MAX_MISSED_FRAMES = 50;

const GOODBYE_GRACE_MS = 12_000;
const MUTE_NOTICE_GRACE_MS = 6_000;
const MUTE_NOTICE_MAX_WAIT_MS = 15_000;
const MUTE_RETRY_MS = 750;
const MUTE_RECOVER_MS = 20_000;
const HEARTBEAT_MS = (VOICE_STATE_TTL_SEC / 2) * SECOND_MS;

const WIKI_FAILED_MAX_WAIT_MS = 8_000;
const WIKI_TIMEOUT_MS = 12_000;
const FETCH_LOOKUP_TIMEOUT_MS = 16_000;
const IMAGE_LOOKUP_TIMEOUT_MS = 125_000;
const SPEECH_DRAIN_MAX_MS = 20_000;
const TOOL_ANSWER_GRACE_MS = 10_000;
const VOICE_READY_TIMEOUT_MS = 20_000;
const CHAT_SPLIT_MIN_FRACTION = 0.5;
const INT16_MIN = -32768;
const INT16_MAX = 32767;
const TRANSCRIPT_LOG_MAX_LENGTH = 300;
const TRANSCRIPT_FLUSH_LENGTH = 1500;
const SERVER_MESSAGE_LOG_MAX_LENGTH = 400;
const USER_ID_LOG_SUFFIX_LENGTH = 4;
const VOICE_RELEASE_RATIO = 0.6;
const QUEUE_FULL_LOG_EVERY = 25;
const TICKER_LOG_EVERY_FRAMES = 500;
const SUPPRESSED_LOG_EVERY = 10;
const FRAME_LOG_EVERY = 250;
const INPUT_DROP_LOG_EVERY = 100;

const WIKI_FAILED_PROMPT =
	'[System] That lookup came back with nothing usable. Do not tell them you could not find it yet, and do not guess. Try again a different way right now — search_web with different English keywords, or fetch_web_page on a likely page. Say at most one very short line like "still checking" in the language they are speaking while you do it. Only once a web search has also come up empty may you tell them you could not find it. Do not read this note aloud.';

const IMAGE_FAILED_PROMPT =
	'[System] The picture could not be made. Say one short line out loud telling them what actually went wrong, based on the "reason" and "tell_the_user" you were given. If the description was flagged by the filter, ask them to describe it differently instead of offering to retry the same thing, and do not call it a technical error. Do not read this note aloud.';

const LOOKUP_TIMEOUT_HINT =
	'That lookup took too long and was dropped. Try search_web with shorter English keywords instead of waiting on it again, and only say you could not find it once that has also failed.';

const WAKE_ACK_PROMPT =
	'[System] Someone just said the wake phrase and you are now listening. Say one very short acknowledgement out loud right now — just "yes?" or the equivalent in the language this server speaks. Two words at most. Do not answer anything yet, do not ask what they need, and do not read this note aloud.';

function splitForChat(text: string) {
	const chunks = [];
	let remaining = text;

	while (remaining.length > DISCORD_LIMITS.MESSAGE) {
		let cut = remaining.lastIndexOf('\n', DISCORD_LIMITS.MESSAGE);
		if (cut < DISCORD_LIMITS.MESSAGE * CHAT_SPLIT_MIN_FRACTION) {
			cut = remaining.lastIndexOf(' ', DISCORD_LIMITS.MESSAGE);
		}
		if (cut < DISCORD_LIMITS.MESSAGE * CHAT_SPLIT_MIN_FRACTION) {
			cut = DISCORD_LIMITS.MESSAGE;
		}

		chunks.push(remaining.slice(0, cut).trim());
		remaining = remaining.slice(cut).trim();
	}

	if (remaining) {
		chunks.push(remaining);
	}
	return chunks;
}

function thinkingLevelFor(level: string | null | undefined) {
	if (level === 'medium') {
		return ThinkingLevel.MEDIUM;
	}
	if (level === 'high') {
		return ThinkingLevel.HIGH;
	}
	return ThinkingLevel.LOW;
}

function isExtendedThinking(model: string | null) {
	return (model ?? '').toLowerCase().includes('live-extended-thinking');
}

function rmsOf(pcm: Buffer) {
	const samples = Math.floor(pcm.length / 2);
	if (!samples) {
		return 0;
	}
	let sum = 0;
	for (let i = 0; i < samples; i++) {
		const s = pcm.readInt16LE(i * 2);
		sum += s * s;
	}
	return Math.sqrt(sum / samples);
}

type ResampleSpec = { fromRate: number; toRate: number; fromChannels: number; toChannels: number };

function downmixAndResample(pcm: Buffer, { fromRate, toRate, fromChannels, toChannels }: ResampleSpec) {
	const inSamples = Math.floor(pcm.length / 2 / fromChannels);
	const outSamples = Math.floor((inSamples * toRate) / fromRate);
	const out = Buffer.alloc(outSamples * 2 * toChannels);
	if (!outSamples) {
		return out;
	}

	const monoAt = (index: number) => {
		let sample = 0;
		for (let c = 0; c < fromChannels; c++) {
			sample += pcm.readInt16LE((index * fromChannels + c) * 2);
		}
		return sample / fromChannels;
	};

	const ratio = fromRate / toRate;
	const window = ratio > 1 ? Math.round(ratio) : 1;

	const averaged = (position: number) => {
		const start = Math.min(inSamples - 1, Math.round(position));
		let sum = 0;
		let taken = 0;
		for (let k = 0; k < window && start + k < inSamples; k++) {
			sum += monoAt(start + k);
			taken++;
		}
		return sum / taken;
	};

	const interpolated = (position: number) => {
		const index = Math.floor(position);
		const next = Math.min(inSamples - 1, index + 1);
		const frac = position - index;
		return monoAt(index) * (1 - frac) + monoAt(next) * frac;
	};

	for (let i = 0; i < outSamples; i++) {
		const position = i * ratio;
		const value = window > 1 ? averaged(position) : interpolated(position);

		const sample = Math.max(INT16_MIN, Math.min(INT16_MAX, Math.round(value)));
		for (let c = 0; c < toChannels; c++) {
			out.writeInt16LE(sample, (i * toChannels + c) * 2);
		}
	}
	return out;
}

function trackNoiseFloor(vad: VadState, rms: number) {
	if (!vad.floor) {
		vad.floor = Math.min(rms, NOISE_FLOOR_MAX);
	} else if (rms < vad.floor) {
		vad.floor += NOISE_FLOOR_FALL_ALPHA * (rms - vad.floor);
	} else if (rms < NOISE_FLOOR_MAX) {
		vad.floor += NOISE_FLOOR_ALPHA * (rms - vad.floor);
	}
	if (vad.floor > NOISE_FLOOR_MAX) {
		vad.floor = NOISE_FLOOR_MAX;
	}
}

const VOICE_SERVER_DATA_NOTE = `Your tools read this server's own live data. Use them instead of guessing whenever someone asks about this server, the game, the shop, their level, their bag or their tasks.

Everything you get back has to be said out loud, so keep it to one or two short spoken sentences. Give the few numbers or names that answer the question, round big numbers, and never read out a hash, a URL or a long list — send those to the text chat with send_to_chat and say one short line about it.

When a lookup is running, say at most one short line about it, and only if you have not already said one — never repeat "let me check" or "one second". Then stay quiet until the result reaches you and answer from it. Never say the lookup failed, never apologise, and never mention an error or a system problem while you are still waiting — a slow result is not a failure.

The get_my_* tools only ever read the account of the person talking to you. Never call one to answer a question about somebody else. If they ask what another member has in their bag, their history or their tasks, say plainly that it is private to that member, and offer their public level, rank and roles instead.`;

const FAST_TOOLS = new Set(['send_to_chat', ...SERVER_TOOL_NAMES, ...ACCOUNT_TOOL_NAMES, ...KNOWLEDGE_TOOL_NAMES]);
const SILENT_TOOLS = new Set(['leave_voice', 'conversation_done']);
const LOOKUP_TOOLS = new Set([
	'send_to_chat',
	'search_wiki',
	'search_web',
	'fetch_web_page',
	'generate_image',
	...SERVER_TOOL_NAMES,
	...ACCOUNT_TOOL_NAMES,
	...KNOWLEDGE_TOOL_NAMES
]);

const BASE_VOICE_TOOLS = [
	{
		name: 'conversation_done',
		description:
			'Stop listening and mute yourself immediately, while STAYING in the voice channel. Call this when the person you are currently talking with signals they are finished with you: "that is all", "done", "thanks, that is it", "mute yourself", "you can rest now", "okay that is enough". Call it straight away without saying anything back — you go silent the instant you call it, so any words would be cut off. Do NOT call it for a mid-conversation "ok" or "thanks" that is just filler while they keep talking to you, and do NOT use it when they want you to leave the channel entirely — that is leave_voice.',
		parameters: { type: Type.OBJECT, properties: {} }
	},
	{
		name: 'send_to_chat',
		description:
			"Write a message into this voice channel's text chat, for the people who are in the call with you. Use it whenever the answer does not belong in speech: a list, several numbers, steps to follow, a link, a hash, a code snippet, or anything that would take more than two spoken sentences. Put the detail in the chat, then say one short line out loud telling them you have written it there. Never read the same content aloud as well.",
		parameters: {
			type: Type.OBJECT,
			properties: {
				text: {
					type: Type.STRING,
					description: 'The message to write. Discord markdown works — use short lines or bullets so it is easy to read.'
				}
			},
			required: ['text']
		}
	},
	{
		name: 'leave_voice',
		description:
			'Leave the voice channel and end the call. Only usable while you are awake — if nobody has said the wake phrase, you are asleep and must never call this. Call it when the person talking to you asks you to leave, disconnect or hang up, or says a real farewell meant to end the conversation ("goodbye", "see you later", "bye, talk to you tomorrow"). Say your own short goodbye out loud first, then call this. Do NOT call it for filler like "ok", "thanks", "alright", "hmm", for a pause in conversation, or when people say bye to each other rather than to you.',
		parameters: { type: Type.OBJECT, properties: {} }
	}
];

function wikiToolDeclarations(wikiDeclaration: ReturnType<typeof buildWikiDeclaration>, wikis: Wiki[]) {
	if (!wikiDeclaration) {
		return [];
	}
	return [
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
	];
}

class VoiceSession {
	private readonly opts: VoiceSessionOptions;
	channelId: string;
	private channelName: string;
	private readonly speaking = new Map<string, { opus: AudioReceiveStream; decoder: prism.opus.Decoder }>();
	private readonly endpoint: ReturnType<typeof aiVoiceEndpoint>;
	private readonly genai: GoogleGenAI;
	private readonly isThinkingExtended: boolean;
	private readonly toolBehavior: Behavior;
	private systemInstruction = '';

	private wikis: Wiki[] = [];

	private connection: VoiceConnection | null = null;
	private player: AudioPlayer | null = null;
	private outputStream: Readable | null = null;
	private outputEncoder: prism.opus.Encoder | null = null;
	private session: Session | null = null;
	private resumeHandle: string | null = null;
	private isClosed = false;
	private readonly isGoodbyePending = false;

	private heartbeat: ReturnType<typeof setInterval> | null = null;

	private readonly playbackQueue: Buffer[] = [];
	private pending: Buffer = EMPTY;
	private pendingOffset = 0;
	private lastAudioAt = 0;
	private isTurnOpen = false;
	private turnOpenedAt = 0;
	private turnTimer: ReturnType<typeof setTimeout> | null = null;
	private isReconnecting = false;
	private closeWaiter: (() => void) | null = null;
	private isLeaveRequested = false;
	private lastSpeakerId = '';
	private lockedSpeakerId = '';
	private turnOwnerId = '';
	private isAwake = false;
	private isSelfMuted = false;
	private muteTimer: ReturnType<typeof setTimeout> | null = null;
	private muteRetryTimer: ReturnType<typeof setTimeout> | null = null;
	private speakAllowedUntil = 0;
	private bargeInDeafUntil = 0;
	private offWakeDetected: (() => void) | null = null;

	private readonly names = new Map<string, string>();
	private readonly ignoredBots = new Set<string>();
	private readonly voiceState = new Map<string, VadState>();
	private readonly wikiInflight = new Map<string, Promise<Record<string, unknown>>>();
	private readonly activeLookups = new Set<string>();
	private toolBusyUntil = 0;
	private isModelThinking = false;

	constructor(opts: VoiceSessionOptions) {
		this.opts = opts;
		this.channelId = this.opts.channelId;
		this.channelName = this.opts.channelName;
		this.endpoint = aiVoiceEndpoint(this.opts.config);
		this.genai = new GoogleGenAI({ apiKey: this.endpoint.api_key! });
		this.isThinkingExtended = isExtendedThinking(this.opts.config.voice_model);
		this.toolBehavior = this.isThinkingExtended ? Behavior.NON_BLOCKING : Behavior.BLOCKING;
	}

	private readonly isAddressed = () => {
		return this.isAwake;
	};

	private readonly markAddressed = ({ verified: isVerified = false } = {}) => {
		const wasAddressed = this.isAddressed();

		const speaker = this.lastSpeakerId || this.loudestActiveSpeaker();
		if (!this.lockedSpeakerId && speaker) {
			this.lockedSpeakerId = speaker;
			logger.log(`🔒 Voice AI locked onto ${this.nameOf(this.lockedSpeakerId)} for this conversation`);
		} else if (!this.lockedSpeakerId) {
			logger.log('⚠️ Voice AI addressed but no speaker identified yet, staying open to anyone');
		} else if (speaker && speaker !== this.lockedSpeakerId && !wasAddressed) {
			logger.log(`🔄 Voice AI re-locking from ${this.nameOf(this.lockedSpeakerId)} to ${this.nameOf(speaker)}`);
			this.lockedSpeakerId = speaker;
		}

		this.isAwake = true;
		this.setSelfMute(false);
		return wasAddressed;
	};

	private readonly finishConversation = () => {
		if (this.isClosed || this.isGoodbyePending) {
			return;
		}

		if (this.lookupBusy()) {
			logger.log('🔎 Voice AI ignoring done request, a lookup is still running');
			this.keepAwakeForTool();
			return;
		}

		this.isAwake = false;

		if (this.muteTimer) {
			clearTimeout(this.muteTimer);
		}
		this.muteTimer = null;

		this.afterSpeaking('muting', () => {
			if (this.isClosed || this.isAddressed()) {
				return;
			}
			if (this.lookupBusy()) {
				logger.log('🔎 Voice AI cancelled muting, a lookup is still running');
				this.keepAwakeForTool();
				return;
			}
			logger.log('🔇 Voice AI finished speaking, muting now');
			this.playbackQueue.splice(0);
			this.pending = EMPTY;
			this.pendingOffset = 0;

			this.releaseSpeakerLock();
			this.setSelfMute(true);
		});
	};

	private readonly loudestActiveSpeaker = () => {
		let best = '';
		let bestAt = 0;
		for (const [userId, vad] of this.voiceState) {
			if (!vad.active || this.isBotUser(userId)) {
				continue;
			}
			if (vad.startedAt >= bestAt) {
				bestAt = vad.startedAt;
				best = userId;
			}
		}
		return best;
	};

	private readonly lookupBusy = () => {
		return this.activeLookups.size > 0 || Date.now() < this.toolBusyUntil;
	};

	private readonly toolBusy = () => {
		return this.lookupBusy() || this.isModelThinking;
	};

	private readonly keepAwakeForTool = () => {
		this.isAwake = true;
		this.setSelfMute(false);
	};

	private readonly releaseSpeakerLock = () => {
		if (!this.lockedSpeakerId) {
			return;
		}
		logger.log(`🔓 Voice AI released lock on ${this.nameOf(this.lockedSpeakerId)}, open to anyone`);
		this.lockedSpeakerId = '';
	};

	private readonly micIsOpenFor = (userId: string) => {
		if (!this.lockedSpeakerId) {
			return true;
		}
		if (userId === this.lockedSpeakerId) {
			return true;
		}
		return !this.isAddressed();
	};

	private readonly announceWakePhrase = () => {
		if (this.isClosed || this.isGoodbyePending) {
			return;
		}

		const announcedAt = Date.now();
		const chunksAtAnnounce = this.stats.chunksPlayed;
		this.speakAllowedUntil = announcedAt + MUTE_NOTICE_MAX_WAIT_MS;
		logger.log('👋 Voice AI greeting the channel with the wake phrase');
		this.sendSystemNote(
			`Say one short sentence out loud right now to greet the channel: you have joined, you are going quiet, and anyone can wake you by saying "hey stupid". Say the wake phrase clearly so they hear exactly what to say. One casual sentence in the language this server speaks, no explanation, and do not read this note aloud.`
		);

		const settleGreeting = () => {
			this.muteTimer = null;
			if (this.isClosed || this.isSelfMuted || this.isAddressed()) {
				return;
			}

			if (this.toolBusy()) {
				this.muteTimer = setTimeout(settleGreeting, SPEAK_GUARD_MS);
				return;
			}

			const hasSpoken = this.stats.chunksPlayed > chunksAtAnnounce;
			const waited = Date.now() - announcedAt;
			const isExpired = waited >= MUTE_NOTICE_MAX_WAIT_MS;

			if (!isExpired && (this.botIsSpeaking() || !hasSpoken)) {
				this.muteTimer = setTimeout(settleGreeting, SPEAK_GUARD_MS);
				return;
			}

			if (isExpired && !hasSpoken) {
				logger.log('⚠️ Voice AI never spoke its greeting, muting anyway');
			}
			this.setSelfMute(true);
		};
		this.muteTimer = setTimeout(settleGreeting, MUTE_NOTICE_GRACE_MS);
	};

	private readonly nameOf = (userId: string) => {
		if (this.names.has(userId)) {
			return this.names.get(userId);
		}
		const member = this.opts.client.guilds.cache.get(this.opts.guildId)?.members?.cache?.get(userId);
		const name = member?.displayName || member?.user?.username || 'Unknown';
		this.names.set(userId, name);
		return name;
	};

	private readonly rosterText = () => {
		const channel = this.opts.client.guilds.cache.get(this.opts.guildId)?.channels?.cache?.get(this.channelId) as VoiceBasedChannel | undefined;
		const people = [...(channel?.members ?? [])]
			.filter(([id, m]) => !m.user.bot && id !== this.opts.client.user?.id)
			.map(([id]) => (id === this.opts.inviterId ? `${this.nameOf(id)} (invited you)` : this.nameOf(id)));
		return people.length ? people.join(', ') : 'nobody';
	};

	private readonly sendSystemNote = (text: string) => {
		if (!this.session || this.isClosed || this.isGoodbyePending) {
			return;
		}
		try {
			this.session.sendRealtimeInput({ text });
		} catch {}
	};

	private readonly announceRoster = () => {
		this.sendSystemNote(
			`[System] People currently in the voice channel: ${this.rosterText()}. Address them by name when it feels natural. Do not read this note aloud.`
		);
	};

	private readonly stats = {
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

	private readonly clearTimers = () => {
		for (const t of [this.turnTimer, this.muteTimer, this.muteRetryTimer]) {
			if (t) {
				clearTimeout(t);
			}
		}
		this.turnTimer = null;
		this.muteTimer = null;
		this.muteRetryTimer = null;
		if (this.heartbeat) {
			clearInterval(this.heartbeat);
		}
		this.heartbeat = null;
	};

	private readonly transcriptBuffer: Record<'user' | 'assistant', string> = { user: '', assistant: '' };

	private readonly flushTranscript = (role: 'user' | 'assistant') => {
		const text = this.transcriptBuffer[role].trim();
		this.transcriptBuffer[role] = '';
		if (text.length < 2) {
			return;
		}
		logger.log(`${role === 'user' ? '💬' : '🗨️'} Voice AI ${role}: ${text.slice(0, TRANSCRIPT_LOG_MAX_LENGTH)}`);
		appendAiMessage({ botId: this.opts.botId, guildId: this.opts.guildId, memberId: this.opts.inviterId }, role, text).catch(() => {});
	};

	private readonly collectTranscript = (role: 'user' | 'assistant', fragment: string) => {
		const other = role === 'user' ? 'assistant' : 'user';
		if (this.transcriptBuffer[other].trim()) {
			this.flushTranscript(other);
		}

		this.transcriptBuffer[role] += fragment;
		if (/[.!?]\s*$/.test(fragment) || this.transcriptBuffer[role].length > TRANSCRIPT_FLUSH_LENGTH) {
			this.flushTranscript(role);
		}
	};

	private readonly liveConnection = (): VoiceConnection => {
		if (!this.connection) {
			throw new Error('Voice connection is not open');
		}
		return this.connection;
	};

	private readonly botIsSpeaking = () => {
		return this.playbackQueue.length > 0 || this.pendingOffset < this.pending.length || Date.now() - this.lastAudioAt < SPEECH_TAIL_MS;
	};

	private readonly afterSpeaking = (label: string, run: () => void, { graceMs = 0, maxWaitMs = SPEECH_DRAIN_MAX_MS } = {}) => {
		const startedAt = Date.now();
		const chunksAtStart = this.stats.chunksPlayed;

		const wait = () => {
			if (this.isClosed) {
				return;
			}

			const elapsed = Date.now() - startedAt;
			const hasSpoken = this.stats.chunksPlayed > chunksAtStart;

			if ((this.botIsSpeaking() || (!hasSpoken && elapsed < graceMs)) && elapsed < maxWaitMs) {
				setTimeout(wait, SPEAK_GUARD_MS);
				return;
			}

			if (elapsed >= maxWaitMs && this.botIsSpeaking()) {
				logger.log(`⚠️ Voice AI still speaking after ${Math.round(maxWaitMs / SECOND_MS)}s, continuing with ${label}`);
			}

			run();
		};
		wait();
	};

	private readonly openTurn = () => {
		if (this.isTurnOpen) {
			return;
		}
		this.isTurnOpen = true;
		this.turnOpenedAt = Date.now();
		this.stats.turns++;
		try {
			this.session!.sendRealtimeInput({ activityStart: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn start (#${this.stats.turns})`);
	};

	private readonly closeTurn = () => {
		if (!this.isTurnOpen || !this.session) {
			return;
		}
		this.isTurnOpen = false;
		this.turnOwnerId = '';
		if (this.turnTimer) {
			clearTimeout(this.turnTimer);
			this.turnTimer = null;
		}
		try {
			this.session.sendRealtimeInput({ activityEnd: {} });
		} catch {}
		logger.log(`🎙️ Voice AI turn end (#${this.stats.turns} frames=${this.stats.framesIn})`);
	};

	private readonly anyoneSpeaking = () => {
		for (const [userId, vad] of this.voiceState) {
			if (vad.active && this.micIsOpenFor(userId) && (!this.turnOwnerId || userId === this.turnOwnerId)) {
				return true;
			}
		}
		return false;
	};

	private readonly claimTurnFor = (userId: string) => {
		if (!this.isAddressed()) {
			return true;
		}
		if (!this.turnOwnerId || this.turnOwnerId === userId) {
			this.turnOwnerId = userId;
			return true;
		}
		const owner = this.voiceState.get(this.turnOwnerId);
		if (!owner?.active) {
			this.turnOwnerId = userId;
			return true;
		}
		return false;
	};

	private readonly voiceSilenceMs = () => {
		let latest = 0;
		for (const [userId, vad] of this.voiceState) {
			if (!this.micIsOpenFor(userId)) {
				continue;
			}
			if (this.turnOwnerId && userId !== this.turnOwnerId) {
				continue;
			}
			if (vad.lastVoiceAt > latest) {
				latest = vad.lastVoiceAt;
			}
		}
		return latest ? Date.now() - latest : TURN_SILENCE_MS;
	};

	private readonly settleTurn = () => {
		const elapsed = Date.now() - this.turnOpenedAt;
		const silence = this.voiceSilenceMs();

		if (silence < TURN_SILENCE_MS && elapsed < MAX_TURN_MS) {
			this.turnTimer = setTimeout(this.settleTurn, Math.max(TURN_SETTLE_MIN_MS, TURN_SILENCE_MS - silence));
			return;
		}

		if (this.anyoneSpeaking()) {
			if (elapsed >= MAX_TURN_MS) {
				logger.log(`⚠️ Voice AI turn stuck open past ${MAX_TURN_MS / SECOND_MS}s, forcing it closed`);
			}
			for (const [userId, vad] of this.voiceState) {
				if (!this.micIsOpenFor(userId)) {
					continue;
				}
				vad.active = false;
				vad.onset = 0;
			}
		}
		this.closeTurn();
	};

	private readonly bumpTurn = () => {
		if (this.turnTimer) {
			clearTimeout(this.turnTimer);
		}
		this.turnTimer = setTimeout(this.settleTurn, Math.max(TURN_SETTLE_MIN_MS, TURN_SILENCE_MS - this.voiceSilenceMs()));
	};

	private readonly playChunk = (pcm24k: Buffer) => {
		if (this.isClosed || this.isSelfMuted || Date.now() < this.bargeInDeafUntil) {
			this.stats.chunksDropped++;
			return;
		}
		if (this.playbackQueue.length >= MAX_QUEUED_CHUNKS) {
			this.stats.chunksDropped++;
			if (this.stats.chunksDropped % QUEUE_FULL_LOG_EVERY === 1) {
				logger.log(`⚠️ Voice AI playback queue full at ${MAX_QUEUED_CHUNKS}, dropping the newest audio (high=${this.stats.queueHigh})`);
			}
			return;
		}

		this.playbackQueue.push(downmixAndResample(pcm24k, { fromRate: OUTPUT_RATE, toRate: DISCORD_RATE, fromChannels: 1, toChannels: 2 }));
		this.stats.chunksPlayed++;
		this.lastAudioAt = Date.now();

		if (this.playbackQueue.length > this.stats.queueHigh) {
			this.stats.queueHigh = this.playbackQueue.length;
		}
	};

	private readonly handleInterrupt = () => {
		this.stats.interrupts++;
		const cleared = this.playbackQueue.length;
		this.playbackQueue.splice(0);
		this.pending = EMPTY;
		this.pendingOffset = 0;
		logger.log(`🔊 Voice AI interrupted (cleared=${cleared} played=${this.stats.chunksPlayed})`);
	};

	private readonly bargeInAllowed = (userId: string) => {
		if (!this.isAddressed() || this.isGoodbyePending || this.isSelfMuted) {
			return false;
		}
		if (Date.now() < this.speakAllowedUntil) {
			return false;
		}
		return this.micIsOpenFor(userId);
	};

	private readonly tryBargeIn = (userId: string, vad: VadState, rms: number) => {
		const openAt = Math.min(VOICE_RMS_CEILING, Math.max(VOICE_RMS_THRESHOLD, vad.floor * NOISE_FLOOR_MARGIN));
		const bargeAt = Math.max(BARGE_IN_RMS_MIN, openAt * BARGE_IN_RMS_MARGIN);

		if (rms < bargeAt || !this.bargeInAllowed(userId)) {
			vad.barge = 0;
			return false;
		}

		if (++vad.barge < BARGE_IN_FRAMES) {
			return false;
		}

		const now = Date.now();
		vad.barge = 0;
		vad.active = true;
		vad.onset = VOICE_ONSET_FRAMES;
		vad.startedAt = now;
		vad.lastVoiceAt = now;
		this.bargeInDeafUntil = now + BARGE_IN_DEAF_MS;
		logger.log(`✋ Voice AI cut off by ${this.nameOf(userId)} (rms=${Math.round(rms)} gate=${Math.round(bargeAt)})`);
		this.handleInterrupt();
		return true;
	};

	private readonly nextFrame = () => {
		const frame = Buffer.alloc(FRAME_BYTES);
		let filled = 0;

		if (this.isSelfMuted) {
			if (this.playbackQueue.length || this.pendingOffset < this.pending.length) {
				this.playbackQueue.splice(0);
				this.pending = EMPTY;
				this.pendingOffset = 0;
				this.stats.chunksDropped++;
				logger.log('🔇 Voice AI dropped playback that arrived while muted');
			}
			this.stats.framesOut++;
			this.stats.silenceOut++;
			return frame;
		}

		while (filled < FRAME_BYTES) {
			if (this.pendingOffset >= this.pending.length) {
				const next = this.playbackQueue.shift();
				if (!next) {
					break;
				}
				this.pending = next;
				this.pendingOffset = 0;
			}
			const take = Math.min(FRAME_BYTES - filled, this.pending.length - this.pendingOffset);
			this.pending.copy(frame, filled, this.pendingOffset, this.pendingOffset + take);
			this.pendingOffset += take;
			filled += take;
		}

		this.stats.bytesOut += filled;
		this.stats.framesOut++;
		if (filled === 0) {
			this.stats.silenceOut++;
		} else {
			this.lastAudioAt = Date.now();
		}
		if (this.stats.framesOut % TICKER_LOG_EVERY_FRAMES === 0) {
			const gates = [...this.voiceState.entries()]
				.map(
					([userId, vad]) =>
						`${userId.slice(-USER_ID_LOG_SUFFIX_LENGTH)}:floor=${Math.round(vad.floor)}/openAt=${Math.round(Math.min(VOICE_RMS_CEILING, Math.max(VOICE_RMS_THRESHOLD, vad.floor * NOISE_FLOOR_MARGIN)))}/active=${vad.active ? 1 : 0}`
				)
				.join(' ');
			logger.log(
				`🔈 Voice AI ticker out=${this.stats.framesOut} silence=${this.stats.silenceOut} audioBytes=${this.stats.bytesOut} queued=${this.playbackQueue.length} | in=${this.stats.framesIn} asleep=${this.stats.framesAsleep} noise=${this.stats.framesNoise} subscribed=${this.voiceState.size} awake=${this.isAddressed()}${gates ? ` | ${gates}` : ''}`
			);
		}
		return frame;
	};

	private readonly startOutput = () => {
		const previousStream = this.outputStream;
		const previousEncoder = this.outputEncoder;

		const frame = () => (this.isClosed ? null : this.nextFrame());
		this.outputStream = new Readable({
			highWaterMark: FRAME_BYTES * OUTPUT_BUFFER_FRAMES,
			read() {
				this.push(frame());
			}
		});
		this.outputStream.on('error', (err) => {
			if (this.isClosed) {
				return;
			}
			logger.log(`❌ Voice AI output stream error: ${err?.message || err}`);
		});

		this.outputEncoder = new prism.opus.Encoder({
			rate: DISCORD_RATE,
			channels: 2,
			frameSize: 960,
			readableHighWaterMark: OUTPUT_ENCODER_FRAMES,
			writableHighWaterMark: FRAME_BYTES
		} as prism.opus.OpusOptions);
		this.outputEncoder.on('error', (err) => {
			if (this.isClosed) {
				return;
			}
			logger.log(`❌ Voice AI output encoder error: ${err?.message || err}`);
		});

		this.outputStream.pipe(this.outputEncoder);
		this.player!.play(createAudioResource(this.outputEncoder, { inputType: StreamType.Opus }));

		if (previousStream) {
			previousStream.unpipe(previousEncoder ?? undefined);
			previousStream.destroy();
		}
		previousEncoder?.destroy();

		const pipelineMs = (OUTPUT_BUFFER_FRAMES + OUTPUT_ENCODER_FRAMES + 1) * FRAME_MS;
		logger.log(`🔊 Voice AI output stream started (pipeline=${pipelineMs}ms)`);
	};

	private readonly sendToolResponses = (responses: FunctionResponse[]) => {
		if (!responses.length || !this.session || this.isClosed) {
			return;
		}
		try {
			this.session.sendToolResponse({ functionResponses: responses });
		} catch (err) {
			logger.log(`⚠️ Voice AI tool response failed: ${String(err)}`);
		}
	};

	private readonly withToolBehavior = (declaration: object): FunctionDeclaration => {
		return { ...declaration, behavior: this.toolBehavior };
	};

	private readonly toolResponse = (call: LiveToolCall, response: Record<string, unknown>) => {
		return { id: call.id, name: call.name, response };
	};

	private readonly chatTargets = () => {
		return [
			['voice channel chat', this.channelId],
			['invite text channel', this.opts.textChannelId]
		];
	};

	private readonly sendChatMessage = async (text: unknown) => {
		const body = String(text ?? '')
			.trim()
			.slice(0, MAX_CHAT_MESSAGE_CHARS);
		if (!body) {
			return { ok: false, reason: 'nothing_to_send' };
		}

		for (const [label, target] of this.chatTargets()) {
			if (!target) {
				continue;
			}
			try {
				const channel = await this.opts.client.channels.fetch(target).catch(() => null);
				if (!channel?.isTextBased?.()) {
					continue;
				}

				for (const chunk of splitForChat(body)) {
					await (channel as SendableChannels).send({ content: chunk, allowedMentions: { parse: [] } });
				}

				logger.log(`💬 Voice AI wrote to the ${label} (${body.length} chars)`);
				return { ok: true, posted_to: label };
			} catch (err) {
				logger.log(`⚠️ Voice AI could not write to the ${label}: ${String(err)}`);
			}
		}

		return { ok: false, reason: 'could_not_post' };
	};

	private readonly sendImageTo = async (targetChannelId: string | null, buffer: Buffer) => {
		if (!targetChannelId) {
			return false;
		}

		const channel = await this.opts.client.channels.fetch(targetChannelId).catch(() => null);
		if (!channel?.isTextBased?.()) {
			return false;
		}

		await (channel as SendableChannels).send({ files: [new AttachmentBuilder(buffer, { name: 'image-1.png' })] });
		return true;
	};

	private readonly postGeneratedImage = async (result: Awaited<ReturnType<typeof runImageTool>>) => {
		if (!result?.ok || !result.buffer) {
			return false;
		}

		for (const [label, target] of this.chatTargets()) {
			try {
				if (await this.sendImageTo(target, result.buffer)) {
					logger.log(`🖼️ Voice AI posted a generated image to the ${label}`);
					return true;
				}
			} catch (err) {
				logger.log(`⚠️ Voice AI could not post the image to the ${label}: ${String(err)}`);
			}
		}

		return false;
	};

	private readonly runLookup = (call: LiveToolCall) => {
		const toolContext = {
			botId: this.opts.botId,
			guildId: this.opts.guildId,
			callerDiscordId: this.lockedSpeakerId || this.lastSpeakerId || this.opts.inviterId,
			voice: true
		};
		if (SERVER_TOOL_NAMES.has(call.name)) {
			return runServerTool(call.name, call.args ?? {}, toolContext);
		}
		if (ACCOUNT_TOOL_NAMES.has(call.name)) {
			return runAccountTool(call.name, call.args ?? {}, toolContext);
		}
		if (KNOWLEDGE_TOOL_NAMES.has(call.name)) {
			return runKnowledgeTool(call.name, call.args ?? {}, toolContext);
		}
		if (call.name === 'send_to_chat') {
			return this.sendChatMessage(call.args?.text);
		}
		if (call.name === 'search_web') {
			return runSearchTool(this.opts.config, call.args ?? {});
		}
		if (call.name === 'fetch_web_page') {
			return runFetchTool(this.opts.config, call.args ?? {});
		}
		if (call.name === 'generate_image') {
			return runImageTool(this.opts.config, call.args ?? {}).then(async (result) => {
				const wasPosted = await this.postGeneratedImage(result);
				const { buffer, ...summary } = result;
				if (!summary.ok) {
					return summary;
				}
				return wasPosted ? { ...summary, posted_to_chat: true } : { ok: false, reason: 'could_not_post_image' };
			});
		}
		return runWikiTool(this.wikis, call.args ?? {}, { sessionKey: `${this.opts.botId}:${this.opts.guildId}:${this.channelId}` });
	};

	private readonly lookupLabel = (call: LiveToolCall) => {
		if (call.name === 'send_to_chat') {
			return 'chat message';
		}
		if (SERVER_TOOL_NAMES.has(call.name) || ACCOUNT_TOOL_NAMES.has(call.name) || KNOWLEDGE_TOOL_NAMES.has(call.name)) {
			return `server lookup ${call.name}`;
		}
		if (call.name === 'search_web') {
			return `web search "${call.args?.query ?? ''}"`;
		}
		if (call.name === 'fetch_web_page') {
			return `web fetch ${call.args?.url ?? ''}`;
		}
		if (call.name === 'generate_image') {
			return `image generation "${call.args?.prompt ?? ''}"`;
		}
		return `wiki lookup "${call.args?.query ?? ''}" (${call.args?.wiki ?? 'default'})`;
	};

	private readonly lookupKey = (call: LiveToolCall) => {
		const query = call.args?.query ?? call.args?.url ?? '';
		return FAST_TOOLS.has(call.name)
			? `${call.name}::${JSON.stringify(call.args ?? {})}`.toLowerCase()
			: `${call.name}::${call.args?.wiki ?? ''}::${query}`.toLowerCase();
	};

	private readonly scheduleFailureNudge = (call: LiveToolCall, lookup: LookupState) => {
		const failedAt = Date.now();
		const chunksAtFailure = this.stats.chunksPlayed;
		const nudgeFailure = () => {
			if (this.isClosed || this.isGoodbyePending || lookup.hasSpokenFailure) {
				return;
			}
			if (this.stats.chunksPlayed > chunksAtFailure) {
				return;
			}
			if (Date.now() - failedAt >= WIKI_FAILED_MAX_WAIT_MS) {
				logger.log('❌ Voice AI never spoke the lookup failure, giving up');
				return;
			}
			if (this.botIsSpeaking()) {
				setTimeout(nudgeFailure, SPEAK_GUARD_MS);
				return;
			}
			lookup.hasSpokenFailure = true;
			logger.log(`❌ Voice AI nudging the ${call.name} failure out loud`);
			this.keepAwakeForTool();
			this.sendSystemNote(call.name === 'generate_image' ? IMAGE_FAILED_PROMPT : WIKI_FAILED_PROMPT);
		};
		setTimeout(nudgeFailure, SPEAK_GUARD_MS);
	};

	private readonly deliverLookupResult = (call: LiveToolCall, response: Record<string, unknown>, lookup: LookupState) => {
		if (this.isClosed) {
			return;
		}
		this.keepAwakeForTool();
		this.sendToolResponses([this.toolResponse(call, response)]);
		if (response?.ok === false) {
			this.scheduleFailureNudge(call, lookup);
		}
	};

	private readonly reuseInflightLookup = (call: LiveToolCall, inflight: Promise<Record<string, unknown>>) => {
		logger.log(`📖 Voice AI reusing in-flight ${this.lookupLabel(call)}`);
		this.keepAwakeForTool();
		inflight
			.then((response) => {
				this.keepAwakeForTool();
				this.sendToolResponses([this.toolResponse(call, response)]);
			})
			.catch(() => {});
	};

	private readonly startLookup = (call: LiveToolCall) => {
		const dedupeKey = this.lookupKey(call);
		const inflight = this.wikiInflight.get(dedupeKey);
		if (inflight) {
			this.reuseInflightLookup(call, inflight);
			return;
		}

		logger.log(`📖 Voice AI ${this.lookupLabel(call)}`);

		const lookup: LookupState = { isSettled: false, hasSpokenFailure: false };
		let resolveInflight: (value: Record<string, unknown>) => void = () => {};
		this.wikiInflight.set(
			dedupeKey,
			new Promise<Record<string, unknown>>((resolve) => {
				resolveInflight = resolve;
			})
		);

		const lookupId = `${call.id ?? ''}::${dedupeKey}`;
		this.activeLookups.add(lookupId);
		this.keepAwakeForTool();

		const keepAwake = setInterval(() => {
			if (lookup.isSettled || this.isClosed || this.isGoodbyePending) {
				clearInterval(keepAwake);
				return;
			}
			this.keepAwakeForTool();
		}, SPEAK_GUARD_MS * 2);

		const finish = (response: Record<string, unknown>) => {
			if (lookup.isSettled) {
				return;
			}
			lookup.isSettled = true;
			clearInterval(keepAwake);
			this.wikiInflight.delete(dedupeKey);
			this.activeLookups.delete(lookupId);
			this.toolBusyUntil = Date.now() + TOOL_ANSWER_GRACE_MS;
			resolveInflight(response);
			this.keepAwakeForTool();

			if (response?.ok === false) {
				logger.log(`❌ Voice AI ${this.lookupLabel(call)} unusable: ${response.reason}`);
			}
			this.deliverLookupResult(call, response, lookup);
		};

		const lookupTimeoutMs =
			call.name === 'generate_image' ? IMAGE_LOOKUP_TIMEOUT_MS : call.name === 'fetch_web_page' ? FETCH_LOOKUP_TIMEOUT_MS : WIKI_TIMEOUT_MS;
		const timeoutTimer = setTimeout(() => {
			if (lookup.isSettled) {
				return;
			}
			logger.log(`⏱️ Voice AI ${this.lookupLabel(call)} timed out after ${lookupTimeoutMs / SECOND_MS}s`);
			finish({ ok: false, reason: 'timeout', next_step: LOOKUP_TIMEOUT_HINT });
		}, lookupTimeoutMs);

		this.runLookup(call)
			.then((response) => {
				clearTimeout(timeoutTimer);
				finish(response);
			})
			.catch((err) => {
				clearTimeout(timeoutTimer);
				logger.log(`❌ Voice AI ${this.lookupLabel(call)} failed: ${String(err)}`);
				finish({ ok: false, reason: 'lookup_failed' });
			});
	};

	private readonly handleDoneRequest = () => {
		if (this.lockedSpeakerId && this.lastSpeakerId && this.lastSpeakerId !== this.lockedSpeakerId) {
			logger.log(`🚫 Voice AI ignoring done request from ${this.nameOf(this.lastSpeakerId)} (talking with ${this.nameOf(this.lockedSpeakerId)})`);
			return;
		}
		logger.log(`✅ Voice AI done with ${this.nameOf(this.lockedSpeakerId) || 'this turn'}, releasing lock and muting`);
		this.finishConversation();
	};

	private readonly handleLeaveRequest = () => {
		if (!this.isAddressed()) {
			logger.log('🚫 Voice AI ignoring leave request while asleep (nobody said the wake phrase)');
			return;
		}

		if (this.lastSpeakerId && this.lastSpeakerId !== this.opts.inviterId) {
			logger.log(`🚫 Voice AI ignoring leave request from ${this.nameOf(this.lastSpeakerId)} (only ${this.nameOf(this.opts.inviterId)} can)`);
			this.sendSystemNote(
				`[System] ${this.nameOf(this.lastSpeakerId)} asked you to leave, but only ${this.nameOf(this.opts.inviterId)} who invited you can end this call. Say one short line telling them that, and stay in the channel.`
			);
			return;
		}

		logger.log('🎙️ Voice AI leave requested by voice');
		this.isLeaveRequested = true;
		this.closeTurn();
		this.afterSpeaking('leaving', () => this.stop('user_request_voice'), { graceMs: GOODBYE_GRACE_MS });
	};

	private readonly handleToolCall = (calls: LiveToolCall[]) => {
		const responses = calls
			.filter((call) => !LOOKUP_TOOLS.has(call.name) && !SILENT_TOOLS.has(call.name))
			.map((call) => ({ id: call.id, name: call.name, response: { ok: true } }));

		this.sendToolResponses(responses);

		for (const call of calls.filter((c) => LOOKUP_TOOLS.has(c.name))) {
			this.startLookup(call);
		}

		if (calls.some((call) => call.name === 'conversation_done')) {
			if (!this.isAddressed()) {
				logger.log('🚫 Voice AI ignoring done request while asleep');
				return;
			}
			this.handleDoneRequest();
		}

		if (calls.some((call) => call.name === 'leave_voice')) {
			this.handleLeaveRequest();
		}
	};

	private readonly loadSystemInstruction = async () => {
		const languageNote = await aiLanguageInstruction(this.opts.guildId, 'voice').catch(() => '');
		this.systemInstruction = [(this.endpoint.system_prompt ?? '').replace(/\{\{today\}\}/g, isoDay(new Date())), languageNote, VOICE_SERVER_DATA_NOTE]
			.filter(Boolean)
			.join('\n\n');
	};

	private readonly loadToolDeclarations = async () => {
		this.wikis = await getEnabledWikis(this.opts.botId).catch(() => []);
		const wikiDeclaration = buildWikiDeclaration(this.wikis);
		if (wikiDeclaration) {
			logger.log(`📚 Voice AI wiki lookup available: ${this.wikis.map((w) => w.name).join(', ')}`);
		}

		const toolFeatures = await resolveToolFeatures(this.opts.botId, this.opts.guildId).catch(() => null);

		const searchDeclaration = buildSearchDeclaration(this.opts.config);
		const fetchDeclaration = buildFetchDeclaration(this.opts.config);
		const imageDeclaration = buildImageDeclaration(this.opts.config);
		if (searchDeclaration) {
			logger.log('🌐 Voice AI web search available');
		}
		if (fetchDeclaration) {
			logger.log('🌐 Voice AI web fetch available');
		}
		if (imageDeclaration) {
			logger.log('🖼️ Voice AI image generation available');
		}

		const functionDeclarations = [
			...BASE_VOICE_TOOLS,
			...wikiToolDeclarations(wikiDeclaration, this.wikis),
			...buildServerDeclarations(toolFeatures),
			...buildAccountDeclarations(toolFeatures),
			...buildKnowledgeDeclarations(),
			...(searchDeclaration ? [searchDeclaration] : []),
			...(fetchDeclaration ? [fetchDeclaration] : []),
			...(imageDeclaration ? [imageDeclaration] : [])
		].map(this.withToolBehavior);

		const names = functionDeclarations.map((d) => d.name);
		const dupes = names.filter((n, i) => names.indexOf(n) !== i);
		logger.log(
			`🧰 Voice AI declaring ${names.length} tools (model=${this.opts.config.voice_model} behavior=${this.toolBehavior}${dupes.length ? ` DUPLICATES=${[...new Set(dupes)].join(',')}` : ''}): ${names.join(', ')}`
		);
		return [{ functionDeclarations }];
	};

	private readonly noteModelThinking = (status: InteractionStatus) => {
		const isThinking = status === InteractionStatus.IN_PROGRESS;
		if (isThinking !== this.isModelThinking) {
			this.isModelThinking = isThinking;
			logger.log(isThinking ? '🧠 Voice AI reasoning in the background' : '🧠 Voice AI finished reasoning');
		}
		if (isThinking) {
			this.keepAwakeForTool();
		}
	};

	private readonly suppressReply = (sc: LiveServerContent) => {
		if (!sc.modelTurn?.parts?.some((p) => p.inlineData?.data)) {
			return;
		}
		this.stats.repliesSuppressed++;
		if (this.stats.repliesSuppressed % SUPPRESSED_LOG_EVERY === 1) {
			logger.log(`🙊 Voice AI staying silent, not addressed (suppressed=${this.stats.repliesSuppressed})`);
		}
	};

	private readonly handleServerContent = (sc: LiveServerContent) => {
		if (sc.turnCompleteReason && sc.turnCompleteReason !== TurnCompleteReason.NEED_MORE_INPUT) {
			logger.log(`📩 Voice AI turn complete reason: ${sc.turnCompleteReason}`);
		}

		if (sc.interactionStatus) {
			this.noteModelThinking(sc.interactionStatus);
		}

		const inlineCalls = (sc.modelTurn?.parts ?? []).filter((p) => p.functionCall).map((p) => p.functionCall) as LiveToolCall[];
		if (inlineCalls.length) {
			logger.log(`🧰 Voice AI tool call (inline part): ${inlineCalls.map((c) => c.name).join(', ')}`);
			this.handleToolCall(inlineCalls);
			return;
		}

		if (sc.interrupted) {
			this.handleInterrupt();
		}

		if (sc.inputTranscription?.text) {
			this.collectTranscript('user', sc.inputTranscription.text);
		}

		if (!this.isAddressed() && !this.toolBusy() && Date.now() > this.speakAllowedUntil) {
			this.suppressReply(sc);
			return;
		}

		for (const part of sc.modelTurn?.parts ?? []) {
			if (part.inlineData?.data) {
				this.playChunk(Buffer.from(part.inlineData.data, 'base64'));
			}
		}

		if (sc.outputTranscription?.text) {
			this.collectTranscript('assistant', sc.outputTranscription.text);
		}
	};

	private readonly handleLiveMessage = (msg: LiveServerMessage) => {
		if (msg.sessionResumptionUpdate?.newHandle) {
			this.resumeHandle = msg.sessionResumptionUpdate.newHandle;
		}
		if (msg.goAway) {
			logger.log(`⚠️ Voice AI goAway, timeLeft=${msg.goAway.timeLeft ?? '?'}`);
			this.reconnect().catch(() => {});
		}

		if (msg.toolCall?.functionCalls?.length) {
			logger.log(`🧰 Voice AI tool call: ${msg.toolCall.functionCalls.map((c) => c.name).join(', ')}`);
			this.handleToolCall(msg.toolCall.functionCalls as LiveToolCall[]);
			return;
		}

		if (msg.toolCallCancellation?.ids?.length) {
			logger.log(`🧰 Voice AI tool call cancelled: ${msg.toolCallCancellation.ids.join(', ')}`);
		}

		const unknown = Object.keys(msg).filter((k) => !KNOWN_SERVER_KEYS.has(k));
		if (unknown.length) {
			logger.log(`📩 Voice AI server message: ${unknown.join(', ')} ${JSON.stringify(msg).slice(0, SERVER_MESSAGE_LOG_MAX_LENGTH)}`);
		}

		if (msg.serverContent) {
			this.handleServerContent(msg.serverContent);
		}
	};

	private readonly connectLive = async () => {
		await this.loadSystemInstruction();
		const tools = await this.loadToolDeclarations();

		this.session = await this.genai.live.connect({
			model: this.opts.config.voice_model!,
			config: {
				responseModalities: [Modality.AUDIO],
				...(this.opts.config.voice_name ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.config.voice_name } } } } : {}),
				...(this.systemInstruction ? { systemInstruction: this.systemInstruction } : {}),
				...(this.isThinkingExtended ? { thinkingConfig: { thinkingLevel: thinkingLevelFor(this.opts.config.voice_thinking) } } : {}),
				inputAudioTranscription: {},
				outputAudioTranscription: {},
				contextWindowCompression: { slidingWindow: {} },
				sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
				realtimeInputConfig: {
					automaticActivityDetection: { disabled: true }
				},
				tools
			},
			callbacks: {
				onopen: () =>
					logger.log(
						`🔊 Voice AI live session open (model=${this.opts.config.voice_model}${this.isThinkingExtended ? ` thinking=${this.opts.config.voice_thinking}` : ''})`
					),
				onmessage: this.handleLiveMessage,
				onerror: (err) => logger.log(`❌ Voice AI session error: ${err?.message || String(err)}`),
				onclose: (e) => {
					logger.log(`🔊 Voice AI live session closed: ${e?.reason || 'no reason'} (closed=${this.isClosed} goodbye=${this.isGoodbyePending})`);
					if (this.closeWaiter) {
						this.closeWaiter();
						return;
					}
					if (!this.isClosed && !this.isGoodbyePending) {
						this.reconnect().catch(() => {});
					}
				}
			}
		});
	};

	private readonly reconnect = async () => {
		if (this.isClosed || this.isGoodbyePending || this.isReconnecting) {
			return;
		}
		this.isReconnecting = true;
		this.stats.reconnects++;
		logger.log(`🔊 Voice AI reconnecting (attempt=${this.stats.reconnects} resume=${this.resumeHandle ? 'yes' : 'no'})`);

		this.isTurnOpen = false;
		this.turnOwnerId = '';
		this.isModelThinking = false;
		if (this.wikiInflight.size) {
			logger.log(`🔎 Voice AI dropping ${this.wikiInflight.size} in-flight wiki lookup(s) across reconnect, staying unmuted until they settle`);
			this.wikiInflight.clear();
		}
		for (const vad of this.voiceState.values()) {
			vad.active = false;
			vad.onset = 0;
		}
		if (this.turnTimer) {
			clearTimeout(this.turnTimer);
			this.turnTimer = null;
		}

		const old = this.session;
		this.session = null;
		if (old) {
			await new Promise((resolve) => {
				const done = setTimeout(resolve, CLOSE_WAIT_MS);
				this.closeWaiter = () => {
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
			this.closeWaiter = null;
		}

		try {
			await this.connectLive();
		} catch (err) {
			logger.log(`❌ Voice AI reconnect failed: ${String(err)}`);
			await this.stop('reconnect_failed');
		} finally {
			this.isReconnecting = false;
		}
	};

	private readonly isBotUser = (userId: string) => {
		if (userId === this.opts.client.user?.id) {
			return true;
		}
		const member = this.opts.client.guilds.cache.get(this.opts.guildId)?.members?.cache?.get(userId);
		if (member) {
			return Boolean(member.user?.bot);
		}
		return Boolean(this.opts.client.users.cache.get(userId)?.bot);
	};

	private readonly detectSpeech = (userId: string, vad: VadState, rms: number) => {
		const now = Date.now();
		vad.frames++;

		const openAt = Math.min(VOICE_RMS_CEILING, Math.max(VOICE_RMS_THRESHOLD, vad.floor * NOISE_FLOOR_MARGIN));

		if (rms >= openAt) {
			vad.onset++;
			vad.lastVoiceAt = now;
		} else if (vad.active && rms >= Math.max(Math.min(VOICE_RMS_RELEASE, openAt * VOICE_RELEASE_RATIO), vad.floor * NOISE_FLOOR_HOLD)) {
			vad.lastVoiceAt = now;
		} else {
			vad.onset = 0;
		}

		if (!vad.active && vad.onset >= VOICE_ONSET_FRAMES) {
			vad.active = true;
			vad.startedAt = now;
			logger.log(`🗣️ Voice AI speech from ${this.nameOf(userId)} (rms=${Math.round(rms)} floor=${Math.round(vad.floor)})`);
		}

		if (vad.active && now - vad.lastVoiceAt > VOICE_HANG_MS) {
			vad.active = false;
			vad.onset = 0;
		}
		return vad.active;
	};

	private readonly mayStream = (userId: string) => {
		if (!this.micIsOpenFor(userId)) {
			this.stats.framesOffTurn++;
			if (this.stats.framesOffTurn % FRAME_LOG_EVERY === 1) {
				logger.log(`🙉 Voice AI ignoring ${this.nameOf(userId)} while talking with ${this.nameOf(this.lockedSpeakerId)}`);
			}
			return false;
		}

		if (!this.claimTurnFor(userId)) {
			this.stats.framesOffTurn++;
			if (this.stats.framesOffTurn % FRAME_LOG_EVERY === 1) {
				logger.log(`⏳ Voice AI deferring ${this.nameOf(userId)} until ${this.nameOf(this.turnOwnerId)} finishes this turn`);
			}
			return false;
		}
		return true;
	};

	private readonly streamFrame = (userId: string, mono16k: Buffer) => {
		try {
			if (userId !== this.lastSpeakerId) {
				this.lastSpeakerId = userId;
				if (this.isAddressed()) {
					this.sendSystemNote(`[System] ${this.nameOf(userId)} is now speaking.`);
				}
			}
			this.openTurn();
			this.session!.sendRealtimeInput({ audio: { data: mono16k.toString('base64'), mimeType: `audio/pcm;rate=${INPUT_RATE}` } });
			this.stats.framesIn++;
			this.stats.bytesIn += mono16k.length;
			this.bumpTurn();
			if (this.stats.framesIn % FRAME_LOG_EVERY === 0) {
				logger.log(
					`🎙️ Voice AI in=${this.stats.framesIn}f/${this.stats.bytesIn}b out=${this.stats.chunksPlayed}c/${this.stats.bytesOut}b dropped=${this.stats.framesDropped}/${this.stats.chunksDropped}`
				);
			}
		} catch (err) {
			this.stats.framesDropped++;
			if (this.stats.framesDropped % INPUT_DROP_LOG_EVERY === 1) {
				logger.log(`⚠️ Voice AI input dropped: ${String(err)}`);
			}
		}
	};

	private readonly handleUserAudio = (userId: string, vad: VadState, pcm: Buffer) => {
		if (this.isClosed || !this.session || this.isGoodbyePending || this.isLeaveRequested) {
			this.stats.framesDropped++;
			return;
		}

		const mono16k = downmixAndResample(pcm, { fromRate: DISCORD_RATE, toRate: INPUT_RATE, fromChannels: 2, toChannels: 1 });
		const rms = rmsOf(mono16k);

		if (this.botIsSpeaking() && !this.tryBargeIn(userId, vad, rms)) {
			this.stats.framesDropped++;
			return;
		}

		const isDiscordSpeaking = this.liveConnection().receiver.speaking.users.has(userId);

		pushWakeAudio(userId, mono16k);

		if (!vad.active && !isDiscordSpeaking) {
			trackNoiseFloor(vad, rms);
		}

		if (!this.isAddressed()) {
			this.stats.framesAsleep++;
			return;
		}

		if (!this.detectSpeech(userId, vad, rms)) {
			this.stats.framesNoise++;
			return;
		}

		if (this.mayStream(userId)) {
			this.streamFrame(userId, mono16k);
		}
	};

	readonly subscribeUser = (userId: string) => {
		if (this.speaking.has(userId)) {
			return;
		}
		if (this.isBotUser(userId)) {
			if (!this.ignoredBots.has(userId)) {
				this.ignoredBots.add(userId);
				logger.log(`🤖 Voice AI ignoring bot audio from ${this.nameOf(userId)}`);
			}
			return;
		}

		const opus = this.liveConnection().receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
		const decoder = new prism.opus.Decoder({ rate: DISCORD_RATE, channels: 2, frameSize: 960 });

		const vad: VadState = { active: false, onset: 0, lastVoiceAt: 0, floor: 0, frames: 0, startedAt: 0, barge: 0 };
		this.voiceState.set(userId, vad);

		decoder.on('data', (pcm: Buffer) => this.handleUserAudio(userId, vad, pcm));
		decoder.on('error', () => {});

		opus.pipe(decoder);
		this.speaking.set(userId, { opus, decoder });
	};

	readonly unsubscribeUser = (userId: string) => {
		this.voiceState.delete(userId);
		dropWakeUser(userId);
		if (this.turnOwnerId === userId) {
			this.turnOwnerId = '';
		}
		const entry = this.speaking.get(userId);
		if (!entry) {
			return;
		}
		entry.opus.destroy();
		entry.decoder.destroy();
		this.speaking.delete(userId);
	};

	readonly stop = async (reason: string) => {
		if (this.isClosed) {
			return;
		}
		this.isClosed = true;
		this.clearTimers();

		this.flushTranscript('user');
		this.flushTranscript('assistant');

		this.offWakeDetected?.();
		this.offWakeDetected = null;
		this.wikiInflight.clear();
		this.bargeInDeafUntil = 0;
		this.activeLookups.clear();
		this.toolBusyUntil = 0;
		this.isModelThinking = false;

		for (const userId of [...this.speaking.keys()]) {
			this.unsubscribeUser(userId);
		}

		try {
			this.session?.close();
		} catch {}
		try {
			this.player?.stop();
			this.outputStream?.destroy();
			this.outputEncoder?.destroy();
			this.connection?.destroy();
		} catch {}

		await clearVoiceState(this.opts.botId);
		await logger.log(
			`🔇 Voice AI left ${this.channelName || this.channelId} (${reason}) turns=${this.stats.turns} in=${this.stats.framesIn}f out=${this.stats.chunksPlayed}c dropped=${this.stats.framesDropped}/${this.stats.chunksDropped} noise=${this.stats.framesNoise} asleep=${this.stats.framesAsleep} offTurn=${this.stats.framesOffTurn} suppressed=${this.stats.repliesSuppressed} queueHigh=${this.stats.queueHigh} interrupts=${this.stats.interrupts} reconnects=${this.stats.reconnects}`
		);
		this.opts.onEnded?.(reason);
	};

	readonly start = async () => {
		const guild = this.opts.client.guilds.cache.get(this.opts.guildId);
		if (!guild) {
			throw new Error('Guild not available');
		}

		this.connection = joinVoiceChannel({
			channelId: this.channelId,
			guildId: this.opts.guildId,
			adapterCreator: guild.voiceAdapterCreator,
			selfDeaf: false,
			selfMute: false
		});

		await entersState(this.connection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);

		this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play, maxMissedFrames: MAX_MISSED_FRAMES } });
		this.connection.subscribe(this.player);
		this.player.on('error', (err) => logger.log(`❌ Voice AI player error: ${err?.message || err}`));
		this.player.on('stateChange', (oldState, newState) => {
			if (this.isClosed || oldState.status === newState.status) {
				return;
			}
			logger.log(
				`🔊 Voice AI player ${oldState.status} -> ${newState.status} (frames=${this.stats.framesOut} silence=${this.stats.silenceOut} queued=${this.playbackQueue.length})`
			);
			if (newState.status === AudioPlayerStatus.Idle && !this.isGoodbyePending) {
				logger.log('⚠️ Voice AI player went idle unexpectedly, restarting output');
				this.startOutput();
			}
		});
		this.startOutput();

		const wakePending = wakeModelAvailable() ? warmWakeModel().catch(() => false) : Promise.resolve(false);

		this.offWakeDetected = onWakeDetected((userId, score) => {
			if (this.isClosed || this.isAddressed() || this.isBotUser(userId)) {
				return;
			}
			this.lastSpeakerId = userId;
			logger.log(`👋 Voice AI woken by ${this.nameOf(userId)} ("hey stupid" ${score.toFixed(2)})`);
			this.markAddressed({ verified: true });
			this.sendSystemNote(WAKE_ACK_PROMPT);
		});

		await this.connectLive();

		this.connection.receiver.speaking.on('start', (userId: string) => {
			if (userId !== this.opts.client.user?.id) {
				this.subscribeUser(userId);
			}
		});

		const channel = guild.channels.cache.get(this.channelId) as VoiceBasedChannel | undefined;
		for (const [memberId, member] of channel?.members ?? []) {
			if (!member.user.bot && memberId !== this.opts.client.user?.id) {
				this.subscribeUser(memberId);
			}
		}

		await this.ensureUnmuted();
		await this.ensureUndeafened();

		const isWakeLoaded = await wakePending;
		logger.log(`👥 Voice AI participants: ${this.rosterText()} | wake=${isWakeLoaded ? 'hey stupid (model ready)' : 'none — bot cannot be woken'}`);

		this.announceRoster();
		this.announceWakePhrase();

		const startedAt = Date.now();
		await writeVoiceState(this.opts.botId, {
			guildId: this.opts.guildId,
			channelId: this.channelId,
			channelName: this.channelName,
			inviterId: this.opts.inviterId,
			textChannelId: this.opts.textChannelId,
			startedAt
		});
		this.heartbeat = setInterval(() => {
			if (!this.isClosed) {
				writeVoiceState(this.opts.botId, {
					guildId: this.opts.guildId,
					channelId: this.channelId,
					channelName: this.channelName,
					inviterId: this.opts.inviterId,
					textChannelId: this.opts.textChannelId,
					startedAt
				}).catch(() => {});
			}
		}, HEARTBEAT_MS);

		await logger.log(`🔊 Voice AI joined ${this.channelName || this.channelId}`);
	};

	readonly ensureUnmuted = async () => {
		if (this.isClosed) {
			return;
		}
		const me = this.opts.client.guilds.cache.get(this.opts.guildId)?.members?.me;
		if (!me?.voice?.serverMute) {
			return;
		}

		try {
			await me.voice.setMute(false, 'Voice AI needs to speak');
			logger.log('🔊 Voice AI self-unmuted after server mute');
		} catch (err) {
			logger.log(`⚠️ Voice AI is server muted and cannot unmute itself (needs Mute Members): ${(err as Error)?.message || err}`);
		}
	};

	readonly ensureUndeafened = async () => {
		if (this.isClosed) {
			return;
		}
		const me = this.opts.client.guilds.cache.get(this.opts.guildId)?.members?.me;
		if (!me?.voice?.serverDeaf) {
			return;
		}

		try {
			await me.voice.setDeaf(false, 'Voice AI needs to hear');
			logger.log('👂 Voice AI self-undeafened after server deafen');
		} catch (err) {
			logger.log(`⚠️ Voice AI is server deafened and cannot undeafen itself (needs Deafen Members): ${(err as Error)?.message || err}`);
		}
	};

	private readonly setSelfMute = (isMuted: boolean) => {
		if (this.isClosed || this.isSelfMuted === isMuted) {
			return;
		}
		if (isMuted) {
			this.playbackQueue.splice(0);
			this.pending = EMPTY;
			this.pendingOffset = 0;
		}

		if (this.muteRetryTimer) {
			clearTimeout(this.muteRetryTimer);
			this.muteRetryTimer = null;
		}

		if (this.liveConnection().rejoin({ channelId: this.channelId, selfDeaf: false, selfMute: isMuted })) {
			this.isSelfMuted = isMuted;
			logger.log(isMuted ? '🔇 Voice AI muted (not addressed)' : '🎤 Voice AI unmuted (listening)');
			return;
		}

		logger.log(
			`⚠️ Voice AI could not ${isMuted ? 'mute' : 'unmute'} — Discord did not accept it (connection=${this.liveConnection().state.status}), still ${this.isSelfMuted ? 'muted' : 'live'}, retrying`
		);
		this.muteRetryTimer = setTimeout(() => {
			this.muteRetryTimer = null;
			this.retrySelfMute(isMuted);
		}, MUTE_RETRY_MS);
	};

	private readonly retrySelfMute = async (isMuted: boolean) => {
		if (this.isClosed || this.isSelfMuted === isMuted) {
			return;
		}

		if (this.liveConnection().state.status !== VoiceConnectionStatus.Ready) {
			try {
				this.liveConnection().rejoin({ channelId: this.channelId, selfDeaf: false, selfMute: isMuted });
				await entersState(this.liveConnection(), VoiceConnectionStatus.Ready, MUTE_RECOVER_MS);
				this.isSelfMuted = isMuted;
				logger.log(`🔗 Voice AI recovered the voice connection and is now ${isMuted ? 'muted' : 'live'}`);
				return;
			} catch (err) {
				logger.log(`❌ Voice AI lost the voice connection while trying to ${isMuted ? 'mute' : 'unmute'}: ${(err as Error)?.message || err}`);
				await this.stop('mute_failed');
				return;
			}
		}

		if (this.liveConnection().rejoin({ channelId: this.channelId, selfDeaf: false, selfMute: isMuted })) {
			this.isSelfMuted = isMuted;
			logger.log(isMuted ? '🔇 Voice AI muted (not addressed)' : '🎤 Voice AI unmuted (listening)');
			return;
		}

		logger.log(`❌ Voice AI still cannot ${isMuted ? 'mute' : 'unmute'} after a retry, ending the session rather than staying live`);
		await this.stop('mute_failed');
	};

	readonly moveTo = async (nextChannelId: string, nextChannelName: string | undefined) => {
		if (this.isClosed || nextChannelId === this.channelId) {
			return;
		}

		this.channelId = nextChannelId;
		this.channelName = nextChannelName || nextChannelId;

		try {
			this.liveConnection().rejoin({ channelId: nextChannelId, selfDeaf: false, selfMute: this.isSelfMuted });
			await entersState(this.liveConnection(), VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
		} catch (err) {
			logger.log(`❌ Voice AI failed to return to inviter: ${(err as Error)?.message || err}`);
			await this.stop('rejoin_failed');
			return;
		}

		for (const userId of [...this.speaking.keys()]) {
			this.unsubscribeUser(userId);
		}
		const channel = this.opts.client.guilds.cache.get(this.opts.guildId)?.channels?.cache?.get(nextChannelId) as VoiceBasedChannel | undefined;
		for (const [memberId, member] of channel?.members ?? []) {
			if (!member.user.bot && memberId !== this.opts.client.user?.id) {
				this.subscribeUser(memberId);
			}
		}

		await this.ensureUnmuted();
		await this.ensureUndeafened();
		if (this.lockedSpeakerId && !this.speaking.has(this.lockedSpeakerId)) {
			this.releaseSpeakerLock();
		}
		this.announceRoster();
		logger.log(`🔊 Voice AI followed inviter back to ${this.channelName}`);
	};

	readonly noteJoined = (userId: string) => {
		if (this.isClosed || this.isBotUser(userId)) {
			return;
		}
		this.names.delete(userId);
		this.sendSystemNote(`[System] ${this.nameOf(userId)} joined the voice channel.`);
	};

	readonly noteLeft = (userId: string) => {
		if (this.isClosed || this.isBotUser(userId)) {
			return;
		}
		const name = this.nameOf(userId);
		this.names.delete(userId);
		if (this.lastSpeakerId === userId) {
			this.lastSpeakerId = '';
		}
		if (this.lockedSpeakerId === userId) {
			this.releaseSpeakerLock();
		}
		this.sendSystemNote(`[System] ${name} left the voice channel.`);
	};
}

export function createVoiceSession(options: VoiceSessionOptions) {
	const voice = new VoiceSession(options);
	return {
		start: voice.start,
		stop: voice.stop,
		subscribeUser: voice.subscribeUser,
		unsubscribeUser: voice.unsubscribeUser,
		ensureUnmuted: voice.ensureUnmuted,
		ensureUndeafened: voice.ensureUndeafened,
		moveTo: voice.moveTo,
		noteJoined: voice.noteJoined,
		noteLeft: voice.noteLeft,
		get inviterId() {
			return options.inviterId;
		},
		get channelId() {
			return voice.channelId;
		}
	};
}
