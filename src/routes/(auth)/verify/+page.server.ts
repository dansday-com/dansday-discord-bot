import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, '/');

	const token = url.searchParams.get('token');
	if (!token) redirect(302, '/login');

	return { verifyToken: token };
};
