import type { PageServerLoad } from './$types';
import db, { botAiFromDbRow } from '$lib/database.js';

export const load: PageServerLoad = async ({ params }) => {
	const { api_key, voice_api_key, search_api_key, fetch_api_key, image_api_key, ...botAiRest } = botAiFromDbRow(await db.getBotAiByBotId(Number(params.id)));
	return {
		botAi: {
			...botAiRest,
			has_api_key: Boolean(api_key),
			has_voice_api_key: Boolean(voice_api_key),
			has_search_api_key: Boolean(search_api_key),
			has_fetch_api_key: Boolean(fetch_api_key),
			has_image_api_key: Boolean(image_api_key)
		}
	};
};
