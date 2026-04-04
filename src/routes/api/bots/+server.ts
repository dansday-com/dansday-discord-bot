import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const bots = await db.getAllBots();

		const botsWithDetails = await Promise.all(
			bots.map(async (bot: any) => {
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

				const botData: any = {
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
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { name, token, application_id, bot_icon, port, secret_key } = await request.json();

		const account = await db.getAccountById(locals.user.account_id);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 401 });
		}

		if (!token) {
			return json({ success: false, error: 'Token is required' }, { status: 400 });
		}

		if (!application_id) {
			return json({ success: false, error: 'Application ID is required' }, { status: 400 });
		}

		if (!port) {
			return json({ success: false, error: 'Port is required' }, { status: 400 });
		}

		if (!secret_key) {
			return json({ success: false, error: 'Secret Key is required' }, { status: 400 });
		}

		const existingBots = await db.getAllBots();
		const portInUse = existingBots.some((b: any) => b.port === port);
		if (portInUse) {
			return json({ success: false, error: `Port ${port} is already in use by another official bot` }, { status: 400 });
		}

		const bot = await db.createBot({
			name: name || 'Bot',
			token,
			application_id,
			bot_icon: bot_icon || null,
			port: port || 7777,
			secret_key: secret_key || null,
			account_id: account.id
		});

		logger.log(`${locals.user.username} added official bot: "${name || 'Bot'}" (ID: ${bot.id})`);

		return json({ success: true, bot });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
