import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	let autoQuestEnrollment = false;

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		const questRow = await db.getPanelSettings(locals.user.panel_id, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
		const questRaw = questRow?.settings;
		autoQuestEnrollment = questRaw && typeof questRaw === 'object' ? (questRaw as Record<string, unknown>).auto_quest === true : false;
	}

	return { autoQuestEnrollment };
};
