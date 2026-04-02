import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { newSessionId, setSession, makeSessionCookie, peekVerifyToken, consumeVerifyToken } from '$lib/server/session.js';
import { getClientIp } from '$lib/server/rateLimit.js';
import { sanitizeString, getNowInTimezone, getDateTimeFromSQL, toMySQLDateTime } from '$lib/server/utils.js';
import { sendVerificationSuccessEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const verifyToken = typeof body.verify_token === 'string' ? body.verify_token.trim() : null;
		const sanitizedOtpCode = sanitizeString(body.otp_code, 6);
		const accountSource: 'accounts' | 'server_accounts' = body.account_source === 'server_accounts' ? 'server_accounts' : 'accounts';

		if (!verifyToken || !sanitizedOtpCode || sanitizedOtpCode.length !== 6) {
			return json({ success: false, error: 'Verification token and valid OTP code are required' }, { status: 400 });
		}

		const sanitizedAccountId = await peekVerifyToken(verifyToken);
		if (!sanitizedAccountId) {
			return json({ success: false, error: 'Invalid or expired verification link. Please log in again.' }, { status: 401 });
		}

		if (!/^\d{6}$/.test(sanitizedOtpCode)) {
			return json({ success: false, error: 'OTP code must be 6 digits' }, { status: 400 });
		}

		const account = accountSource === 'server_accounts' ? await db.getServerAccountById(sanitizedAccountId) : await db.getAccountById(sanitizedAccountId);

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
		await consumeVerifyToken(verifyToken);

		if (accountSource === 'server_accounts') {
			await db.updateServerAccount(account.id, { email_verified: true, otp_code: null, otp_expires_at: null });
		} else {
			await db.updateAccount(account.id, { email_verified: true, otp_code: null, otp_expires_at: null, ip_address: ip });
		}

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			account_id: account.id,
			account_type: account.account_type,
			account_source: accountSource
		});

		logger.log(`Email verified and logged in: ${account.username} (IP: ${ip})`);

		try {
			await sendVerificationSuccessEmail(account.email, account.username);
		} catch (_) {}

		return json(
			{ success: true, message: 'Email verified successfully', account_type: account.account_type, account_source: accountSource },
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
