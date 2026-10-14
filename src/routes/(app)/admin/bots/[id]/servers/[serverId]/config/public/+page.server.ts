import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { computePublicServerSlugForServerConfig } from '$lib/backend/public/server-slug/index.js';
import { publicServerPath, publicServerSubdomainUrl, publicSiteOrigin } from '$lib/url.js';
import { inviteJoinPath } from '$lib/invites.js';
import { serverThemeUrl } from '$lib/backend/storage/serverThemes.js';
import { HTTP } from '$lib/http.js';

type PublicSettings = {
	items_enabled?: boolean;
	minigames_enabled?: boolean;
	market_enabled?: boolean;
	tasks_enabled?: boolean;
	invite_enabled?: boolean;
	ITEMS_CHANNEL_ID?: string;
	MINIGAMES_CHANNEL_ID?: string;
	invite_theme_image?: string | null;
	invite_theme_accent?: string | null;
	invite_theme_effect?: string | null;
	invite_theme_effect_seed?: number | null;
};

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}

	const parentData = await parent();
	const { overview } = parentData;

	const settingsRow = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.public).catch(() => null);
	const settings = (settingsRow?.settings || {}) as PublicSettings;

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
