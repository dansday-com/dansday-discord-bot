import db from '../database.js';
import { type PublicStatisticsSnapshot, getCachedPublicStatistics, setCachedPublicStatistics } from './cache.js';
import { shapePublicStatisticsFromOverview } from './shape.js';

type Listener = (payload: PublicStatisticsSnapshot) => void;

type StreamState = {
	listeners: Set<Listener>;
	timer: ReturnType<typeof setInterval> | null;
	lastJson: string | null;
};

const streams = new Map<number, StreamState>();

const CACHE_FRESH_MS = 20_000;

async function buildSnapshotFromDb(serverId: number): Promise<PublicStatisticsSnapshot | null> {
	const overview = await db.getServerOverview(serverId, { forPublicPage: true });
	const shaped = shapePublicStatisticsFromOverview(overview as Record<string, unknown>);
	if (!shaped) return null;
	const snap: PublicStatisticsSnapshot = { ...shaped, updated_at: Date.now() };
	setCachedPublicStatistics(serverId, snap).catch(() => {});
	return snap;
}

export type ResolvePublicStatisticsOpts = { bypassCache?: boolean };

export async function resolvePublicStatisticsSnapshot(serverId: number, opts?: ResolvePublicStatisticsOpts): Promise<PublicStatisticsSnapshot | null> {
	if (!opts?.bypassCache) {
		const cached = await getCachedPublicStatistics(serverId);
		if (cached && Date.now() - cached.updated_at < CACHE_FRESH_MS) {
			return cached;
		}
	}
	return buildSnapshotFromDb(serverId);
}

export function subscribePublicServerStatistics(serverId: number, fn: Listener): () => void {
	let state = streams.get(serverId);
	if (!state) {
		state = { listeners: new Set(), timer: null, lastJson: null };
		streams.set(serverId, state);
	}
	state.listeners.add(fn);
	if (state.lastJson) {
		try {
			fn(JSON.parse(state.lastJson) as PublicStatisticsSnapshot);
		} catch (_) {}
	}

	if (!state.timer) {
		const pollMs = 10_000;
		state.timer = setInterval(async () => {
			const current = streams.get(serverId);
			if (!current || current.listeners.size === 0) return;
			try {
				const payload = await resolvePublicStatisticsSnapshot(serverId, { bypassCache: true });
				if (!payload) return;
				const json = JSON.stringify(payload);
				if (json === current.lastJson) return;
				current.lastJson = json;
				for (const l of current.listeners) l(payload);
			} catch (_) {}
		}, pollMs);

		(async () => {
			const current = streams.get(serverId);
			if (!current || current.listeners.size === 0) return;
			try {
				const payload = await resolvePublicStatisticsSnapshot(serverId, { bypassCache: true });
				if (!payload) return;
				current.lastJson = JSON.stringify(payload);
				for (const l of current.listeners) l(payload);
			} catch (_) {}
		})();
	}

	return () => {
		const current = streams.get(serverId);
		if (!current) return;
		current.listeners.delete(fn);
		if (current.listeners.size === 0) {
			if (current.timer) clearInterval(current.timer);
			streams.delete(serverId);
		}
	};
}
