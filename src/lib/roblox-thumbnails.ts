const ROBLOX_PLACEHOLDER_THUMBNAIL_HASH = 'a53354b1f60a5dedc00d0600d1491075';

export function isUsableRobloxThumbnail(url: unknown): boolean {
	if (typeof url !== 'string') return false;
	const trimmed = url.trim();
	return trimmed.startsWith('http') && !trimmed.includes(ROBLOX_PLACEHOLDER_THUMBNAIL_HASH);
}
