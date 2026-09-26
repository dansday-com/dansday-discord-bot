export function createGuildSyncDebouncer(runSync: (guild: any) => Promise<any>, delayMs: number, maxWaitMs: number) {
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const pending = new Map<string, any>();
	const queuedAt = new Map<string, number>();
	const running = new Set<string>();

	function schedule(guild: any): void {
		if (!guild?.id) return;
		const key = String(guild.id);

		pending.set(key, guild);
		if (!queuedAt.has(key)) queuedAt.set(key, Date.now());

		const waited = Date.now() - (queuedAt.get(key) as number);
		const wait = Math.max(0, Math.min(delayMs, maxWaitMs - waited));

		const existing = timers.get(key);
		if (existing) clearTimeout(existing);
		timers.set(
			key,
			setTimeout(() => {
				flush(key).catch(() => {});
			}, wait)
		);
	}

	function requeue(key: string, guild: any): void {
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
		if (next) requeue(key, next);
	}

	return schedule;
}
