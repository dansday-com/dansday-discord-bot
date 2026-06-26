import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, publicStatsEnabled } = await parent();
	const hash = String(params.hash || '').trim();

	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');
	if ('invalid' in shared) redirect(303, publicStatsEnabled ? publicServerPath(server.slug) : '/');

	return { ...shared };
};
