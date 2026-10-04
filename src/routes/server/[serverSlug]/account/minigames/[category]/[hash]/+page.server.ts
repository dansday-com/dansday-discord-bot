import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadMinigamesShared, MINIGAME_CATEGORIES } from '$lib/frontend/public/minigames/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, minigamesEnabled } = await parent();

	if (!minigamesEnabled) return { featureDisabled: true, server, category: 'all' };

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadMinigamesShared(server, hash);
	if ('notFound' in shared) redirect(303, `${serverBasePath}/account/overview/${params.hash}`);
	if ('guest' in shared) redirect(303, serverBasePath || '/');

	const category = MINIGAME_CATEGORIES.includes(String(params.category)) ? String(params.category) : 'all';

	return { ...shared, category, server };
};
