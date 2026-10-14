import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import {
	sanitizeString,
	isUtcSqlExpired,
	getCurrentDateTime,
	toMySQLDateTime,
	getClientIp,
	checkRateLimit,
	newSessionId,
	setSession,
	makeSessionCookie,
	logger
} from '$lib/utils/index.js';
import bcrypt from 'bcryptjs';
import { HTTP } from '$lib/http.js';
import { INVITE_TOKEN_LENGTH } from '$lib/accounts.js';
import { BCRYPT_SALT_ROUNDS, validateRegistrationInputs } from '$lib/frontend/registration.server.js';

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

		const inviteLink = await db.getServerAccountInviteByToken(sanitizedToken);
		if (!inviteLink) {
			return json({ success: false, error: 'Invalid invite link' }, { status: HTTP.NOT_FOUND });
		}

		if (inviteLink.used_by || inviteLink.used_at) {
			return json({ success: false, error: 'Invite link has already been used' }, { status: HTTP.BAD_REQUEST });
		}

		if (inviteLink.expires_at && isUtcSqlExpired(inviteLink.expires_at)) {
			return json({ success: false, error: 'Invite link has expired' }, { status: HTTP.BAD_REQUEST });
		}

		const existingInScope = await db.getServerAccountByNormalizedEmailServer(validation.sanitizedEmail, inviteLink.server_id);
		if (existingInScope) {
			return json({ success: false, error: 'Email already registered for this server' }, { status: HTTP.BAD_REQUEST });
		}

		const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

		const account = await db.createServerAccount({
			server_id: inviteLink.server_id,
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: passwordHash,
			account_type: inviteLink.account_type,
			ip_address: ip
		});

		await db.updateServerAccountInvite(inviteLink.id, { used_by: account.id, used_at: toMySQLDateTime(getCurrentDateTime()) ?? undefined });
		await db
			.createServerPanelLog(
				Number(inviteLink.server_id),
				{ server_account_id: Number(account.id) },
				{
					action: 'account_invite',
					changes: [{ key: 'invite link', before: `${inviteLink.account_type}, open`, after: `${inviteLink.account_type}, used by ${account.username}` }]
				}
			)
			.catch(() => null);

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			account_id: account.id,
			account_type: account.account_type,
			account_source: 'server_accounts'
		});

		logger.log(`Registered and logged in: ${account.username} (${account.account_type}, IP: ${ip})`);

		return json(
			{
				success: true,
				message: 'Registration successful.',
				account_type: account.account_type,
				account_source: 'server_accounts'
			},
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
