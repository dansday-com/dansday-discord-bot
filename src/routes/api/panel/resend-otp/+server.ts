import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { peekVerifyToken } from '$lib/server/session.js';
import { addMinutesToNow } from '$lib/server/utils.js';
import { sendOTPEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';
import { randomInt } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const verifyToken = typeof body.verify_token === 'string' ? body.verify_token.trim() : null;

		if (!verifyToken) {
			return json({ success: false, error: 'Valid verification token is required' }, { status: 400 });
		}

		const accountId = await peekVerifyToken(verifyToken);
		if (!accountId) {
			return json({ success: false, error: 'Invalid or expired verification link. Please log in again.' }, { status: 401 });
		}

		const account = await db.getAccountById(accountId);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 404 });
		}

		if (account.email_verified) {
			return json({ success: false, error: 'Email already verified' }, { status: 400 });
		}

		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = addMinutesToNow(10);

		await db.updateAccount(account.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt });

		try {
			await sendOTPEmail(account.email, otpCode);
		} catch (emailError: any) {
			logger.log(`❌ Failed to send OTP email: ${emailError.message}`);
			return json({ success: false, error: 'Failed to send verification email. Please try again.' }, { status: 500 });
		}

		return json({ success: true, message: 'OTP code resent successfully' });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
