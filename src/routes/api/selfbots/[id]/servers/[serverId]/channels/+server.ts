import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsServer } from '$lib/frontend/panelServer.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const selfbotId = Number(params.id);
		const serverBotServerId = Number(params.serverId);

		const selfbot = await db.getServerBotById(selfbotId);
		if (!selfbot) return json({ error: 'Selfbot not found' }, { status: 404 });

		if (locals.user.account_source === 'accounts' && !(await accountOwnsServer(locals, selfbot.server_id))) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== selfbot.server_id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const linked = await db.getServerBotServerForSelfbot(selfbotId, serverBotServerId);
		if (!linked) return json({ error: 'Server not found' }, { status: 404 });

		const [rawChannels, categories] = await Promise.all([
			db.getServerBotChannelsForServer(serverBotServerId),
			db.getServerBotCategoriesForServer(serverBotServerId)
		]);

		const discordCatIdToId = new Map<string, number>();
		for (const cat of categories) {
			discordCatIdToId.set(cat.discord_category_id, cat.id);
		}

		const channels = rawChannels.map((ch: any) => ({
			...ch,
			category_id: ch.discord_parent_category_id ? (discordCatIdToId.get(ch.discord_parent_category_id) ?? null) : null
		}));

		return json({ channels, categories });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
