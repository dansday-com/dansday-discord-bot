import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { randomBytes } from 'crypto';
import { guardAccountAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { invitableAccountTypes, panelActorOf } from '$lib/panelHierarchy.js';
import { HTTP } from '$lib/http.js';
import { INVITE_TOKEN_BYTES } from '$lib/accounts.js';

const EMAIL_MASK_VISIBLE_CHARS = 3;

function maskEmail(email: string) {
	const at = email.indexOf('@');
	if (at <= 0) {
		return `${email.slice(0, EMAIL_MASK_VISIBLE_CHARS)}***`;
	}
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const prefix = local.slice(0, EMAIL_MASK_VISIBLE_CHARS);
	return `${prefix}***@${domain}`;
}

async function canManageAccounts(locals: App.Locals, serverId: number): Promise<boolean> {
	const { user } = locals;
	if (!user.authenticated) {
		return false;
	}
	if (user.account_source === 'accounts') {
		const { accountOwnsServer } = await import('$lib/backend/panelServer.js');
		return accountOwnsServer(locals, serverId);
	}
	if (user.account_source === 'server_accounts') {
		return user.server_id === serverId;
	}
	return false;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!(await canManageAccounts(locals, serverId))) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const [rawAccounts, invites] = await Promise.all([db.getServerAccountsByServer(serverId), db.getServerAccountInvitesByServer(serverId)]);
	const isSuperadmin = locals.user.authenticated && locals.user.account_source === 'accounts';

	const accounts = rawAccounts.map((a) => {
		if (isSuperadmin) {
			return a;
		}
		return { ...a, email: typeof a.email === 'string' ? maskEmail(a.email) : a.email, ip_address: null, password_hash: undefined };
	});

	return json({ success: true, accounts, invites });
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);
	if (!(await canManageAccounts(locals, serverId))) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body = await request.json();
	const { account_type } = body;

	const denied = guardAccountAction(locals, account_type === 'owner' ? 'owner' : 'staff');
	if (denied) {
		return denied;
	}
	const validTypes: string[] = invitableAccountTypes(panelActorOf(locals.user));
	if (!account_type || !validTypes.includes(account_type)) {
		return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: HTTP.BAD_REQUEST });
	}

	const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');

	await db.createServerAccountInvite({
		token,
		server_id: serverId,
		account_type
	});

	logger.log(`${locals.user.username} generated server invite for ${account_type} (server ${serverId})`);
	await db
		.createServerPanelLog(serverId, panelActorIds(locals), {
			action: 'account_invite',
			changes: [{ key: 'invite link', before: null, after: `${account_type}, copied link` }]
		})
		.catch(() => null);

	const fullUrl = `${url.origin}/register?token=${token}`;
	return json({ success: true, invite_link: fullUrl, token });
};
