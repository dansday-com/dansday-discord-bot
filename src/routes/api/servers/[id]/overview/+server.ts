import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	try {
		const overview = await db.getServerOverview(serverId);
		if (!overview) return json({ error: 'Not found' }, { status: 404 });
		return json(overview);
	} catch (err: any) {
		logger.log(`❌ Error fetching server overview: ${err.message}`);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
