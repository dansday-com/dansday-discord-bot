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
		const bot = await db.getBot(bot_id);

		if (locals.user.account_type !== 'superadmin') {
			if (!bot || locals.user.account_type !== 'owner' || bot.bot_type !== 'selfbot') {
				return json({ success: false, error: 'Access denied' }, { status: 403 });
			}
			const serverBots = await db.getServerBots(locals.user.server_id);
			const owns = serverBots.some((sb: any) => sb.selfbot_id === Number(bot_id));
			if (!owns) return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		const result = await stopBotById(bot_id);
		if (result.success && bot) {
			logger.log(`${locals.user.username} stopped bot "${bot.name}" (ID: ${bot_id})`);
		}
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message });
	}
};
