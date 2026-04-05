import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { type LeaderboardMetric, buildLeaderboardRowsFromMembersList, getCachedLeaderboard, setCachedLeaderboard } from '$lib/leaderboard/index.js';

function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	return 'xp';
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const metric = parseMetric(url.searchParams.get('metric'));
	const limit = 100;

	const cached = await getCachedLeaderboard(server.id, metric, limit);
	const snapshot = cached && Date.now() - cached.updated_at < 20_000 ? cached : (() => null)();

	const rows = snapshot ? snapshot.rows : buildLeaderboardRowsFromMembersList(await db.getServerMembersList(server.id), metric, limit);
	const snap = snapshot || { metric, limit, updated_at: Date.now(), rows };
	if (!snapshot) setCachedLeaderboard(server.id, metric, limit, snap).catch(() => {});

	return {
		metric,
		limit,
		rows
	};
};
