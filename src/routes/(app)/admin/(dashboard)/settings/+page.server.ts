import { getAutoQuest } from '$lib/frontend/panelSettings.server.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	let autoQuestEnrollment = false;

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		autoQuestEnrollment = await getAutoQuest(locals.user.panel_id);
	}

	return { autoQuestEnrollment };
};
