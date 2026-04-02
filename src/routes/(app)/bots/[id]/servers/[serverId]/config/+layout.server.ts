import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/database.js';
import { exitConfigToGuildOverview } from '$lib/frontend/redirect.js';

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		redirect(302, exitConfigToGuildOverview(url.pathname));
	}
	if (locals.user.account_source !== 'accounts') {
		if (locals.user.bot_id !== Number(params.id) || locals.user.server_id !== serverId) {
			redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}`);
		}
	}

	const [channels, roles, categories] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getRoles(params.serverId),
		db.getCategoriesForServer(params.serverId)
	]);

	return { channels: channels ?? [], roles: roles ?? [], categories: categories ?? [] };
};
