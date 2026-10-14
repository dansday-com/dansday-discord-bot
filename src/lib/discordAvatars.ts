const CDN = 'https://cdn.discordapp.com';
const LEGACY_DEFAULT_AVATARS = 5;

export function defaultAvatarUrl(index: number) {
	return `${CDN}/embed/avatars/${index}.png`;
}

export function legacyDefaultAvatarUrl(seed: unknown) {
	return defaultAvatarUrl(Number(seed) % LEGACY_DEFAULT_AVATARS || 0);
}

export function userAvatarUrl(userId: string, hash: string) {
	return `${CDN}/avatars/${userId}/${hash}.png`;
}
