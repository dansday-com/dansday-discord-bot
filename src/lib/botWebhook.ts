import { request } from 'http';
import { HTTP } from './http.js';
import { attemptSync } from './utils/attempt.js';
import { SECOND_MS } from './utils/time.js';

const WEBHOOK_TIMEOUT_SECONDS = 25;

export type BotWebhookBody = { ok?: boolean; error?: string; details?: string; [field: string]: unknown };
export type BotWebhookResult = { status: number; body: BotWebhookBody | null };
export type BotWebhookTarget = { port: number | null; secret_key: string | null };

export function postToLocalBot(target: BotWebhookTarget, payload: unknown): Promise<BotWebhookResult> {
	if (!target.port) {
		return Promise.resolve({ status: HTTP.BAD_GATEWAY, body: null });
	}
	const body = JSON.stringify(payload);
	return new Promise((resolve) => {
		const req = request(
			{
				hostname: 'localhost',
				port: target.port,
				path: '/',
				method: 'POST',
				timeout: WEBHOOK_TIMEOUT_SECONDS * SECOND_MS,
				headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Secret-Key': target.secret_key ?? '' }
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					const parsed = attemptSync<BotWebhookBody>(() => JSON.parse(data));
					resolve({ status: res.statusCode ?? HTTP.INTERNAL_ERROR, body: parsed.ok ? parsed.value : null });
				});
			}
		);
		req.on('timeout', () => req.destroy(new Error('Bot did not respond in time')));
		req.on('error', () => resolve({ status: HTTP.BAD_GATEWAY, body: null }));
		req.write(body);
		req.end();
	});
}
