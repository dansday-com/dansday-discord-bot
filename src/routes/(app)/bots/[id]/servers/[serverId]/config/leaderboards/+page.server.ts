import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { computeLeaderboardSlugForServerId } from '$lib/leaderboard/index.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const parentData = await parent();
	const overview: any = (parentData as any).overview;

	const settingsRow = await db.getServerSettings(params.serverId, 'leaderboard').catch(() => null);
	const settings = (settingsRow as any)?.settings || {};
	const enabled = settings.enabled ?? true;

	const slug = enabled ? await computeLeaderboardSlugForServerId(Number(params.serverId)) : null;

	return {
		settings,
		enabled,
		serverName: overview?.name || 'server',
		previewPath: slug ? `/${encodeURIComponent(String(slug))}/leaderboard` : null
	};
};
