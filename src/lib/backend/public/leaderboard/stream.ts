import { DateTime } from 'luxon';
import db from '../../../database.js';
import {
	type LeaderboardMetric,
	type LeaderboardPeriod,
	type LeaderboardRow,
	type LeaderboardSnapshot,
	getCachedLeaderboard,
	setCachedLeaderboard
} from './cache.js';
import { attachMemberThemes } from '../memberThemes.js';
import { PERCENT, roundTo } from '../../../utils/numbers.js';

const MAX_LEADERBOARD_ROWS = 100;

export type MembersListEntry = {
	discord_member_id: string;
	username: string | null;
	display_name: string | null;
	server_display_name: string | null;
	avatar: string | null;
	level?: number | null;
	xp?: number | null;
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
			return Number(m.xp ?? 0);
	}
}

export function buildLeaderboardRowsFromMembersList(members: MembersListEntry[], metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const sorted = [...members].sort((a, b) => {
		const vb = memberSortValue(b, metric);
		const va = memberSortValue(a, metric);
		if (vb !== va) {
			return vb - va;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((m) => ({
		discord_member_id: m.discord_member_id,
		username: m.username,
		display_name: m.display_name,
		server_display_name: m.server_display_name,
		avatar: m.avatar,
		xp: m.xp ?? 0,
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

type Rows<F extends (...args: never[]) => Promise<unknown[]>> = Awaited<ReturnType<F>>;

function periodSince(period: LeaderboardPeriod): Date | null {
	if (period === 'week') {
		return DateTime.utc().startOf('week').toJSDate();
	}
	if (period === 'month') {
		return DateTime.utc().startOf('month').toJSDate();
	}
	return null;
}

function buildPeriodRows(entries: Rows<typeof db.getLeaderboardPeriodCounts>, metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const value = (e: Record<string, unknown>): number => {
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
				return Number(e.xp ?? 0);
		}
	};

	const sorted = [...entries].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) {
			return vb - va;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: Number(e.xp ?? 0),
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

const TOWER_METRICS: LeaderboardMetric[] = ['minigames_tower_net', 'minigames_tower_ratio', 'minigames_tower_big'];
const COLOR_METRICS: LeaderboardMetric[] = ['minigames_color_net', 'minigames_color_avg', 'minigames_color_best'];
const MINIGAMES_METRICS: LeaderboardMetric[] = ['minigames_gamble_net', 'minigames_gamble_ratio', 'minigames_gamble_big', ...TOWER_METRICS, ...COLOR_METRICS];

function buildMinigamesRows(entries: Rows<typeof db.getMinigamesLeaderboard>, metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const ratio = (e: Record<string, unknown>): number => {
		const total = Number(e.minigame_total ?? 0);
		if (total <= 0) {
			return 0;
		}
		return (Number(e.minigame_wins ?? 0) / total) * PERCENT;
	};
	const value = (e: Record<string, unknown>): number => {
		switch (metric) {
			case 'minigames_gamble_ratio':
			case 'minigames_tower_ratio':
				return ratio(e);
			case 'minigames_gamble_big':
			case 'minigames_tower_big':
				return Number(e.minigame_big_win ?? 0);
			case 'minigames_color_avg':
				return Number(e.minigame_avg_score ?? 0);
			case 'minigames_color_best':
				return Number(e.minigame_best_floor ?? 0);
			default:
				return Number(e.minigame_net ?? 0);
		}
	};
	const isTowerMetric = TOWER_METRICS.includes(metric);
	const isColorMetric = COLOR_METRICS.includes(metric);
	const tieBreak = (e: Record<string, unknown>): number => (isTowerMetric || isColorMetric ? Number(e.minigame_net ?? 0) : 0);

	const pool = entries;

	const sorted = [...pool].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) {
			return vb - va;
		}
		const tb = tieBreak(b);
		const ta = tieBreak(a);
		if (tb !== ta) {
			return tb - ta;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: 0,
		level: e.level ?? 0,
		chat_total: 0,
		voice_minutes_total: 0,
		voice_minutes_active: 0,
		voice_minutes_afk: 0,
		voice_minutes_video: 0,
		voice_minutes_streaming: 0,
		minigame_net: Number(e.minigame_net ?? 0),
		minigame_wins: Number(e.minigame_wins ?? 0),
		minigame_total: Number(e.minigame_total ?? 0),
		minigame_big_win: Number(e.minigame_big_win ?? 0),
		minigame_ratio: roundTo(ratio(e), 1),
		...(isTowerMetric ? { minigame_best_floor: Math.round(Number(e.minigame_best_floor ?? 0)) } : {}),
		...(isColorMetric
			? {
					minigame_avg_score: roundTo(Number(e.minigame_avg_score ?? 0), 2),
					minigame_best_score: roundTo(Number(e.minigame_best_floor ?? 0), 2)
				}
			: {}),
		rank: null
	}));
}

const BOUNTY_METRICS: LeaderboardMetric[] = ['items_bounty_total', 'items_bounty_claimer', 'items_bounty_give'];

function buildBountyRows(entries: Rows<typeof db.getItemsBountyLeaderboard>, metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const value = (e: Record<string, unknown>): number => {
		switch (metric) {
			case 'items_bounty_claimer':
				return Number(e.bounty_collected ?? 0);
			case 'items_bounty_give':
				return Number(e.bounty_given ?? 0);
			default:
				return Number(e.bounty_on_them ?? 0);
		}
	};

	const sorted = [...entries].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) {
			return vb - va;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: 0,
		level: e.level ?? 0,
		chat_total: 0,
		voice_minutes_total: 0,
		voice_minutes_active: 0,
		voice_minutes_afk: 0,
		voice_minutes_video: 0,
		voice_minutes_streaming: 0,
		bounty_on_them: Number(e.bounty_on_them ?? 0),
		bounty_collected: Number(e.bounty_collected ?? 0),
		bounty_given: Number(e.bounty_given ?? 0),
		rank: null
	}));
}

const STEAL_METRICS: LeaderboardMetric[] = ['items_steal_total', 'items_steal_rate', 'items_steal_big'];
const BOMB_METRICS: LeaderboardMetric[] = ['items_bomb_total', 'items_bomb_rate', 'items_bomb_big'];

function buildAttackRows(entries: Rows<typeof db.getItemsAttackLeaderboard>, metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const isRate = metric.endsWith('_rate');
	const isBig = metric.endsWith('_big');
	const rate = (e: Record<string, unknown>): number => {
		const attempts = Number(e.attack_attempts ?? 0);
		if (attempts <= 0) {
			return 0;
		}
		return (Number(e.attack_success ?? 0) / attempts) * PERCENT;
	};
	const value = (e: Record<string, unknown>): number => {
		if (isRate) {
			return rate(e);
		}
		if (isBig) {
			return Number(e.attack_big ?? 0);
		}
		return Number(e.attack_total ?? 0);
	};

	const sorted = [...entries].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) {
			return vb - va;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: 0,
		level: e.level ?? 0,
		chat_total: 0,
		voice_minutes_total: 0,
		voice_minutes_active: 0,
		voice_minutes_afk: 0,
		voice_minutes_video: 0,
		voice_minutes_streaming: 0,
		attack_total: Number(e.attack_total ?? 0),
		attack_success: Number(e.attack_success ?? 0),
		attack_attempts: Number(e.attack_attempts ?? 0),
		attack_big: Number(e.attack_big ?? 0),
		attack_rate: roundTo(rate(e), 1),
		rank: null
	}));
}

