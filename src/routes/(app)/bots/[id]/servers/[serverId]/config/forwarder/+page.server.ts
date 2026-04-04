import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';
import { normalizeForwarderSettings } from '$lib/forwarder-settings.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, serverSettingsComponent.forwarder).catch(() => null);
	return { settings: normalizeForwarderSettings(row?.settings ?? {}) };
};
