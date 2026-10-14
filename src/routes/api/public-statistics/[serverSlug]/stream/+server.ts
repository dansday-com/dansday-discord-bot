import type { RequestHandler } from '@sveltejs/kit';
import { parseLeaderboardLimit, parseLeaderboardMetric, parseLeaderboardPeriod, subscribeLeaderboard } from '$lib/frontend/public/leaderboard/index.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { HTTP } from '$lib/http.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return new Response('Not found', { status: HTTP.NOT_FOUND });
	}
	const { server } = resolved;

	const metric = parseLeaderboardMetric(url.searchParams.get('metric'));
	const period = parseLeaderboardPeriod(url.searchParams.get('period'));
	const limit = parseLeaderboardLimit(url.searchParams.get('limit'));

	return eventStream((send) => subscribeLeaderboard(server.id, { metric, period, limit }, (snap) => send(snap)));
};
