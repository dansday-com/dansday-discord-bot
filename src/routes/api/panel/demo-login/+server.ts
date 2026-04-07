import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { seedDemoSession } from '$lib/demo/seedDemo.js';
import { getClientIp, checkRateLimit, logger, makeSessionCookie, newSessionId, setSession } from '$lib/utils/index.js';

const MAX_DEMO_LOGIN_ATTEMPTS = 5;
const DEMO_SESSION_TTL_SECONDS = 60 * 5;
const CAPTCHA_TTL_SECONDS = 60 * 2;

function generateCaptchaChallenge(): { challenge: string; answer: string } {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let challenge = '';
	for (let i = 0; i < 6; i++) {
		challenge += chars[Math.floor(Math.random() * chars.length)];
	}
	return { challenge, answer: challenge };
}

function base64UrlEncode(s: string): string {
	return Buffer.from(s, 'utf8').toString('base64url');
}

function base64UrlDecodeToString(s: string): string {
	return Buffer.from(s, 'base64url').toString('utf8');
}

function signCaptchaPayload(payloadB64: string, secret: string): string {
	return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function makeCaptchaToken(challenge: string, secret: string): string {
	const payload = JSON.stringify({
		challenge,
		iat: Date.now(),
		nonce: randomBytes(16).toString('hex')
	});
	const payloadB64 = base64UrlEncode(payload);
	const sig = signCaptchaPayload(payloadB64, secret);
	return `${payloadB64}.${sig}`;
}

function verifyCaptchaToken(token: string, secret: string): { ok: boolean; challenge?: string } {
	const parts = token.split('.');
	if (parts.length !== 2) return { ok: false };
	const [payloadB64, sig] = parts;
	const expectedSig = signCaptchaPayload(payloadB64, secret);
	try {
		const a = Buffer.from(sig, 'base64url');
		const b = Buffer.from(expectedSig, 'base64url');
		if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
	} catch (_) {
		return { ok: false };
	}

	try {
		const payloadRaw = base64UrlDecodeToString(payloadB64);
		const payload = JSON.parse(payloadRaw) as { challenge?: string; iat?: number };
		if (!payload?.challenge || typeof payload.iat !== 'number') return { ok: false };
		if (Date.now() - payload.iat > CAPTCHA_TTL_SECONDS * 1000) return { ok: false };
		return { ok: true, challenge: payload.challenge };
	} catch (_) {
		return { ok: false };
	}
}

export const GET: RequestHandler = async () => {
	const { challenge } = generateCaptchaChallenge();
	const secret = process.env.CAPTCHA_SECRET;
	if (!secret) return json({ error: 'Captcha is not configured.' }, { status: 500 });
	const token = makeCaptchaToken(challenge, secret);
	return json({ challenge, token });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'demo_login', MAX_DEMO_LOGIN_ATTEMPTS);
		if (!rateLimit.allowed) {
			return json({ success: false, error: 'Too many demo login attempts. Please try again later.' }, { status: 429 });
		}

		const body = await request.json().catch(() => ({}));
		const { captcha_input, captcha_challenge, captcha_token } = body as {
			captcha_input?: string;
			captcha_challenge?: string;
			captcha_token?: string;
		};

		const secret = process.env.CAPTCHA_SECRET;
		if (!secret) {
			return json({ success: false, error: 'Captcha is not configured.' }, { status: 500 });
		}

		if (!captcha_input || !captcha_challenge || !captcha_token) {
			return json({ success: false, error: 'Captcha is required.' }, { status: 400 });
		}

		const verified = verifyCaptchaToken(captcha_token, secret);
		if (!verified.ok || verified.challenge !== captcha_challenge) {
			return json({ success: false, error: 'Captcha expired. Please try again.' }, { status: 400 });
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
