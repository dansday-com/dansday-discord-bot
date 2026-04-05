import { getRedisClient } from '../redis.js';

export type LeaderboardMetric = 'xp' | 'chat' | 'voice_total' | 'voice_active' | 'voice_afk';

export type LeaderboardRow = {
	discord_member_id: string;
	username: string | null;
	display_name: string | null;
	server_display_name: string | null;
	avatar: string | null;
	experience: number | null;
	level: number | null;
	chat_total: number | null;
	voice_minutes_total: number | null;
	voice_minutes_active: number | null;
	voice_minutes_afk: number | null;
	rank: number | null;
};

export type LeaderboardSnapshot = {
	metric: LeaderboardMetric;
	limit: number;
	updated_at: number;
	rows: LeaderboardRow[];
};

function key(serverId: number, metric: LeaderboardMetric, limit: number) {
	return `dansday:leaderboard:${serverId}:${metric}:${limit}`;
}

export async function getCachedLeaderboard(serverId: number, metric: LeaderboardMetric, limit: number): Promise<LeaderboardSnapshot | null> {
	const redis = await getRedisClient();
	if (!redis) return null;
	try {
		const raw = await redis.get(key(serverId, metric, limit));
		if (!raw) return null;
		return JSON.parse(raw) as LeaderboardSnapshot;
	} catch (_) {
		return null;
	}
}

export async function setCachedLeaderboard(serverId: number, metric: LeaderboardMetric, limit: number, snapshot: LeaderboardSnapshot, ttlSeconds = 20) {
	const redis = await getRedisClient();
	if (!redis) return false;
	try {
		await redis.set(key(serverId, metric, limit), JSON.stringify(snapshot), { EX: ttlSeconds });
		return true;
	} catch (_) {
		return false;
	}
}
