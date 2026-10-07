import { randomBytes } from 'crypto';
import { deleteObject, getObject, listObjectKeys, publicUrl, putObject } from './index.js';
import { imageContentType } from '../../images.js';
import { uploadTimestampMs } from './uploadStore.js';
import { MESSAGE_UPLOAD_ROOTS, MESSAGE_VIDEO_TYPES, isMessageUploadKey, type MessageOwner } from '../../messages.js';

const UNSAVED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function folder(owner: MessageOwner): string {
	const id = Math.trunc(Number(owner.id));
	if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid message upload owner: ${owner.id}`);
	return `${MESSAGE_UPLOAD_ROOTS[owner.scope]}/${id}`;
}

function assertKey(key: string): string {
	if (!isMessageUploadKey(key)) throw new Error(`Invalid message upload key: ${key}`);
	return key;
}

export function messageFileKey(owner: MessageOwner, extension: string): string {
	return assertKey(`${folder(owner)}/${Date.now()}-${randomBytes(12).toString('hex')}.${extension}`);
}

export function messageFileKeyFor(owner: MessageOwner, filename: string): string {
	return assertKey(`${folder(owner)}/${filename}`);
}

export function messageFileBelongsTo(key: unknown, owner: MessageOwner): boolean {
	return isMessageUploadKey(key, owner);
}

export function messageFileUrl(key: string): string {
	return publicUrl(assertKey(key));
}

export function messageFileContentType(key: string): string {
	const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
	const video = Object.entries(MESSAGE_VIDEO_TYPES).find(([, ext]) => ext === extension);
	return video ? video[0] : imageContentType(key);
}

export async function saveMessageFile(key: string, data: Buffer): Promise<void> {
	await putObject(assertKey(key), data, messageFileContentType(key));
}

export async function readMessageFile(key: string): Promise<Buffer | null> {
	try {
		return await getObject(assertKey(key));
	} catch {
		return null;
	}
}

export async function pruneMessageFiles(owner: MessageOwner, inUse: Set<string>): Promise<void> {
	const now = Date.now();
	const keys = await listObjectKeys(folder(owner)).catch(() => [] as string[]);
	for (const key of keys) {
		if (!isMessageUploadKey(key, owner) || inUse.has(key)) continue;
		const ts = uploadTimestampMs(key);
		if (ts != null && now - ts <= UNSAVED_MAX_AGE_MS) continue;
		await deleteObject(key).catch(() => null);
	}
}
