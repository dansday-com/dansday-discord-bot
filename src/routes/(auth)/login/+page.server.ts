import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user.authenticated) redirect(302, DASHBOARD_PATH);
	return { canRegister: 'can_register' in locals.user && locals.user.can_register };
};
