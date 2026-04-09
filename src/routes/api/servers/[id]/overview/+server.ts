import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { accountOwnsServer } from '$lib/serverPanelAccess.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	if (locals.user.account_source === 'accounts' && !(await accountOwnsServer(locals, serverId))) {
		return json({ error: 'Access denied' }, { status: 403 });
	}
	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		return json({ error: 'Access denied' }, { status: 403 });
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
