import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { botAiFromDbRow, getOfficialBotIdForServer } from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { normalizeServerAiSettings } from '$lib/server-ai-settings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [row, officialBotId] = await Promise.all([
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.ai).catch(() => null),
		getOfficialBotIdForServer(Number(params.serverId)).catch(() => null)
	]);

	const botAi = botAiFromDbRow(officialBotId == null ? null : await db.getBotAiByBotId(officialBotId).catch(() => null));

	return {
		settings: normalizeServerAiSettings(row && !Array.isArray(row) ? row.settings : null),
		botFallback: {
			system_prompt: botAi.system_prompt,
			voice_system_prompt: botAi.voice_system_prompt,
			voice_name: botAi.voice_name
		}
	};
};
