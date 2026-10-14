import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import {
	newSessionId,
	setSession,
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
import { HTTP } from '$lib/http.js';
import { USERNAME_MIN_LENGTH } from '$lib/accounts.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_INPUT_MAX_LENGTH = 255;

type LoginAccount = NonNullable<Awaited<ReturnType<typeof db.getAccountByEmail>>> | NonNullable<Awaited<ReturnType<typeof db.getServerAccountByEmail>>>;

type FoundAccount = { account: LoginAccount; accountSource: 'accounts' | 'server_accounts' };
type AccountLookup = { panel: (key: string) => Promise<LoginAccount | null | undefined>; server: (key: string) => Promise<LoginAccount | null | undefined> };

const BY_EMAIL: AccountLookup = { panel: (key) => db.getAccountByEmail(key), server: (key) => db.getServerAccountByEmail(key) };
const BY_USERNAME: AccountLookup = { panel: (key) => db.getAccountByUsername(key), server: (key) => db.getServerAccountByUsername(key) };

async function lookupAccount(key: string, lookup: AccountLookup): Promise<FoundAccount | null> {
	const panelAccount = await lookup.panel(key);
	if (panelAccount) {
		return { account: panelAccount, accountSource: 'accounts' };
	}
	const serverAccount = await lookup.server(key);
	return serverAccount ? { account: serverAccount, accountSource: 'server_accounts' } : null;
}

async function findLoginAccount(input: string): Promise<FoundAccount | null> {
	const sanitizedEmail = input.includes('@') ? sanitizeEmail(input) : '';
	const byEmail = sanitizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail) ? await lookupAccount(sanitizedEmail, BY_EMAIL) : null;
	if (byEmail) {
		return byEmail;
	}
	const sanitizedUsername = sanitizeUsername(input);
	return sanitizedUsername && sanitizedUsername.length >= USERNAME_MIN_LENGTH ? lookupAccount(sanitizedUsername, BY_USERNAME) : null;
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

		const body = await request.json();
		const { username_or_email, password } = body;

		if (!username_or_email || !password) {
			return json({ success: false, error: 'Username/Email and password are required' }, { status: HTTP.BAD_REQUEST });
		}

		const sanitizedInput = sanitizeString(username_or_email, LOGIN_INPUT_MAX_LENGTH);
		const found = await findLoginAccount(sanitizedInput);
		const account = found?.account ?? null;
		const accountSource = found?.accountSource ?? 'accounts';

		if (typeof password !== 'string') {
			return json({ success: false, error: 'Invalid password format' }, { status: HTTP.BAD_REQUEST });
		}

		const passwordValidation = validateInputLength(password, 'Password', { minLength: 1, maxLength: 128 });
		if (!passwordValidation.valid) {
			return json({ success: false, error: passwordValidation.error }, { status: HTTP.BAD_REQUEST });
		}

		if (!account) {
			logger.log(`Failed login attempt: Account not found (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: HTTP.UNAUTHORIZED });
		}

		if (accountSource === 'server_accounts' && 'is_frozen' in account && account.is_frozen) {
			logger.log(`Blocked login attempt: Account frozen for ${account.username} (IP: ${ip})`);
			return json({ success: false, error: 'This account has been frozen. Please contact an administrator.' }, { status: HTTP.FORBIDDEN });
		}

		const isValid = await bcrypt.compare(password, account.password_hash);
		if (!isValid) {
			logger.log(`Failed login attempt for ${account.username} (IP: ${ip})`);
			return json({ success: false, error: 'Invalid credentials' }, { status: HTTP.UNAUTHORIZED });
		}

		if (accountSource === 'accounts') {
			await db.updateAccount(account.id, { ip_address: ip });
		} else {
			await db.updateServerAccount(account.id, { ip_address: ip });
		}

		const sessionId = newSessionId();
		await setSession(sessionId, {
			authenticated: true,
			account_id: account.id,
			account_type: account.account_type,
			account_source: accountSource
		});

		logger.log(`Successful login: ${account.username} (IP: ${ip})`);

		return json(
			{ success: true, message: 'Login successful', account_type: account.account_type, account_source: accountSource },
			{ headers: { 'Set-Cookie': makeSessionCookie(sessionId) } }
		);
	} catch (error) {
		logger.log(`❌ Panel login error: ${(error as Error).message}`);
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
