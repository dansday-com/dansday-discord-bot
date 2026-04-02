import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const officialBot = await db.getBot(Number(params.id));
		if (!officialBot) {
			return json({ error: 'Bot not found' }, { status: 400 });
		}

		const selfbots = await db.getSelfbotsForOfficialBot(Number(params.id));
		return json(selfbots);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
