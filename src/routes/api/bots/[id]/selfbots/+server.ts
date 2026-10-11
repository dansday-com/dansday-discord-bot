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
	} catch (error) {
		return json({ error: (error as Error).message }, { status: 500 });
	}
};
