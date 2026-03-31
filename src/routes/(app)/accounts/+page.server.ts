import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type !== 'admin') error(403, 'Admins only');

	let accounts: any[] = [],
		links: any[] = [];
	try {
		[accounts, links] = await Promise.all([db.getAllPanelAccounts(), db.getAllPanelInviteLinks()]);
	} catch (_) {}

	return { accounts, links, user: locals.user };
};
