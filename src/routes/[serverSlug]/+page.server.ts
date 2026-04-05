import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ parent, setHeaders }) => {
	const { server } = await parent();
	const overview = await db.getServerOverview(server.id, { forPublicPage: true });
	if (!overview) error(404, 'Not found');

	setHeaders({
		'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
	});

	const s = (overview as any).stats ?? {};
	const boostLevel = (overview as any).boost_level ?? s.boost_level;

	return {
		stats: {
			members_total: s.members_total,
			members_with_levels: s.members_with_levels,
			members_unique_boosters: s.members_unique_boosters,
			members_boosters: s.members_boosters,
			member_afk: s.member_afk,
			channels_total: s.channels_total,
			channels_text: s.channels_text,
			channels_voice: s.channels_voice,
			channels_announcement: s.channels_announcement,
			channels_stage: s.channels_stage,
			leveling_total_experience: s.leveling_total_experience,
			leveling_avg_level: s.leveling_avg_level,
			leveling_max_level: s.leveling_max_level,
			leveling_total_chat: s.leveling_total_chat,
			leveling_total_voice_minutes: s.leveling_total_voice_minutes,
			leveling_total_voice_active: s.leveling_total_voice_active,
			leveling_total_voice_afk: s.leveling_total_voice_afk,
			roles_total: s.roles_total,
			categories_total: s.categories_total,
			members_with_custom_roles: s.members_with_custom_roles,
			boost_level: s.boost_level
		},
		boost_level: boostLevel
	};
};
