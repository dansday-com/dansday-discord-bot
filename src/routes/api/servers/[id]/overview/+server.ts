import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	try {
		const overview = await db.getServerOverview(serverId);
		return json(overview);
	} catch (error: any) {
		if (error.message?.toLowerCase().includes('not found')) {
			return json({ error: 'Server not found' }, { status: 404 });
		}
		logger.log(`❌ Error fetching server overview: ${error.message}`);
		return json({ error: error.message }, { status: 500 });
	}
};
