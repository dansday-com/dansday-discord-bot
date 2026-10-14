import { redirect } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import type { PageServerLoad } from './$types';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.creator_alerts).catch(() => null);
	const raw = row && !Array.isArray(row) ? row.settings : null;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	return {
		settings: {
			enabled: s.enabled === true,
			target_channel_id: typeof s.target_channel_id === 'string' ? s.target_channel_id : ''
		}
	};
};
