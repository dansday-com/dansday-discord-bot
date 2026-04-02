import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { newSessionId, setSession, makeSessionCookie, createVerifyToken } from '$lib/server/session.js';
import { checkRateLimit, getClientIp } from '$lib/server/rateLimit.js';
import { sanitizeString, sanitizeEmail, sanitizeUsername, validateInputLength } from '$lib/server/utils.js';
import logger from '$lib/server/logger.js';
import bcrypt from 'bcrypt';

const MAX_LOGIN_ATTEMPTS = 5;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'login', MAX_LOGIN_ATTEMPTS);

		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many login attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: 429 }
			);
		}

		const body = await request.json();
		const { username_or_email, password } = body;

		if (!username_or_email || !password) {
			return json({ success: false, error: 'Username/Email and password are required' }, { status: 400 });
		}

		let sanitizedInput = sanitizeString(username_or_email, 255);
		let account: any = null;
		let accountSource: 'accounts' | 'server_accounts' = 'accounts';

		if (sanitizedInput.includes('@')) {
			const sanitizedEmail = sanitizeEmail(sanitizedInput);
			if (sanitizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
				account = await db.getAccountByEmail(sanitizedEmail);
				if (!account) {
					account = await db.getServerAccountByEmail(sanitizedEmail);
					if (account) accountSource = 'server_accounts';
				}
			}
		}

		if (!account) {
			const sanitizedUsername = sanitizeUsername(sanitizedInput);
			if (sanitizedUsername && sanitizedUsername.length >= 3) {
				account = await db.getAccountByUsername(sanitizedUsername);
				if (!account) {
					account = await db.getServerAccountByUsername(sanitizedUsername);
					if (account) accountSource = 'server_accounts';
				}
			}
		}

		if (typeof password !== 'string') {
			return json({ success: false, error: 'Invalid password format' }, { status: 400 });
		}

		const passwordValidation = validateInputLength(password, 'Password', 1, 128);
		if (!passwordValidation.valid) {
			return json({ success: false, error: passwordValidation.error }, { status: 400 });
		}

		if (!account) {
			logger.log(`Failed login attempt: Account not found (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		if (!account.email_verified) {
			const verifyToken = await createVerifyToken(account.id);
			return json(
				{
					success: false,
					error: 'Email not verified. Please verify your email first.',
					requires_verification: true,
					verify_token: verifyToken,
					account_source: accountSource
				},
				{ status: 401 }
			);
		}

		if (accountSource === 'server_accounts' && account.is_frozen) {
			logger.log(`Blocked login attempt: Account frozen for ${account.username} (IP: ${ip})`);
			return json({ success: false, error: 'This account has been frozen. Please contact an administrator.' }, { status: 403 });
		}

		const isValid = await bcrypt.compare(password, account.password_hash);
		if (!isValid) {
			logger.log(`Failed login attempt for ${account.username} (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		if (accountSource === 'accounts') {
			await db.updateAccount(account.id, { ip_address: ip });
		} else {
			await db.updateServerAccount(account.id, { ip_address: ip });
		}

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			account_id: account.id,
			account_type: account.account_type,
			account_source: accountSource
		});

		logger.log(`Successful login: ${account.username} (IP: ${ip})`);

		return json(
			{ success: true, message: 'Login successful', account_type: account.account_type, account_source: accountSource },
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error: any) {
		logger.log(`❌ Panel login error: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
