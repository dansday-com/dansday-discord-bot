import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsServer } from '$lib/serverPanelAccess.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { selfbotId, serverId } = params;
		const search = url.searchParams.get('search');

		const selfbot = await db.getServerBotById(Number(selfbotId));
		if (!selfbot) return json({ error: 'Selfbot not found' }, { status: 404 });

		if (locals.user.account_source === 'accounts' && !(await accountOwnsServer(locals, selfbot.server_id))) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== selfbot.server_id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		let channels = await db.getServerBotChannelsForServer(Number(serverId));

		if (search) {
			const searchLower = search.toLowerCase();
			channels = channels.filter((ch: any) => ch.name?.toLowerCase().includes(searchLower) || ch.discord_channel_id?.includes(searchLower));
		}

		const categories = await db.getServerBotCategoriesForServer(Number(serverId));

		return json({ channels, categories });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
