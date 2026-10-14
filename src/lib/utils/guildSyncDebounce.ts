import { MINUTE_MS, SECOND_MS } from './time.js';

const FULL_RESYNC_INTERVAL_MINUTES = 30;
const EVENT_SYNC_DEBOUNCE_SECONDS = 15;
const EVENT_SYNC_MAX_WAIT_MINUTES = 2;
const STARTUP_SYNC_DELAY_SECONDS = 2;

export const FULL_RESYNC_INTERVAL_MS = FULL_RESYNC_INTERVAL_MINUTES * MINUTE_MS;
export const EVENT_SYNC_DEBOUNCE_MS = EVENT_SYNC_DEBOUNCE_SECONDS * SECOND_MS;
export const EVENT_SYNC_MAX_WAIT_MS = EVENT_SYNC_MAX_WAIT_MINUTES * MINUTE_MS;
export const STARTUP_SYNC_DELAY_MS = STARTUP_SYNC_DELAY_SECONDS * SECOND_MS;

export function createGuildSyncDebouncer<G extends { id: string }>(runSync: (guild: G) => Promise<unknown>, delayMs: number, maxWaitMs: number) {
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const pending = new Map<string, G>();
	const queuedAt = new Map<string, number>();
	const running = new Set<string>();

	function schedule(guild: G): void {
		if (!guild?.id) {
			return;
		}
		const key = String(guild.id);

		pending.set(key, guild);
		if (!queuedAt.has(key)) {
			queuedAt.set(key, Date.now());
		}

		const waited = Date.now() - (queuedAt.get(key) as number);
		const wait = Math.max(0, Math.min(delayMs, maxWaitMs - waited));

		const existing = timers.get(key);
		if (existing) {
			clearTimeout(existing);
		}
		timers.set(
			key,
			setTimeout(() => {
				flush(key).catch(() => {});
			}, wait)
		);
	}

	function requeue(key: string, guild: G): void {
		queuedAt.delete(key);
		schedule(guild);
	}

	async function flush(key: string): Promise<void> {
		timers.delete(key);

		const guild = pending.get(key);
		if (!guild) {
			queuedAt.delete(key);
			return;
		}

		if (running.has(key)) {
			requeue(key, guild);
			return;
		}

		pending.delete(key);
		queuedAt.delete(key);
		running.add(key);
		try {
			await runSync(guild);
		} catch (_) {
		} finally {
			running.delete(key);
		}

		const next = pending.get(key);
		if (next) {
			requeue(key, next);
		}
	}

	return schedule;
}
