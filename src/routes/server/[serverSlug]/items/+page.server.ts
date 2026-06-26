import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { readItemsSession } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { server } = await parent();
	const base = publicServerPath(server.slug);
	const session = readItemsSession(cookies, server.slug);
	// Logged-in members resume with their card token; everyone else browses read-only.
	redirect(303, `${base}/items/shop/all/${session || 'guest'}`);
};
