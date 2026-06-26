import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');

	const category = String(params.category || 'all');
	const visibleItems = category === 'all' ? shared.items : shared.items.filter((i: any) => i.effect_type === category);

	return { ...shared, category, visibleItems };
};
