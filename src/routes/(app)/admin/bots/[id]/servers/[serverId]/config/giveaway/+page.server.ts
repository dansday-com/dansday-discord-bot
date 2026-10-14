import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	const settings = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.giveaway).catch((): { settings?: undefined } => ({}));
	return { settings: (settings?.settings ?? {}) as { enabled?: boolean; giveaway_channel?: string; giveaway_creator_can_participate?: boolean } };
};
