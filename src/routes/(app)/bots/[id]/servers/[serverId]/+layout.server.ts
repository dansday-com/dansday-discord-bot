import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: LayoutServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? '';
	let res: Response;
	try {
		res = await fetch(`${BACKEND_URL}/api/servers/${params.serverId}/overview`, { headers: { cookie } });
	} catch {
		error(503, 'Backend unavailable');
	}

	if (res.status === 404) error(404, 'Server not found');
	if (!res.ok) error(res.status, 'Failed to load server');

	const overview = await res.json();

	return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
};
