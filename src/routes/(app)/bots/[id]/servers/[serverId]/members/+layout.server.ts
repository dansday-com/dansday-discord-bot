import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: LayoutServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	const [membersRes, permissionsRes] = await Promise.all([
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/members`, { headers }),
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/settings?component=permissions`, { headers })
	]);

	if (!membersRes.ok) error(500, 'Failed to load members');

	const members = await membersRes.json();
	const permissions = permissionsRes.ok ? await permissionsRes.json() : null;

	return { members, permissions };
};
