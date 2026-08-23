import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { request as httpRequest } from 'http';

function postToBot(bot: { port: number | null; secret_key: string | null }, payload: string) {
	return new Promise<{ status: number; body: any }>((resolve) => {
		const options = {
			hostname: 'localhost',
			port: bot.port as number,
			path: '/',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(payload),
				'X-Secret-Key': bot.secret_key ?? ''
			}
		};
		const req = httpRequest(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				try {
					resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
				} catch {
					resolve({ status: 500, body: { error: 'Failed to parse bot response' } });
				}
			});
		});
		req.on('error', (err) => {
			logger.log(`❌ Error calling bot webhook: ${err.message}`);
			resolve({ status: 500, body: { error: 'Failed to communicate with bot' } });
		});
		req.write(payload);
		req.end();
	});
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const guildId = body && typeof body.guild_id === 'string' ? body.guild_id.trim() : '';
	if (!guildId) {
		return json({ success: false, error: 'guild_id is required' }, { status: 400 });
	}

	const bots = await db.getAllBots(locals.user.panel_id).catch(() => []);
	const running = (bots as any[]).filter((b) => b.port && b.secret_key && b.status === 'running');
	if (running.length === 0) {
		return json({ success: false, error: 'No running bots available' }, { status: 409 });
	}

	const payload = JSON.stringify({ type: 'resend_greeting', guild_id: guildId });

	for (const bot of running) {
		const result = await postToBot(bot, payload);
		if (result.status === 200 && result.body?.success) {
			const actor = 'username' in locals.user ? locals.user.username : 'unknown';
			logger.log(`${actor} resent the join greeting for "${result.body.guild_name || guildId}" via ${bot.name}`);
			return json({ success: true, bot_name: bot.name, guild_name: result.body.guild_name ?? null });
		}
	}

	return json({ success: false, error: 'No bot in this server could send the greeting' }, { status: 502 });
};
