import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/database.js';
import { webBotHome } from '$lib/frontend/redirect.js';

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const botId = Number(params.id);
	const serverIdNum = Number(params.serverId);

	if (!Number.isFinite(serverIdNum) || serverIdNum <= 0) {
		redirect(302, webBotHome(url.pathname));
	}

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.bot_id !== botId || locals.user.server_id !== serverIdNum) {
			redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}`);
		}
	}

	const overview = await db.getServerOverview(params.serverId);
	if (!overview || Number(overview.bot_id) !== botId) {
		redirect(302, webBotHome(url.pathname));
	}

	return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
};
