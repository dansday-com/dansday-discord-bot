import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type === 'moderator') error(403, 'Access denied');

	const serverId = Number(params.serverId);

	if (locals.user.account_type === 'owner' && locals.user.server_id !== serverId) {
		error(403, 'Access denied');
	}

	const server = await db.getServer(params.serverId);
	if (!server) error(404, 'Server not found');

	const [accounts, invites] = await Promise.all([
		db.getServerAccountsByBotServer(server.bot_id, serverId),
		db.getServerAccountInvitesByBotServer(server.bot_id, serverId)
	]);

	return { accounts, invites, serverId, botId: params.id, user: locals.user };
};
