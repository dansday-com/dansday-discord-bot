import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const botId = Number(params.id);
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
