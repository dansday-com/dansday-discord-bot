import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';
import logger from '$lib/server/logger.js';

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
					} catch {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
						bot.status = 'stopped';
						bot.process_id = null;
						bot.uptime_started_at = null;
					}
				}

				const botData: any = {
					id: bot.id,
					name: bot.name,
					bot_type: bot.bot_type,
					bot_icon: bot.bot_icon,
					port: bot.port,
					application_id: bot.application_id,
					connect_to: bot.connect_to,
					status: bot.status || 'stopped',
					process_id: bot.process_id || null,
					uptime_started_at: bot.uptime_started_at || null,
					created_at: bot.created_at,
					updated_at: bot.updated_at,
					is_testing: bot.is_testing || false
				};

				if (bot.connect_to) {
					const connectToId = Number(bot.connect_to);
					if (connectToId && !Number.isNaN(connectToId)) {
						try {
							const connectedBot = await db.getBot(connectToId);
							if (connectedBot) {
								botData.connected_bot_name = connectedBot.name?.trim() || null;
								if (bot.bot_type === 'selfbot') {
									botData.is_testing = connectedBot.is_testing || false;
									if (bot.is_testing !== connectedBot.is_testing) {
										await db.updateBot(bot.id, { is_testing: connectedBot.is_testing || false });
									}
								}
							}
						} catch {}
					}
				}

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
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { name, token, application_id, bot_type, bot_icon, port, secret_key, connect_to } = await request.json();

		const account = await db.getPanelAccountById(locals.user.account_id);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 401 });
		}

		if (!token || !bot_type) {
			return json({ success: false, error: 'Token and Bot Type are required' }, { status: 400 });
		}

		if (!['official', 'selfbot'].includes(bot_type)) {
			return json({ success: false, error: 'Bot type must be "official" or "selfbot"' }, { status: 400 });
		}

		if (bot_type === 'official' && !application_id) {
			return json({ success: false, error: 'Application ID is required for official bots' }, { status: 400 });
		}

		if (bot_type === 'official' && !port) {
			return json({ success: false, error: 'Port is required for official bots' }, { status: 400 });
		}

		if (bot_type === 'official' && !secret_key) {
			return json({ success: false, error: 'Secret Key is required for official bots' }, { status: 400 });
		}

		if (bot_type === 'selfbot' && !connect_to) {
			return json({ success: false, error: 'Selfbot must connect to an official bot' }, { status: 400 });
		}

		if (bot_type === 'official') {
			const existingBots = await db.getAllBots();
			const portInUse = existingBots.some((b: any) => b.port === port && b.bot_type === 'official');
			if (portInUse) {
				return json({ success: false, error: `Port ${port} is already in use by another official bot` }, { status: 400 });
			}
		}

		let is_testing = false;
		if (bot_type === 'selfbot' && connect_to) {
			try {
				const connectedBot = await db.getBot(connect_to);
				if (connectedBot) is_testing = connectedBot.is_testing || false;
			} catch {}
		}

		const bot = await db.createBot({
			name: name || 'Bot',
			token,
			application_id,
			bot_type,
			bot_icon: bot_icon || null,
			port: bot_type === 'official' ? (port || 7777) : null,
			is_testing,
			secret_key: secret_key || null,
			connect_to: connect_to || null,
			panel_id: account.panel_id || null
		});

		logger.log(`${locals.user.username} added ${bot_type} bot: "${name || 'Bot'}" (ID: ${bot.id})`);

		return json({ success: true, bot });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
