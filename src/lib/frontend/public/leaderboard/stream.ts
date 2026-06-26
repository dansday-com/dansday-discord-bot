import db from '../../../database.js';
import {
	type LeaderboardMetric,
	type LeaderboardPeriod,
	type LeaderboardRow,
	type LeaderboardSnapshot,
	getCachedLeaderboard,
	setCachedLeaderboard
} from './cache.js';

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
	voice_minutes_video?: number | null;
	voice_minutes_streaming?: number | null;
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
		case 'video':
			return Number(m.voice_minutes_video ?? 0);
		case 'streaming':
			return Number(m.voice_minutes_streaming ?? 0);
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
		voice_minutes_video: m.voice_minutes_video ?? 0,
		voice_minutes_streaming: m.voice_minutes_streaming ?? 0,
		rank: m.rank ?? null
	}));
}

function periodSince(period: LeaderboardPeriod): Date | null {
	if (period === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	if (period === 'month') return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	return null;
}

function buildPeriodRows(entries: any[], metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(100, limit));
	const value = (e: any): number => {
		switch (metric) {
			case 'chat':
				return Number(e.chat_count ?? 0);
			case 'voice_total':
				return Number(e.voice_active_count ?? 0) + Number(e.voice_afk_count ?? 0);
			case 'voice_active':
				return Number(e.voice_active_count ?? 0);
			case 'voice_afk':
				return Number(e.voice_afk_count ?? 0);
			case 'video':
				return Number(e.video_count ?? 0);
			case 'streaming':
				return Number(e.stream_count ?? 0);
			default:
				return Number(e.xp_amount ?? 0);
		}
	};

	const sorted = [...entries].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) return vb - va;
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted
		.filter((e) => value(e) > 0)
		.slice(0, safe)
		.map((e) => ({
			discord_member_id: e.discord_member_id,
			username: e.username,
			display_name: e.display_name,
			server_display_name: e.server_display_name,
			avatar: e.avatar,
			experience: Number(e.xp_amount ?? 0),
			level: e.level ?? 0,
			chat_total: Number(e.chat_count ?? 0),
			voice_minutes_total: Number(e.voice_active_count ?? 0) + Number(e.voice_afk_count ?? 0),
			voice_minutes_active: Number(e.voice_active_count ?? 0),
			voice_minutes_afk: Number(e.voice_afk_count ?? 0),
			voice_minutes_video: Number(e.video_count ?? 0),
			voice_minutes_streaming: Number(e.stream_count ?? 0),
			rank: null
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

function makeKeyV2(serverId: number, metric: LeaderboardMetric, period: LeaderboardPeriod, limit: number): StreamKey {
	return `${serverId}:${metric}:${period}:${limit}`;
}

const CACHE_FRESH_MS = 20_000;

async function buildSnapshot(serverId: number, metric: LeaderboardMetric, period: LeaderboardPeriod, limit: number): Promise<LeaderboardSnapshot> {
	let rows: LeaderboardRow[];
	const since = periodSince(period);
	if (since) {
		const entries = await db.getLeaderboardPeriodCounts(serverId, since).catch(() => []);
		rows = buildPeriodRows(entries, metric, limit);
	} else {
		const disguisedIds = new Set((await db.getDisguisedMemberIds(serverId).catch(() => [])).map((n: number) => Number(n)));
		const members = (await db.getServerMembersList(serverId)).filter((m: any) => !disguisedIds.has(Number(m.id)));
		rows = buildLeaderboardRowsFromMembersList(members, metric, limit);
	}
	const snap: LeaderboardSnapshot = { metric, period, limit, updated_at: Date.now(), rows };
	setCachedLeaderboard(serverId, metric, period, limit, snap).catch(() => {});
	return snap;
}

export type ResolveLeaderboardSnapshotOpts = { bypassCache?: boolean };

export async function resolveLeaderboardSnapshot(
	serverId: number,
	metric: LeaderboardMetric,
	period: LeaderboardPeriod,
	limit: number,
	opts?: ResolveLeaderboardSnapshotOpts
): Promise<LeaderboardSnapshot> {
	if (!opts?.bypassCache) {
		const cached = await getCachedLeaderboard(serverId, metric, period, limit);
		if (cached && Date.now() - cached.updated_at < CACHE_FRESH_MS) {
			return cached;
		}
	}
	return buildSnapshot(serverId, metric, period, limit);
}

export function subscribeLeaderboard(serverId: number, metric: LeaderboardMetric, period: LeaderboardPeriod, limit: number, fn: Listener): () => void {
	const k = makeKeyV2(serverId, metric, period, limit);
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
				const snap = await resolveLeaderboardSnapshot(serverId, metric, period, limit, { bypassCache: true });
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
				const snap = await resolveLeaderboardSnapshot(serverId, metric, period, limit, { bypassCache: true });
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
