import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	let row = await db.getServerSettings(params.serverId, 'staff_rating').catch(() => null);
	if (!row) row = await db.getServerSettings(params.serverId, 'staff_report_rating').catch(() => null);
	const raw = row?.settings ?? {};
	const settings = {
		...raw,
		review_channel_id: raw.review_channel_id ?? raw.report_channel_id ?? ''
	};
	return { settings };
};
