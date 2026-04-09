import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const categories = await db.getCategoriesForServer(params.id);
		return json(categories);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
