import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';
import { computeLeaderboardSlugForServerConfig } from '$lib/leaderboard/index.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const parentData = await parent();
	const overview: any = (parentData as any).overview;

	const settingsRow = await db.getServerSettings(params.serverId, serverSettingsComponent.leaderboard).catch(() => null);
	const settings = (settingsRow as any)?.settings || {};
	const enabled = settings.enabled ?? true;

	const slug = await computeLeaderboardSlugForServerConfig(Number(params.serverId), overview?.name ?? null);

	return {
		settings,
		enabled,
		serverName: overview?.name || 'server',
		leaderboardPath: slug ? `/${encodeURIComponent(String(slug))}/leaderboard` : null
	};
};
