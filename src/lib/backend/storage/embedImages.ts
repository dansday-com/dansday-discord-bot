import { NUMERIC_SCOPE, createUploadStore, uploadFilename, uploadTimestampMs } from './uploadStore.js';

const MAX_AGE_MS = 30 * 60 * 1000;

const store = createUploadStore('embed', [/admin(?:-[1-9]\d*)?|[1-9]\d*/]);

export const EMBED_FILENAME_PATTERN = /^\d+-[a-z0-9]+\.[a-z0-9]+$/i;

export function embedScope(serverId: any): string {
	const id = Math.trunc(Number(serverId));
	if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid embed scope: ${serverId}`);
	return String(id);
}

export function embedAdminScope(panelId: any): string {
	const id = Math.trunc(Number(panelId));
	return Number.isFinite(id) && id > 0 ? `admin-${id}` : 'admin';
}

export function embedImageKey(scope: string, filename: string): string {
	return store.key([scope], filename);
}

export function embedImageFilename(extension: string): string {
	return uploadFilename(extension);
}

export function embedImageContentType(key: string): string {
	return store.contentType(key);
}

export function embedKeyBelongsTo(key: unknown, scope: string): boolean {
	return store.belongsTo(key, scope);
}

export function embedImageUrl(key: string): string {
	return store.url(key);
}

export async function saveEmbedImage(key: string, data: Buffer): Promise<void> {
	await store.save(key, data);
}

export async function readEmbedImage(key: string): Promise<Buffer | null> {
	return store.read(key);
}

export async function removeEmbedImage(key: string): Promise<void> {
	await store.remove(key);
}

export async function pruneExpiredEmbedImages(): Promise<void> {
	const now = Date.now();
	for (const key of await store.list()) {
		const ts = uploadTimestampMs(key);
		if (ts == null || now - ts <= MAX_AGE_MS) continue;
		await store.remove(key);
	}
}

export { NUMERIC_SCOPE };
