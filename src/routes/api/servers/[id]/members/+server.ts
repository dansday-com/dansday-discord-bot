import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	try {
		const q = url.searchParams.get('q');
		const limit = Number(url.searchParams.get('limit') || 15);
		const members = await db.searchServerMembers(serverId, q, limit);
		return json({ success: true, members });
	} catch (error: any) {
		logger.log(`❌ Error fetching server members: ${error.message}`);
		return json({ error: error.message }, { status: 500 });
	}
};
