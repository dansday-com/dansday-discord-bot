import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const slug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(slug);
	if (!resolved) error(404, 'Not found');

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	const publicStatsEnabled = settings.enabled !== false;

	const [itemsRow, assetsRow, minigamesRow] = await Promise.all([
		db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.items).catch(() => null),
		db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.assets).catch(() => null),
		db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.minigames).catch(() => null)
	]);
	const itemsEnabled = (itemsRow as any)?.settings?.enabled === true;
	const assetsEnabled = (assetsRow as any)?.settings?.enabled === true;
	const minigamesEnabled = (minigamesRow as any)?.settings?.enabled === true;
	const accountEnabled = itemsEnabled || assetsEnabled || minigamesEnabled;

	const isAccountPath = /\/account(\/|$)/.test(url.pathname);
	if (!publicStatsEnabled && !isAccountPath) error(404, 'Not found');

	const server = resolved.server;
	return {
		publicStatsEnabled,
		itemsEnabled,
		assetsEnabled,
		minigamesEnabled,
		accountEnabled,
		server: {
			id: server.id,
			name: server.name,
			slug: resolved.computedSlug,
			server_icon: server.server_icon ?? null
		}
	};
};
