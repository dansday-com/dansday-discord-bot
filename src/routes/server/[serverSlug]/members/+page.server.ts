import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const members = await db.getServerMembersList(server.id);

	return { members: members ?? [] };
};
