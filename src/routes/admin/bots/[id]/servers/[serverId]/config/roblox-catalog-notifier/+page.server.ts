import { redirect } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load = async ({ locals, params }: { locals: any; params: any }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.roblox_catalog_notifier).catch(() => null);
	const raw = row && !Array.isArray(row) ? row.settings : null;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	return {
		settings: {
			enabled: s.enabled === true,
			channel_id: typeof s.channel_id === 'string' ? s.channel_id : ''
		}
	};
};
