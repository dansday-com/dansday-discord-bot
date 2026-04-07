import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { seedDemoSession } from '$lib/demo/seedDemo.js';
import { getClientIp, checkRateLimit, logger, makeSessionCookie, newSessionId, setSession } from '$lib/utils/index.js';

const MAX_DEMO_LOGIN_ATTEMPTS = 5;
const DEMO_SESSION_TTL_SECONDS = 60 * 5;

function generateCaptchaChallenge(): { challenge: string; answer: string } {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let challenge = '';
	for (let i = 0; i < 6; i++) {
		challenge += chars[Math.floor(Math.random() * chars.length)];
	}
	return { challenge, answer: challenge };
}

export const GET: RequestHandler = async () => {
	const { challenge } = generateCaptchaChallenge();
	return json({ challenge });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'demo_login', MAX_DEMO_LOGIN_ATTEMPTS);
		if (!rateLimit.allowed) {
			return json({ success: false, error: 'Too many demo login attempts. Please try again later.' }, { status: 429 });
		}

		const body = await request.json().catch(() => ({}));
		const { captcha_input, captcha_challenge } = body as { captcha_input?: string; captcha_challenge?: string };

		if (!captcha_input || !captcha_challenge) {
			return json({ success: false, error: 'Captcha is required.' }, { status: 400 });
		}

		if (captcha_input !== captcha_challenge) {
			return json({ success: false, error: 'Incorrect captcha. Please try again.' }, { status: 400 });
		}

		const sessionSlug = `demo_${randomBytes(6).toString('hex')}`;
		const seeded = await seedDemoSession(sessionSlug);

		const sessionId = newSessionId();
		await setSession(
			sessionId,
			{
				authenticated: true,
				account_id: seeded.superadmin_account_id,
				account_type: 'superadmin',
				account_source: 'accounts',
				is_demo: true,
				demo_panel_slug: sessionSlug
			},
			DEMO_SESSION_TTL_SECONDS
		);

		logger.log(`Demo login (IP: ${ip}) -> superadmin_account_id=${seeded.superadmin_account_id}, panel_slug=${sessionSlug}`);

		return json({ success: true, message: 'Demo login successful' }, { headers: { 'Set-Cookie': makeSessionCookie(sessionId) } });
	} catch (error: any) {
		logger.log(`❌ Demo login error: ${error?.message || String(error)}`);
		try {
			console.error(error);
		} catch (_) {}
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
