import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const panelId = await db.getServerPanelId(Number(params.id));
		if (panelId == null) return json([]);
		return json(await db.getPanelSourceServers(Number(panelId)));
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
