import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const res = await fetch(`${BACKEND_URL}/api/bots`, { headers: { cookie } });
	const bots = res.ok ? await res.json() : [];
	return { bots, user: locals.user };
};
