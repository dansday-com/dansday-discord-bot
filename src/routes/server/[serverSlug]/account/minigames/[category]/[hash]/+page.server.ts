import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadMinigamesShared, MINIGAME_CATEGORIES } from '$lib/frontend/public/minigames/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadMinigamesShared(server, hash);
	if ('notFound' in shared) error(404, 'Minigames not available');

	const category = MINIGAME_CATEGORIES.includes(String(params.category)) ? String(params.category) : 'all';

	return { ...shared, category, server };
};
