import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { stopBotById } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) return json({ success: false, error: 'Authentication required' }, { status: 401 });
	if (locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) return json({ success: false, error: 'Invalid id' }, { status: 400 });

	try {
		const panelBot = await db.getBot(botId);
		if (!panelBot) return json({ success: false, error: 'Bot not found' }, { status: 404 });
		if (!(await accountOwnsBot(locals, panelBot.id))) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}
		const result = await stopBotById(panelBot.id, panelBot);
		if (result.success) logger.log(`${locals.user.username} stopped bot "${panelBot.name}" (ID: ${botId})`);
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
