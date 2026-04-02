import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		error(403, 'Access denied');
	}
	if (locals.user.account_source !== 'accounts') {
		if (locals.user.bot_id !== Number(params.id) || locals.user.server_id !== serverId) {
			error(403, 'Access denied');
		}
	}

	const [channels, roles, categories] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getRoles(params.serverId),
		db.getCategoriesForServer(params.serverId)
	]);

	return { channels: channels ?? [], roles: roles ?? [], categories: categories ?? [] };
};
