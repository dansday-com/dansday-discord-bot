import { getRedisClient } from '../../../redis.js';
import type { PublicPageStats } from './shape.js';

export type PublicStatisticsSnapshot = {
	stats: PublicPageStats;
	boost_level: number;
	updated_at: number;
};

function redisKey(serverId: number) {
	return `dansday:public_stats:${serverId}`;
}

export async function getCachedPublicStatistics(serverId: number): Promise<PublicStatisticsSnapshot | null> {
	const redis = await getRedisClient();
	if (!redis) return null;
	try {
		const raw = await redis.get(redisKey(serverId));
		if (!raw) return null;
		return JSON.parse(raw) as PublicStatisticsSnapshot;
	} catch (_) {
		return null;
	}
}

export async function setCachedPublicStatistics(serverId: number, snapshot: PublicStatisticsSnapshot, ttlSeconds = 20) {
	const redis = await getRedisClient();
	if (!redis) return false;
	try {
		await redis.set(redisKey(serverId), JSON.stringify(snapshot), { EX: ttlSeconds });
		return true;
	} catch (_) {
		return false;
	}
}
