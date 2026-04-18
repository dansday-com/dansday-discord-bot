import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import {
	checkRateLimit,
	getClientIp,
	addMinutesToNow,
	sanitizeString,
	sanitizeUsername,
	sanitizeEmail,
	validateInputLength,
	createVerifyToken
} from '$lib/utils/index.js';
import { sendOTPEmail } from '$lib/frontend/email.js';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

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
			if (!existingUsername.email_verified) {
				const otpCode = randomInt(100000, 999999).toString();
				const otpExpiresAt = addMinutesToNow(10);
				await db.updateAccount(existingUsername.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt });
				try {
					await sendOTPEmail(existingUsername.email, otpCode);
				} catch (_) {}
				const verifyToken = await createVerifyToken(existingUsername.id);
				return json({ success: true, message: 'Account already exists. A new verification code has been sent to your email.', verify_token: verifyToken });
			}
			return json({ success: false, error: 'Username already taken. Please choose another.' }, { status: 400 });
		}

		const existingAccount = await db.getAccountByNormalizedEmail(validation.sanitizedEmail);
		if (existingAccount) {
			if (!existingAccount.email_verified) {
				const otpCode = randomInt(100000, 999999).toString();
				const otpExpiresAt = addMinutesToNow(10);
				await db.updateAccount(existingAccount.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt });
				try {
					await sendOTPEmail(existingAccount.email, otpCode);
				} catch (_) {}
				const verifyToken = await createVerifyToken(existingAccount.id);
				return json({ success: true, message: 'Account already exists. A new verification code has been sent to your email.', verify_token: verifyToken });
			}
			return json({ success: false, error: 'Email already registered. Please login instead.', redirect_to: '/login' }, { status: 400 });
		}

		const passwordHash = await bcrypt.hash(password, 12);
		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = addMinutesToNow(10);

		const account = await db.createAccount({
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: passwordHash,
			account_type: 'superadmin',
			email_verified: false,
			otp_code: otpCode,
			otp_expires_at: otpExpiresAt,
			ip_address: ip
		});

		await db.createPanel(account.id);

		try {
			await sendOTPEmail(validation.sanitizedEmail, otpCode);
		} catch (emailError: any) {
			return json(
				{ success: false, error: `Failed to send verification email: ${emailError.message}. Please check your email configuration.` },
				{ status: 500 }
			);
		}

		const verifyToken = await createVerifyToken(account.id);
		return json({ success: true, message: 'Registration successful. Please check your email for verification code.', verify_token: verifyToken });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
