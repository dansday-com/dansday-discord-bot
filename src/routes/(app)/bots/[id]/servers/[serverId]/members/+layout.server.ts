import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db from '$lib/server/db.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const [members, permissions] = await Promise.all([
		db.getServerMembersList(params.serverId),
		db.getServerSettings(params.serverId, 'permissions').catch(() => null)
	]);

	if (!members) error(500, 'Failed to load members');

	return { members, permissions: permissions ?? null };
};
