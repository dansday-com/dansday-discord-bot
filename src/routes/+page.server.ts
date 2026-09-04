import type { PageServerLoad } from './$types';
import { resolveServerDirectory, EMPTY_DIRECTORY } from '$lib/frontend/public/statistics/directory.js';
import { resolveQuestDirectory, resolveRobloxDirectory, EMPTY_QUESTS, EMPTY_ROBLOX } from '$lib/frontend/public/catalog/index.js';

const PREVIEW = 5;

export const load: PageServerLoad = async () => {
	const [directory, quests, roblox] = await Promise.all([
		resolveServerDirectory().catch(() => EMPTY_DIRECTORY),
		resolveQuestDirectory().catch(() => EMPTY_QUESTS),
		resolveRobloxDirectory().catch(() => EMPTY_ROBLOX)
	]);

	return {
		topServers: directory.entries.slice(0, PREVIEW),
		serverCount: directory.entries.length,
		totals: directory.totals,
		topQuests: quests.slice(0, PREVIEW),
		questCount: quests.length,
		liveQuestCount: quests.filter((q) => q.live).length,
		topRoblox: roblox.slice(0, PREVIEW),
		robloxCount: roblox.length
	};
};
