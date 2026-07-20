import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { loadMarketsBoard, markAssetViewer } from '$lib/frontend/public/assets/index.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });

	await markAssetViewer();
	const board = await loadMarketsBoard();
	return json({ success: true, board });
};
