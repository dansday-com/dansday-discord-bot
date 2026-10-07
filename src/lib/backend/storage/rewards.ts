import { NUMERIC_SCOPE, createUploadStore, uploadFilename } from './uploadStore.js';

const store = createUploadStore('rewards', [NUMERIC_SCOPE]);

export function rewardImageFilename(extension: string): string {
	return uploadFilename(extension);
}

export function rewardImageKey(serverId: any, filename: string): string {
	return store.key([serverId], filename);
}

export function rewardImageBelongsTo(key: unknown, serverId: any): boolean {
	return store.belongsTo(key, serverId);
}

export function rewardImageUrl(key: string | null | undefined): string | null {
	if (!key || !store.isKey(key)) return null;
	return store.url(key);
}

export function rewardImageContentType(key: string): string {
	return store.contentType(key);
}

export async function saveRewardImage(key: string, data: Buffer): Promise<void> {
	await store.save(key, data);
}

export async function readRewardImage(key: string): Promise<Buffer | null> {
	return store.read(key);
}

export async function removeRewardImage(key: string | null | undefined): Promise<void> {
	if (key && store.isKey(key)) await store.remove(key);
}
