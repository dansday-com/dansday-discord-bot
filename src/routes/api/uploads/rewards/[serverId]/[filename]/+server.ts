import type { RequestHandler } from '@sveltejs/kit';
import { readRewardImage, rewardImageContentType, rewardImageKey } from '$lib/backend/storage/rewards.js';

export const GET: RequestHandler = async ({ params }) => {
	let key: string;
	try {
		key = rewardImageKey(params.serverId, params.filename ?? '');
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
	}

	const data = await readRewardImage(key);
	if (!data) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });

	return new Response(data, {
		headers: {
			'Content-Type': rewardImageContentType(key),
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
