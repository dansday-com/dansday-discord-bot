import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { apexHome, publicServerPath, publicServerSlugFromHost, publicSiteOrigin } from '$lib/url.js';
import { getEffectiveMainEmbedAppearance } from '$lib/utils/mainConfig.js';
import { HTTP } from '$lib/http.js';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const slug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(slug);
	if (!resolved) {
		redirect(HTTP.SEE_OTHER, apexHome());
	}

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public);
	const settings = settingsRow?.settings || {};

	const areItemsEnabled = publicSubfeatureEnabled(settings, 'items');
	const isMarketEnabled = publicSubfeatureEnabled(settings, 'market');
	const areMinigamesEnabled = publicSubfeatureEnabled(settings, 'minigames');
	const areTasksEnabled = publicSubfeatureEnabled(settings, 'tasks');
	const isInviteEnabled = publicSubfeatureEnabled(settings, 'invite');

	const { server } = resolved;
	const [serverRow, mainRow] = await Promise.all([
		db.getServer(server.id).catch(() => null),
		db.getServerSettings(server.id, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const accent = parseInt(getEffectiveMainEmbedAppearance(mainRow?.settings).color.replace('#', ''), 16);
	const isOnSubdomain = publicServerSlugFromHost(url.hostname) === resolved.computedSlug;
	const canonicalBase = publicServerPath(resolved.computedSlug);
	const pathname = url.pathname.replace(/\/+$/, '');
	const tail = isOnSubdomain ? pathname : pathname.slice(publicServerPath(slug).length);
	return {
		itemsEnabled: areItemsEnabled,
		marketEnabled: isMarketEnabled,
		minigamesEnabled: areMinigamesEnabled,
		tasksEnabled: areTasksEnabled,
		onSubdomain: isOnSubdomain,
		serverBasePath: isOnSubdomain ? '' : canonicalBase,
		canonicalUrl: publicSiteOrigin() + canonicalBase + tail,
		server: {
			id: server.id,
			name: server.name,
			slug: resolved.computedSlug,
			server_icon: server.server_icon ?? null,
			join_available: isInviteEnabled && !!(serverRow?.vanity_url_code || serverRow?.invite_code),
			accent: Number.isFinite(accent) ? accent : null
		}
	};
};
