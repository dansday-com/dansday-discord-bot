import type { RequestHandler } from '@sveltejs/kit';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { subscribePublicMembersList } from '$lib/frontend/public/members/index.js';
import { HTTP } from '$lib/http.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return new Response('Not found', { status: HTTP.NOT_FOUND });
	}

	const serverId = resolved.server.id;

	return eventStream((send) => subscribePublicMembersList(serverId, (payload) => send(payload)));
};
