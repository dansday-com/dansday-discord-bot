import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.staff_rating).catch(() => null);
	const raw = row?.settings ?? {};
	const settings = {
		...raw,
		review_channel_id: raw.review_channel_id ?? raw.report_channel_id ?? ''
	};
	return { settings };
};
