import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { normalizeMainConfigForPanel } from '$lib/utils/mainConfigSettings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [channels, categories, mainConfigRow, roles] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getCategoriesForServer(params.serverId),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getRoles(params.serverId)
	]);

	const mainConfig = normalizeMainConfigForPanel(mainConfigRow?.settings ?? {});
	const serverRow = await db.getServer(params.serverId).catch(() => null);

	return {
		channels: channels ?? [],
		categories: categories ?? [],
		mainConfig,
		roles: roles ?? [],
		serverName: serverRow?.name ?? 'Server'
	};
};
