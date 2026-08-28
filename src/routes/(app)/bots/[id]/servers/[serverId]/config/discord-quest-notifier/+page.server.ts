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
	const selfbots = await db.getServerBots(Number(params.serverId)).catch(() => []);

	return {
		settings: {
			enabled: s.enabled === true,
			channel_id: typeof s.channel_id === 'string' ? s.channel_id : '',
			http_proxy_url: typeof s.http_proxy_url === 'string' ? s.http_proxy_url : '',
			auto_quest: s.auto_quest !== false
		},
		hasQuests: quests.length > 0,
		hasSelfbots: selfbots.length > 0
	};
};
