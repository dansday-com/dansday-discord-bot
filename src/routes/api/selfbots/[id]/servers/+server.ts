import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canReadSelfbotTopology } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = Number(params.id);
		const selfbot = await db.getSelfbotById(id);
		if (!selfbot) {
			return json({ error: 'Selfbot not found' }, { status: HTTP.NOT_FOUND });
		}
		if (!(await canReadSelfbotTopology(locals, id))) {
			return json({ error: 'Access denied' }, { status: HTTP.FORBIDDEN });
		}
		return json(await db.getServersForSelfbot(id));
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
