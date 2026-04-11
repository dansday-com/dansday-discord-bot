import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { isUtcSqlExpired } from '$lib/utils/index.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user.authenticated) redirect(302, DASHBOARD_PATH);

	const token = url.searchParams.get('token') ?? null;

	if (token) {
		const invite = await db.getServerAccountInviteByToken(token).catch(() => null);
		if (!invite || invite.used_by || invite.used_at || (invite.expires_at && isUtcSqlExpired(invite.expires_at))) {
			redirect(302, '/login?error=invite_invalid');
		}
		return { token };
	}

	const canRegister = !locals.user.authenticated && 'can_register' in locals.user && locals.user.can_register;
	if (!canRegister) redirect(302, '/login');

	return { token: null };
};
