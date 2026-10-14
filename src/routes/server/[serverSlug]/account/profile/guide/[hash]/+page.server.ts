import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, itemsEnabled: areItemsEnabled, marketEnabled: isMarketEnabled, minigamesEnabled: areMinigamesEnabled } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, apexHome());
	}
	if ('guest' in shared) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	return { ...shared, itemsEnabled: areItemsEnabled, marketEnabled: isMarketEnabled, minigamesEnabled: areMinigamesEnabled };
};
