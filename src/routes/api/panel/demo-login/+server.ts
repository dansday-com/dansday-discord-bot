import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { seedDemoSession } from '$lib/backend/demo/seedDemo.js';
import { getClientIp, checkRateLimit, logger, makeSessionCookie, newSessionId, setSession } from '$lib/utils/index.js';

const MAX_DEMO_LOGIN_ATTEMPTS = 5;
const DEMO_SESSION_TTL_SECONDS = 60 * 5;
const CAPTCHA_TTL_SECONDS = 60 * 2;

function generateCaptchaAnswer(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let answer = '';
	for (let i = 0; i < 6; i++) {
		answer += chars[Math.floor(Math.random() * chars.length)];
	}
	return answer;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
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
			const rot = -18 + Math.floor(Math.random() * 37);
			const dx = -4 + Math.floor(Math.random() * 9);
			const dy = -6 + Math.floor(Math.random() * 13);
			const x = x0 + i * step + dx;
			const yy = y + dy;
			return `<text x="${x}" y="${yy}" fill="${fg}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" transform="rotate(${rot} ${x} ${yy})">${escapeXml(
				c
			)}</text>`;
		})
		.join('');

	const lines = Array.from({ length: 6 })
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
		nonce: randomBytes(16).toString('hex')
	});
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
	const ct = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
}

function verifyCaptchaToken(token: string, secret: string): { ok: boolean; answer?: string } {
	const parts = token.split('.');
	if (parts.length !== 3) return { ok: false };
	const [ivB64, tagB64, ctB64] = parts;
	try {
		const iv = Buffer.from(ivB64, 'base64url');
		const tag = Buffer.from(tagB64, 'base64url');
		const ct = Buffer.from(ctB64, 'base64url');
		const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), iv);
		decipher.setAuthTag(tag);
		const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
		const payload = JSON.parse(pt) as { answer?: string; iat?: number };
		if (!payload?.answer || typeof payload.iat !== 'number') return { ok: false };
		if (Date.now() - payload.iat > CAPTCHA_TTL_SECONDS * 1000) return { ok: false };
		return { ok: true, answer: payload.answer };
	} catch (_) {
		return { ok: false };
	}
}

export const GET: RequestHandler = async () => {
	const secret = process.env.CAPTCHA_SECRET;
	if (!secret) return json({ error: 'Captcha is not configured.' }, { status: 500 });
	const answer = generateCaptchaAnswer();
	const token = makeCaptchaToken(answer, secret);
	const svg = renderCaptchaSvg(answer);
	return json({ image_svg: svg, token });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const ip = getClientIp(request);
		const rateLimit = await checkRateLimit(ip, 'demo_login', MAX_DEMO_LOGIN_ATTEMPTS);
		if (!rateLimit.allowed) {
			return json({ success: false, error: 'Too many demo login attempts. Please try again later.' }, { status: 429 });
		}

		const body = await request.json().catch(() => ({}));
		const { captcha_input, captcha_token } = body as {
			captcha_input?: string;
			captcha_token?: string;
		};

		const secret = process.env.CAPTCHA_SECRET;
		if (!secret) {
			return json({ success: false, error: 'Captcha is not configured.' }, { status: 500 });
		}

		if (!captcha_input || !captcha_token) {
			return json({ success: false, error: 'Captcha is required.' }, { status: 400 });
		}

		const verified = verifyCaptchaToken(captcha_token, secret);
		if (!verified.ok || !verified.answer) {
			return json({ success: false, error: 'Captcha expired. Please try again.' }, { status: 400 });
		}

		if (captcha_input !== verified.answer) {
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
