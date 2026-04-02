import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [channels, categories, mainConfig, roles] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getCategoriesForServer(params.serverId),
		db.getServerSettings(params.serverId, 'main_config').catch(() => null),
		db.getRoles(params.serverId)
	]);

	return { channels: channels ?? [], categories: categories ?? [], mainConfig: mainConfig ?? null, roles: roles ?? [] };
};
