import type { PageServerLoad } from './$types';
import { resolveServerDirectory, EMPTY_DIRECTORY } from '$lib/frontend/public/statistics/directory.js';
import {
	resolveQuestDirectory,
	resolveRobloxDirectory,
	resolveTaskDirectory,
	resolveItemDirectory,
	resolveWikiDirectory,
	EMPTY_QUESTS,
	EMPTY_ROBLOX,
	EMPTY_TASKS,
	EMPTY_ITEMS,
	EMPTY_WIKIS
} from '$lib/frontend/public/catalog/index.js';

const ROW_PREVIEW = 5;
const GRID_PREVIEW = 6;
const TASK_PREVIEW = 24;

export const load: PageServerLoad = async () => {
	const [directory, quests, roblox, items, wikis] = await Promise.all([
		resolveServerDirectory().catch(() => EMPTY_DIRECTORY),
		resolveQuestDirectory().catch(() => EMPTY_QUESTS),
		resolveRobloxDirectory().catch(() => EMPTY_ROBLOX),
		resolveItemDirectory().catch(() => EMPTY_ITEMS),
		resolveWikiDirectory().catch(() => EMPTY_WIKIS)
	]);

	let tasks = EMPTY_TASKS;
	try {
		tasks = resolveTaskDirectory();
	} catch (_) {}

	return {
		topServers: directory.entries.slice(0, ROW_PREVIEW),
		serverCount: directory.entries.length,
		totals: directory.totals,
		topTasks: tasks.slice(0, TASK_PREVIEW),
		taskCount: tasks.length,
		topItems: items.slice(0, GRID_PREVIEW),
		itemCount: items.length,
		buyableItemCount: items.filter((i) => i.buyable).length,
		topQuests: quests.slice(0, ROW_PREVIEW),
		questCount: quests.length,
		liveQuestCount: quests.filter((q) => q.live).length,
		topRoblox: roblox.slice(0, GRID_PREVIEW),
		robloxCount: roblox.length,
		topWikis: wikis.slice(0, ROW_PREVIEW),
		wikiCount: wikis.length,
		activeWikiCount: wikis.filter((w) => w.active).length
	};
};
