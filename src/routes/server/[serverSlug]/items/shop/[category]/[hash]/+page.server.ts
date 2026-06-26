import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadItemsShared, resolveItemsCardToken, writeItemsSession } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const { server } = await parent();

	const { hash, persist } = resolveItemsCardToken(cookies, server.slug, params.hash);
	if (persist) writeItemsSession(cookies, server.slug, hash);

	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');

	const category = String(params.category || 'all');
	const visibleItems = category === 'all' ? shared.items : shared.items.filter((i: any) => i.effect_type === category);

	return { ...shared, category, visibleItems };
};
