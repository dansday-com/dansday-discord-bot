import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	const settings = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.content_creator).catch((): { settings?: undefined } => ({}));
	return {
		settings: (settings?.settings ?? {}) as {
			enabled?: boolean;
			admission_channel_id?: string;
			target_channel_id?: string;
			cooldown_days?: number;
			pending_role?: string;
			content_creator_roles?: string[];
		}
	};
};
