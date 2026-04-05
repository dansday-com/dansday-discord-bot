import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { computePublicServerSlugForServerConfig } from '$lib/publicServerSlug/index.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const parentData = await parent();
	const overview: any = (parentData as any).overview;

	const settingsRow = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.public_statistics).catch(() => null);
	const settings = (settingsRow as any)?.settings || {};
	const enabled = settings.enabled !== false;

	const slug = await computePublicServerSlugForServerConfig(Number(params.serverId), overview?.name ?? null);
	const enc = slug ? encodeURIComponent(String(slug)) : '';

	return {
		settings,
		enabled,
		serverName: overview?.name || 'server',
		publicStatsPath: slug ? `/${enc}` : null
	};
};
