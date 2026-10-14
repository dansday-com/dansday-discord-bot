import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { logger } from '../../../../utils/index.js';

const MODEL_FILES = ['melspectrogram.onnx', 'embedding_model.onnx', 'hey_stupid.onnx'];
const MODEL_DIR_SEARCH_DEPTH = 24;
const DEFAULT_DETECT_THRESHOLD = 0.2;
const WARM_TIMEOUT_MS = 15_000;

function findModelDir() {
	const hasModels = (dir: string) => MODEL_FILES.every((file) => fs.existsSync(path.join(dir, file)));

	let dir = path.dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < MODEL_DIR_SEARCH_DEPTH; i++) {
		const candidate = path.join(dir, 'static', 'wakeword');
		if (hasModels(candidate)) {
			return candidate;
		}

		const parent = path.dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}

	return path.resolve('static/wakeword');
}

const MODEL_DIR = findModelDir();
const [MEL_PATH, EMB_PATH, WAKE_PATH] = MODEL_FILES.map((file) => path.join(MODEL_DIR, file));

const DETECT_THRESHOLD = Number(process.env.WAKE_THRESHOLD ?? DEFAULT_DETECT_THRESHOLD);
const REFRACTORY_MS = 2000;
const DEBUG_WAKE = process.env.WAKE_DEBUG === '1';

function workerPath() {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const ext = path.extname(fileURLToPath(import.meta.url));
	return path.join(here, `wakeWordWorker${ext === '.ts' ? '.ts' : '.js'}`);
}

let worker: Worker | null = null;
let hasWorkerFailed = false;
let wasReportedUnavailable = false;

const listeners = new Set<(userId: string, score: number) => void>();

export function wakeModelAvailable() {
	if (hasWorkerFailed) {
		return false;
	}

	const missing = [MEL_PATH, EMB_PATH, WAKE_PATH].filter((p) => !fs.existsSync(p));
	if (!missing.length) {
		return true;
	}

	if (!wasReportedUnavailable) {
		wasReportedUnavailable = true;
		logger.log(`🔇 Wake word unavailable, missing: ${missing.join(', ')} (dir=${MODEL_DIR}, cwd=${process.cwd()})`);
	}
	return false;
}

function getWorker() {
	if (worker || hasWorkerFailed) {
		return worker;
	}
	if (!wakeModelAvailable()) {
		return null;
	}

	const file = workerPath();
	if (!fs.existsSync(file)) {
		hasWorkerFailed = true;
		logger.log(`❌ Wake word worker script missing at ${file}`);
		return null;
	}

	try {
		worker = new Worker(file, {
			workerData: {
				melPath: MEL_PATH,
				embPath: EMB_PATH,
				wakePath: WAKE_PATH,
				threshold: DETECT_THRESHOLD,
				refractoryMs: REFRACTORY_MS,
				debug: DEBUG_WAKE
			}
		});

		worker.unref();

		worker.on('message', (msg) => {
			if (msg?.type === 'detected') {
				for (const listener of listeners) {
					listener(msg.userId, msg.score);
				}
				return;
			}
			if (msg?.type === 'debug') {
				logger.log(`🎚️ Wake debug: ${msg.text}`);
				return;
			}
			if (msg?.type === 'error') {
				logger.log(`❌ Wake word worker error: ${msg.message}`);
			}
		});

		worker.on('error', (error: Record<string, unknown>) => {
			hasWorkerFailed = true;
			worker = null;
			logger.log(`❌ Wake word worker crashed: ${error?.message ?? String(error)}`);
		});

		worker.on('exit', (code) => {
			worker = null;
			if (code !== 0) {
				logger.log(`⚠️ Wake word worker exited with code ${code}`);
			}
		});
	} catch (error) {
		hasWorkerFailed = true;
		worker = null;
		logger.log(`❌ Wake word worker failed to start: ${(error as Error).message}`);
	}

	return worker;
}

export async function warmWakeModel() {
	const active = getWorker();
	if (!active) {
		return false;
	}
	const target = active;

	return new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => {
			target.off('message', onMessage);
			resolve(false);
		}, WARM_TIMEOUT_MS);

		function onMessage(msg: Record<string, unknown>) {
			if (msg?.type !== 'ready' && msg?.type !== 'error') {
				return;
			}
			clearTimeout(timer);
			target.off('message', onMessage);
			if (msg.type === 'error') {
				logger.log(`❌ Wake word model failed to load: ${msg.message}`);
				hasWorkerFailed = true;
				resolve(false);
				return;
			}
			logger.log('🧠 Wake word model loaded (hey stupid)');
			resolve(true);
		}

		target.on('message', onMessage);
		target.postMessage({ type: 'warm' });
	});
}

export function onWakeDetected(listener: (userId: string, score: number) => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function pushWakeAudio(userId: string, pcm: Buffer) {
	const active = getWorker();
	if (!active) {
		return;
	}

	const count = Math.floor(pcm.length / 2);
	const samples = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		samples[i] = pcm.readInt16LE(i * 2);
	}

	active.postMessage({ type: 'audio', userId, samples: samples.buffer }, [samples.buffer]);
}

export function resetWakeUser(userId: string) {
	worker?.postMessage({ type: 'reset', userId });
}

export function dropWakeUser(userId: string) {
	worker?.postMessage({ type: 'drop', userId });
}

export default { wakeModelAvailable, warmWakeModel, onWakeDetected, pushWakeAudio, resetWakeUser, dropWakeUser };
