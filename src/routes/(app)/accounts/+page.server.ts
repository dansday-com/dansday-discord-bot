import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type !== 'admin') error(403, 'Admins only');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	let accounts = [], links = [];
	try {
		const [accountsRes, linksRes] = await Promise.all([
			fetch(`${BACKEND_URL}/api/panel/accounts`, { headers }),
			fetch(`${BACKEND_URL}/api/panel/invite-links`, { headers })
		]);
		if (accountsRes.ok) ({ accounts } = await accountsRes.json());
		if (linksRes.ok) ({ links } = await linksRes.json());
	} catch {}

	return { accounts, links, user: locals.user };
};
