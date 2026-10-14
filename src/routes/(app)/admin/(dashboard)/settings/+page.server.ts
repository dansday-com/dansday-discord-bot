import { getAutoQuest } from '$lib/frontend/panelSettings.server.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	let isAutoQuestEnrollment = false;

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		isAutoQuestEnrollment = await getAutoQuest(locals.user.panel_id);
	}

	return { autoQuestEnrollment: isAutoQuestEnrollment };
};
