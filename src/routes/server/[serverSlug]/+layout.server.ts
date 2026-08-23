import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';

export const load: LayoutServerLoad = async ({ params }) => {
	const slug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(slug);
	if (!resolved) redirect(303, '/');

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	const publicStatsEnabled = settings.enabled !== false;

	const itemsEnabled = settings.items_enabled === true;
	const assetsEnabled = settings.assets_enabled === true;
	const minigamesEnabled = settings.minigames_enabled === true;
	const tasksEnabled = settings.tasks_enabled === true;
	const accountEnabled = publicStatsEnabled;

	const server = resolved.server;
	return {
		publicStatsEnabled,
		itemsEnabled,
		assetsEnabled,
		minigamesEnabled,
		tasksEnabled,
		accountEnabled,
		server: {
			id: server.id,
			name: server.name,
			slug: resolved.computedSlug,
			server_icon: server.server_icon ?? null
		}
	};
};
