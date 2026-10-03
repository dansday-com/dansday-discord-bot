import type { PageServerLoad } from './$types';
import { resolveWikiDirectory, EMPTY_WIKIS } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let wikis = EMPTY_WIKIS;
	try {
		wikis = await resolveWikiDirectory();
	} catch (_) {}
	return { wikis };
};
