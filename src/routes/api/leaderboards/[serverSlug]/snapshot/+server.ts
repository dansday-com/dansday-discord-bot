import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { type LeaderboardMetric, resolveLeaderboardSnapshot } from '$lib/frontend/public/leaderboard/index.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	if (v === 'video') return 'video';
	if (v === 'streaming') return 'streaming';
	return 'xp';
}

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	const server = resolved.server;

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	}

	const metric = parseMetric(url.searchParams.get('metric'));
	const limit = Math.max(3, Math.min(100, Number(url.searchParams.get('limit') || 50)));

	const snap = await resolveLeaderboardSnapshot(server.id, metric, limit);

	return new Response(JSON.stringify(snap), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
