import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { hasLostBotProcess } from '$lib/botControl.js';

async function getEnrichedBot(id: string) {
	const bot = await db.getBot(id);
	if (!bot) {
		return null;
	}

	if (hasLostBotProcess(bot)) {
		await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
		Object.assign(bot, await db.getBot(id));
	}

	const { token, ...botData }: typeof bot & { uptime_ms?: number } = bot;
	botData.uptime_ms = getBotUptimeMs(botData);
	return botData;
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const botData = await getEnrichedBot(params.id);
		if (!botData) {
			return json({ error: 'Bot not found' }, { status: HTTP.NOT_FOUND });
		}
		return json(botData);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	try {
		const bot = await db.getBot(params.id);
		if (bot && locals.user.authenticated) {
			logger.log(`${locals.user.username} removed bot "${bot.name}" (ID: ${bot.id})`);
		}
		await db.deleteBot(params.id);
		return json({ success: true });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
