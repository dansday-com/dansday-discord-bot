import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, accountEnabled, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();

	if (!accountEnabled) redirect(303, '/');

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, '/');
	if ('guest' in shared) redirect(303, publicServerPath(server.slug));

	return { ...shared, itemsEnabled, assetsEnabled, minigamesEnabled };
};
