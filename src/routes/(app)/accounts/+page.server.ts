import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export const load: PageServerLoad = async ({ locals, request }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_type !== 'admin') error(403, 'Admins only');

	const cookie = request.headers.get('cookie') ?? '';
	const headers = { cookie };

	const [accountsRes, linksRes] = await Promise.all([
		fetch(`${BACKEND_URL}/api/panel/accounts`, { headers }),
		fetch(`${BACKEND_URL}/api/panel/invite-links`, { headers })
	]);

	const { accounts } = accountsRes.ok ? await accountsRes.json() : { accounts: [] };
	const { links } = linksRes.ok ? await linksRes.json() : { links: [] };

	return { accounts, links, user: locals.user };
};
