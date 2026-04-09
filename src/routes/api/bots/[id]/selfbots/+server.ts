import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsBot } from '$lib/serverPanelAccess.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const botId = Number(params.id);
		if (locals.user.account_source === 'accounts' && !(await accountOwnsBot(locals, botId))) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		const officialBot = await db.getBot(botId);
		if (!officialBot) {
			return json({ error: 'Bot not found' }, { status: 400 });
		}

		const selfbots = await db.getSelfbotsForOfficialBot(botId);
		return json(selfbots);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
