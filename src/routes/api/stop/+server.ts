import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { stopBotById } from '$lib/server/botProcesses.js';
import logger from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	const { bot_id } = await request.json();
	if (!bot_id) return json({ success: false, error: 'bot_id is required' });

	try {
		const bot = await db.getBot(bot_id);
		const result = await stopBotById(bot_id);
		if (result.success && bot) {
			logger.log(`${locals.user.username} stopped bot "${bot.name}" (ID: ${bot_id})`);
		}
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message });
	}
};
