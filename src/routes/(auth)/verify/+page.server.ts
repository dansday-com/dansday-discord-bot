import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, '/');

	const accountId = url.searchParams.get('account_id');
	if (!accountId) redirect(302, '/login');

	return { accountId: Number(accountId) };
};
