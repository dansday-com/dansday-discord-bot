import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	if (!itemsEnabled && !assetsEnabled && !minigamesEnabled) error(404, 'Account not available');
	const gate = itemsEnabled ? SERVER_SETTINGS.component.items : assetsEnabled ? SERVER_SETTINGS.component.assets : SERVER_SETTINGS.component.minigames;

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, gate);
	if ('notFound' in shared) error(404, 'Account not available');
	if ('guest' in shared) redirect(303, publicServerPath(server.slug));

	return { ...shared, itemsEnabled, assetsEnabled, minigamesEnabled };
};
