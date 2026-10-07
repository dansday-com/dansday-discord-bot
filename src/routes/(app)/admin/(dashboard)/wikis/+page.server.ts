import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') redirect(302, DASHBOARD_PATH);

	return { wikis: await db.getWikis(Number(locals.user.panel_id)) };
};
