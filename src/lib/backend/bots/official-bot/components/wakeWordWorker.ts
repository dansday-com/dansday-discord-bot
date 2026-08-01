import type { InferenceSession } from 'onnxruntime-node';
import { parentPort, workerData } from 'node:worker_threads';

const { melPath, embPath, wakePath, threshold, refractoryMs, debug } = workerData;

const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1280;
const MEL_FRAMES_PER_EMBEDDING = 76;
const EMBEDDING_DIM = 96;
const EMBEDDING_WINDOW = 16;
const MEL_STRIDE = 8;
const AUDIO_BUFFER_SAMPLES = SAMPLE_RATE * 3;
const MEL_BUFFER_FRAMES = 400;
const MAX_PENDING_SAMPLES = CHUNK_SAMPLES * 12;
const DEBUG_INTERVAL_MS = 2000;
const IDLE_EVICT_MS = 60_000;

const AGC_TARGET_RMS = 2000;
const AGC_SILENCE_RMS = 60;
const AGC_ALPHA = 0.05;
const AGC_MIN_GAIN = 0.5;
const AGC_MAX_GAIN = 12;

let sessions: {
	mel: InferenceSession;
	emb: InferenceSession;
	wake: InferenceSession;
	Tensor: typeof import('onnxruntime-node').Tensor;
} | null = null;

function post(message: any) {
	parentPort?.postMessage(message);
}

async function loadSessions() {
	if (sessions) return sessions;

	const ort = await import('onnxruntime-node');
	const [mel, emb, wake] = await Promise.all([
		ort.InferenceSession.create(melPath),
		ort.InferenceSession.create(embPath),
		ort.InferenceSession.create(wakePath)
	]);

	sessions = { mel, emb, wake, Tensor: ort.Tensor };
	return sessions;
}

type Detector = {
	audio: Float32Array;
	audioFilled: number;
	pending: number;
	mels: Float32Array[];
	embeddings: Float32Array[];
	melFramesSinceEmbedding: number;
	lastDetectionAt: number;
	lastSeenAt: number;
	peakScore: number;
	lastScore: number;
	inferences: number;
	levelRms: number;
};

const detectors = new Map<string, Detector>();
let queue: Array<{ userId: string; samples: Float32Array }> = [];
let draining = false;
let lastDebugAt = 0;
let framesReceived = 0;
let chunksProcessed = 0;

function reportStats() {
	const parts = [...detectors.entries()].map(
		([userId, state]) =>
			`${userId.slice(-4)}:last=${state.lastScore.toFixed(2)}/peak=${state.peakScore.toFixed(2)}/emb=${state.embeddings.length}/inf=${state.inferences}/rms=${Math.round(state.levelRms)}/gain=${(state.levelRms ? Math.min(AGC_MAX_GAIN, Math.max(AGC_MIN_GAIN, AGC_TARGET_RMS / state.levelRms)) : 1).toFixed(1)}`
	);
	post({
		type: 'debug',
		text: `threshold=${threshold} users=${detectors.size} frames=${framesReceived} chunks=${chunksProcessed} queued=${queue.length} ${parts.join(' ')}`
	});
	for (const state of detectors.values()) state.peakScore = 0;
}

setInterval(() => {
	if (detectors.size || framesReceived) reportStats();
}, 10_000).unref();

function createDetector(): Detector {
	return {
		audio: new Float32Array(AUDIO_BUFFER_SAMPLES),
		audioFilled: 0,
		pending: 0,
		mels: [],
		embeddings: [],
		melFramesSinceEmbedding: 0,
		lastDetectionAt: 0,
		lastSeenAt: Date.now(),
		peakScore: 0,
		lastScore: 0,
		inferences: 0,
		levelRms: 0
	};
}

function resetDetector(state: Detector) {
	state.audioFilled = 0;
	state.pending = 0;
	state.mels.length = 0;
	state.embeddings.length = 0;
	state.melFramesSinceEmbedding = 0;
}

function evictIdle() {
	const now = Date.now();
	for (const [userId, state] of detectors) {
		if (now - state.lastSeenAt > IDLE_EVICT_MS) detectors.delete(userId);
	}
}

async function computeMels(active: NonNullable<typeof sessions>, state: Detector, samples: Float32Array) {
	const out = await active.mel.run({ input: new active.Tensor('float32', samples, [1, samples.length]) });
	const data = out[active.mel.outputNames[0]].data as Float32Array;
	const frames = data.length / 32;

	for (let i = 0; i < frames; i++) {
		const frame = new Float32Array(32);
		for (let j = 0; j < 32; j++) frame[j] = data[i * 32 + j] / 10 + 2;
		state.mels.push(frame);
	}
	if (state.mels.length > MEL_BUFFER_FRAMES) state.mels.splice(0, state.mels.length - MEL_BUFFER_FRAMES);
}

async function computeEmbedding(active: NonNullable<typeof sessions>, state: Detector) {
	const window = state.mels.slice(-MEL_FRAMES_PER_EMBEDDING);
	const flat = new Float32Array(MEL_FRAMES_PER_EMBEDDING * 32);
	for (let i = 0; i < MEL_FRAMES_PER_EMBEDDING; i++) flat.set(window[i], i * 32);

	const out = await active.emb.run({
		input_1: new active.Tensor('float32', flat, [1, MEL_FRAMES_PER_EMBEDDING, 32, 1])
	});

	state.embeddings.push(out[active.emb.outputNames[0]].data as Float32Array);
	if (state.embeddings.length > EMBEDDING_WINDOW) state.embeddings.splice(0, state.embeddings.length - EMBEDDING_WINDOW);
}

