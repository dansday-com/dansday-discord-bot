import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { sanitizeString, getClientIp, checkRateLimit, makeSessionCookie, logger } from '$lib/utils/index.js';
import bcrypt from 'bcryptjs';
import { HTTP } from '$lib/http.js';
import { INVITE_TOKEN_LENGTH } from '$lib/accounts.js';
import { BCRYPT_SALT_ROUNDS, validateRegistrationInputs } from '$lib/frontend/registration.server.js';
import { INVITE_PROBLEM_MESSAGES, acceptAccountInvite, findOpenInvite, openAccountSession } from '$lib/frontend/accountServers.server.js';

const MAX_REGISTER_ATTEMPTS = 5;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'register-with-token', { maxAttempts: MAX_REGISTER_ATTEMPTS });
		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many registration attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: HTTP.TOO_MANY_REQUESTS }
			);
		}

		const body = await request.json();
		const { token, username, email, password } = body;

		if (!token || typeof token !== 'string') {
			return json({ success: false, error: 'Token is required' }, { status: HTTP.BAD_REQUEST });
		}

		const sanitizedToken = sanitizeString(token, INVITE_TOKEN_LENGTH.max);
		if (!sanitizedToken || sanitizedToken.length < INVITE_TOKEN_LENGTH.min) {
			return json({ success: false, error: 'Invalid token format' }, { status: HTTP.BAD_REQUEST });
		}

		const validation = await validateRegistrationInputs(username, email, password);
		if (!validation.valid) {
			return json({ success: false, error: validation.errors[0] }, { status: HTTP.BAD_REQUEST });
		}

		const found = await findOpenInvite(sanitizedToken);
		if ('problem' in found) {
			return json({ success: false, error: INVITE_PROBLEM_MESSAGES[found.problem] }, { status: HTTP.BAD_REQUEST });
		}

		const existingByEmail = await db.getAccountByNormalizedEmail(validation.sanitizedEmail);
		if (existingByEmail?.account_type === 'superadmin') {
			return json({ success: false, error: 'This email belongs to the panel admin account, which already manages every server.' }, { status: HTTP.CONFLICT });
		}
		if (existingByEmail) {
			return json(
				{ success: false, error: 'An account with this email already exists. Log in to accept this invite.', has_account: true },
				{ status: HTTP.CONFLICT }
			);
		}

		if (await db.getAccountByUsername(validation.sanitizedUsername)) {
			return json({ success: false, error: 'This username is taken. Choose another one, or sign in if it is yours.' }, { status: HTTP.CONFLICT });
		}

		const account = await db.createAccount({
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
			account_type: 'user',
			ip_address: ip
		});
		if (!account) {
			return json({ success: false, error: 'Could not create your account. Please try again.' }, { status: HTTP.INTERNAL_ERROR });
		}

		const refusal = await acceptAccountInvite(found.invite, account);
		if (refusal) {
			await db.deleteAccount(account.id);
			return json({ success: false, error: refusal }, { status: HTTP.CONFLICT });
		}
		const sessionId = await openAccountSession(account.id, found.invite.server_id);
		logger.log(`Registered and logged in: ${account.username} (${found.invite.account_type}, IP: ${ip})`);

		return json({ success: true, message: 'Registration successful.' }, { headers: { 'Set-Cookie': makeSessionCookie(sessionId) } });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
