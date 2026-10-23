import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { INVITE_PROBLEM_MESSAGES, findOpenInvite } from '$lib/frontend/accountServers.server.js';
import { HTTP } from '$lib/http.js';

async function inviteData(locals: App.Locals, token: string) {
	if (locals.user.authenticated && locals.user.account_source === 'accounts') {
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}
	const found = await findOpenInvite(token).catch(() => ({ problem: 'invite_not_found' as const }));
	if ('problem' in found) {
		if (!locals.user.authenticated) {
			redirect(HTTP.FOUND, `/login?error=${found.problem}`);
		}
		return { token, invite: null, signedInAs: locals.user.username, inviteError: INVITE_PROBLEM_MESSAGES[found.problem] };
	}
	return {
		token,
		invite: { account_type: found.invite.account_type, server_name: found.server.name || 'this server', server_icon: found.server.server_icon },
		signedInAs: locals.user.authenticated ? locals.user.username : null,
		inviteError: null
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const token = url.searchParams.get('token') ?? null;
	if (token) {
		return inviteData(locals, token);
	}

	if (locals.user.authenticated) {
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	const canRegister = 'can_register' in locals.user && locals.user.can_register;
	if (!canRegister) {
		redirect(HTTP.FOUND, '/login');
	}

	return { token: null, invite: null, signedInAs: null, inviteError: null };
};
