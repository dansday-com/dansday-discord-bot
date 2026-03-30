import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	const [botRes, serversRes] = await Promise.all([
		fetch(`${BACKEND_URL}/api/bots/${params.id}`, { headers }),
		fetch(`${BACKEND_URL}/api/bots/${params.id}/servers`, { headers })
	]);

	if (botRes.status === 404) error(404, 'Bot not found');
	if (!botRes.ok) error(500, 'Failed to load bot');

	const bot = await botRes.json();
	const servers = serversRes.ok ? await serversRes.json() : [];

	return { bot, servers, user: locals.user };
};
