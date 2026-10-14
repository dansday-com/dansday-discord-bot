import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { restartBotById } from '$lib/botControl.js';
import { logger } from '$lib/utils/index.js';
import { accountOwnsBot } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}
	if (locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) {
		return json({ success: false, error: 'Invalid id' }, { status: HTTP.BAD_REQUEST });
	}

	try {
		const panelBot = await db.getBot(botId);
		if (!panelBot) {
			return json({ success: false, error: 'Bot not found' }, { status: HTTP.NOT_FOUND });
		}
		if (!(await accountOwnsBot(locals, panelBot.id))) {
			return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
		}
		const result = await restartBotById(panelBot.id, panelBot);
		if (result.success) {
			logger.log(`${locals.user.username} restarted bot "${panelBot.name}" (ID: ${botId})`);
		}
		return json(result);
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
