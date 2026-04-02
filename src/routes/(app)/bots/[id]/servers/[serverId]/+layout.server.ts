import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.bot_id !== Number(params.id) || locals.user.server_id !== serverId) {
			error(403, 'Access denied');
		}
	}

	const overview = await db.getServerOverview(params.serverId);
	if (!overview) error(404, 'Server not found');

	return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
};
