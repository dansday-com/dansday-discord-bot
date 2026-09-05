import type { PageServerLoad } from './$types';
import { resolveRobloxDirectory, resolveRobloxTrackedCount, EMPTY_ROBLOX } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	const [items, tracked] = await Promise.all([resolveRobloxDirectory().catch(() => EMPTY_ROBLOX), resolveRobloxTrackedCount().catch(() => 0)]);
	return { items, tracked: Math.max(tracked, items.length) };
};
