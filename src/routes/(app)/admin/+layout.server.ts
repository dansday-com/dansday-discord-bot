import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { HTTP } from '$lib/http.js';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	return { user: locals.user };
};
