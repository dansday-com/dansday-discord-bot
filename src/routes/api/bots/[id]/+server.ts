import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';
import logger from '$lib/server/logger.js';

async function getEnrichedBot(id: any) {
	const bot = await db.getBot(id);
	if (!bot) return null;

	if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
		try {
			process.kill(bot.process_id, 0);
		} catch (_) {
			await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
			Object.assign(bot, await db.getBot(id));
		}
	}

	const { token, ...botData } = bot;
	botData.is_testing = bot.is_testing || false;

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
			} catch (_) {}
		}
	}

	botData.uptime_ms = getBotUptimeMs(botData);
	return botData;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const botData = await getEnrichedBot(params.id);
		if (!botData) return json({ error: 'Bot not found' }, { status: 404 });
		return json(botData);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const bot = await db.getBot(params.id);
		if (bot) {
			logger.log(`${locals.user.username} removed bot "${bot.name}" (ID: ${bot.id}, Type: ${bot.bot_type})`);
		}
		await db.deleteBot(params.id);
		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
