import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const servers = await db.getServersForBot(params.id);
		return json(servers);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
