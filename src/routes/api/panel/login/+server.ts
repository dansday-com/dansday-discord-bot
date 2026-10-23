import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import {
	makeSessionCookie,
	checkRateLimit,
	getClientIp,
	sanitizeString,
	sanitizeEmail,
	sanitizeUsername,
	validateInputLength,
	logger
} from '$lib/utils/index.js';
import bcrypt from 'bcryptjs';
import { HTTP, readJsonObject } from '$lib/http.js';
import { ACCOUNT_ROLE_LABELS, INVITE_TOKEN_LENGTH, USERNAME_MIN_LENGTH } from '$lib/accounts.js';
import { INVITE_PROBLEM_MESSAGES, acceptAccountInvite, findOpenInvite, openAccountSession } from '$lib/frontend/accountServers.server.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_INPUT_MAX_LENGTH = 255;

type LoginAccount = NonNullable<Awaited<ReturnType<typeof db.getAccountByEmail>>>;

async function findAccountByLogin(input: string) {
	const email = input.includes('@') ? sanitizeEmail(input) : '';
	if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		const byEmail = await db.getAccountByEmail(email);
		if (byEmail) {
			return byEmail;
		}
	}
	const username = sanitizeUsername(input);
	return username && username.length >= USERNAME_MIN_LENGTH ? db.getAccountByUsername(username) : null;
}

async function acceptLoginInvite(account: LoginAccount, rawToken: unknown): Promise<{ serverId: number | null; notice: string | null }> {
	if (account.account_type === 'superadmin' || typeof rawToken !== 'string' || !rawToken) {
		return { serverId: null, notice: null };
	}
	const found = await findOpenInvite(sanitizeString(rawToken, INVITE_TOKEN_LENGTH.max));
	if ('problem' in found) {
		return { serverId: null, notice: INVITE_PROBLEM_MESSAGES[found.problem] };
	}
	const refusal = await acceptAccountInvite(found.invite, account);
	if (refusal) {
		return { serverId: null, notice: refusal };
	}
	return {
		serverId: found.invite.server_id,
		notice: `You joined ${found.server.name || 'the server'} as ${ACCOUNT_ROLE_LABELS[found.invite.account_type]}`
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'login', { maxAttempts: MAX_LOGIN_ATTEMPTS });

		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: 'Too many login attempts. Please try again later.', resetTime: new Date(rateLimit.resetTime).toISOString() },
				{ status: HTTP.TOO_MANY_REQUESTS }
			);
		}

		const body = await readJsonObject(request);
		const { username_or_email, password } = body;

		if (typeof username_or_email !== 'string' || typeof password !== 'string' || !username_or_email || !password) {
			return json({ success: false, error: 'Username/Email and password are required' }, { status: HTTP.BAD_REQUEST });
		}

		const account = await findAccountByLogin(sanitizeString(username_or_email, LOGIN_INPUT_MAX_LENGTH));

		const passwordValidation = validateInputLength(password, 'Password', { minLength: 1, maxLength: 128 });
		if (!passwordValidation.valid) {
			return json({ success: false, error: passwordValidation.error }, { status: HTTP.BAD_REQUEST });
		}

		if (!account) {
			logger.log(`Failed login attempt: Account not found (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: HTTP.UNAUTHORIZED });
		}

		const isValid = await bcrypt.compare(password, account.password_hash);
		if (!isValid) {
			logger.log(`Failed login attempt for ${account.username} (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: HTTP.UNAUTHORIZED });
		}

		const joined = await acceptLoginInvite(account, body.invite_token);
		const accountServers = account.account_type === 'superadmin' ? [] : await db.getActiveAccountServers(account.id);
		if (account.account_type !== 'superadmin' && accountServers.length === 0) {
			logger.log(`Blocked login attempt: No active server for ${account.username} (IP: ${ip})`);
			return json(
				{
					success: false,
					error:
						joined.notice ??
						'None of your servers are available: the bot was removed or your access was frozen. Add the bot back and run /setup, or ask a server owner for a new invite link.'
				},
				{ status: HTTP.FORBIDDEN }
			);
		}

		await db.updateAccount(account.id, { ip_address: ip });
		const sessionId = await openAccountSession(account.id, joined.serverId ?? accountServers[0]?.server_id);

		logger.log(`Successful login: ${account.username} (IP: ${ip})`);

		return json({ success: true, message: 'Login successful', notice: joined.notice }, { headers: { 'Set-Cookie': makeSessionCookie(sessionId) } });
	} catch (error) {
		logger.log(`❌ Panel login error: ${(error as Error).message}`);
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
