import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { isGuildModeratorUser } from '$lib/serverPanelAccess.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}/selfbot`);
	}

	const selfbots = await db.getServerBots(serverId);

	return {
		selfbots,
		serverId,
		botId: params.id,
		user: locals.user,
		selfbotViewOnly: isGuildModeratorUser(locals.user)
	};
};
