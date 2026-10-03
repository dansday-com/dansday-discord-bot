import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { computePublicServerSlugForServerConfig } from '$lib/frontend/public/server-slug/index.js';
import { publicServerPath, publicServerSubdomainUrl, publicSiteOrigin } from '$lib/url.js';
import { inviteJoinPath } from '$lib/invites.js';
import { serverThemeUrl } from '$lib/backend/storage/serverThemes.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const parentData = await parent();
	const overview: any = (parentData as any).overview;

	const settingsRow = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.public).catch(() => null);
	const settings = (settingsRow as any)?.settings || {};

	const slug = await computePublicServerSlugForServerConfig(Number(params.serverId), overview?.name ?? null);

	return {
		settings,
		serverName: overview?.name || 'server',
		publicStatsPath: slug ? publicServerPath(String(slug)) : null,
		publicStatsSubdomainUrl: slug ? publicServerSubdomainUrl(String(slug)) : null,
		inviteUrl: slug ? `${publicSiteOrigin()}${inviteJoinPath(String(slug))}` : null,
		inviteReady: !!(overview?.vanity_url_code || overview?.invite_code),
		inviteThemeImageUrl: serverThemeUrl(settings.invite_theme_image)
	};
};
