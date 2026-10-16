import type { InferenceSession } from 'onnxruntime-node';
import { parentPort, workerData } from 'node:worker_threads';
import { SECOND_MS } from '../../../../utils/time.js';

const { melPath, embPath, wakePath, threshold, patience, refractoryMs, debug } = workerData;

const SAMPLE_RATE = 16000;
const STEP_SAMPLES = 1280;
const MEL_LOOKBACK_SAMPLES = 480;
const MEL_BINS = 32;
const MEL_WINDOW_FRAMES = 76;
const MEL_STRIDE_FRAMES = 8;
const MEL_BUFFER_MAX_FRAMES = 970;
const EMBEDDING_DIM = 96;
const FEATURE_BUFFER_MAX_ROWS = 120;
const RAW_BUFFER_SECONDS = 10;
const RAW_BUFFER_MAX_SAMPLES = SAMPLE_RATE * RAW_BUFFER_SECONDS;
const PREDICTION_WARMUP = 5;
const DEBUG_INTERVAL_MS = 2000;
const IDLE_EVICT_MS = 60_000;
const DEFAULT_WAKE_INPUT_ROWS = 16;
const STATS_REPORT_INTERVAL_MS = 10_000;
const USER_ID_LOG_SUFFIX_LENGTH = 4;
const SCORE_LOG_DECIMALS = 5;
const LEVEL_RMS_SMOOTHING = 0.05;
const MEL_SCALE_DIVISOR = 10;
const PREDICTION_HISTORY = 30;
const GAP_MS = 200;
const GAP_CHECK_MS = 100;
const GAP_FILL_MS = 1000;
const GAP_FILL_SAMPLES = (SAMPLE_RATE * GAP_FILL_MS) / SECOND_MS;
const PRIME_MEL_STEPS = Math.ceil(MEL_WINDOW_FRAMES / MEL_STRIDE_FRAMES);

let sessions: {
	mel: InferenceSession;
	emb: InferenceSession;
	wake: InferenceSession;
	wakeInputRows: number;
	Tensor: typeof import('onnxruntime-node').Tensor;
} | null = null;

function post(message: unknown) {
	parentPort?.postMessage(message);
}

async function loadSessions() {
	if (sessions) {
		return sessions;
	}

	const ort = await import('onnxruntime-node');
	const [mel, emb, wake] = await Promise.all([
		ort.InferenceSession.create(melPath),
		ort.InferenceSession.create(embPath),
		ort.InferenceSession.create(wakePath)
	]);

	const input = wake.inputMetadata.find((m) => m.name === wake.inputNames[0]);
	const rows = input?.isTensor ? input.shape[1] : undefined;
	const wakeInputRows = typeof rows === 'number' && rows > 0 ? rows : DEFAULT_WAKE_INPUT_ROWS;

	sessions = { mel, emb, wake, wakeInputRows, Tensor: ort.Tensor };
	return sessions;
}

type Detector = {
	raw: Float32Array;
	rawFilled: number;
	remainder: Float32Array;
	accumulated: number;
	mels: Float32Array[];
	features: Float32Array[];
	predictions: number[];
	lastDetectionAt: number;
	lastSeenAt: number;
	peakScore: number;
	allTimePeak: number;
	lastScore: number;
	streak: number;
	inferences: number;
	levelRms: number;
	melMin: number;
	melMax: number;
	isPrimed: boolean;
	isGapFilled: boolean;
};
type QueuedAudio = { userId: string; samples: Float32Array; isSpeech: boolean };

const detectors = new Map<string, Detector>();
let queue: QueuedAudio[] = [];
let isDraining = false;
let lastDebugAt = 0;
let framesReceived = 0;
let stepsProcessed = 0;

function reportStats() {
	const parts = [...detectors.entries()].map(
		([userId, state]) =>
			`${userId.slice(-USER_ID_LOG_SUFFIX_LENGTH)}:last=${state.lastScore.toFixed(SCORE_LOG_DECIMALS)}/peak=${state.peakScore.toFixed(SCORE_LOG_DECIMALS)}/allpeak=${state.allTimePeak.toFixed(SCORE_LOG_DECIMALS)}/melmin=${state.melMin.toFixed(2)}/melmax=${state.melMax.toFixed(2)}/feat=${state.features.length}/inf=${state.inferences}/rms=${Math.round(state.levelRms)}`
	);
	post({
		type: 'debug',
		text: `threshold=${threshold} patience=${patience} users=${detectors.size} frames=${framesReceived} steps=${stepsProcessed} queued=${queue.length} ${parts.join(' ')}`
	});
	for (const state of detectors.values()) {
		state.peakScore = 0;
	}
}

setInterval(() => {
	if (detectors.size || framesReceived) {
		reportStats();
	}
}, STATS_REPORT_INTERVAL_MS).unref();

