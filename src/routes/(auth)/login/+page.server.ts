import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user.authenticated) redirect(302, '/');
	return { canRegister: 'can_register' in locals.user && locals.user.can_register };
};
