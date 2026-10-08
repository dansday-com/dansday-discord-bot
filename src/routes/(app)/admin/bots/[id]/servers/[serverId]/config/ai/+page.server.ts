import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { aiFromDbRow, getOfficialBotIdForServer } from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { normalizeServerAiSettings } from '$lib/server-ai-settings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [row, officialBotId] = await Promise.all([
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.ai).catch(() => null),
		getOfficialBotIdForServer(Number(params.serverId)).catch(() => null)
	]);

	const panelAi = aiFromDbRow(officialBotId == null ? null : await db.getAiByBotId(officialBotId).catch(() => null));

	return {
		settings: normalizeServerAiSettings(row && !Array.isArray(row) ? row.settings : null),
		panelFallback: {
			system_prompt: panelAi.system_prompt,
			voice_system_prompt: panelAi.voice_system_prompt,
			voice_name: panelAi.voice_name
		}
	};
};
