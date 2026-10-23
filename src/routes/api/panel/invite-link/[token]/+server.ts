import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { sanitizeString, getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { INVITE_PROBLEM_MESSAGES, findOpenInvite } from '$lib/frontend/accountServers.server.js';
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

		const found = await findOpenInvite(sanitizedToken);
		if ('problem' in found) {
			return json(
				{ success: false, error: INVITE_PROBLEM_MESSAGES[found.problem] },
				{ status: found.problem === 'invite_not_found' ? HTTP.NOT_FOUND : HTTP.BAD_REQUEST }
			);
		}

		return json({ success: true, account_type: found.invite.account_type });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
