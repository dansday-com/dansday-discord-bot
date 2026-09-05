import type { RequestHandler } from '@sveltejs/kit';
import { resolveRobloxDirectory, EMPTY_ROBLOX } from '$lib/frontend/public/catalog/index.js';
import { ROBLOX_PAGE_SIZE } from '$lib/frontend/public/catalog/paging.js';

export const GET: RequestHandler = async ({ url }) => {
	const offset = Math.max(0, Math.trunc(Number(url.searchParams.get('offset') || 0)));
	const items = await resolveRobloxDirectory(ROBLOX_PAGE_SIZE, offset).catch(() => EMPTY_ROBLOX);

	return new Response(JSON.stringify({ items, offset, limit: ROBLOX_PAGE_SIZE }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
