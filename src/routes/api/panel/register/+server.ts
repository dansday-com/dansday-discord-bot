import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { checkRateLimit, getClientIp } from '$lib/server/rateLimit.js';
import { addMinutesToNow } from '$lib/server/utils.js';
import { sendOTPEmail } from '$lib/server/email.js';
import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { sanitizeString, sanitizeUsername, sanitizeEmail, validateInputLength } from '$lib/server/utils.js';

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

export const POST: RequestHandler = async ({ request }) => {
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

		const existingUsername = await db.getPanelAccountByUsername(validation.sanitizedUsername);
		if (existingUsername) {
			return json({ success: false, error: 'Username already taken. Please choose another.' }, { status: 400 });
		}

		const existingAccount = await db.getPanelAccountByEmail(validation.sanitizedEmail);
		if (existingAccount) {
			return json({ success: false, error: 'Email already registered. Please login instead.' }, { status: 400 });
		}

		let panel = await db.getPanel();
		if (!panel) {
			await db.createPanel();
			panel = await db.getPanel();
		}

		const passwordHash = await bcrypt.hash(password, 12);
		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = addMinutesToNow(10);

		const account = await db.createPanelAccount({
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: passwordHash,
			account_type: 'admin',
			email_verified: false,
			otp_code: otpCode,
			otp_expires_at: otpExpiresAt,
			panel_id: panel.id,
			ip_address: ip
		});

		try {
			await sendOTPEmail(validation.sanitizedEmail, otpCode);
		} catch (emailError: any) {
			return json(
				{ success: false, error: `Failed to send verification email: ${emailError.message}. Please check your email configuration.` },
				{ status: 500 }
			);
		}

		return json({ success: true, message: 'Registration successful. Please check your email for verification code.', account_id: account.id });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
