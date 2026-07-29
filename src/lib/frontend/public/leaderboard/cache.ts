import { getRedisClient } from '../../../redis.js';

export type LeaderboardMetric =
	| 'xp'
	| 'chat'
	| 'voice_total'
	| 'voice_active'
	| 'voice_afk'
	| 'video'
	| 'streaming'
	| 'minigames_gamble_net'
	| 'minigames_gamble_ratio'
	| 'minigames_gamble_big'
	| 'items_bounty_total'
	| 'items_bounty_claimer'
	| 'items_bounty_give'
	| 'items_steal_total'
	| 'items_steal_rate'
	| 'items_steal_big'
	| 'items_bomb_total'
	| 'items_bomb_rate'
	| 'items_bomb_big'
	| 'items_gift_give'
	| 'items_gift_receive';

export type LeaderboardPeriod = 'all' | 'month' | 'week';

export type LeaderboardRow = {
	discord_member_id: string;
	username: string | null;
	display_name: string | null;
	server_display_name: string | null;
	avatar: string | null;
	xp: number | null;
	level: number | null;
	chat_total: number | null;
	voice_minutes_total: number | null;
	voice_minutes_active: number | null;
	voice_minutes_afk: number | null;
	voice_minutes_video: number | null;
	voice_minutes_streaming: number | null;
	minigame_net?: number | null;
	minigame_wins?: number | null;
	minigame_total?: number | null;
	minigame_big_win?: number | null;
	minigame_ratio?: number | null;
	bounty_on_them?: number | null;
	bounty_collected?: number | null;
	bounty_given?: number | null;
	attack_total?: number | null;
	attack_success?: number | null;
	attack_attempts?: number | null;
	attack_big?: number | null;
	attack_rate?: number | null;
	gift_given?: number | null;
	gift_received?: number | null;
	rank: number | null;
};

export type LeaderboardSnapshot = {
	metric: LeaderboardMetric;
	period: LeaderboardPeriod;
	limit: number;
	updated_at: number;
	rows: LeaderboardRow[];
};

function key(serverId: number, metric: LeaderboardMetric, period: LeaderboardPeriod, limit: number) {
	return `dansday:leaderboard:${serverId}:${metric}:${period}:${limit}`;
}

export async function getCachedLeaderboard(
	serverId: number,
	metric: LeaderboardMetric,
	period: LeaderboardPeriod,
	limit: number
): Promise<LeaderboardSnapshot | null> {
	const redis = await getRedisClient();
	if (!redis) return null;
	try {
		const raw = await redis.get(key(serverId, metric, period, limit));
		if (!raw) return null;
		return JSON.parse(raw) as LeaderboardSnapshot;
	} catch (_) {
		return null;
	}
}

export async function setCachedLeaderboard(
	serverId: number,
	metric: LeaderboardMetric,
	period: LeaderboardPeriod,
	limit: number,
	snapshot: LeaderboardSnapshot,
	ttlSeconds = 20
) {
	const redis = await getRedisClient();
	if (!redis) return false;
	try {
		await redis.set(key(serverId, metric, period, limit), JSON.stringify(snapshot), { EX: ttlSeconds });
		return true;
	} catch (_) {
		return false;
	}
}
