import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { addDaysToNow, toMySQLDateTime } from '$lib/server/utils.js';
import logger from '$lib/server/logger.js';
import { randomBytes } from 'crypto';

function maskEmail(email: string) {
	const at = email.indexOf('@');
	if (at <= 0) return email.slice(0, 3) + '***';
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const prefix = local.slice(0, 3);
	return `${prefix}***@${domain}`;
}

function canManageAccounts(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
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

	return json({ success: true, accounts, invites });
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	if (!locals.user.authenticated) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const { account_type } = body;

	const validTypes = locals.user.account_source === 'accounts' ? ['owner', 'moderator'] : ['moderator'];
	if (!account_type || !validTypes.includes(account_type)) {
		return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: 400 });
	}

	const token = randomBytes(32).toString('hex');
	const expiresAt = toMySQLDateTime(addDaysToNow(1));

	await db.createServerAccountInvite({
		token,
		server_id: serverId,
		account_type,
		created_by: locals.user.account_id,
		expires_at: expiresAt ?? ''
	});

	logger.log(`${locals.user.username} generated server invite for ${account_type} (server ${serverId})`);

	const fullUrl = `${url.origin}/register?token=${token}`;
	return json({ success: true, invite_link: fullUrl, token });
};