const GIFT_METRICS: LeaderboardMetric[] = ['items_gift_give', 'items_gift_receive'];

function buildGiftRows(entries: Rows<typeof db.getItemsGiftLeaderboard>, metric: LeaderboardMetric, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const value = (e: Record<string, unknown>): number => (metric === 'items_gift_receive' ? Number(e.gift_received ?? 0) : Number(e.gift_given ?? 0));

	const sorted = [...entries].sort((a, b) => {
		const vb = value(b);
		const va = value(a);
		if (vb !== va) {
			return vb - va;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: 0,
		level: e.level ?? 0,
		chat_total: 0,
		voice_minutes_total: 0,
		voice_minutes_active: 0,
		voice_minutes_afk: 0,
		voice_minutes_video: 0,
		voice_minutes_streaming: 0,
		gift_given: Number(e.gift_given ?? 0),
		gift_received: Number(e.gift_received ?? 0),
		rank: null
	}));
}

function buildInviteRows(entries: Rows<typeof db.getInvitesLeaderboard>, limit: number): LeaderboardRow[] {
	const safe = Math.max(1, Math.min(MAX_LEADERBOARD_ROWS, limit));
	const sorted = [...entries].sort((a, b) => {
		const diff = Number(b.invites_total ?? 0) - Number(a.invites_total ?? 0);
		if (diff !== 0) {
			return diff;
		}
		return String(a.discord_member_id).localeCompare(String(b.discord_member_id));
	});

	return sorted.slice(0, safe).map((e) => ({
		discord_member_id: e.discord_member_id,
		username: e.username,
		display_name: e.display_name,
		server_display_name: e.server_display_name,
		avatar: e.avatar,
		xp: 0,
		level: e.level ?? 0,
		chat_total: 0,
		voice_minutes_total: 0,
		voice_minutes_active: 0,
		voice_minutes_afk: 0,
		voice_minutes_video: 0,
		voice_minutes_streaming: 0,
		invites_total: Number(e.invites_total ?? 0),
		invites_active: Number(e.invites_active ?? 0),
		invites_left: Number(e.invites_left ?? 0),
		invites_bonus: Number(e.invites_bonus ?? 0),
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

function makeKeyV2(serverId: number, { metric, period, limit }: BoardView): StreamKey {
	return `${serverId}:${metric}:${period}:${limit}`;
}

const CACHE_FRESH_MS = 20_000;

type RowsQuery = { serverId: number; metric: LeaderboardMetric; since: Date | null; limit: number };

async function leaderboardRows({ serverId, metric, since, limit }: RowsQuery): Promise<LeaderboardRow[]> {
	if (MINIGAMES_METRICS.includes(metric)) {
		const entries = await db
			.getMinigamesLeaderboard(serverId, since, TOWER_METRICS.includes(metric) ? 'tower' : COLOR_METRICS.includes(metric) ? 'color' : 'gamble')
			.catch(() => []);
		return buildMinigamesRows(entries, metric, limit);
	}
	if (BOUNTY_METRICS.includes(metric)) {
		return buildBountyRows(await db.getItemsBountyLeaderboard(serverId, since).catch(() => []), metric, limit);
	}
	if (STEAL_METRICS.includes(metric)) {
		return buildAttackRows(await db.getItemsAttackLeaderboard(serverId, 'steal', since).catch(() => []), metric, limit);
	}
	if (BOMB_METRICS.includes(metric)) {
		return buildAttackRows(await db.getItemsAttackLeaderboard(serverId, 'bomb', since).catch(() => []), metric, limit);
	}
	if (GIFT_METRICS.includes(metric)) {
		return buildGiftRows(await db.getItemsGiftLeaderboard(serverId, since).catch(() => []), metric, limit);
	}
	if (metric === 'invites') {
		return buildInviteRows(await db.getInvitesLeaderboard(serverId, since).catch(() => []), limit);
	}
	if (since) {
		return buildPeriodRows(await db.getLeaderboardPeriodCounts(serverId, since).catch(() => []), metric, limit);
	}
	const disguisedIds = new Set((await db.getDisguisedMemberIds(serverId).catch(() => [])).map((n: number) => Number(n)));
	const members = (await db.getServerMembersList(serverId)).filter((m) => !disguisedIds.has(Number(m.id)));
	return buildLeaderboardRowsFromMembersList(members, metric, limit);
}

async function buildSnapshot(serverId: number, { metric, period, limit }: BoardView): Promise<LeaderboardSnapshot> {
	const rows = await leaderboardRows({ serverId, metric, since: periodSince(period), limit });
	const snap: LeaderboardSnapshot = { metric, period, limit, updated_at: Date.now(), rows: await attachMemberThemes(serverId, rows) };
	setCachedLeaderboard(serverId, { metric, period, limit }, { snapshot: snap }).catch(() => {});
	return snap;
}

export type ResolveLeaderboardSnapshotOpts = { bypassCache?: boolean };

export async function resolveLeaderboardSnapshot(
	serverId: number,
	{ metric, period, limit }: BoardView,
	opts?: ResolveLeaderboardSnapshotOpts
): Promise<LeaderboardSnapshot> {
	if (!opts?.bypassCache) {
		const cached = await getCachedLeaderboard(serverId, { metric, period, limit });
		if (cached && Date.now() - cached.updated_at < CACHE_FRESH_MS) {
			return cached;
		}
	}
	return buildSnapshot(serverId, { metric, period, limit });
}

type BoardView = { metric: LeaderboardMetric; period: LeaderboardPeriod; limit: number };

export function subscribeLeaderboard(serverId: number, { metric, period, limit }: BoardView, fn: Listener): () => void {
	const k = makeKeyV2(serverId, { metric, period, limit });
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
			if (!current || current.listeners.size === 0) {
				return;
			}
			try {
				const snap = await resolveLeaderboardSnapshot(serverId, { metric, period, limit }, { bypassCache: true });
				const json = JSON.stringify(snap);
				if (json === current.lastJson) {
					return;
				}
				current.lastJson = json;
				for (const l of current.listeners) {
					l(snap);
				}
			} catch (_) {}
		}, pollMs);

		(async () => {
			const current = streams.get(k);
			if (!current || current.listeners.size === 0) {
				return;
			}
			try {
				const snap = await resolveLeaderboardSnapshot(serverId, { metric, period, limit }, { bypassCache: true });
				current.lastJson = JSON.stringify(snap);
				for (const l of current.listeners) {
					l(snap);
				}
			} catch (_) {}
		})();
	}

	return () => {
		const current = streams.get(k);
		if (!current) {
			return;
		}
		current.listeners.delete(fn);
		if (current.listeners.size === 0) {
			if (current.timer) {
				clearInterval(current.timer);
			}
			streams.delete(k);
		}
	};
}
