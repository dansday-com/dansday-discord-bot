import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { greetingMessagesFor } from '$lib/localizedDefaults.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	const [row, mainRow] = await Promise.all([
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.leaver).catch((): { settings?: undefined } => ({})),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const settings = (row?.settings && typeof row.settings === 'object' ? row.settings : {}) as { enabled?: boolean; channels?: string[]; messages?: string[] };

	const mergedSettings = {
		...settings,
		messages: greetingMessagesFor('leaver', settings.messages, (mainRow?.settings as { language?: unknown } | undefined)?.language)
	};

	return { settings: mergedSettings };
};
