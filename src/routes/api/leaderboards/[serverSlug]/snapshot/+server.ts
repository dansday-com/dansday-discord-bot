import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';
import { type LeaderboardMetric, type LeaderboardRange, resolveLeaderboardServerBySlug, resolveLeaderboardSnapshot } from '$lib/leaderboard/index.js';

function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	return 'xp';
}

function parseRange(r: string | null): LeaderboardRange {
	const v = (r || 'all').toLowerCase();
	if (v === '1d') return '1d';
	if (v === '7d') return '7d';
	if (v === '30d') return '30d';
	return 'all';
}

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolveLeaderboardServerBySlug(serverSlug);
	if (!resolved) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	const server = resolved.server;

	const settingsRow = await db.getServerSettings(server.id, serverSettingsComponent.leaderboard);
	const settings = (settingsRow as any)?.settings || {};
	const enabled = settings.enabled ?? true;
	const isPublic = settings.public ?? true;
	if (!enabled || !isPublic) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	}

	const metric = parseMetric(url.searchParams.get('metric'));
	const range = parseRange(url.searchParams.get('range'));
	const limit = Math.max(3, Math.min(100, Number(url.searchParams.get('limit') || 50)));

	const snap = await resolveLeaderboardSnapshot(server.id, metric, range, limit);

	return new Response(JSON.stringify(snap), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'private, max-age=5'
		}
	});
};
