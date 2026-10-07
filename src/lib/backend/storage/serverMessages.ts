import { deleteObject, getObject, listObjectKeys, publicUrl, putObject } from './index.js';
import { imageContentType } from '../../images.js';
import { uploadFilename, uploadTimestampMs } from './uploadStore.js';
import { MESSAGE_UPLOAD_ROOT, MESSAGE_VIDEO_TYPES, isMessageUploadKey } from '../../messages.js';

const UNSAVED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function scope(serverId: any): string {
	const id = Math.trunc(Number(serverId));
	if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid message upload scope: ${serverId}`);
	return `${MESSAGE_UPLOAD_ROOT}/${id}`;
}

function assertKey(key: string): string {
	if (!isMessageUploadKey(key)) throw new Error(`Invalid message upload key: ${key}`);
	return key;
}

export function serverMessageFileKey(serverId: any, extension: string): string {
	return assertKey(`${scope(serverId)}/${uploadFilename(extension)}`);
}

export function serverMessageFileKeyFor(serverId: any, filename: string): string {
	return assertKey(`${scope(serverId)}/${filename}`);
}

export function serverMessageFileBelongsTo(key: unknown, serverId: any): boolean {
	return isMessageUploadKey(key, serverId);
}

export function serverMessageFileUrl(key: string): string {
	return publicUrl(assertKey(key));
}

export function serverMessageFileContentType(key: string): string {
	const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
	const video = Object.entries(MESSAGE_VIDEO_TYPES).find(([, ext]) => ext === extension);
	return video ? video[0] : imageContentType(key);
}

export async function saveServerMessageFile(key: string, data: Buffer): Promise<void> {
	await putObject(assertKey(key), data, serverMessageFileContentType(key));
}

export async function readServerMessageFile(key: string): Promise<Buffer | null> {
	try {
		return await getObject(assertKey(key));
	} catch {
		return null;
	}
}

export async function pruneServerMessageFiles(serverId: any, inUse: Set<string>): Promise<void> {
	const now = Date.now();
	const keys = await listObjectKeys(scope(serverId)).catch(() => [] as string[]);
	for (const key of keys) {
		if (!isMessageUploadKey(key, serverId) || inUse.has(key)) continue;
		const ts = uploadTimestampMs(key);
		if (ts != null && now - ts <= UNSAVED_MAX_AGE_MS) continue;
		await deleteObject(key).catch(() => null);
	}
}
