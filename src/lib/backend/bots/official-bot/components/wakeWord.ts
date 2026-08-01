import type { InferenceSession } from 'onnxruntime-node';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '../../../../utils/index.js';

const MODEL_FILES = ['melspectrogram.onnx', 'embedding_model.onnx', 'hey_stupid.onnx'];

function findModelDir() {
	const hasModels = (dir: string) => MODEL_FILES.every((file) => fs.existsSync(path.join(dir, file)));

	let dir = path.dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < 24; i++) {
		const candidate = path.join(dir, 'static', 'wakeword');
		if (hasModels(candidate)) return candidate;

		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return path.resolve('static/wakeword');
}

const MODEL_DIR = findModelDir();
const [MEL_PATH, EMB_PATH, WAKE_PATH] = MODEL_FILES.map((file) => path.join(MODEL_DIR, file));

const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1280;
const MEL_FRAMES_PER_EMBEDDING = 76;
const EMBEDDING_DIM = 96;
const EMBEDDING_WINDOW = 16;
const MEL_STRIDE = 8;
const AUDIO_BUFFER_SAMPLES = SAMPLE_RATE * 3;
const MEL_BUFFER_FRAMES = 400;

const DETECT_THRESHOLD = Number(process.env.WAKE_THRESHOLD ?? 0.3);
const REFRACTORY_MS = 2000;
const DEBUG_WAKE = process.env.WAKE_DEBUG === '1';
const DEBUG_INTERVAL_MS = 2000;

let sessions: {
	mel: InferenceSession;
	emb: InferenceSession;
	wake: InferenceSession;
	Tensor: typeof import('onnxruntime-node').Tensor;
} | null = null;
let loadFailed = false;

let reportedUnavailable = false;

export function wakeModelAvailable() {
	if (loadFailed) return false;

	const missing = [MEL_PATH, EMB_PATH, WAKE_PATH].filter((p) => !fs.existsSync(p));
	if (!missing.length) return true;

	if (!reportedUnavailable) {
		reportedUnavailable = true;
		logger.log(`🔇 Wake word unavailable, missing: ${missing.join(', ')} (dir=${MODEL_DIR}, cwd=${process.cwd()})`);
	}
	return false;
}

async function loadSessions() {
	if (sessions || loadFailed) return sessions;

	if (!wakeModelAvailable()) {
		loadFailed = true;
		logger.log(`🔇 Wake word model files missing in ${MODEL_DIR}, falling back to transcript matching`);
		return null;
	}

	try {
		const ort = await import('onnxruntime-node');
		const [mel, emb, wake] = await Promise.all([
			ort.InferenceSession.create(MEL_PATH),
			ort.InferenceSession.create(EMB_PATH),
			ort.InferenceSession.create(WAKE_PATH)
		]);
		sessions = { mel, emb, wake, Tensor: ort.Tensor };
		logger.log('🧠 Wake word model loaded (hey stupid)');
	} catch (error) {
		loadFailed = true;
		logger.log(`❌ Wake word model failed to load: ${error.message}`);
	}

	return sessions;
}

export async function warmWakeModel() {
	const active = await loadSessions();
	return !!active;
}

