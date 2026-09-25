import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadAssetsShared } from '$lib/frontend/public/assets/index.js';

const VALID = new Set(['top', 'gainers', 'losers', 'search', 'mine']);

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, assetsEnabled } = await parent();

	if (!assetsEnabled) return { featureDisabled: true, server, category: 'top' };

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadAssetsShared(server, hash);
	if ('notFound' in shared) redirect(303, `${serverBasePath}/account/overview/${params.hash}`);
	if ('guest' in shared) redirect(303, serverBasePath || '/');

	const category = VALID.has(String(params.category)) ? String(params.category) : 'top';

	return { ...shared, category };
};
