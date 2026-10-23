import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { checkRateLimit, getClientIp, newSessionId, setSession, makeSessionCookie, logger } from '$lib/utils/index.js';
import bcrypt from 'bcryptjs';
import { HTTP, readJsonObject } from '$lib/http.js';
import { BCRYPT_SALT_ROUNDS, validateRegistrationInputs } from '$lib/frontend/registration.server.js';

const MAX_REGISTER_ATTEMPTS = 3;

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.can_register) {
		return json({ success: false, error: 'Registration is disabled. A superadmin account already exists.' }, { status: HTTP.FORBIDDEN });
	}

	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'register', { maxAttempts: MAX_REGISTER_ATTEMPTS });

		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many registration attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: HTTP.TOO_MANY_REQUESTS }
			);
		}

		const { username, email, password } = await readJsonObject(request);
		if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
			return json({ success: false, error: 'Username, email and password are required' }, { status: HTTP.BAD_REQUEST });
		}
		const validation = await validateRegistrationInputs(username, email, password);

		if (!validation.valid) {
			return json({ success: false, error: validation.errors[0] }, { status: HTTP.BAD_REQUEST });
		}

		const existingUsername = await db.getAccountByUsername(validation.sanitizedUsername);
		if (existingUsername) {
			return json({ success: false, error: 'Username already taken. Please choose another.' }, { status: HTTP.BAD_REQUEST });
		}

		const existingAccount = await db.getAccountByNormalizedEmail(validation.sanitizedEmail);
		if (existingAccount) {
			return json({ success: false, error: 'Email already registered. Please login instead.', redirect_to: '/login' }, { status: HTTP.BAD_REQUEST });
		}

		const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

		const account = await db.createAccount({
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: passwordHash,
			account_type: 'superadmin',
			ip_address: ip
		});

		await db.createPanel(account.id);

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			account_id: account.id,
			account_type: account.account_type,
			account_source: 'accounts'
		});

		logger.log(`Registered and logged in: ${account.username} (superadmin, IP: ${ip})`);

		return json(
			{ success: true, message: 'Registration successful.', account_type: account.account_type, account_source: 'accounts' },
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
