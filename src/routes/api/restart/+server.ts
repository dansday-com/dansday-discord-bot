import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { restartBotById } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { accountOwnsBot, accountOwnsServer } from '$lib/frontend/panelServer.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated) return json({ success: false, error: 'Authentication required' }, { status: 401 });

	const { bot_id } = await request.json();
	if (!bot_id) return json({ success: false, error: 'bot_id is required' });

	try {
		if (locals.user.account_source === 'server_accounts') {
			if (locals.user.account_type !== 'owner') {
				return json({ success: false, error: 'Access denied' }, { status: 403 });
			}
			const selfbot = await db.getServerBotById(Number(bot_id));
			if (!selfbot || selfbot.server_id !== locals.user.server_id) {
				return json({ success: false, error: 'Access denied' }, { status: 403 });
			}
			const result = await restartBotById(selfbot.id, selfbot);
			if (result.success) logger.log(`${locals.user.username} restarted selfbot "${selfbot.name}" (ID: ${selfbot.id})`);
			return json(result);
		}

		if (locals.user.account_source !== 'accounts') {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		const panelBot = await db.getBot(bot_id);
		if (panelBot) {
			if (!(await accountOwnsBot(locals, panelBot.id))) {
				return json({ success: false, error: 'Access denied' }, { status: 403 });
			}
			const result = await restartBotById(bot_id, panelBot);
			if (result.success) logger.log(`${locals.user.username} restarted bot "${panelBot.name}" (ID: ${bot_id})`);
			return json(result);
		}

		const selfbot = await db.getServerBotById(Number(bot_id));
		if (!selfbot) return json({ success: false, error: 'Bot not found' }, { status: 404 });

		if (!(await accountOwnsServer(locals, selfbot.server_id))) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}
		const result = await restartBotById(selfbot.id, selfbot);
		if (result.success) logger.log(`${locals.user.username} restarted selfbot "${selfbot.name}" (ID: ${selfbot.id})`);
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message });
	}
};
