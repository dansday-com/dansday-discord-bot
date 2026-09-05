import db from '../../../database.js';
import { computeIndexedSlugForItemId, listIndexedSlugsForItems, resolveIndexedSlugToItem } from '../../../utils/index.js';

export type PublicSlugServerRow = {
	id: number;
	bot_id?: number | null;
	name: string | null;
	updated_at: any;
	server_icon?: string | null;
	deleted_at?: any;
};

export type SluggedPublicServer = { slug: string; updated_at: unknown; item: PublicSlugServerRow };

function serverSlugKey(s: PublicSlugServerRow) {
	return s.name || 'server';
}

async function listPublicServerRows(): Promise<PublicSlugServerRow[]> {
	const servers: PublicSlugServerRow[] = await (db as any).listPublicServers();
	return Array.isArray(servers) ? servers : [];
}

export function isLivePublicServer(server: PublicSlugServerRow): boolean {
	return !server.deleted_at;
}

export async function listSluggedPublicServers(): Promise<SluggedPublicServer[]> {
	return listIndexedSlugsForItems(await listPublicServerRows(), serverSlugKey);
}

export async function listLivePublicServers(): Promise<SluggedPublicServer[]> {
	return (await listSluggedPublicServers()).filter((row) => isLivePublicServer(row.item));
}

export async function resolvePublicServerBySlug(requestedSlug: string): Promise<{ server: PublicSlugServerRow; computedSlug: string } | null> {
	const servers = await listPublicServerRows();
	if (servers.length === 0) return null;
	const resolved = resolveIndexedSlugToItem(requestedSlug, servers, serverSlugKey);
	if (!resolved || !isLivePublicServer(resolved.item)) return null;
	return { server: resolved.item, computedSlug: resolved.computedSlug };
}

export async function listPublicServerSlugs(): Promise<{ id: number; slug: string; updated_at: any }[]> {
	const rows = await listLivePublicServers();
	return rows.map((row) => ({
		id: Number(row.item.id),
		slug: row.slug,
		updated_at: row.updated_at
	}));
}

export async function computePublicServerSlugForServerId(serverId: number): Promise<string | null> {
	const servers = await listPublicServerRows();
	if (servers.length === 0) return null;
	return computeIndexedSlugForItemId(serverId, servers, serverSlugKey);
}

export async function computePublicServerSlugForServerConfig(serverId: number, serverNameFallback: string | null): Promise<string | null> {
	const servers = await listPublicServerRows();
	const id = Number(serverId);
	const merged: PublicSlugServerRow[] = servers.some((s) => Number(s.id) === id) ? servers : [...servers, { id, name: serverNameFallback, updated_at: null }];
	return computeIndexedSlugForItemId(id, merged, serverSlugKey);
}
