import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { DateTime } from 'luxon';
import { logger, isUtcSqlExpired } from '$lib/utils/index.js';

function canManageInvites(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === serverId;
	}
	return false;
}

export const POST: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	const inviteId = Number(params.inviteId);

	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!canManageInvites(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!Number.isFinite(inviteId) || inviteId < 1) {
		return json({ success: false, error: 'Invalid invite' }, { status: 400 });
	}

	const invite = await db.getServerAccountInviteByIdForServer(inviteId, serverId);
	if (!invite) {
		return json({ success: false, error: 'Invite not found' }, { status: 404 });
	}
	if (invite.used_by != null || invite.used_at) {
		return json({ success: false, error: 'This invite was already used' }, { status: 400 });
	}

	if (invite.expires_at && isUtcSqlExpired(invite.expires_at)) {
		return json({ success: false, error: 'This invite is already expired' }, { status: 400 });
	}

	const expiredAt = DateTime.utc().minus({ seconds: 1 }).toJSDate();
	await db.updateServerAccountInvite(inviteId, { expires_at: expiredAt });

	logger.log(`${locals.user.username} expired server account invite ${inviteId} (server ${serverId})`);

	return json({ success: true });
};
