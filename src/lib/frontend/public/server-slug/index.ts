import db from '../../../database.js';
import { computeIndexedSlugForItemId, listIndexedSlugsForItems, resolveIndexedSlugToItem } from '../../../utils/index.js';

export type PublicSlugServerRow = {
	id: number;
	name: string | null;
	updated_at: any;
	server_icon?: string | null;
};

function serverSlugKey(s: PublicSlugServerRow) {
	return s.name || 'server';
}

export async function resolvePublicServerBySlug(requestedSlug: string): Promise<{ server: PublicSlugServerRow; computedSlug: string } | null> {
	const servers: PublicSlugServerRow[] = await (db as any).listPublicServers();
	if (!Array.isArray(servers) || servers.length === 0) return null;
	const resolved = resolveIndexedSlugToItem(requestedSlug, servers, serverSlugKey);
	if (!resolved) return null;
	return { server: resolved.item, computedSlug: resolved.computedSlug };
}

export async function listPublicServerSlugs(): Promise<{ id: number; slug: string; updated_at: any }[]> {
	const servers: PublicSlugServerRow[] = await (db as any).listPublicServers();
	if (!Array.isArray(servers) || servers.length === 0) return [];
	return listIndexedSlugsForItems(servers, serverSlugKey).map((row) => ({
		id: Number(row.item.id),
		slug: row.slug,
		updated_at: row.updated_at
	}));
}

export async function computePublicServerSlugForServerId(serverId: number): Promise<string | null> {
	const servers: PublicSlugServerRow[] = await (db as any).listPublicServers();
	if (!Array.isArray(servers) || servers.length === 0) return null;
	return computeIndexedSlugForItemId(serverId, servers, serverSlugKey);
}

export async function computePublicServerSlugForServerConfig(serverId: number, serverNameFallback: string | null): Promise<string | null> {
	const servers: PublicSlugServerRow[] = await (db as any).listPublicServers();
	const id = Number(serverId);
	const merged: PublicSlugServerRow[] = servers.some((s) => Number(s.id) === id) ? servers : [...servers, { id, name: serverNameFallback, updated_at: null }];
	return computeIndexedSlugForItemId(id, merged, serverSlugKey);
}
