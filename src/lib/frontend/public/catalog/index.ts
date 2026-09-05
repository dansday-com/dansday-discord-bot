import db from '../../../database.js';
import { getRedisClient } from '../../../redis.js';
import { TASK_DEFINITIONS, type TaskRequirement } from '../../../tasks.js';

const TTL_SECONDS = 300;
const MAX_ROWS = 300;

export type QuestEntry = {
	quest_id: string;
	quest_name: string;
	game_title: string;
	quest_url: string | null;
	quest_description: string | null;
	quest_task_label: string | null;
	reward: string | null;
	thumbnail_url: string | null;
	banner_url: string | null;
	starts_at: string | null;
	expires_at: string | null;
	live: boolean;
};

export type RobloxEntry = {
	asset_id: string;
	name: string;
	category: string | null;
	creator_name: string | null;
	thumbnail_url: string | null;
	price: number;
	favorite_count: number;
	units_available: number;
	total_quantity: number;
	price_delta: number;
	limited: boolean;
	notification_count: number;
};

export type TaskEntry = {
	id: string;
	label: string;
	icon: string;
	accent: string;
	unit: string;
	requires: TaskRequirement;
	requires_label: string;
	goal: number;
	example: string;
	targets_item: boolean;
	success_chance: number | null;
};

export type ItemEntry = {
	id: number;
	name: string;
	effect_type: string;
	description: string | null;
	cost: number;
	buyable: boolean;
	usable: boolean;
	available_from: string | null;
	available_to: string | null;
	recurring_schedule: any;
	config: Record<string, any>;
};

export type WikiEntry = {
	id: number;
	name: string;
	description: string | null;
	site_url: string | null;
	site_host: string | null;
	active: boolean;
};

export const EMPTY_QUESTS: QuestEntry[] = [];
export const EMPTY_ROBLOX: RobloxEntry[] = [];
export const EMPTY_TASKS: TaskEntry[] = [];
export const EMPTY_ITEMS: ItemEntry[] = [];
export const EMPTY_WIKIS: WikiEntry[] = [];

const TASK_REQUIREMENT_LABEL: Record<TaskRequirement, string> = {
	leveling: 'Leveling',
	minigames: 'Minigames',
	items: 'Items',
	assets: 'Assets'
};

const SAMPLE_GOAL: Record<string, number> = {
	messages: 40,
	reactions: 25,
	minutes: 60,
	rounds: 10,
	wins: 5,
	members: 3,
	items: 5,
	xp: 5000,
	times: 5,
	trades: 3
};

async function cached<T>(key: string, build: () => Promise<T>, fallback: T): Promise<T> {
	const redis = await getRedisClient();
	if (redis) {
		try {
			const raw = await redis.get(key);
			if (raw) return JSON.parse(raw) as T;
		} catch (_) {}
	}
	let value: T;
	try {
		value = await build();
	} catch (_) {
		return fallback;
	}
	if (redis) {
		try {
			await redis.set(key, JSON.stringify(value), { EX: TTL_SECONDS });
		} catch (_) {}
	}
	return value;
}

