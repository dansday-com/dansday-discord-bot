import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { INVITE_PROBLEM_MESSAGES, findOpenInvite } from '$lib/frontend/accountServers.server.js';
import { HTTP } from '$lib/http.js';

const AUTH_QUERY_ERROR_MESSAGES: Record<string, string> = {
	invite_invalid: 'This invite link is invalid, expired, or was already used.',
	...INVITE_PROBLEM_MESSAGES
};

async function loginInvite(token: string | null) {
	if (!token) {
		return null;
	}
	const found = await findOpenInvite(token).catch(() => ({ problem: 'invite_not_found' as const }));
	if ('problem' in found) {
		return { token: null, server_name: null, account_type: null, error: INVITE_PROBLEM_MESSAGES[found.problem] };
	}
	return { token, server_name: found.server.name || 'this server', account_type: found.invite.account_type, error: null };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const inviteToken = url.searchParams.get('invite');
	if (locals.user.authenticated) {
		redirect(HTTP.FOUND, inviteToken ? `/register?token=${encodeURIComponent(inviteToken)}` : DASHBOARD_PATH);
	}
	const code = url.searchParams.get('error');
	const invite = await loginInvite(inviteToken);
	const authQueryError = invite?.error ?? (code && code in AUTH_QUERY_ERROR_MESSAGES ? AUTH_QUERY_ERROR_MESSAGES[code] : null);
	return {
		canRegister: 'can_register' in locals.user && locals.user.can_register,
		authQueryError,
		invite: invite?.token ? invite : null
	};
};
