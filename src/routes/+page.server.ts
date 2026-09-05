import type { PageServerLoad } from './$types';
import { resolveServerDirectory, EMPTY_DIRECTORY } from '$lib/frontend/public/statistics/directory.js';
import {
	resolveQuestDirectory,
	resolveRobloxDirectory,
	resolveTaskDirectory,
	resolveItemDirectory,
	EMPTY_QUESTS,
	EMPTY_ROBLOX,
	EMPTY_TASKS,
	EMPTY_ITEMS
} from '$lib/frontend/public/catalog/index.js';

const PREVIEW = 5;

export const load: PageServerLoad = async () => {
	const [directory, quests, roblox, items] = await Promise.all([
		resolveServerDirectory().catch(() => EMPTY_DIRECTORY),
		resolveQuestDirectory().catch(() => EMPTY_QUESTS),
		resolveRobloxDirectory().catch(() => EMPTY_ROBLOX),
		resolveItemDirectory().catch(() => EMPTY_ITEMS)
	]);

	let tasks = EMPTY_TASKS;
	try {
		tasks = resolveTaskDirectory();
	} catch (_) {}

	return {
		topServers: directory.entries.slice(0, PREVIEW),
		serverCount: directory.entries.length,
		totals: directory.totals,
		topTasks: tasks.slice(0, PREVIEW),
		taskCount: tasks.length,
		topItems: items.slice(0, PREVIEW),
		itemCount: items.length,
		buyableItemCount: items.filter((i) => i.buyable).length,
		topQuests: quests.slice(0, PREVIEW),
		questCount: quests.length,
		liveQuestCount: quests.filter((q) => q.live).length,
		topRoblox: roblox.slice(0, PREVIEW),
		robloxCount: roblox.length
	};
};
