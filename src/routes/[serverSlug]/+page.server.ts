import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { resolvePublicStatisticsSnapshot } from '$lib/publicStatistics/index.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();
	const payload = await resolvePublicStatisticsSnapshot(server.id);
	if (!payload) error(404, 'Not found');

	return {
		stats: payload.stats,
		boost_level: payload.boost_level
	};
};
