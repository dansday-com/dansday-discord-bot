import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { loadMinigamesShared, MINIGAME_CATEGORIES } from '$lib/frontend/public/minigames/index.js';
import { HTTP } from '$lib/http.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, minigamesEnabled: areMinigamesEnabled } = await parent();

	if (!areMinigamesEnabled) {
		return { featureDisabled: true, server, category: 'all' };
	}

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadMinigamesShared(server, hash);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, `${serverBasePath}/account/profile/stats/${params.hash}`);
	}
	if ('guest' in shared) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	const category = MINIGAME_CATEGORIES.includes(String(params.category)) ? String(params.category) : 'all';

	return { ...shared, category, server };
};
