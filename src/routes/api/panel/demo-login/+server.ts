import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { seedDemoSession } from '$lib/backend/demo/seedDemo.js';
import { getClientIp, checkRateLimit, logger, makeSessionCookie, newSessionId, setSession } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { MINUTE_SECONDS, SECOND_MS } from '$lib/utils/time.js';
import { CAPTCHA_LENGTH } from '$lib/accounts.js';

const MAX_DEMO_LOGIN_ATTEMPTS = 5;
const DEMO_SESSION_TTL_MINUTES = 10;
const DEMO_SESSION_TTL_SECONDS = DEMO_SESSION_TTL_MINUTES * MINUTE_SECONDS;
const CAPTCHA_TTL_MINUTES = 2;
const CAPTCHA_TTL_SECONDS = CAPTCHA_TTL_MINUTES * MINUTE_SECONDS;
const CAPTCHA_NOISE_LINES = 6;
const CAPTCHA_ROTATION_JITTER_DEGREES = 18;
const CAPTCHA_X_JITTER = 4;
const CAPTCHA_Y_JITTER = 6;
const CAPTCHA_NONCE_BYTES = 16;
const CAPTCHA_TOKEN_PARTS = 3;
const GCM_IV_BYTES = 12;
const DEMO_SLUG_BYTES = 6;

function generateCaptchaAnswer(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let answer = '';
	for (let i = 0; i < CAPTCHA_LENGTH; i++) {
		answer += chars[Math.floor(Math.random() * chars.length)];
	}
	return answer;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function jitter(max: number): number {
	return -max + Math.floor(Math.random() * (max * 2 + 1));
}

function renderCaptchaSvg(answer: string): string {
	const w = 360;
	const h = 72;
	const bg = '#0f172a';
	const fg = '#fbbf24';
	const noise = '#334155';
	const chars = answer.split('');
	const x0 = 48;
	const step = 44;
	const y = 48;
	const pieces = chars
		.map((c, i) => {
			const rot = jitter(CAPTCHA_ROTATION_JITTER_DEGREES);
			const dx = jitter(CAPTCHA_X_JITTER);
			const dy = jitter(CAPTCHA_Y_JITTER);
			const x = x0 + i * step + dx;
			const yy = y + dy;
			return `<text x="${x}" y="${yy}" fill="${fg}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" transform="rotate(${rot} ${x} ${yy})">${escapeXml(
				c
			)}</text>`;
		})
		.join('');

	const lines = Array.from({ length: CAPTCHA_NOISE_LINES })
		.map(() => {
			const x1 = Math.floor(Math.random() * w);
			const y1 = Math.floor(Math.random() * h);
			const x2 = Math.floor(Math.random() * w);
			const y2 = Math.floor(Math.random() * h);
			const sw = 1 + Math.floor(Math.random() * 2);
			return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${noise}" stroke-width="${sw}" opacity="0.8" />`;
		})
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <rect width="100%" height="100%" rx="10" ry="10" fill="${bg}"/>\n  ${lines}\n  <g opacity="0.95">${pieces}</g>\n</svg>`;
}

function keyFromSecret(secret: string): Buffer {
	return createHash('sha256').update(secret, 'utf8').digest();
}

function makeCaptchaToken(answer: string, secret: string): string {
	const payload = JSON.stringify({
		answer,
		iat: Date.now(),
		nonce: randomBytes(CAPTCHA_NONCE_BYTES).toString('hex')
	});
	const iv = randomBytes(GCM_IV_BYTES);
	const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
	const ct = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
}

function verifyCaptchaToken(token: string, secret: string): { ok: boolean; answer?: string } {
	const parts = token.split('.');
	if (parts.length !== CAPTCHA_TOKEN_PARTS) {
		return { ok: false };
	}
	const [ivB64, tagB64, ctB64] = parts;
	try {
		const iv = Buffer.from(ivB64, 'base64url');
		const tag = Buffer.from(tagB64, 'base64url');
		const ct = Buffer.from(ctB64, 'base64url');
		const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), iv);
		decipher.setAuthTag(tag);
		const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
		const payload = JSON.parse(pt) as { answer?: string; iat?: number };
		if (!payload?.answer || typeof payload.iat !== 'number') {
			return { ok: false };
		}
		if (Date.now() - payload.iat > CAPTCHA_TTL_SECONDS * SECOND_MS) {
			return { ok: false };
		}
		return { ok: true, answer: payload.answer };
	} catch (_) {
		return { ok: false };
	}
}

export const GET: RequestHandler = async () => {
	const secret = process.env.SECRET;
	if (!secret) {
		return json({ error: 'Captcha is not configured.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const answer = generateCaptchaAnswer();
	const token = makeCaptchaToken(answer, secret);
	const svg = renderCaptchaSvg(answer);
	return json({ image_svg: svg, token });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'demo_login', { maxAttempts: MAX_DEMO_LOGIN_ATTEMPTS });
		if (!rateLimit.allowed) {
			return json({ success: false, error: 'Too many demo login attempts. Please try again later.' }, { status: HTTP.TOO_MANY_REQUESTS });
		}

		const body = await request.json().catch(() => ({}));
		const { captcha_input, captcha_token } = body as {
			captcha_input?: string;
			captcha_token?: string;
		};

		const secret = process.env.SECRET;
		if (!secret) {
			return json({ success: false, error: 'Captcha is not configured.' }, { status: HTTP.INTERNAL_ERROR });
		}

		if (!captcha_input || !captcha_token) {
			return json({ success: false, error: 'Captcha is required.' }, { status: HTTP.BAD_REQUEST });
		}

		const verified = verifyCaptchaToken(captcha_token, secret);
		if (!verified.ok || !verified.answer) {
			return json({ success: false, error: 'Captcha expired. Please try again.' }, { status: HTTP.BAD_REQUEST });
		}

		if (captcha_input !== verified.answer) {
			return json({ success: false, error: 'Incorrect captcha. Please try again.' }, { status: HTTP.BAD_REQUEST });
		}

		const sessionSlug = `demo_${randomBytes(DEMO_SLUG_BYTES).toString('hex')}`;
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
	} catch (error) {
		logger.log(`❌ Demo login error: ${(error as Error)?.message || String(error)}`);
		try {
			console.error(error);
		} catch (_) {}
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
