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
	const reachableGuildIds = new Set(sourceServers.map((s) => String(s.discord_server_id)));
	settings.forwarders = await Promise.all(
		settings.forwarders.map(async (raw) => {
			const fw = raw as Record<string, unknown>;
			let resolved = fw;
			if (!(typeof fw?.source_guild_id === 'string' && fw.source_guild_id) && fw?.server_id) {
				const discordServerId = await db.getSelfbotServerDiscordId(Number(fw.server_id)).catch(() => null);
				if (discordServerId) resolved = { ...fw, source_guild_id: discordServerId };
			}
			const guildId = resolved.source_guild_id;
			const unreachable = typeof guildId === 'string' && guildId !== '' ? !reachableGuildIds.has(guildId) : false;
			return { ...resolved, source_unreachable: unreachable };
		})
	);

	return {
		settings,
		sourceServers: sourceServers.map((s) => ({ discord_server_id: s.discord_server_id, name: s.name, server_icon: s.server_icon })),
		hasSelfbots: selfbots.length > 0,
		hasRunningSelfbot: !!runningSelfbot
	};
};
