import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { peekVerifyToken, addMinutesToNow, toMySQLDateTime, logger, getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { sendOTPEmail } from '$lib/frontend/email.js';
import { randomInt } from 'crypto';

const MAX_RESEND_ATTEMPTS = 5;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'resend-otp', MAX_RESEND_ATTEMPTS);

		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many resend attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: 429 }
			);
		}

		const body = await request.json();
		const verifyToken = typeof body.verify_token === 'string' ? body.verify_token.trim() : null;
		const accountSource: 'accounts' | 'server_accounts' = body.account_source === 'server_accounts' ? 'server_accounts' : 'accounts';

		if (!verifyToken) {
			return json({ success: false, error: 'Valid verification token is required' }, { status: 400 });
		}

		const accountId = await peekVerifyToken(verifyToken);
		if (!accountId) {
			return json({ success: false, error: 'Invalid or expired verification link. Please log in again.' }, { status: 401 });
		}

		const account = accountSource === 'server_accounts' ? await db.getServerAccountById(accountId) : await db.getAccountById(accountId);

		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 404 });
		}

		if (account.email_verified) {
			return json({ success: false, error: 'Email already verified' }, { status: 400 });
		}

		const otpCode = randomInt(100000, 999999).toString();
		const otpExpiresAt = toMySQLDateTime(addMinutesToNow(10));

		if (accountSource === 'server_accounts') {
			await db.updateServerAccount(account.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt ?? undefined });
		} else {
			await db.updateAccount(account.id, { otp_code: otpCode, otp_expires_at: otpExpiresAt });
		}

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