function createDetector(): Detector {
	const mels: Float32Array[] = [];
	for (let i = 0; i < MEL_WINDOW_FRAMES; i++) {
		mels.push(new Float32Array(MEL_BINS).fill(1));
	}

	return {
		raw: new Float32Array(RAW_BUFFER_MAX_SAMPLES),
		rawFilled: 0,
		remainder: new Float32Array(0),
		accumulated: 0,
		mels,
		features: [],
		predictions: [],
		lastDetectionAt: 0,
		lastSeenAt: Date.now(),
		peakScore: 0,
		allTimePeak: 0,
		lastScore: 0,
		streak: 0,
		inferences: 0,
		levelRms: 0,
		melMin: 0,
		melMax: 0,
		isPrimed: false,
		isGapFilled: false
	};
}

function detectorFor(userId: string) {
	let state = detectors.get(userId);
	if (!state) {
		state = createDetector();
		detectors.set(userId, state);
	}
	return state;
}

function resetDetector(state: Detector) {
	state.isPrimed = false;
	state.streak = 0;
	state.rawFilled = 0;
	state.remainder = new Float32Array(0);
	state.accumulated = 0;
	state.mels.splice(0);
	for (let i = 0; i < MEL_WINDOW_FRAMES; i++) {
		state.mels.push(new Float32Array(MEL_BINS).fill(1));
	}
	state.features.splice(0);
	state.predictions.splice(0);
}

function evictIdle() {
	const now = Date.now();
	for (const [userId, state] of detectors) {
		if (now - state.lastSeenAt > IDLE_EVICT_MS) {
			detectors.delete(userId);
		}
	}
}

function appendRaw(state: Detector, samples: Float32Array) {
	const incoming = samples.length;
	if (incoming >= RAW_BUFFER_MAX_SAMPLES) {
		state.raw.set(samples.subarray(incoming - RAW_BUFFER_MAX_SAMPLES));
		state.rawFilled = RAW_BUFFER_MAX_SAMPLES;
		return;
	}
	if (state.rawFilled + incoming > RAW_BUFFER_MAX_SAMPLES) {
		const drop = state.rawFilled + incoming - RAW_BUFFER_MAX_SAMPLES;
		state.raw.copyWithin(0, drop, state.rawFilled);
		state.rawFilled -= drop;
	}
	state.raw.set(samples, state.rawFilled);
	state.rawFilled += incoming;
}

function trackLevel(state: Detector, samples: Float32Array) {
	let sum = 0;
	for (let i = 0; i < samples.length; i++) {
		sum += samples[i] * samples[i];
	}
	const rms = Math.sqrt(sum / Math.max(1, samples.length));
	state.levelRms = state.levelRms ? state.levelRms + LEVEL_RMS_SMOOTHING * (rms - state.levelRms) : rms;
}

async function computeMelFrames(active: NonNullable<typeof sessions>, state: Detector, nSamples: number) {
	const take = Math.min(state.rawFilled, nSamples + MEL_LOOKBACK_SAMPLES);
	const audio = state.raw.slice(state.rawFilled - take, state.rawFilled);

	const out = await active.mel.run({ input: new active.Tensor('float32', audio, [1, audio.length]) });
	const data = out[active.mel.outputNames[0]].data as Float32Array;
	const frames = Math.floor(data.length / MEL_BINS);

	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < frames; i++) {
		const frame = new Float32Array(MEL_BINS);
		for (let j = 0; j < MEL_BINS; j++) {
			const v = data[i * MEL_BINS + j] / MEL_SCALE_DIVISOR + 2;
			frame[j] = v;
			if (v < lo) {
				lo = v;
			}
			if (v > hi) {
				hi = v;
			}
		}
		state.mels.push(frame);
	}
	if (frames) {
		state.melMin = lo;
		state.melMax = hi;
	}

	if (state.mels.length > MEL_BUFFER_MAX_FRAMES) {
		state.mels.splice(0, state.mels.length - MEL_BUFFER_MAX_FRAMES);
	}
}

async function computeFeatures(active: NonNullable<typeof sessions>, state: Detector, steps: number) {
	for (let i = steps - 1; i >= 0; i--) {
		const end = i === 0 ? state.mels.length : state.mels.length - MEL_STRIDE_FRAMES * i;
		const start = end - MEL_WINDOW_FRAMES;
		if (start < 0) {
			continue;
		}

		const flat = new Float32Array(MEL_WINDOW_FRAMES * MEL_BINS);
		for (let f = 0; f < MEL_WINDOW_FRAMES; f++) {
			flat.set(state.mels[start + f], f * MEL_BINS);
		}

		const out = await active.emb.run({
			input_1: new active.Tensor('float32', flat, [1, MEL_WINDOW_FRAMES, MEL_BINS, 1])
		});
		state.features.push(out[active.emb.outputNames[0]].data as Float32Array);
	}
}

async function classify(active: NonNullable<typeof sessions>, state: Detector, offset: number) {
	const rows = active.wakeInputRows;
	const end = state.features.length - offset;
	const start = end - rows;
	if (start < 0) {
		return null;
	}

	const flat = new Float32Array(rows * EMBEDDING_DIM);
	for (let i = 0; i < rows; i++) {
		flat.set(state.features[start + i], i * EMBEDDING_DIM);
	}

	const out = await active.wake.run({
		[active.wake.inputNames[0]]: new active.Tensor('float32', flat, [1, rows, EMBEDDING_DIM])
	});
	return (out[active.wake.outputNames[0]].data as Float32Array)[0];
}

