import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const search = url.searchParams.get('search');
		let channels = await db.getChannelsForServer(params.id);

		if (search) {
			const searchLower = search.toLowerCase();
			channels = channels.filter((ch) => ch.name?.toLowerCase().includes(searchLower) || ch.discord_channel_id?.includes(searchLower));
		}

		return json(channels);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
