import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadMarketShared } from '$lib/frontend/public/market/index.js';

const VALID = new Set(['top', 'gainers', 'losers', 'search', 'mine']);

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, marketEnabled } = await parent();

	if (!marketEnabled) return { featureDisabled: true, server, category: 'top' };

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadMarketShared(server, hash);
	if ('notFound' in shared) redirect(303, `${serverBasePath}/account/profile/stats/${params.hash}`);
	if ('guest' in shared) redirect(303, serverBasePath || '/');

	const category = VALID.has(String(params.category)) ? String(params.category) : 'top';

	return { ...shared, category };
};
