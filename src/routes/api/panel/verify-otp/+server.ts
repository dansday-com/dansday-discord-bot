import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { newSessionId, setSession, makeSessionCookie } from '$lib/server/session.js';
import { getClientIp } from '$lib/server/rateLimit.js';
import { sanitizeString, sanitizeInteger, getNowInTimezone, getDateTimeFromSQL } from '$lib/server/utils.js';
import { sendVerificationSuccessEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const sanitizedAccountId = sanitizeInteger(body.account_id, 1, null);
		const sanitizedOtpCode = sanitizeString(body.otp_code, 6);

		if (!sanitizedAccountId || !sanitizedOtpCode || sanitizedOtpCode.length !== 6) {
			return json({ success: false, error: 'Account ID and valid OTP code are required' }, { status: 400 });
		}

		if (!/^\d{6}$/.test(sanitizedOtpCode)) {
			return json({ success: false, error: 'OTP code must be 6 digits' }, { status: 400 });
		}

		const account = await db.getPanelAccountById(sanitizedAccountId);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 404 });
		}

		if (account.email_verified) {
			return json({ success: false, error: 'Email already verified' }, { status: 400 });
		}

		if (!account.otp_code || account.otp_code !== sanitizedOtpCode) {
			logger.log(`Failed OTP verification for ${account.username} (IP: ${getClientIp(request)})`);
			return json({ success: false, error: 'Invalid OTP code' }, { status: 401 });
		}

		if (account.otp_expires_at) {
			const expiresAt = getDateTimeFromSQL(account.otp_expires_at);
			const now = getNowInTimezone();
			if (expiresAt?.isValid && expiresAt < now) {
				return json({ success: false, error: 'OTP code has expired. Please request a new one.' }, { status: 401 });
			}
		}

		const ip = getClientIp(request);
		await db.updatePanelAccount(account.id, {
			email_verified: true,
			otp_code: null,
			otp_expires_at: null,
			ip_address: ip
		});

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			panel_account_id: account.id,
			account_type: account.account_type
		});

		logger.log(`Email verified and logged in: ${account.username} (IP: ${ip})`);

		try {
			await sendVerificationSuccessEmail(account.email, account.username);
		} catch {}

		return json(
			{ success: true, message: 'Email verified successfully', account_type: account.account_type },
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
