import { publicUrl } from './index.js';
import { NUMERIC_SCOPE, createUploadStore, uploadFilename } from './uploadStore.js';
import { type MemberTheme, type MemberThemeRow, resolveMemberTheme } from '../../themes.js';

const LEGACY_FOLDER = 'member-themes';

const store = createUploadStore('themes', [NUMERIC_SCOPE, NUMERIC_SCOPE]);

export function memberThemeFilename(extension: string): string {
	return uploadFilename(extension);
}

export function memberThemeKey(serverId: any, memberId: any, filename: string): string {
	return store.key([serverId, memberId], filename);
}

export function memberThemeContentType(key: string): string {
	return store.contentType(key);
}

function isLegacyKey(value: string): boolean {
	return !value.includes('/') && /^[\w.-]+$/.test(value) && !value.includes('..');
}

export function memberThemeStorageKey(stored: string): string {
	const value = String(stored ?? '');
	if (isLegacyKey(value)) return `${LEGACY_FOLDER}/${value}`;
	return store.assertKey(value);
}

export function memberThemeUrl(stored: string): string {
	const key = memberThemeStorageKey(stored);
	return store.isKey(key) ? store.url(key) : publicUrl(key);
}

export function resolveMemberThemeForClient(row: MemberThemeRow | null | undefined): MemberTheme | null {
	const theme = resolveMemberTheme(row);
	if (!theme) return null;
	if (!theme.image) return theme;
	try {
		return { ...theme, image: memberThemeUrl(theme.image) };
	} catch {
		return { ...theme, image: null };
	}
}

export async function saveMemberTheme(key: string, data: Buffer): Promise<void> {
	await store.save(key, data);
}

export async function readMemberTheme(stored: string): Promise<Buffer | null> {
	const key = memberThemeStorageKey(stored);
	if (store.isKey(key)) return store.read(key);
	const { getObject } = await import('./index.js');
	try {
		return await getObject(key);
	} catch {
		return null;
	}
}

export async function removeMemberTheme(stored: string): Promise<void> {
	const key = memberThemeStorageKey(stored);
	if (store.isKey(key)) {
		await store.remove(key);
		return;
	}
	const { deleteObject } = await import('./index.js');
	try {
		await deleteObject(key);
	} catch {}
}
