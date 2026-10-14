import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { sanitizeString, isUtcSqlExpired, getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { INVITE_TOKEN_LENGTH } from '$lib/accounts.js';

const MAX_LOOKUPS = 20;

export const GET: RequestHandler = async ({ params, request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'invite-link-lookup', { maxAttempts: MAX_LOOKUPS });
		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: HTTP.TOO_MANY_REQUESTS }
			);
		}

		const sanitizedToken = sanitizeString(params.token, INVITE_TOKEN_LENGTH.max);
		if (!sanitizedToken || sanitizedToken.length < INVITE_TOKEN_LENGTH.min) {
			return json({ success: false, error: 'Invalid token format' }, { status: HTTP.BAD_REQUEST });
		}

		const inviteLink = await db.getServerAccountInviteByToken(sanitizedToken);
		if (!inviteLink) {
			return json({ success: false, error: 'Invite link not found' }, { status: HTTP.NOT_FOUND });
		}

		if (inviteLink.used_by || inviteLink.used_at) {
			return json({ success: false, error: 'Invite link has already been used' }, { status: HTTP.BAD_REQUEST });
		}

		if (inviteLink.expires_at && isUtcSqlExpired(inviteLink.expires_at)) {
			return json({ success: false, error: 'Invite link has expired' }, { status: HTTP.BAD_REQUEST });
		}

		return json({ success: true, account_type: inviteLink.account_type });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
