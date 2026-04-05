import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { type LeaderboardMetric, getCachedLeaderboard, setCachedLeaderboard } from '$lib/leaderboard/index.js';

function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	return 'xp';
}

export const load: PageServerLoad = async ({ parent, url, setHeaders }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const metric = parseMetric(url.searchParams.get('metric'));
	const range = 'all' as const;
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
		metric,
		limit,
		rows
	};
};
