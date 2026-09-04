import db from '../../../database.js';
import { getRedisClient } from '../../../redis.js';

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
	description: string | null;
	thumbnail_url: string | null;
	price: number;
	lowest_resale_price: number;
	favorite_count: number;
	units_available: number;
	total_quantity: number;
	price_delta: number;
	limited: boolean;
};

export const EMPTY_QUESTS: QuestEntry[] = [];
export const EMPTY_ROBLOX: RobloxEntry[] = [];

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

export function resolveRobloxDirectory(): Promise<RobloxEntry[]> {
	return cached(
		'dansday:roblox_directory',
		async () => {
			const rows: any[] = await (db as any).listPublicRobloxItems(MAX_ROWS);
			return rows.map((r) => {
				const price = num(r.price);
				return {
					asset_id: String(r.asset_id),
					name: r.name || `Asset ${r.asset_id}`,
					category: r.category || null,
					creator_name: r.creator_name || null,
					description: r.description || null,
					thumbnail_url: r.thumbnail_url || null,
					price,
					lowest_resale_price: num(r.lowest_resale_price),
					favorite_count: num(r.favorite_count),
					units_available: num(r.units_available),
					total_quantity: num(r.total_quantity),
					price_delta: price - num(r.last_price),
					limited: num(r.total_quantity) > 0
				};
			});
		},
		EMPTY_ROBLOX
	);
}
