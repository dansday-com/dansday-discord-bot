import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { greetingMessagesFor } from '$lib/localizedDefaults.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const [row, mainRow] = await Promise.all([
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.leaver).catch(() => ({})),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const settings = row?.settings && typeof row.settings === 'object' ? row.settings : {};

	const mergedSettings = {
		...settings,
		messages: greetingMessagesFor('leaver', settings.messages, (mainRow?.settings as { language?: unknown } | undefined)?.language)
	};

	return { settings: mergedSettings };
};
