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

	const [accounts, invites] = await Promise.all([db.getServerAccountsByServer(serverId), db.getServerAccountInvitesByServer(serverId)]);

	return { accounts, invites, serverId, botId: params.id, user: locals.user };
};
