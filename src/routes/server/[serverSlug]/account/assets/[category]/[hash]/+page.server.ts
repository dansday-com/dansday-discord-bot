import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadAssetsShared } from '$lib/frontend/public/assets/index.js';

const VALID = new Set(['top', 'gainers', 'losers', 'search', 'positions']);

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadAssetsShared(server, hash);

	const category = VALID.has(String(params.category)) ? String(params.category) : 'top';

	return { ...shared, category };
};
