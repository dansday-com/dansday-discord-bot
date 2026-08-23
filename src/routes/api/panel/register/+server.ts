import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import {
	checkRateLimit,
	getClientIp,
	sanitizeString,
	sanitizeUsername,
	sanitizeEmail,
	validateInputLength,
	newSessionId,
	setSession,
	makeSessionCookie,
	logger
} from '$lib/utils/index.js';
import bcrypt from 'bcryptjs';

const MAX_REGISTER_ATTEMPTS = 3;

async function validateRegistrationInputs(username: string, email: string, password: string) {
	const errors: string[] = [];

	const sanitizedUsername = sanitizeUsername(username);
	if (!sanitizedUsername || sanitizedUsername.length < 3) {
		errors.push('Username must be at least 3 characters long');
	} else if (!/^[a-zA-Z]+$/.test(sanitizedUsername)) {
		errors.push('Username can only contain uppercase and lowercase letters');
	} else {
		const r = validateInputLength(sanitizedUsername, 'Username', 3, 50);
		if (!r.valid) errors.push(r.error);
	}

	const sanitizedEmail = sanitizeEmail(email);
	if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
		errors.push('Valid email is required');
	} else {
		const r = validateInputLength(sanitizedEmail, 'Email', 5, 255);
		if (!r.valid) errors.push(r.error);
	}

	if (!password || typeof password !== 'string') {
		errors.push('Password is required');
	} else {
		const r = validateInputLength(password, 'Password', 6, 128);
		if (!r.valid) errors.push(r.error);
	}

	return { valid: errors.length === 0, errors, sanitizedUsername: sanitizedUsername || '', sanitizedEmail: sanitizedEmail || '' };
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.can_register) {
		return json({ success: false, error: 'Registration is disabled. A superadmin account already exists.' }, { status: 403 });
	}

	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'register', MAX_REGISTER_ATTEMPTS);

		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many registration attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: 429 }
			);
		}

		const { username, email, password } = await request.json();
		const validation = await validateRegistrationInputs(username, email, password);

		if (!validation.valid) {
			return json({ success: false, error: validation.errors[0] }, { status: 400 });
		}

		const existingUsername = await db.getAccountByUsername(validation.sanitizedUsername);
		if (existingUsername) {
			return json({ success: false, error: 'Username already taken. Please choose another.' }, { status: 400 });
		}

		const existingAccount = await db.getAccountByNormalizedEmail(validation.sanitizedEmail);
		if (existingAccount) {
			return json({ success: false, error: 'Email already registered. Please login instead.', redirect_to: '/login' }, { status: 400 });
		}

		const passwordHash = await bcrypt.hash(password, 12);

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
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
