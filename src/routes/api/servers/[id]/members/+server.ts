import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

async function canViewMembers(locals: App.Locals, serverId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') {
		const { accountOwnsServer } = await import('$lib/serverPanelAccess.js');
		return accountOwnsServer(locals, serverId);
	}
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	if (!(await canViewMembers(locals, serverId))) {
		return json({ error: 'Access denied' }, { status: 403 });
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
