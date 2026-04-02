import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';

function maskEmail(email: string) {
	const at = email.indexOf('@');
	if (at <= 0) return email.slice(0, 3) + '***';
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const prefix = local.slice(0, 3);
	return `${prefix}***@${domain}`;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') error(403, 'Access denied');

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		error(403, 'Access denied');
	}

	const [rawAccounts, invites] = await Promise.all([db.getServerAccountsByServer(serverId), db.getServerAccountInvitesByServer(serverId)]);
	const isSuperadmin = locals.user.account_source === 'accounts';
	const accounts = isSuperadmin
		? rawAccounts
		: rawAccounts.map((a: any) => ({
				...a,
				email: typeof a.email === 'string' ? maskEmail(a.email) : a.email,
				ip_address: null
			}));

	return { accounts, invites, serverId, botId: params.id, user: locals.user };
};