function iso(d: unknown): string | null {
	if (!d) return null;
	const dt = d instanceof Date ? d : new Date(String(d).replace(' ', 'T') + 'Z');
	return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function num(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function hostOf(url: unknown): string | null {
	const raw = typeof url === 'string' ? url.trim() : '';
	if (!raw) return null;
	try {
		return new URL(raw).host.replace(/^www\./, '') || null;
	} catch (_) {
		return null;
	}
}

export function resolveQuestDirectory(): Promise<QuestEntry[]> {
	return cached(
		'dansday:quest_directory',
		async () => {
			const rows: any[] = await (db as any).listPublicDiscordQuests(MAX_ROWS);
			const now = Date.now();
			return rows.map((r) => {
				const starts = iso(r.starts_at);
				const expires = iso(r.expires_at);
				return {
					quest_id: String(r.quest_id),
					quest_name: r.quest_name || 'Untitled quest',
					game_title: r.game_title || 'Discord',
					quest_url: r.quest_url || null,
					quest_description: r.quest_description || null,
					quest_task_label: r.quest_task_label || null,
					reward: r.reward || null,
					thumbnail_url: r.thumbnail_url || null,
					banner_url: r.banner_url || null,
					starts_at: starts,
					expires_at: expires,
					live: (!starts || Date.parse(starts) <= now) && (!expires || Date.parse(expires) > now)
				};
			});
		},
		EMPTY_QUESTS
	);
}

export function resolveRobloxDirectory(limit: number | null = null, offset = 0): Promise<RobloxEntry[]> {
	return cached(
		`dansday:roblox_directory:${limit ?? 'all'}:${offset}`,
		async () => {
			const rows: any[] = await (db as any).listPublicRobloxItems(limit, offset);
			return rows.map((r) => {
				const price = num(r.price);
				return {
					asset_id: String(r.asset_id),
					name: r.name || `Asset ${r.asset_id}`,
					category: r.category || null,
					creator_name: r.creator_name || null,
					thumbnail_url: r.thumbnail_url || null,
					price,
					favorite_count: num(r.favorite_count),
					units_available: num(r.units_available),
					total_quantity: num(r.total_quantity),
					price_delta: price - num(r.last_price),
					limited: num(r.total_quantity) > 0,
					notification_count: num(r.notification_count)
				};
			});
		},
		EMPTY_ROBLOX
	);
}

export function resolveRobloxMostNotified(limit = 6): Promise<RobloxEntry[]> {
	return cached(
		`dansday:roblox_most_notified:${limit}`,
		async () => {
			const rows: any[] = await (db as any).listPublicRobloxItemsByNotifications(limit);
			return rows.map((r) => {
				const price = num(r.price);
				return {
					asset_id: String(r.asset_id),
					name: r.name || `Asset ${r.asset_id}`,
					category: r.category || null,
					creator_name: r.creator_name || null,
					thumbnail_url: r.thumbnail_url || null,
					price,
					favorite_count: num(r.favorite_count),
					units_available: num(r.units_available),
					total_quantity: num(r.total_quantity),
					price_delta: price - num(r.last_price),
					limited: num(r.total_quantity) > 0,
					notification_count: num(r.notification_count)
				};
			});
		},
		EMPTY_ROBLOX
	);
}

export function resolveRobloxTrackedCount(): Promise<number> {
	return cached('dansday:roblox_tracked_count', async () => (await (db as any).countPublicRobloxItems()) as number, 0);
}

export function resolveTaskDirectory(): TaskEntry[] {
	return TASK_DEFINITIONS.map((def) => {
		const goal = SAMPLE_GOAL[def.unit] ?? 10;
		return {
			id: def.id,
			label: def.label,
			icon: def.icon,
			accent: def.accent,
			unit: def.unit,
			requires: def.requires,
			requires_label: TASK_REQUIREMENT_LABEL[def.requires] ?? def.requires,
			goal,
			example: def.describe(goal),
			targets_item: !!def.targetsItem,
			success_chance: typeof def.successChance === 'number' ? def.successChance : null
		};
	});
}

export function resolveItemDirectory(): Promise<ItemEntry[]> {
	return cached(
		'dansday:item_directory',
		async () => {
			const rows: any[] = await (db as any).listPublicItems(MAX_ROWS);
			return rows.map((r) => ({
				id: Number(r.id),
				name: r.name || `Item ${r.id}`,
				effect_type: String(r.effect_type || ''),
				description: r.description || null,
				cost: num(r.cost),
				buyable: r.enabled !== false && r.enabled !== 0,
				usable: r.usable !== false && r.usable !== 0,
				available_from: r.available_from ? String(r.available_from) : null,
				available_to: r.available_to ? String(r.available_to) : null,
				recurring_schedule: r.recurring_schedule ?? null,
				config: (r.config as Record<string, any>) ?? {}
			}));
		},
		EMPTY_ITEMS
	);
}

export function resolveWikiDirectory(): Promise<WikiEntry[]> {
	return cached(
		'dansday:wiki_directory',
		async () => {
			const rows: any[] = await (db as any).listPublicWikis(MAX_ROWS);

			return rows.map((r) => {
				const site = typeof r.site_url === 'string' && r.site_url.trim() ? r.site_url.trim() : null;
				return {
					id: Number(r.id),
					name: r.name || `Wiki ${r.id}`,
					description: r.description || null,
					site_url: site,
					site_host: hostOf(site),
					active: r.enabled === true || r.enabled === 1
				};
			});
		},
		EMPTY_WIKIS
	);
}
