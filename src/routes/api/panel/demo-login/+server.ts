import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ensureDemoReady } from '$lib/demo/seedDemo.js';
import { getClientIp, checkRateLimit, logger, makeSessionCookie, newSessionId, setSession } from '$lib/utils/index.js';

const MAX_DEMO_LOGIN_ATTEMPTS = 25;
const DEMO_SESSION_TTL_SECONDS = 60 * 10;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'demo_login', MAX_DEMO_LOGIN_ATTEMPTS);
		if (!rateLimit.allowed) {
			return json({ success: false, error: 'Too many demo login attempts. Please try again later.' }, { status: 429 });
		}

		const seeded = await ensureDemoReady();

		const sessionId = newSessionId();
		await setSession(
			sessionId,
			{
				authenticated: true,
				account_id: seeded.superadmin_account_id,
				account_type: 'superadmin',
				account_source: 'accounts',
				is_demo: true
			},
			DEMO_SESSION_TTL_SECONDS
		);

		logger.log(`Demo login (IP: ${ip}) -> superadmin_account_id=${seeded.superadmin_account_id}`);

		return json({ success: true, message: 'Demo login successful' }, { headers: { 'Set-Cookie': makeSessionCookie(sessionId) } });
	} catch (error: any) {
		logger.log(`❌ Demo login error: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
