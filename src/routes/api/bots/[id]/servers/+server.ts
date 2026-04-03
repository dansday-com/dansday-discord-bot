import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const id = Number(params.id);
		const official = await db.getBot(id);
		if (official) {
			return json(await db.getServersForBot(id));
		}
		const selfbot = await db.getServerBotById(id);
		if (selfbot) {
			return json(await db.getServersForSelfbot(id));
		}
		return json({ error: 'Bot not found' }, { status: 404 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
