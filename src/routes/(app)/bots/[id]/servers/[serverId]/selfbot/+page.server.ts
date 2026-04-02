import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_type === 'owner' && locals.user.server_id !== serverId) error(403, 'Access denied');
	if (locals.user.account_type === 'moderator' && locals.user.server_id !== serverId) error(403, 'Access denied');

	const selfbots = await db.getServerBots(serverId);

	return { selfbots, serverId, botId: params.id, user: locals.user };
};