async function classify(active: NonNullable<typeof sessions>, state: Detector) {
	const flat = new Float32Array(EMBEDDING_WINDOW * EMBEDDING_DIM);
	for (let i = 0; i < EMBEDDING_WINDOW; i++) flat.set(state.embeddings[i], i * EMBEDDING_DIM);

	const out = await active.wake.run({
		[active.wake.inputNames[0]]: new active.Tensor('float32', flat, [1, EMBEDDING_WINDOW, EMBEDDING_DIM])
	});

	return (out[active.wake.outputNames[0]].data as Float32Array)[0];
}

function applyGain(state: Detector, samples: Float32Array) {
	let sum = 0;
	for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
	const rms = Math.sqrt(sum / Math.max(1, samples.length));

	if (rms < AGC_SILENCE_RMS) return samples;

	state.levelRms = state.levelRms ? state.levelRms + AGC_ALPHA * (rms - state.levelRms) : rms;

	const gain = Math.min(AGC_MAX_GAIN, Math.max(AGC_MIN_GAIN, AGC_TARGET_RMS / state.levelRms));
	if (Math.abs(gain - 1) < 0.05) return samples;

	const out = new Float32Array(samples.length);
	for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, samples[i] * gain));
	return out;
}

function ingest(userId: string, incomingSamples: Float32Array) {
	let state = detectors.get(userId);
	if (!state) {
		state = createDetector();
		detectors.set(userId, state);
	}

	state.lastSeenAt = Date.now();

	const samples = applyGain(state, incomingSamples);
	const incoming = samples.length;
	if (state.audioFilled + incoming > AUDIO_BUFFER_SAMPLES) {
		const keep = Math.max(0, AUDIO_BUFFER_SAMPLES - incoming);
		state.audio.copyWithin(0, state.audioFilled - keep, state.audioFilled);
		state.audioFilled = keep;
	}
	state.audio.set(samples, state.audioFilled);
	state.audioFilled += incoming;
	state.pending = Math.min(state.pending + incoming, state.audioFilled, MAX_PENDING_SAMPLES);

	return state;
}

async function processUser(active: NonNullable<typeof sessions>, userId: string, state: Detector) {
	while (state.pending >= CHUNK_SAMPLES) {
		const end = state.audioFilled - state.pending + CHUNK_SAMPLES;
		const chunk = state.audio.slice(end - CHUNK_SAMPLES, end);
		state.pending -= CHUNK_SAMPLES;

		const before = state.mels.length;
		await computeMels(active, state, chunk);
		state.melFramesSinceEmbedding += state.mels.length - before;

		while (state.mels.length >= MEL_FRAMES_PER_EMBEDDING && state.melFramesSinceEmbedding >= MEL_STRIDE) {
			state.melFramesSinceEmbedding -= MEL_STRIDE;
			await computeEmbedding(active, state);
		}

		if (state.embeddings.length < EMBEDDING_WINDOW) continue;

		chunksProcessed++;
		const score = await classify(active, state);
		state.inferences++;
		state.lastScore = score;
		if (score > state.peakScore) state.peakScore = score;

		const now = Date.now();
		if (score >= threshold && now - state.lastDetectionAt > refractoryMs) {
			state.lastDetectionAt = now;
			resetDetector(state);
			post({ type: 'detected', userId, score });
			return;
		}
	}
}

async function drain() {
	if (draining) return;
	draining = true;

	try {
		const active = await loadSessions();

		while (queue.length) {
			const batch = queue;
			queue = [];

			const byUser = new Map<string, Float32Array[]>();
			for (const item of batch) {
				const list = byUser.get(item.userId);
				if (list) list.push(item.samples);
				else byUser.set(item.userId, [item.samples]);
			}

			for (const [userId, chunks] of byUser) {
				let state: Detector | undefined;
				for (const samples of chunks) state = ingest(userId, samples);
				if (state) await processUser(active, userId, state);
			}
		}

		if (debug) {
			const now = Date.now();
			if (now - lastDebugAt >= DEBUG_INTERVAL_MS) {
				lastDebugAt = now;
				reportStats();
			}
		}

		evictIdle();
	} catch (error: any) {
		post({ type: 'error', message: error?.message ?? String(error) });
		queue = [];
	} finally {
		draining = false;
		if (queue.length) void drain();
	}
}

parentPort?.on('message', (msg) => {
	if (msg?.type === 'audio') {
		framesReceived++;
		queue.push({ userId: msg.userId, samples: new Float32Array(msg.samples) });
		void drain();
		return;
	}

	if (msg?.type === 'reset') {
		const state = detectors.get(msg.userId);
		if (state) resetDetector(state);
		return;
	}

	if (msg?.type === 'drop') {
		detectors.delete(msg.userId);
		return;
	}

	if (msg?.type === 'warm') {
		loadSessions()
			.then(() => post({ type: 'ready' }))
			.catch((error) => post({ type: 'error', message: error?.message ?? String(error) }));
	}
});
