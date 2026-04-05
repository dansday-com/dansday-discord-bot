import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const raw = row?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	const selfbots = await db.getServerBots(Number(params.serverId));
	const runningSelfbot = selfbots.find((sb) => sb.status === 'running' && typeof sb.token === 'string' && sb.token.trim() !== '');

	return {
		settings: {
			enabled: s.enabled !== false,
			channel_id: typeof s.channel_id === 'string' ? s.channel_id : '',
			http_proxy_url: typeof s.http_proxy_url === 'string' ? s.http_proxy_url : '',
			auto_quest: s.auto_quest !== false
		},
		hasSelfbots: selfbots.length > 0,
		hasRunningSelfbot: !!runningSelfbot
	};
};
