import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const roles = await db.getRoles(params.id);
		return json(roles);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
