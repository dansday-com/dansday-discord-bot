import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { aiFromDbRow } from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') redirect(302, DASHBOARD_PATH);

	const { api_key, voice_api_key, search_api_key, fetch_api_key, image_api_key, ...aiRest } = aiFromDbRow(await db.getAi(Number(locals.user.panel_id)));
	return {
		ai: {
			...aiRest,
			has_api_key: Boolean(api_key),
			has_voice_api_key: Boolean(voice_api_key),
			has_search_api_key: Boolean(search_api_key),
			has_fetch_api_key: Boolean(fetch_api_key),
			has_image_api_key: Boolean(image_api_key)
		}
	};
};
