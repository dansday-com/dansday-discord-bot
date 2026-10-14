import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { isUtcSqlExpired } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { maskEmail } from '$lib/accounts.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(HTTP.FOUND, adminServerSectionPath(targetBot, locals.user.server_id, 'accounts'));
		}
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	const [rawAccounts, invites] = await Promise.all([db.getServerAccountsByServer(serverId), db.getServerAccountInvitesByServer(serverId)]);
	const isSuperadmin = locals.user.account_source === 'accounts';

	const accounts = rawAccounts.map((a) => {
		const base = { ...a, password_hash: undefined };
		if (isSuperadmin) {
			return base;
		}
		return { ...base, email: typeof a.email === 'string' ? maskEmail(a.email) : a.email, ip_address: null };
	});

	const openInvites = invites.filter((i) => i.used_by == null && !i.used_at && !(i.expires_at && isUtcSqlExpired(i.expires_at)));

	return { accounts, invites: openInvites, serverId, botId: params.id, user: locals.user };
};
