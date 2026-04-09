import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { accountOwnsBot } from '$lib/serverPanelAccess.js';

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
	botData.uptime_ms = getBotUptimeMs(botData);
	return botData;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const botId = Number(params.id);
		if (locals.user.account_source === 'accounts' && !(await accountOwnsBot(locals, botId))) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		const botData = await getEnrichedBot(params.id);
		if (!botData) return json({ error: 'Bot not found' }, { status: 404 });
		return json(botData);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const botId = Number(params.id);
		if (!(await accountOwnsBot(locals, botId))) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}
		const bot = await db.getBot(params.id);
		if (bot) {
			logger.log(`${locals.user.username} removed bot "${bot.name}" (ID: ${bot.id})`);
		}
		await db.deleteBot(params.id);
		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
