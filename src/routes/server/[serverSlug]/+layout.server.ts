import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { publicSubfeatureEnabled } from '$lib/frontend/panelServer.js';
import { apexHome, publicServerPath, publicServerSlugFromHost, publicSiteOrigin } from '$lib/url.js';
import { getEffectiveMainEmbedAppearance } from '$lib/utils/mainConfig.js';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const slug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(slug);
	if (!resolved) redirect(303, apexHome());

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public);
	const settings = (settingsRow as any)?.settings || {};

	const itemsEnabled = publicSubfeatureEnabled(settings, 'items');
	const marketEnabled = publicSubfeatureEnabled(settings, 'market');
	const minigamesEnabled = publicSubfeatureEnabled(settings, 'minigames');
	const tasksEnabled = publicSubfeatureEnabled(settings, 'tasks');
	const inviteEnabled = publicSubfeatureEnabled(settings, 'invite');

	const server = resolved.server;
	const [serverRow, mainRow] = await Promise.all([
		db.getServer(server.id).catch(() => null),
		db.getServerSettings(server.id, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const accent = parseInt(getEffectiveMainEmbedAppearance((mainRow as any)?.settings).color.replace('#', ''), 16);
	const onSubdomain = publicServerSlugFromHost(url.hostname) === resolved.computedSlug;
	const canonicalBase = publicServerPath(resolved.computedSlug);
	const pathname = url.pathname.replace(/\/+$/, '');
	const tail = onSubdomain ? pathname : pathname.slice(publicServerPath(slug).length);
	return {
		itemsEnabled,
		marketEnabled,
		minigamesEnabled,
		tasksEnabled,
		onSubdomain,
		serverBasePath: onSubdomain ? '' : canonicalBase,
		canonicalUrl: publicSiteOrigin() + canonicalBase + tail,
		server: {
			id: server.id,
			name: server.name,
			slug: resolved.computedSlug,
			server_icon: server.server_icon ?? null,
			join_available: inviteEnabled && !!(serverRow?.vanity_url_code || serverRow?.invite_code),
			accent: Number.isFinite(accent) ? accent : null
		}
	};
};
