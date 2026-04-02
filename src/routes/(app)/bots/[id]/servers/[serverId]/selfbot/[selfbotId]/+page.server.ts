import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { webRouteUp } from '$lib/frontend/redirect.js';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	const selfbotId = Number(params.selfbotId);

	if (!serverId || !selfbotId) redirect(302, webRouteUp(url.pathname));

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}/selfbot`);
	}

	const bot = await db.getServerBotById(selfbotId);
	if (!bot || bot.server_id !== serverId) redirect(302, webRouteUp(url.pathname));

	return { bot, serverId, botId: params.id, user: locals.user };
};
