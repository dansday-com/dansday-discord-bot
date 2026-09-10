import { deleteObject, getObject, putObject } from './index.js';
import { imageContentType } from '../../images.js';
import { themeImageUrl } from '../../themes.js';

const FOLDER = 'member-themes';

export function memberThemeContentType(filename: string): string {
	return imageContentType(filename);
}

function memberThemeKey(filename: string): string {
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		throw new Error(`Invalid member theme filename: ${filename}`);
	}
	return `${FOLDER}/${filename}`;
}

export function memberThemeUrl(filename: string): string {
	return themeImageUrl(filename) ?? '';
}

export async function saveMemberTheme(filename: string, data: Buffer): Promise<void> {
	await putObject(memberThemeKey(filename), data, memberThemeContentType(filename));
}

export async function readMemberTheme(filename: string): Promise<Buffer | null> {
	try {
		return await getObject(memberThemeKey(filename));
	} catch {
		return null;
	}
}

export async function removeMemberTheme(filename: string): Promise<void> {
	try {
		await deleteObject(memberThemeKey(filename));
	} catch {}
}
