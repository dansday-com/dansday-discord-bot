import type { PageServerLoad } from './$types';
import {
	listEnabledLeaderboardServers,
	getGlobalStats,
	getTopGlobalMembers,
	getActivityTrackingStats,
	getActiveDiscordQuests,
	getLatestRobloxCatalogItems
} from '$lib/database.js';
import { slugifyDisplayName, formatIndexedSlug } from '$lib/utils/slug.js';

export const load: PageServerLoad = async () => {
	let featuredServers: { name: string; slug: string; server_icon: string | null }[] = [];
	let globalStats = { total_members: 0, total_servers: 0 };
	let activeQuests: any[] = [];
	let catalogItems: any[] = [];
	let topMembers: any[] = [];
	let activityStats = { voice_mins: 0, video_mins: 0, stream_mins: 0, total_tracked: 0 };

	try {
		const servers = await listEnabledLeaderboardServers();
		if (Array.isArray(servers) && servers.length > 0) {
			const groups = new Map<string, typeof servers>();
			for (const s of servers) {
				const base = slugifyDisplayName(s.name || 'server', 'server');
				if (!groups.has(base)) groups.set(base, []);
				groups.get(base)!.push(s);
			}
			const all: { server: (typeof servers)[number]; slug: string }[] = [];
			for (const [base, list] of groups) {
				list.sort((a, b) => a.id - b.id);
				for (let i = 0; i < list.length; i++) {
					all.push({ server: list[i], slug: formatIndexedSlug(base, i + 1) });
				}
			}
			featuredServers = all.slice(0, 5).map((e) => ({
				name: e.server.name || e.slug,
				slug: e.slug,
				server_icon: e.server.server_icon ?? null
			}));
		}
	} catch (_) {}

	globalStats = await getGlobalStats();
	activeQuests = (await getActiveDiscordQuests()) as any[];
	catalogItems = (await getLatestRobloxCatalogItems()) as any[];

	return { featuredServers, globalStats, activeQuests, catalogItems, topMembers, activityStats };
};
