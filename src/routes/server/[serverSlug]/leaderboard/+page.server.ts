import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { type LeaderboardMetric, type LeaderboardPeriod, resolveLeaderboardSnapshot } from '$lib/frontend/public/leaderboard/index.js';

function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	if (v === 'video') return 'video';
	if (v === 'streaming') return 'streaming';
	if (v === 'items_gamble_net') return 'items_gamble_net';
	if (v === 'items_gamble_ratio') return 'items_gamble_ratio';
	if (v === 'items_gamble_big') return 'items_gamble_big';
	return 'xp';
}

function parsePeriod(p: string | null): LeaderboardPeriod {
	const v = (p || 'all').toLowerCase();
	if (v === 'month') return 'month';
	if (v === 'week') return 'week';
	return 'all';
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const metric = parseMetric(url.searchParams.get('metric'));
	const period = parsePeriod(url.searchParams.get('period'));
	const limit = 100;

	const snap = await resolveLeaderboardSnapshot(server.id, metric, period, limit);

	return {
		metric,
		period,
		limit,
		rows: snap.rows
	};
};
