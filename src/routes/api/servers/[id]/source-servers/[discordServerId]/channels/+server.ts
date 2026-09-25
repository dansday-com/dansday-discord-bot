import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const panelId = await db.getServerPanelId(Number(params.id));
		if (panelId == null) return json({ channels: [], categories: [] });

		const { channels: rawChannels, categories } = await db.getPanelSourceServerTopology(Number(panelId), String(params.discordServerId));

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
