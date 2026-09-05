import { getRedisClient } from '../../../redis.js';
import { listLivePublicServers } from '../server-slug/index.js';
import { resolvePublicStatisticsSnapshot } from './stream.js';
import { aggregatePanelStatistics, type AggregatedPanelStats } from './aggregate.js';

const REDIS_KEY = 'dansday:server_directory';
const TTL_SECONDS = 300;
const MAX_SERVERS = 200;

export type DirectoryEntry = {
	rank: number;
	name: string;
	slug: string;
	server_icon: string | null;
	xp: number;
	members: number;
	messages: number;
	voice_hours: number;
	max_level: number;
};

export type ServerDirectory = {
	totals: AggregatedPanelStats;
	entries: DirectoryEntry[];
};

export const EMPTY_DIRECTORY: ServerDirectory = { totals: aggregatePanelStatistics([]), entries: [] };

export async function resolveServerDirectory(): Promise<ServerDirectory> {
	const redis = await getRedisClient();

	if (redis) {
		try {
			const raw = await redis.get(REDIS_KEY);
			if (raw) return JSON.parse(raw) as ServerDirectory;
		} catch (_) {}
	}

	let slugged: Awaited<ReturnType<typeof listLivePublicServers>> = [];
	try {
		slugged = (await listLivePublicServers()).slice(0, MAX_SERVERS);
	} catch (_) {
		return EMPTY_DIRECTORY;
	}
	if (slugged.length === 0) return EMPTY_DIRECTORY;

	const snapshots = await Promise.all(
		slugged.map((r: any) =>
			resolvePublicStatisticsSnapshot(Number(r.item.id))
				.then((s) => s?.stats ?? null)
				.catch(() => null)
		)
	);

	const entries: DirectoryEntry[] = slugged
		.map((r: any, i: number) => {
			const s = snapshots[i];
			return {
				rank: 0,
				name: r.item.name || r.slug,
				slug: r.slug,
				server_icon: r.item.server_icon ?? null,
				xp: Number(s?.leveling_total_xp) || 0,
				members: Number(s?.members_total) || 0,
				messages: Number(s?.leveling_total_chat) || 0,
				voice_hours: Math.round((Number(s?.leveling_total_voice_minutes) || 0) / 60),
				max_level: Number(s?.leveling_max_level) || 0
			};
		})
		.sort((a, b) => b.xp - a.xp || b.members - a.members || a.name.localeCompare(b.name))
		.map((e, i) => ({ ...e, rank: i + 1 }));

	const directory: ServerDirectory = { totals: aggregatePanelStatistics(snapshots), entries };

	if (redis) {
		try {
			await redis.set(REDIS_KEY, JSON.stringify(directory), { EX: TTL_SECONDS });
		} catch (_) {}
	}

	return directory;
}
