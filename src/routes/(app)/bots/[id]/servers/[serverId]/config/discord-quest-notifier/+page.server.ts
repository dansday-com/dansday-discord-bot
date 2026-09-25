import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const raw = row && !Array.isArray(row) ? row.settings : null;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	const officialBotId = await db.getOfficialBotIdForServer(Number(params.serverId)).catch(() => null);
	const quests = officialBotId == null ? [] : await db.listActiveBotDiscordQuests(officialBotId).catch(() => []);

	const panelId = await db.getServerPanelId(Number(params.serverId)).catch(() => null);
	const panelRow = panelId == null ? null : await db.getPanelSettings(panelId, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const panelRaw = panelRow?.settings;
	const panelSettings = panelRaw && typeof panelRaw === 'object' ? (panelRaw as Record<string, unknown>) : {};

	return {
		settings: {
			enabled: s.enabled === true,
			channel_id: typeof s.channel_id === 'string' ? s.channel_id : '',
			http_proxy_url: typeof s.http_proxy_url === 'string' ? s.http_proxy_url : ''
		},
		hasQuests: quests.length > 0,
		autoQuestEnabled: panelSettings.auto_quest === true
	};
};
