import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ params }) => {
	return { wikis: await db.getBotWikis(Number(params.id)) };
};
