import db from '../database.js';
import { type LeaderboardMetric, type LeaderboardRow, type LeaderboardSnapshot, getCachedLeaderboard, setCachedLeaderboard } from './cache.js';

export type MembersListEntry = {
	discord_member_id: string;
	username: string | null;
	display_name: string | null;
	server_display_name: string | null;
	avatar: string | null;
	level?: number | null;
	experience?: number | null;
	chat_total?: number | null;
	voice_minutes_total?: number | null;
	voice_minutes_active?: number | null;
	voice_minutes_afk?: number | null;
	rank?: number | null;
};

function memberSortValue(m: MembersListEntry, metric: LeaderboardMetric): number {
	switch (metric) {
		case 'chat':
			return Number(m.chat_total ?? 0);
		case 'voice_total':
			return Number(m.voice_minutes_total ?? 0);
		case 'voice_active':
			return Number(m.voice_minutes_active ?? 0);
		case 'voice_afk':
			return Number(m.voice_minutes_afk ?? 0);
		default:
			return Number(m.experience ?? 0);
	}
}

export function buildLeaderboardRowsFromMembersList(members: MembersListEntry[], metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(100, limit));
	const sorted = [...members].sort((a, b) => {
		const vb = memberSortValue(b, metric);
		const va = memberSortValue(a, metric);
		if (vb !== va) return vb - va;
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((m) => ({
		discord_member_id: m.discord_member_id,
		username: m.username,
		display_name: m.display_name,
		server_display_name: m.server_display_name,
		avatar: m.avatar,
		experience: m.experience ?? 0,
		level: m.level ?? 0,
		chat_total: m.chat_total ?? 0,
		voice_minutes_total: m.voice_minutes_total ?? 0,
		voice_minutes_active: m.voice_minutes_active ?? 0,
		voice_minutes_afk: m.voice_minutes_afk ?? 0,
		rank: m.rank ?? null
	}));
}

type Listener = (snap: LeaderboardSnapshot) => void;

type StreamKey = string;

type StreamState = {
	listeners: Set<Listener>;
	timer: ReturnType<typeof setInterval> | null;
	lastJson: string | null;
};

const streams = new Map<StreamKey, StreamState>();

function makeKeyV2(serverId: number, metric: LeaderboardMetric, limit: number): StreamKey {
	return `${serverId}:${metric}:${limit}`;
}

const CACHE_FRESH_MS = 20_000;

async function buildSnapshot(serverId: number, metric: LeaderboardMetric, limit: number): Promise<LeaderboardSnapshot> {
	const rows = buildLeaderboardRowsFromMembersList(await db.getServerMembersList(serverId), metric, limit);
	const snap: LeaderboardSnapshot = { metric, limit, updated_at: Date.now(), rows };
	setCachedLeaderboard(serverId, metric, limit, snap).catch(() => {});
	return snap;
}

export type ResolveLeaderboardSnapshotOpts = { bypassCache?: boolean };

export async function resolveLeaderboardSnapshot(
	serverId: number,
	metric: LeaderboardMetric,
	limit: number,
	opts?: ResolveLeaderboardSnapshotOpts
): Promise<LeaderboardSnapshot> {
	if (!opts?.bypassCache) {
		const cached = await getCachedLeaderboard(serverId, metric, limit);
		if (cached && Date.now() - cached.updated_at < CACHE_FRESH_MS) {
			return cached;
		}
	}
	return buildSnapshot(serverId, metric, limit);
}

export function subscribeLeaderboard(serverId: number, metric: LeaderboardMetric, limit: number, fn: Listener): () => void {
	const k = makeKeyV2(serverId, metric, limit);
	let state = streams.get(k);
	if (!state) {
		state = { listeners: new Set(), timer: null, lastJson: null };
		streams.set(k, state);
	}
	state.listeners.add(fn);
	if (state.lastJson) {
		try {
			fn(JSON.parse(state.lastJson) as LeaderboardSnapshot);
		} catch (_) {}
	}

	if (!state.timer) {
		const pollMs = 10_000;
		state.timer = setInterval(async () => {
			const current = streams.get(k);
			if (!current || current.listeners.size === 0) return;
			try {
				const snap = await resolveLeaderboardSnapshot(serverId, metric, limit, { bypassCache: true });
				const json = JSON.stringify(snap);
				if (json === current.lastJson) return;
				current.lastJson = json;
				for (const l of current.listeners) l(snap);
			} catch (_) {}
		}, pollMs);

		(async () => {
			const current = streams.get(k);
			if (!current || current.listeners.size === 0) return;
			try {
				const snap = await resolveLeaderboardSnapshot(serverId, metric, limit, { bypassCache: true });
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
