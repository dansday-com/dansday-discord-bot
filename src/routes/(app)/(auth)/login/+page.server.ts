import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';

const AUTH_QUERY_ERROR_MESSAGES: Record<string, string> = {
	invite_invalid: 'This invite link is invalid, expired, or was already used.',
	invite_not_found: 'This invite link could not be found.',
	invite_used: 'This invite link has already been used.',
	invite_expired: 'This invite link has expired. Ask a server admin for a new one.'
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, DASHBOARD_PATH);
	const code = url.searchParams.get('error');
	const authQueryError = code && code in AUTH_QUERY_ERROR_MESSAGES ? AUTH_QUERY_ERROR_MESSAGES[code] : null;
	return {
		canRegister: 'can_register' in locals.user && locals.user.can_register,
		authQueryError
	};
};
