import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const panelId = await db.getServerPanelId(Number(params.id));
		if (panelId == null) {
			return json([]);
		}
		return json(await db.getPanelSourceServers(Number(panelId)));
	} catch (error) {
		return json({ error: (error as Error).message }, { status: 500 });
	}
};
