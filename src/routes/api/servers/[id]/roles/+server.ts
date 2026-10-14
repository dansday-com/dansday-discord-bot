import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const roles = await db.getRoles(params.id);
		return json(roles);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
