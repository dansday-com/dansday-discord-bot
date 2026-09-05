import type { PageServerLoad } from './$types';
import { resolveItemDirectory, EMPTY_ITEMS } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let items = EMPTY_ITEMS;
	try {
		items = await resolveItemDirectory();
	} catch (_) {}
	return { items };
};
