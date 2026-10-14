import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST });
	}

	try {
		const overview = await db.getServerOverview(serverId);
		if (!overview) {
			return json({ error: 'Not found' }, { status: HTTP.NOT_FOUND });
		}
		return json(overview);
	} catch (err) {
		logger.log(`❌ Error fetching server overview: ${(err as Error).message}`);
		return json({ error: 'Internal error' }, { status: HTTP.INTERNAL_ERROR });
	}
};
