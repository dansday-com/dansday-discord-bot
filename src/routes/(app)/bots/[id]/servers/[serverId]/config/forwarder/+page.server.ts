import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { normalizeForwarderSettings } from '$lib/forwarder-settings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.forwarder).catch(() => null);

	const panelId = await db.getServerPanelId(Number(params.serverId)).catch(() => null);
	const selfbots = panelId == null ? [] : await db.getPanelSelfbots(panelId).catch(() => []);
	const sourceServers = panelId == null ? [] : await db.getPanelSourceServers(panelId).catch(() => []);
	const runningSelfbot = selfbots.find((sb) => sb.status === 'running' && typeof sb.token === 'string' && sb.token.trim() !== '');

	const settings = normalizeForwarderSettings(row?.settings ?? {});
	settings.forwarders = await Promise.all(
		settings.forwarders.map(async (raw) => {
			const fw = raw as Record<string, unknown>;
			if (typeof fw?.source_guild_id === 'string' && fw.source_guild_id) return fw;
			if (!fw?.server_id) return fw;
			const discordServerId = await db.getSelfbotServerDiscordId(Number(fw.server_id)).catch(() => null);
			if (!discordServerId) return fw;
			return { ...fw, source_guild_id: discordServerId };
		})
	);

	return {
		settings,
		sourceServers: sourceServers.map((s) => ({ discord_server_id: s.discord_server_id, name: s.name, server_icon: s.server_icon })),
		hasSelfbots: selfbots.length > 0,
		hasRunningSelfbot: !!runningSelfbot
	};
};