export function createWakeDetector() {
	const audio = new Float32Array(AUDIO_BUFFER_SAMPLES);
	let audioFilled = 0;

	const mels: Float32Array[] = [];
	const embeddings: Float32Array[] = [];

	let melFramesSinceEmbedding = 0;
	let lastDetectionAt = 0;
	let busy = false;
	let pending = 0;
	let peakScore = 0;
	let lastScore = 0;
	let inferences = 0;
	let framesPushed = 0;
	let lastDebugAt = 0;

	function reset() {
		audioFilled = 0;
		mels.length = 0;
		embeddings.length = 0;
		melFramesSinceEmbedding = 0;
		pending = 0;
	}

	async function computeMels(active: NonNullable<typeof sessions>, samples: Float32Array) {
		const out = await active.mel.run({ input: new active.Tensor('float32', samples, [1, samples.length]) });
		const raw = out[active.mel.outputNames[0]];
		const data = raw.data as Float32Array;
		const frames = data.length / 32;

		for (let i = 0; i < frames; i++) {
			const frame = new Float32Array(32);
			for (let j = 0; j < 32; j++) frame[j] = data[i * 32 + j] / 10 + 2;
			mels.push(frame);
		}
		if (mels.length > MEL_BUFFER_FRAMES) mels.splice(0, mels.length - MEL_BUFFER_FRAMES);
	}

	async function computeEmbedding(active: NonNullable<typeof sessions>) {
		const window = mels.slice(-MEL_FRAMES_PER_EMBEDDING);
		const flat = new Float32Array(MEL_FRAMES_PER_EMBEDDING * 32);
		for (let i = 0; i < MEL_FRAMES_PER_EMBEDDING; i++) flat.set(window[i], i * 32);

		const out = await active.emb.run({
			input_1: new active.Tensor('float32', flat, [1, MEL_FRAMES_PER_EMBEDDING, 32, 1])
		});

		embeddings.push(out[active.emb.outputNames[0]].data as Float32Array);
		if (embeddings.length > EMBEDDING_WINDOW) embeddings.splice(0, embeddings.length - EMBEDDING_WINDOW);
	}

	async function classify(active: NonNullable<typeof sessions>) {
		const flat = new Float32Array(EMBEDDING_WINDOW * EMBEDDING_DIM);
		for (let i = 0; i < EMBEDDING_WINDOW; i++) flat.set(embeddings[i], i * EMBEDDING_DIM);

		const out = await active.wake.run({
			[active.wake.inputNames[0]]: new active.Tensor('float32', flat, [1, EMBEDDING_WINDOW, EMBEDDING_DIM])
		});

		return (out[active.wake.outputNames[0]].data as Float32Array)[0];
	}

	async function push(pcm: Buffer) {
		const active = await loadSessions();
		if (!active) return 0;

		const incoming = pcm.length / 2;
		if (audioFilled + incoming > AUDIO_BUFFER_SAMPLES) {
			const keep = Math.max(0, AUDIO_BUFFER_SAMPLES - incoming);
			const drop = audioFilled - keep;
			audio.copyWithin(0, drop, audioFilled);
			audioFilled = keep;
		}
		for (let i = 0; i < incoming; i++) audio[audioFilled + i] = pcm.readInt16LE(i * 2);
		audioFilled += incoming;
		pending = Math.min(pending + incoming, audioFilled);
		framesPushed++;

		if (busy || pending < CHUNK_SAMPLES) return 0;

		busy = true;
		try {
			let detected = 0;

			while (pending >= CHUNK_SAMPLES) {
				const end = audioFilled - pending + CHUNK_SAMPLES;
				const chunk = audio.slice(end - CHUNK_SAMPLES, end);
				pending -= CHUNK_SAMPLES;

				const before = mels.length;
				await computeMels(active, chunk);
				melFramesSinceEmbedding += mels.length - before;

				while (mels.length >= MEL_FRAMES_PER_EMBEDDING && melFramesSinceEmbedding >= MEL_STRIDE) {
					melFramesSinceEmbedding -= MEL_STRIDE;
					await computeEmbedding(active);
				}

				if (embeddings.length < EMBEDDING_WINDOW) continue;

				const score = await classify(active);
				inferences++;
				lastScore = score;
				if (score > peakScore) peakScore = score;

				const now = Date.now();
				if (score >= DETECT_THRESHOLD && now - lastDetectionAt > REFRACTORY_MS) {
					lastDetectionAt = now;
					reset();
					detected = score;
					break;
				}
			}

			if (DEBUG_WAKE) {
				const now = Date.now();
				if (now - lastDebugAt >= DEBUG_INTERVAL_MS) {
					lastDebugAt = now;
					logger.log(
						`🎚️ Wake debug: frames=${framesPushed} inferences=${inferences} last=${lastScore.toFixed(3)} peak=${peakScore.toFixed(3)} threshold=${DETECT_THRESHOLD} mels=${mels.length} embeddings=${embeddings.length}/${EMBEDDING_WINDOW}`
					);
					peakScore = 0;
				}
			}

			return detected;
		} catch (error) {
			logger.log(`❌ Wake word inference failed: ${error.message}`);
			return 0;
		} finally {
			busy = false;
		}
	}

	return { push, reset };
}

export default { createWakeDetector, wakeModelAvailable, warmWakeModel };
