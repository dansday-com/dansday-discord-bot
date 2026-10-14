import type { RequestHandler } from '@sveltejs/kit';
import { parseLeaderboardLimit, parseLeaderboardMetric, parseLeaderboardPeriod, resolveLeaderboardSnapshot } from '$lib/frontend/public/leaderboard/index.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: HTTP.NOT_FOUND, headers: { 'Content-Type': 'application/json' } });
	}
	const { server } = resolved;

	const metric = parseLeaderboardMetric(url.searchParams.get('metric'));
	const period = parseLeaderboardPeriod(url.searchParams.get('period'));
	const limit = parseLeaderboardLimit(url.searchParams.get('limit'));

	const snap = await resolveLeaderboardSnapshot(server.id, { metric, period, limit });

	return new Response(JSON.stringify(snap), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
