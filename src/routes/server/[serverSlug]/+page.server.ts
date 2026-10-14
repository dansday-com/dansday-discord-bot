import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { resolvePublicStatisticsSnapshot } from '$lib/frontend/public/statistics/index.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();
	const payload = await resolvePublicStatisticsSnapshot(server.id);
	if (!payload) {
		error(HTTP.NOT_FOUND, 'Not found');
	}

	return {
		stats: payload.stats,
		boost_level: payload.boost_level
	};
};
