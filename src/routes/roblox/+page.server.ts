import type { PageServerLoad } from './$types';
import { resolveRobloxDirectory, EMPTY_ROBLOX } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let items = EMPTY_ROBLOX;
	try {
		items = await resolveRobloxDirectory();
	} catch (_) {}
	return { items };
};
