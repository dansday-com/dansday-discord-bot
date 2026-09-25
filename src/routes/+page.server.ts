import type { PageServerLoad } from './$types';
import { resolveServerDirectory, EMPTY_DIRECTORY } from '$lib/frontend/public/statistics/directory.js';
import {
	resolveQuestDirectory,
	resolveRobloxDirectory,
	resolveTaskDirectory,
	resolveItemDirectory,
	resolveWikiDirectory,
	resolveRobloxTrackedCount,
	resolveRobloxMostNotified,
	resolveForwarderSourceDirectory,
	EMPTY_QUESTS,
	EMPTY_ROBLOX,
	EMPTY_TASKS,
	EMPTY_ITEMS,
	EMPTY_WIKIS,
	EMPTY_FORWARDER_SOURCES
} from '$lib/frontend/public/catalog/index.js';

const ROW_PREVIEW = 5;
const GRID_PREVIEW = 6;
const TASK_PREVIEW = 24;
const ROBLOX_POOL = GRID_PREVIEW * 8;

export const load: PageServerLoad = async () => {
	const [directory, quests, roblox, robloxTracked, robloxNotified, items, wikis, forwarderSources] = await Promise.all([
		resolveServerDirectory().catch(() => EMPTY_DIRECTORY),
		resolveQuestDirectory().catch(() => EMPTY_QUESTS),
		resolveRobloxDirectory(ROBLOX_POOL).catch(() => EMPTY_ROBLOX),
		resolveRobloxTrackedCount().catch(() => 0),
		resolveRobloxMostNotified(GRID_PREVIEW).catch(() => EMPTY_ROBLOX),
		resolveItemDirectory().catch(() => EMPTY_ITEMS),
		resolveWikiDirectory().catch(() => EMPTY_WIKIS),
		resolveForwarderSourceDirectory().catch(() => EMPTY_FORWARDER_SOURCES)
	]);

	const notifiedAssetIds = new Set(robloxNotified.map((item) => item.asset_id));
	const hasThumbnail = (item: { thumbnail_url: string | null }) => typeof item.thumbnail_url === 'string' && item.thumbnail_url.trim() !== '';
	const fillers = roblox.filter((item) => !notifiedAssetIds.has(item.asset_id));
	const topRoblox = [...robloxNotified, ...fillers.filter(hasThumbnail), ...fillers.filter((item) => !hasThumbnail(item))].slice(0, GRID_PREVIEW);

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
		topRoblox,
		robloxCount: Math.max(robloxTracked, roblox.length),
		topWikis: wikis.slice(0, ROW_PREVIEW),
		wikiCount: wikis.length,
		activeWikiCount: wikis.filter((w) => w.active).length,
		topForwarderSources: forwarderSources.slice(0, ROW_PREVIEW),
		forwarderSourceCount: forwarderSources.length,
		forwarderSourceMembers: forwarderSources.reduce((sum, s) => sum + s.members, 0)
	};
};
