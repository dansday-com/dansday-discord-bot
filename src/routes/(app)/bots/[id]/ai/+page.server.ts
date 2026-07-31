import type { PageServerLoad } from './$types';
import db, { botAiFromDbRow } from '$lib/database.js';

export const load: PageServerLoad = async ({ params }) => {
	const { api_key, ...botAiRest } = botAiFromDbRow(await db.getBotAiByBotId(Number(params.id)));
	return { botAi: { ...botAiRest, has_api_key: Boolean(api_key) } };
};
