import type { PageServerLoad } from './$types';
import db, { presenceFromDbRow } from '$lib/database.js';

export const load: PageServerLoad = async ({ params }) => {
	const statusRow = await db.getBotStatusByBotId(Number(params.id));
	return { botPresence: presenceFromDbRow(statusRow) };
};
