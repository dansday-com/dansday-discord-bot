import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const settings = await db.getServerSettings(params.serverId, 'notifications').catch(() => ({}));
	return { settings: settings ?? {} };
};
