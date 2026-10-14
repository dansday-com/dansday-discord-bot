import { getRedisClient } from '../../../redis.js';
import type { LeaderboardMetric, LeaderboardPeriod } from './metrics.js';

export type { LeaderboardMetric, LeaderboardPeriod } from './metrics.js';

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
	minigame_best_floor?: number | null;
	minigame_avg_score?: number | null;
	minigame_best_score?: number | null;
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
	invites_total?: number | null;
	invites_active?: number | null;
	invites_left?: number | null;
	invites_bonus?: number | null;
	rank: number | null;
	theme_image?: string | null;
	theme_accent?: string | null;
	theme_effect?: string | null;
	theme_effect_seed?: number | null;
};

export type LeaderboardSnapshot = {
	metric: LeaderboardMetric;
	period: LeaderboardPeriod;
	limit: number;
	updated_at: number;
	rows: LeaderboardRow[];
};

function key(serverId: number, { metric, period, limit }: BoardView) {
	return `dansday:leaderboard:${serverId}:${metric}:${period}:${limit}`;
}

export async function getCachedLeaderboard(serverId: number, { metric, period, limit }: BoardView): Promise<LeaderboardSnapshot | null> {
	const redis = await getRedisClient();
	if (!redis) {
		return null;
	}
	try {
		const raw = await redis.get(key(serverId, { metric, period, limit }));
		if (!raw) {
			return null;
		}
		return JSON.parse(raw) as LeaderboardSnapshot;
	} catch (_) {
		return null;
	}
}

type BoardEntry = { snapshot: LeaderboardSnapshot; ttlSeconds?: number };

type BoardView = { metric: LeaderboardMetric; period: LeaderboardPeriod; limit: number };

export async function setCachedLeaderboard(serverId: number, { metric, period, limit }: BoardView, { snapshot, ttlSeconds = 20 }: BoardEntry) {
	const redis = await getRedisClient();
	if (!redis) {
		return false;
	}
	try {
		await redis.set(key(serverId, { metric, period, limit }), JSON.stringify(snapshot), { EX: ttlSeconds });
		return true;
	} catch (_) {
		return false;
	}
}
