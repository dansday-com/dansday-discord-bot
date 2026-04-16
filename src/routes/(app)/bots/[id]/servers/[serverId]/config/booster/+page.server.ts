import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { DEFAULT_BOOSTER_MESSAGES } from '$lib/backend/config.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.booster).catch(() => ({}));
	const settings = row?.settings && typeof row.settings === 'object' ? row.settings : {};

	const mergedSettings = {
		...settings,
		messages: settings.messages && settings.messages.length > 0 ? settings.messages : DEFAULT_BOOSTER_MESSAGES
	};

	return { settings: mergedSettings };
};
