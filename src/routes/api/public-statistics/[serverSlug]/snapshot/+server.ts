import type { RequestHandler } from '@sveltejs/kit';
import { type LeaderboardMetric, type LeaderboardPeriod, resolveLeaderboardSnapshot } from '$lib/frontend/public/leaderboard/index.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	if (v === 'video') return 'video';
	if (v === 'streaming') return 'streaming';
	if (v === 'minigames_gamble_net') return 'minigames_gamble_net';
	if (v === 'minigames_gamble_ratio') return 'minigames_gamble_ratio';
	if (v === 'minigames_gamble_big') return 'minigames_gamble_big';
	if (v === 'items_bounty_total') return 'items_bounty_total';
	if (v === 'items_bounty_claimer') return 'items_bounty_claimer';
	if (v === 'items_bounty_give') return 'items_bounty_give';
	if (v === 'items_steal_total') return 'items_steal_total';
	if (v === 'items_steal_rate') return 'items_steal_rate';
	if (v === 'items_steal_big') return 'items_steal_big';
	if (v === 'items_bomb_total') return 'items_bomb_total';
	if (v === 'items_bomb_rate') return 'items_bomb_rate';
	if (v === 'items_bomb_big') return 'items_bomb_big';
	if (v === 'items_gift_give') return 'items_gift_give';
	if (v === 'items_gift_receive') return 'items_gift_receive';
	return 'xp';
}

function parsePeriod(p: string | null): LeaderboardPeriod {
	const v = (p || 'all').toLowerCase();
	if (v === 'month') return 'month';
	if (v === 'week') return 'week';
	return 'all';
}

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	const server = resolved.server;

	const metric = parseMetric(url.searchParams.get('metric'));
	const period = parsePeriod(url.searchParams.get('period'));
	const limit = Math.max(3, Math.min(100, Number(url.searchParams.get('limit') || 50)));

	const snap = await resolveLeaderboardSnapshot(server.id, metric, period, limit);

	return new Response(JSON.stringify(snap), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
