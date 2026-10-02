import { NUMERIC_SCOPE, createUploadStore, uploadFilename } from './uploadStore.js';

const store = createUploadStore('server-themes', [NUMERIC_SCOPE]);

export function serverThemeFilename(extension: string): string {
	return uploadFilename(extension);
}

export function serverThemeKey(serverId: any, filename: string): string {
	return store.key([serverId], filename);
}

export function serverThemeUrl(key: string | null | undefined): string | null {
	if (!key || !store.isKey(key)) return null;
	return store.url(key);
}

export function serverThemeContentType(key: string): string {
	return store.contentType(key);
}

export async function saveServerTheme(key: string, data: Buffer): Promise<void> {
	await store.save(key, data);
}

export async function readServerTheme(key: string): Promise<Buffer | null> {
	return store.read(key);
}

export async function removeServerTheme(key: string | null | undefined): Promise<void> {
	if (key && store.isKey(key)) await store.remove(key);
}
