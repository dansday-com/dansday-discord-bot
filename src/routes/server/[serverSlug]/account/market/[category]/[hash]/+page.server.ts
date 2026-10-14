import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { loadMarketShared } from '$lib/backend/public/market/index.js';
import { HTTP } from '$lib/http.js';

const VALID = new Set(['top', 'gainers', 'losers', 'search', 'mine']);

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, marketEnabled: isMarketEnabled } = await parent();

	if (!isMarketEnabled) {
		return { featureDisabled: true, category: 'top' };
	}

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadMarketShared(server, hash);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, `${serverBasePath}/account/profile/stats/${params.hash}`);
	}
	if ('guest' in shared) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	const category = VALID.has(String(params.category)) ? String(params.category) : 'top';

	return { ...shared, category };
};