function ingest(state: Detector, { samples: incomingSamples, isSpeech }: QueuedAudio) {
	if (isSpeech) {
		trackLevel(state, incomingSamples);
	}

	let x = incomingSamples;
	if (state.remainder.length) {
		const merged = new Float32Array(state.remainder.length + x.length);
		merged.set(state.remainder, 0);
		merged.set(x, state.remainder.length);
		x = merged;
		state.remainder = new Float32Array(0);
	}

	if (state.accumulated + x.length >= STEP_SAMPLES) {
		const remainder = (state.accumulated + x.length) % STEP_SAMPLES;
		if (remainder !== 0) {
			const head = x.subarray(0, x.length - remainder);
			appendRaw(state, head);
			state.accumulated += head.length;
			state.remainder = x.slice(x.length - remainder);
		} else {
			appendRaw(state, x);
			state.accumulated += x.length;
		}
	} else {
		state.accumulated += x.length;
		appendRaw(state, x);
	}
}

async function processUser(active: NonNullable<typeof sessions>, userId: string, state: Detector) {
	if (state.accumulated < STEP_SAMPLES || state.accumulated % STEP_SAMPLES !== 0) {
		return;
	}

	const prepared = state.accumulated;
	const steps = prepared / STEP_SAMPLES;

	await computeMelFrames(active, state, prepared);
	await computeFeatures(active, state, steps);
	state.accumulated = 0;

	if (state.features.length > FEATURE_BUFFER_MAX_ROWS) {
		state.features.splice(0, state.features.length - FEATURE_BUFFER_MAX_ROWS);
	}

	for (let i = steps - 1; i >= 0; i--) {
		const score = await classify(active, state, i);
		if (score !== null) {
			scoreStep(userId, state, score);
		}
	}
}

function scoreStep(userId: string, state: Detector, rawScore: number) {
	stepsProcessed++;
	state.inferences++;

	const score = state.predictions.length < PREDICTION_WARMUP ? 0 : rawScore;
	state.predictions.push(score);
	if (state.predictions.length > PREDICTION_HISTORY) {
		state.predictions.shift();
	}

	state.lastScore = score;
	if (score > state.peakScore) {
		state.peakScore = score;
	}
	if (score > state.allTimePeak) {
		state.allTimePeak = score;
	}

	state.streak = score >= threshold ? state.streak + 1 : 0;

	const now = Date.now();
	if (state.streak >= patience && now - state.lastDetectionAt > refractoryMs) {
		state.lastDetectionAt = now;
		state.streak = 0;
		state.predictions.splice(0);
		for (let i = 0; i < PREDICTION_WARMUP; i++) {
			state.predictions.push(0);
		}
		post({ type: 'detected', userId, score });
	}
}

async function primeDetector(active: NonNullable<typeof sessions>, userId: string, state: Detector) {
	state.isPrimed = true;
	const steps = PRIME_MEL_STEPS + active.wakeInputRows + PREDICTION_WARMUP;
	for (let i = 0; i < steps; i++) {
		ingest(state, { userId, samples: new Float32Array(STEP_SAMPLES), isSpeech: false });
		await processUser(active, userId, state);
	}
}

function fillGaps() {
	const now = Date.now();
	let hasGap = false;
	for (const [userId, state] of detectors) {
		if (state.isGapFilled || now - state.lastSeenAt < GAP_MS) {
			continue;
		}
		state.isGapFilled = true;
		queue.push({ userId, samples: new Float32Array(GAP_FILL_SAMPLES), isSpeech: false });
		hasGap = true;
	}
	if (hasGap) {
		drain();
	}
}

setInterval(fillGaps, GAP_CHECK_MS).unref();

async function drain() {
	if (isDraining) {
		return;
	}
	isDraining = true;

	try {
		const active = await loadSessions();

		while (queue.length) {
			const batch = queue;
			queue = [];

			const byUser = new Map<string, QueuedAudio[]>();
			for (const item of batch) {
				const list = byUser.get(item.userId);
				if (list) {
					list.push(item);
				} else {
					byUser.set(item.userId, [item]);
				}
			}

			for (const [userId, chunks] of byUser) {
				const state = detectorFor(userId);
				if (!state.isPrimed) {
					await primeDetector(active, userId, state);
				}
				for (const chunk of chunks) {
					ingest(state, chunk);
				}
				await processUser(active, userId, state);
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
	} catch (error) {
		post({ type: 'error', message: (error as Error)?.message ?? String(error) });
		queue = [];
	} finally {
		isDraining = false;
		if (queue.length) {
			drain();
		}
	}
}

parentPort?.on('message', (msg) => {
	if (msg?.type === 'audio') {
		framesReceived++;
		const state = detectorFor(msg.userId);
		state.lastSeenAt = Date.now();
		state.isGapFilled = false;
		queue.push({ userId: msg.userId, samples: new Float32Array(msg.samples), isSpeech: true });
		drain();
		return;
	}

	if (msg?.type === 'reset') {
		const state = detectors.get(msg.userId);
		if (state) {
			resetDetector(state);
		}
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
