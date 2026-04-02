import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { addDaysToNow, sanitizeInteger } from '$lib/server/utils.js';
import logger from '$lib/server/logger.js';
import { randomBytes } from 'crypto';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Superadmin access required' }, { status: 403 });
	}

	try {
		const links = await db.getAllInviteLinks();
		return json({ success: true, links });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const user = locals.user;

	// Only superadmin can create superadmin or owner invites
	// Owner can create moderator invites for their own servers
	if (user.account_type !== 'superadmin' && user.account_type !== 'owner') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { account_type, server_id } = body;

		const validTypes = user.account_type === 'superadmin' ? ['superadmin', 'owner', 'moderator'] : ['moderator'];

		if (!account_type || !validTypes.includes(account_type)) {
			return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: 400 });
		}

		// owner and moderator invites require a server_id
		if ((account_type === 'owner' || account_type === 'moderator') && !server_id) {
			return json({ success: false, error: 'server_id is required for owner and moderator invites' }, { status: 400 });
		}

		// Owners can only invite to their own accessible servers
		if (user.account_type === 'owner' && server_id) {
			const sanitizedServerId = sanitizeInteger(server_id, 1, null);
			const hasAccess = user.accessible_servers?.find((s) => s.server_id === sanitizedServerId && s.role === 'owner');
			if (!hasAccess) {
				return json({ success: false, error: 'You do not own that server' }, { status: 403 });
			}
		}

		const sanitizedServerId = server_id ? sanitizeInteger(server_id, 1, null) : null;

		const token = randomBytes(32).toString('hex');
		const expiresAt = addDaysToNow(1);

		await db.createInviteLink({
			token,
			account_type,
			server_id: sanitizedServerId,
			created_by: user.account_id,
			expires_at: expiresAt
		});

		logger.log(`${user.username} generated invite link for ${account_type} account${sanitizedServerId ? ` (server ${sanitizedServerId})` : ''}`);

		const fullUrl = `${url.origin}/register?token=${token}`;
		return json({ success: true, invite_link: fullUrl, token, expires_at: expiresAt });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
