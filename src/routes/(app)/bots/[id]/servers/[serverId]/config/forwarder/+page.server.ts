import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { normalizeForwarderSettings } from '$lib/forwarder-settings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.forwarder).catch(() => null);

	const selfbots = await db.getServerBots(Number(params.serverId));
	const runningSelfbot = selfbots.find((sb) => sb.status === 'running' && typeof sb.token === 'string' && sb.token.trim() !== '');

	return {
		settings: normalizeForwarderSettings(row?.settings ?? {}),
		hasSelfbots: selfbots.length > 0,
		hasRunningSelfbot: !!runningSelfbot
	};
};
