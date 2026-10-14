import type { RequestHandler } from '@sveltejs/kit';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { subscribePublicServerStatistics } from '$lib/frontend/public/statistics/index.js';
import { HTTP } from '$lib/http.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return new Response('Not found', { status: HTTP.NOT_FOUND });
	}

	const serverId = resolved.server.id;

	return eventStream((send) => subscribePublicServerStatistics(serverId, (payload) => send(payload)));
};
