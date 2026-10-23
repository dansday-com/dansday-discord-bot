import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { sanitizeString, logger } from '$lib/utils/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { INVITE_TOKEN_LENGTH } from '$lib/accounts.js';
import { INVITE_PROBLEM_MESSAGES, acceptAccountInvite, findOpenInvite, switchSessionServer } from '$lib/frontend/accountServers.server.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const { user, sessionId } = locals;
		if (!user.authenticated || user.account_source !== 'server_accounts' || !sessionId) {
			return json({ success: false, error: 'Log in first, then open the invite link again to accept it.' }, { status: HTTP.UNAUTHORIZED });
		}

		const body = await readJsonObject(request);
		const token = typeof body.token === 'string' ? sanitizeString(body.token, INVITE_TOKEN_LENGTH.max) : '';
		if (!token || token.length < INVITE_TOKEN_LENGTH.min) {
			return json({ success: false, error: 'Invalid token format' }, { status: HTTP.BAD_REQUEST });
		}

		const found = await findOpenInvite(token);
		if ('problem' in found) {
			return json({ success: false, error: INVITE_PROBLEM_MESSAGES[found.problem] }, { status: HTTP.BAD_REQUEST });
		}

		const account = await db.getAccountById(user.account_id);
		if (!account) {
			return json({ success: false, error: 'Your session expired. Log in again.' }, { status: HTTP.UNAUTHORIZED });
		}

		const refusal = await acceptAccountInvite(found.invite, account);
		if (refusal) {
			return json({ success: false, error: refusal }, { status: HTTP.FORBIDDEN });
		}
		await switchSessionServer(sessionId, found.invite.server_id);
		logger.log(`Accepted invite: ${account.username} joined "${found.server.name}" as ${found.invite.account_type}`);
		return json({ success: true });
	} catch (error) {
		logger.log(`❌ Accept invite error: ${(error as Error).message}`);
		return json({ success: false, error: 'Could not accept the invite. Please try again.' }, { status: HTTP.INTERNAL_ERROR });
	}
};
