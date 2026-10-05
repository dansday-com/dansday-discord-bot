import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome, MAINTAINER_DISCORD_ID } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, apexHome());
	if ('guest' in shared) redirect(303, serverBasePath || '/');

	const isPlatformOwner = MAINTAINER_DISCORD_ID.length > 0 && String((shared as any).memberDiscordId || '') === MAINTAINER_DISCORD_ID;

	return { ...shared, isPlatformOwner };
};
