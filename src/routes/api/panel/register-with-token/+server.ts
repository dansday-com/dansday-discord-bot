import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import {
	sanitizeString,
	sanitizeUsername,
	sanitizeEmail,
	validateInputLength,
	addMinutesToNow,
	getNowInTimezone,
	getDateTimeFromSQL,
	getCurrentDateTime,
	toMySQLDateTime
} from '$lib/server/utils.js';
import { sendOTPEmail } from '$lib/server/email.js';
import { createVerifyToken } from '$lib/server/session.js';
import logger from '$lib/server/logger.js';
import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

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
		const body = await request.json();
		const { token, username, email, password } = body;

		if (!token || typeof token !== 'string') {
			return json({ success: false, error: 'Token is required' }, { status: 400 });
		}

		const sanitizedToken = sanitizeString(token, 255);
		if (!sanitizedToken || sanitizedToken.length < 32) {
			return json({ success: false, error: 'Invalid token format' }, { status: 400 });
		}

		const validation = await validateRegistrationInputs(username, email, password);
		if (!validation.valid) {
			return json({ success: false, error: validation.errors[0] }, { status: 400 });
		}

		const inviteLink = await db.getServerAccountInviteByToken(sanitizedToken);
		if (!inviteLink) {
			return json({ success: false, error: 'Invalid invite link' }, { status: 404 });
		}

		if (inviteLink.used_by || inviteLink.used_at) {
			return json({ success: false, error: 'Invite link has already been used' }, { status: 400 });
		}

		if (inviteLink.expires_at) {
			const expiresAt = getDateTimeFromSQL(inviteLink.expires_at);
			const now = getNowInTimezone();
			if (expiresAt?.isValid && expiresAt < now) {
				return json({ success: false, error: 'Invite link has expired' }, { status: 400 });
			}
		}

		const existingInScope = await db.getServerAccountByEmailServer(validation.sanitizedEmail, inviteLink.server_id);
		if (existingInScope) {
			return json({ success: false, error: 'Email already registered for this server' }, { status: 400 });
		}

		const passwordHash = await bcrypt.hash(password, 12);
		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = toMySQLDateTime(addMinutesToNow(10));

		const account = await db.createServerAccount({
			server_id: inviteLink.server_id,
			username: validation.sanitizedUsername,
			email: validation.sanitizedEmail,
			password_hash: passwordHash,
			account_type: inviteLink.account_type,
			email_verified: false,
			otp_code: otpCode,
			otp_expires_at: otpExpiresAt
		});

		await db.updateServerAccountInvite(inviteLink.id, { used_by: account.id, used_at: toMySQLDateTime(getCurrentDateTime()) ?? undefined });

		try {
			await sendOTPEmail(validation.sanitizedEmail, otpCode);
		} catch (emailError: any) {
			logger.log(`❌ Failed to send OTP email: ${emailError.message}`);
			return json({ success: false, error: `Failed to send verification email: ${emailError.message}.` }, { status: 500 });
		}

		const verifyToken = await createVerifyToken(account.id);
		return json({
			success: true,
			message: 'Registration successful. Please check your email for verification code.',
			verify_token: verifyToken,
			account_source: 'server_accounts'
		});
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
