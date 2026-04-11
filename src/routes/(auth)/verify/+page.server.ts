import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, DASHBOARD_PATH);

	const token = url.searchParams.get('token');
	if (!token) redirect(302, '/login');

	const accountSource = url.searchParams.get('source') === 'server_accounts' ? 'server_accounts' : 'accounts';

	return { verifyToken: token, accountSource };
};
