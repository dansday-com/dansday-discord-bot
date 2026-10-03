import type { PageServerLoad } from './$types';
import { resolveQuestDirectory, EMPTY_QUESTS } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let quests = EMPTY_QUESTS;
	try {
		quests = await resolveQuestDirectory();
	} catch (_) {}
	return { quests };
};
