import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { isUtcSqlExpired } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user.authenticated) {
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	const token = url.searchParams.get('token') ?? null;

	if (token) {
		const invite = await db.getServerAccountInviteByToken(token).catch(() => null);
		if (!invite) {
			redirect(HTTP.FOUND, '/login?error=invite_not_found');
		}
		if (invite.used_by || invite.used_at) {
			redirect(HTTP.FOUND, '/login?error=invite_used');
		}
		if (invite.expires_at && isUtcSqlExpired(invite.expires_at)) {
			redirect(HTTP.FOUND, '/login?error=invite_expired');
		}
		return { token };
	}

	const canRegister = !locals.user.authenticated && 'can_register' in locals.user && locals.user.can_register;
	if (!canRegister) {
		redirect(HTTP.FOUND, '/login');
	}

	return { token: null };
};
