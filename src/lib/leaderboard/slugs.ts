import db from '../database.js';
import { computeIndexedSlugForItemId, listIndexedSlugsForItems, resolveIndexedSlugToItem } from '../utils/index.js';

export type LeaderboardServerRow = {
	id: number;
	name: string | null;
	updated_at: any;
	server_icon?: string | null;
};

function serverSlugKey(s: LeaderboardServerRow) {
	return s.name || 'server';
}

export async function resolveLeaderboardServerBySlug(requestedSlug: string): Promise<{ server: LeaderboardServerRow; computedSlug: string } | null> {
	const servers: LeaderboardServerRow[] = await (db as any).listEnabledLeaderboardServers();
	if (!Array.isArray(servers) || servers.length === 0) return null;
	const resolved = resolveIndexedSlugToItem(requestedSlug, servers, serverSlugKey);
	if (!resolved) return null;
	return { server: resolved.item, computedSlug: resolved.computedSlug };
}

export async function listEnabledLeaderboardSlugs(): Promise<{ slug: string; updated_at: any }[]> {
	const servers: LeaderboardServerRow[] = await (db as any).listEnabledLeaderboardServers();
	if (!Array.isArray(servers) || servers.length === 0) return [];
	return listIndexedSlugsForItems(servers, serverSlugKey);
}

export async function computeLeaderboardSlugForServerId(serverId: number): Promise<string | null> {
	const servers: LeaderboardServerRow[] = await (db as any).listEnabledLeaderboardServers();
	if (!Array.isArray(servers) || servers.length === 0) return null;
	return computeIndexedSlugForItemId(serverId, servers, serverSlugKey);
}

export async function computeLeaderboardSlugForServerConfig(serverId: number, serverNameFallback: string | null): Promise<string | null> {
	const servers: LeaderboardServerRow[] = await (db as any).listEnabledLeaderboardServers();
	const id = Number(serverId);
	const merged: LeaderboardServerRow[] = servers.some((s) => Number(s.id) === id) ? servers : [...servers, { id, name: serverNameFallback, updated_at: null }];
	return computeIndexedSlugForItemId(id, merged, serverSlugKey);
}
