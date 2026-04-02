import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type !== 'superadmin') error(403, 'Superadmin only');

	let accounts: any[] = [],
		links: any[] = [];
	try {
		[accounts, links] = await Promise.all([db.getAllAccounts(), db.getAllInviteLinks()]);
	} catch (_) {}

	return { accounts, links, user: locals.user };
};
