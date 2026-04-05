import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { resolvePublicStatisticsSnapshot } from '$lib/publicStatistics/index.js';

export const load: PageServerLoad = async ({ parent, setHeaders }) => {
	const { server } = await parent();
	const payload = await resolvePublicStatisticsSnapshot(server.id);
	if (!payload) error(404, 'Not found');

	setHeaders({
		'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
	});

	return {
		stats: payload.stats,
		boost_level: payload.boost_level
	};
};
