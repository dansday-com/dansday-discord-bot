const CDN = 'https://cdn.discordapp.com';
const LEGACY_DEFAULT_AVATARS = 5;
const DEFAULT_AVATARS = 6n;
const SNOWFLAKE_TIMESTAMP_SHIFT = 22n;
const SNOWFLAKE = /^\d+$/;

export function defaultAvatarUrl(index: number) {
	return `${CDN}/embed/avatars/${index}.png`;
}

export function defaultAvatarIndex(userId: unknown, discriminator?: unknown) {
	const legacy = Number(discriminator);
	if (Number.isInteger(legacy) && legacy > 0) {
		return legacy % LEGACY_DEFAULT_AVATARS;
	}
	const id = String(userId ?? '');
	return SNOWFLAKE.test(id) ? Number((BigInt(id) >> SNOWFLAKE_TIMESTAMP_SHIFT) % DEFAULT_AVATARS) : 0;
}

export function memberDefaultAvatarUrl(userId: unknown, discriminator?: unknown) {
	return defaultAvatarUrl(defaultAvatarIndex(userId, discriminator));
}

export function userAvatarUrl(userId: string, hash: string) {
	return `${CDN}/avatars/${userId}/${hash}.png`;
}
