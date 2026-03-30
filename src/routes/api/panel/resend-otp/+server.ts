import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { sanitizeInteger, addMinutesToNow } from '$lib/server/utils.js';
import { sendOTPEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';
import { randomInt } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const sanitizedAccountId = sanitizeInteger(body.account_id, 1, null);

		if (!sanitizedAccountId) {
			return json({ success: false, error: 'Valid account ID is required' }, { status: 400 });
		}

		const account = await db.getPanelAccountById(sanitizedAccountId);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 404 });
		}

		if (account.email_verified) {
			return json({ success: false, error: 'Email already verified' }, { status: 400 });
		}

		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = addMinutesToNow(10);

		await db.updatePanelAccount(account.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt });

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
