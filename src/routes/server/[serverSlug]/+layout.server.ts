import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';

export const load: LayoutServerLoad = async ({ params }) => {
	const slug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(slug);
	if (!resolved) error(404, 'Not found');

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) error(404, 'Not found');

	const server = resolved.server;
	return {
		server: {
			id: server.id,
			name: server.name,
			slug: resolved.computedSlug,
			server_icon: server.server_icon ?? null
		}
	};
};
