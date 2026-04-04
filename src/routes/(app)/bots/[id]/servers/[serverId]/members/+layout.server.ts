import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [members, permissions] = await Promise.all([
		db.getServerMembersList(params.serverId),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.permissions).catch(() => null)
	]);

	return { members: members ?? [], permissions: permissions ?? null };
};
