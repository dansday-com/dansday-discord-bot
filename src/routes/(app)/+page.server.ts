import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request }) => {
	const cookie = request.headers.get('cookie') ?? '';
	let bots = [];
	try {
		const res = await fetch(`${BACKEND_URL}/api/bots`, { headers: { cookie } });
		if (res.ok) bots = await res.json();
	} catch {}
	return { bots, user: locals.user };
};
