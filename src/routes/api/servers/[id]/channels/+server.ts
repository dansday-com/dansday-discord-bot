import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const search = url.searchParams.get('search');
		let channels = await db.getChannelsForServer(params.id);

		if (search) {
			const searchLower = search.toLowerCase();
			channels = channels.filter((ch: any) =>
				ch.name?.toLowerCase().includes(searchLower) ||
				ch.discord_channel_id?.includes(searchLower)
			);
		}

		return json(channels);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
