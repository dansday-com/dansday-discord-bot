import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { selfbotId, serverId } = params;
		const search = url.searchParams.get('search');
		const discordServerId = url.searchParams.get('discordServerId');

		const server = await db.getServerByDiscordId(Number(selfbotId), String(discordServerId), { forSelfbot: true });
		if (!server) {
			return json({ error: 'Server not found' }, { status: 404 });
		}

		if (Number(server.id) !== Number(serverId)) {
			return json({ error: 'Server not found' }, { status: 404 });
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
