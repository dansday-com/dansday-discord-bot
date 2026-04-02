import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	if (locals.user.account_type !== 'superadmin') {
		const hasAccess = locals.user.accessible_servers?.find((s) => s.server_id === serverId);
		if (!hasAccess) error(403, 'Access denied');
	}

	const [channels, roles, categories] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getRoles(params.serverId),
		db.getCategoriesForServer(params.serverId)
	]);

	return { channels: channels ?? [], roles: roles ?? [], categories: categories ?? [] };
};
