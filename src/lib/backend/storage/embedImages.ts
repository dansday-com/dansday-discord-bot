import { deleteObject, getObject, listObjectKeys, publicUrl, putObject } from './index.js';
import { imageContentType } from '../../images.js';

const FOLDER = 'embed-images';
const MAX_AGE_MS = 30 * 60 * 1000;

export function embedImageContentType(filename: string): string {
	return imageContentType(filename);
}

function embedImageKey(filename: string): string {
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		throw new Error(`Invalid embed image filename: ${filename}`);
	}
	return `${FOLDER}/${filename}`;
}

export function embedImageUrl(filename: string): string {
	return publicUrl(embedImageKey(filename));
}

export async function saveEmbedImage(filename: string, data: Buffer): Promise<void> {
	await putObject(embedImageKey(filename), data, embedImageContentType(filename));
}

export async function readEmbedImage(filename: string): Promise<Buffer | null> {
	try {
		return await getObject(embedImageKey(filename));
	} catch {
		return null;
	}
}

export async function removeEmbedImage(filename: string): Promise<void> {
	try {
		await deleteObject(embedImageKey(filename));
	} catch {}
}

function uploadTimestampMs(filename: string): number | null {
	const base = filename.replace(/\.[^.]+$/, '');
	const parts = base.split('-');

	if (parts[0] === 'global' && parts.length === 4) {
		const ts = Number(parts[2]);
		return Number.isFinite(ts) ? ts : null;
	}

	if (parts.length >= 3) {
		const ts = Number(parts[1]);
		return Number.isFinite(ts) ? ts : null;
	}
	if (parts.length === 2) {
		const ts = Number(parts[0]);
		return Number.isFinite(ts) ? ts : null;
	}
	return null;
}

export async function pruneExpiredEmbedImages(): Promise<void> {
	let keys: string[];
	try {
		keys = await listObjectKeys(FOLDER);
	} catch {
		return;
	}

	const now = Date.now();
	for (const key of keys) {
		const filename = key.slice(FOLDER.length + 1);
		const ts = uploadTimestampMs(filename);
		if (ts == null) continue;
		if (now - ts <= MAX_AGE_MS) continue;
		await removeEmbedImage(filename);
	}
}
