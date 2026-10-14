import type { PageServerLoad } from './$types';
import { parseLeaderboardMetric, parseLeaderboardPeriod, resolveLeaderboardSnapshot } from '$lib/frontend/public/leaderboard/index.js';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { server } = await parent();

	const metric = parseLeaderboardMetric(url.searchParams.get('metric'));
	const period = parseLeaderboardPeriod(url.searchParams.get('period'));
	const limit = 50;

	const snap = await resolveLeaderboardSnapshot(server.id, { metric, period, limit });

	return {
		metric,
		period,
		limit,
		rows: snap.rows
	};
};
