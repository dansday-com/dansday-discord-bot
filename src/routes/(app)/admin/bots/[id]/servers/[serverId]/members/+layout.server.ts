import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(HTTP.FOUND, adminServerSectionPath(targetBot, locals.user.server_id, 'members'));
			}
			redirect(HTTP.FOUND, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	return {};
};
