import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: LayoutServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type !== 'admin') error(403, 'Admins only');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	const [channelsRes, rolesRes] = await Promise.all([
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/channels`, { headers }),
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/roles`, { headers })
	]);

	const channels = channelsRes.ok ? await channelsRes.json() : [];
	const roles = rolesRes.ok ? await rolesRes.json() : [];

	return { channels, roles };
};
