import { getRedisClient } from '../../../redis.js';
import { resolvePublicStatisticsSnapshot } from './stream.js';
import { aggregatePanelStatistics, type AggregatedPanelStats } from './aggregate.js';

const REDIS_KEY = 'dansday:landing_totals';
const TTL_SECONDS = 300;
const MAX_SERVERS = 60;

export type LandingTotals = AggregatedPanelStats;

export const EMPTY_LANDING_TOTALS: LandingTotals = aggregatePanelStatistics([]);

export async function resolveLandingTotals(serverIds: number[]): Promise<LandingTotals> {
	const redis = await getRedisClient();

	if (redis) {
		try {
			const raw = await redis.get(REDIS_KEY);
			if (raw) return JSON.parse(raw) as LandingTotals;
		} catch (_) {}
	}

	const ids = serverIds.slice(0, MAX_SERVERS);
	if (ids.length === 0) return EMPTY_LANDING_TOTALS;

	const snapshots = await Promise.all(
		ids.map((id) =>
			resolvePublicStatisticsSnapshot(id)
				.then((s) => s?.stats ?? null)
				.catch(() => null)
		)
	);

	const totals = aggregatePanelStatistics(snapshots);

	if (redis) {
		try {
			await redis.set(REDIS_KEY, JSON.stringify(totals), { EX: TTL_SECONDS });
		} catch (_) {}
	}

	return totals;
}
