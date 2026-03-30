import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { addDaysToNow } from '$lib/server/utils.js';
import logger from '$lib/server/logger.js';
import { randomBytes } from 'crypto';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const links = await db.getAllPanelInviteLinks();
		return json({ success: true, links });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { account_type } = await request.json();
		if (!account_type || !['admin', 'moderator'].includes(account_type)) {
			return json({ success: false, error: 'Valid account type (admin or moderator) is required' }, { status: 400 });
		}

		const token = randomBytes(32).toString('hex');
		const expiresAt = addDaysToNow(1);

		await db.createPanelInviteLink({
			token,
			account_type,
			created_by: locals.user.account_id,
			expires_at: expiresAt
		});

		logger.log(`${locals.user.username} generated invite link for ${account_type} account`);

		const fullUrl = `${url.origin}/register?token=${token}`;
		return json({ success: true, invite_link: fullUrl, token, expires_at: expiresAt });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
