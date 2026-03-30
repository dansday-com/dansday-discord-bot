import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const officialBot = await db.getBot(params.id);
		if (!officialBot || officialBot.bot_type !== 'official') {
			return json({ error: 'Bot not found or is not an official bot' }, { status: 400 });
		}

		const allBots = await db.getAllBots();
		const officialBotIdNum = Number(params.id);
		const selfbots = allBots.filter((bot: any) => {
			if (bot.bot_type !== 'selfbot') return false;
			return Number(bot.connect_to) === officialBotIdNum;
		});

		return json(selfbots);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
