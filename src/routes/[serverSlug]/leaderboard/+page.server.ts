import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import type { LeaderboardMetric, LeaderboardRange } from '$lib/server/leaderboardCache.js';
import { getCachedLeaderboard, setCachedLeaderboard } from '$lib/server/leaderboardCache.js';

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

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	const slug = String(params.serverSlug || '').trim();
	const server = await db.getServerByLeaderboardSlug(slug);
	if (!server) throw error(404, 'Not found');

	// Visibility is controlled via server_settings (component: leaderboard), defaults to public+enabled
	const settingsRow = await db.getServerSettings(server.id, 'leaderboard');
	const settings = (settingsRow as any)?.settings || {};
	const enabled = settings.enabled ?? true;
	const isPublic = settings.public ?? true;
	if (!enabled || !isPublic) throw error(404, 'Not found');

	const serverSlug = String(settings.slug || slug);

	const metric = parseMetric(url.searchParams.get('metric'));
	const range = parseRange(url.searchParams.get('range'));
	const limit = 50;

	const cached = await getCachedLeaderboard(server.id, metric, range, limit);
	const snapshot = cached && Date.now() - cached.updated_at < 20_000 ? cached : (() => null)();

	const rows = snapshot ? snapshot.rows : await db.getServerLeaderboard(server.id, limit, metric, range);
	const snap = snapshot || { metric, range, limit, updated_at: Date.now(), rows };
	if (!snapshot) setCachedLeaderboard(server.id, metric, range, limit, snap).catch(() => {});

	setHeaders({
		'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		server: {
			id: server.id,
			name: server.name,
			slug: serverSlug,
			server_icon: server.server_icon
		},
		metric,
		range,
		limit,
		rows
	};
};
