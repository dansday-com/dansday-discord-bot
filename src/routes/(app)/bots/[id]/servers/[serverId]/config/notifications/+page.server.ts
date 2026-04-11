import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const settings = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.notifications).catch(() => ({}));
	return { settings: settings?.settings ?? {} };
};
