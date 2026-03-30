import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? '';
	const res = await fetch(`${BACKEND_URL}/api/servers/${params.serverId}/settings?component=permissions`, {
		headers: { cookie }
	});

	const settings = res.ok ? await res.json() : {};
	return { settings };
};
