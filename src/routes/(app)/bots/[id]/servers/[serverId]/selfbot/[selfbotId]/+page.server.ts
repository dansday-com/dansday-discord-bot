import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	const selfbotId = Number(params.selfbotId);
	if (!serverId || !selfbotId) error(400, 'Invalid ID');

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) error(403, 'Access denied');

	const bot = await db.getServerBotById(selfbotId);
	if (!bot || bot.server_id !== serverId) error(404, 'Selfbot not found');

	return { bot, serverId, botId: params.id, user: locals.user };
};

