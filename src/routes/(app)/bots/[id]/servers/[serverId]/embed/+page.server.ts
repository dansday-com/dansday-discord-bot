import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	const [channelsRes, mainConfigRes, rolesRes] = await Promise.all([
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/channels`, { headers }),
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/settings?component=main_config`, { headers }),
		fetch(`${BACKEND_URL}/api/servers/${params.serverId}/roles`, { headers })
	]);

	if (!channelsRes.ok) error(500, 'Failed to load channels');

	const channels = await channelsRes.json();
	const mainConfig = mainConfigRes.ok ? await mainConfigRes.json() : null;
	const roles = rolesRes.ok ? await rolesRes.json() : [];

	return { channels, mainConfig, roles };
};
