import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { stopBotById } from '$lib/server/botProcesses.js';
import logger from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated) return json({ success: false, error: 'Authentication required' }, { status: 401 });

	const { bot_id } = await request.json();
	if (!bot_id) return json({ success: false, error: 'bot_id is required' });

	try {
		if (locals.user.account_type === 'owner') {
			const selfbot = await db.getServerBotById(Number(bot_id));
			if (!selfbot || selfbot.server_id !== locals.user.server_id) {
				return json({ success: false, error: 'Access denied' }, { status: 403 });
			}
			const result = await stopBotById(selfbot.id, selfbot);
			if (result.success) logger.log(`${locals.user.username} stopped selfbot "${selfbot.name}" (ID: ${selfbot.id})`);
			return json(result);
		}

		if (locals.user.account_type !== 'superadmin') {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		const bot = await db.getBot(bot_id);
		const result = await stopBotById(bot_id);
		if (result.success && bot) logger.log(`${locals.user.username} stopped bot "${bot.name}" (ID: ${bot_id})`);
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message });
	}
};
