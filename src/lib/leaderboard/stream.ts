import db from '../database.js';
import { type LeaderboardMetric, type LeaderboardRange, type LeaderboardSnapshot, getCachedLeaderboard, setCachedLeaderboard } from './cache.js';

type Listener = (snap: LeaderboardSnapshot) => void;

type StreamKey = string; // `${serverId}:${metric}:${range}:${limit}`

type StreamState = {
	listeners: Set<Listener>;
	timer: ReturnType<typeof setInterval> | null;
	lastJson: string | null;
};

const streams = new Map<StreamKey, StreamState>();

function makeKeyV2(serverId: number, metric: LeaderboardMetric, range: LeaderboardRange, limit: number): StreamKey {
	return `${serverId}:${metric}:${range}:${limit}`;
}

async function buildSnapshot(serverId: number, metric: LeaderboardMetric, range: LeaderboardRange, limit: number): Promise<LeaderboardSnapshot> {
	const rows = await db.getServerLeaderboard(serverId, limit, metric, range);
	const snap: LeaderboardSnapshot = { metric, range, limit, updated_at: Date.now(), rows };
	setCachedLeaderboard(serverId, metric, range, limit, snap).catch(() => {});
	return snap;
}

export function subscribeLeaderboard(serverId: number, metric: LeaderboardMetric, range: LeaderboardRange, limit: number, fn: Listener): () => void {
	const k = makeKeyV2(serverId, metric, range, limit);
	let state = streams.get(k);
	if (!state) {
		state = { listeners: new Set(), timer: null, lastJson: null };
		streams.set(k, state);
	}
	state.listeners.add(fn);

	if (!state.timer) {
		const pollMs = 10_000;
		state.timer = setInterval(async () => {
			const current = streams.get(k);
			if (!current || current.listeners.size === 0) return;
			try {
				const cached = await getCachedLeaderboard(serverId, metric, range, limit);
				const snap = cached && Date.now() - cached.updated_at < 15_000 ? cached : await buildSnapshot(serverId, metric, range, limit);
				const json = JSON.stringify(snap);
				if (json === current.lastJson) return;
				current.lastJson = json;
				for (const l of current.listeners) l(snap);
			} catch (_) {}
		}, pollMs);

		// Kick immediately (don’t wait first interval)
		(async () => {
			const current = streams.get(k);
			if (!current || current.listeners.size === 0) return;
			try {
				const cached = await getCachedLeaderboard(serverId, metric, range, limit);
				const snap = cached && Date.now() - cached.updated_at < 60_000 ? cached : await buildSnapshot(serverId, metric, range, limit);
				current.lastJson = JSON.stringify(snap);
				for (const l of current.listeners) l(snap);
			} catch (_) {}
		})();
	}

	return () => {
		const current = streams.get(k);
		if (!current) return;
		current.listeners.delete(fn);
		if (current.listeners.size === 0) {
			if (current.timer) clearInterval(current.timer);
			streams.delete(k);
		}
	};
}
