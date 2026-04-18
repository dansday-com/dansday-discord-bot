import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.moderation).catch(() => null);
	const settings = (row && !Array.isArray(row) ? row.settings : null) ?? {};
	return { settings: { enabled: (settings as any).enabled === true, log_channel_id: (settings as any).log_channel_id ?? '' } };
};
