import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { sanitizeString, getNowInTimezone, getDateTimeFromSQL } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const sanitizedToken = sanitizeString(params.token, 255);
		if (!sanitizedToken || sanitizedToken.length < 32) {
			return json({ success: false, error: 'Invalid token format' }, { status: 400 });
		}

		const inviteLink = await db.getInviteLinkByToken(sanitizedToken);
		if (!inviteLink) {
			return json({ success: false, error: 'Invite link not found' }, { status: 404 });
		}

		if (inviteLink.used_by || inviteLink.used_at) {
			return json({ success: false, error: 'Invite link has already been used' }, { status: 400 });
		}

		if (inviteLink.expires_at) {
			const expiresAt = getDateTimeFromSQL(inviteLink.expires_at);
			const now = getNowInTimezone();
			if (expiresAt?.isValid && expiresAt < now) {
				return json({ success: false, error: 'Invite link has expired' }, { status: 400 });
			}
		}

		return json({ success: true, account_type: inviteLink.account_type });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
