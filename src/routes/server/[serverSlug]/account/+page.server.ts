import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();
	const base = `${publicServerPath(server.slug)}/account`;
	if (itemsEnabled) redirect(303, `${base}/items/all/guest`);
	if (assetsEnabled) redirect(303, `${base}/assets/top/guest`);
	if (minigamesEnabled) redirect(303, `${base}/minigames/all/guest`);
	redirect(303, `${base}/guide/guest`);
};
