import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ params }) => {
	const servers = await db.getServersForBot(Number(params.id));
	return { servers };
};
