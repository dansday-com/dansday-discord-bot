import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, apexHome());
	if ('guest' in shared) redirect(303, serverBasePath || '/');

	return { ...shared, itemsEnabled, assetsEnabled, minigamesEnabled };
};
