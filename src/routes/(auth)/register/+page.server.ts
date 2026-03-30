import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, '/');

	// If no accounts exist yet, allow open registration — otherwise require an invite token
	const token = url.searchParams.get('token');
	const canRegister = !locals.user.authenticated && (
		('can_register' in locals.user && locals.user.can_register) || Boolean(token)
	);

	if (!canRegister) redirect(302, '/login');

	return { token };
};
