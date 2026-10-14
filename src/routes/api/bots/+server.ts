import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { DEFAULT_BOT_PORT } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ error: 'Admin access required' }, { status: HTTP.FORBIDDEN });
	}

	try {
		const bots = await db.getAllBots(locals.user.panel_id);

		const botsWithDetails = await Promise.all(
			bots.map(async (bot) => {
				if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
					try {
						process.kill(bot.process_id, 0);
					} catch (_) {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
						bot.status = 'stopped';
						bot.process_id = null;
						bot.uptime_started_at = null;
					}
				}

				const botData: Record<string, unknown> = {
					id: bot.id,
					name: bot.name,
					bot_icon: bot.bot_icon,
					port: bot.port,
					application_id: bot.application_id,
					status: bot.status || 'stopped',
					process_id: bot.process_id || null,
					uptime_started_at: bot.uptime_started_at || null,
					created_at: bot.created_at,
					updated_at: bot.updated_at
				};

				botData.uptime_ms = getBotUptimeMs(botData);
				return botData;
			})
		);

		return json(botsWithDetails);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Admin access required' }, { status: HTTP.FORBIDDEN });
	}

	try {
		const { name, token, application_id, bot_icon, port, secret_key } = await request.json();

		const account = await db.getAccountById(locals.user.account_id);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: HTTP.UNAUTHORIZED });
		}

		if (!token) {
			return json({ success: false, error: 'Token is required' }, { status: HTTP.BAD_REQUEST });
		}

		if (!application_id) {
			return json({ success: false, error: 'Application ID is required' }, { status: HTTP.BAD_REQUEST });
		}

		if (!port) {
			return json({ success: false, error: 'Port is required' }, { status: HTTP.BAD_REQUEST });
		}

		if (!secret_key) {
			return json({ success: false, error: 'Secret Key is required' }, { status: HTTP.BAD_REQUEST });
		}

		const existingBots = await db.getAllBots();
		const isPortInUse = existingBots.some((b) => b.port === port);
		if (isPortInUse) {
			return json({ success: false, error: `Port ${port} is already in use by another official bot` }, { status: HTTP.BAD_REQUEST });
		}

		const panel = await db.getPanel(account.id);
		if (!panel) {
			return json({ success: false, error: 'Panel not found for this account' }, { status: HTTP.INTERNAL_ERROR });
		}

		const bot = await db.createBot({
			name: name || 'Bot',
			token,
			application_id,
			bot_icon: bot_icon || null,
			port: port || DEFAULT_BOT_PORT,
			secret_key: secret_key || null,
			panel_id: panel.id
		});

		logger.log(`${locals.user.username} added official bot: "${name || 'Bot'}" (ID: ${bot.id})`);

		return json({ success: true, bot });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
