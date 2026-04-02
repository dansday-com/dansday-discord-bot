import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { addDaysToNow, toMySQLDateTime } from '$lib/server/utils.js';
import logger from '$lib/server/logger.js';
import { randomBytes } from 'crypto';

function canManageAccounts(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_type === 'superadmin') return true;
	if (locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const [accounts, invites] = await Promise.all([db.getServerAccountsByServer(serverId), db.getServerAccountInvitesByServer(serverId)]);

	return json({ success: true, accounts, invites });
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	if (!locals.user.authenticated) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const { account_type } = body;

	const validTypes = locals.user.account_type === 'superadmin' ? ['owner', 'moderator'] : ['moderator'];
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
