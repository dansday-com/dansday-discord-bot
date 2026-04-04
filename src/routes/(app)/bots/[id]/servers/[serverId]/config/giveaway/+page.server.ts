import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const settings = await db.getServerSettings(params.serverId, serverSettingsComponent.giveaway).catch(() => ({}));
	return { settings: settings?.settings ?? {} };
};
