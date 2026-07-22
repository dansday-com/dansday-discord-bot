import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { loadMarketsBoard } from '$lib/frontend/public/assets/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_BOARD = 60;

export const GET: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'asset_board', MAX_BOARD, RATE_WINDOW_MS);
	if (!rate.allowed) return json({ success: false, error: 'Too many requests. Please slow down.' }, { status: 429 });

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });

	const board = await loadMarketsBoard();
	return json({ success: true, board });
};
