import { getRedisClient } from '../../../../redis.js';

const local = new Map<string, { value: unknown; expires: number }>();

function readLocal(key: string) {
	const entry = local.get(key);
	if (!entry) return undefined;
	if (Date.now() >= entry.expires) {
		local.delete(key);
		return undefined;
	}
	return entry.value;
}

function writeLocal(key: string, value: unknown, ttlSeconds: number) {
	local.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

async function readRedis(key: string) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return null;
	try {
		return await redis.get(key);
	} catch (_) {
		return null;
	}
}

async function writeRedis(key: string, value: unknown, ttlSeconds: number) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return false;
	try {
		await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
		return true;
	} catch (_) {
		return false;
	}
}

export async function cachedLookup<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
	const hit = readLocal(key);
	if (hit !== undefined) return hit as T;

	const raw = await readRedis(key);
	if (raw) {
		try {
			const value = JSON.parse(raw) as T;
			writeLocal(key, value, ttlSeconds);
			return value;
		} catch (_) {
			await invalidateCached(key);
		}
	}

	const value = await loader();
	writeLocal(key, value, ttlSeconds);
	await writeRedis(key, value, ttlSeconds);
	return value;
}

export async function invalidateCached(key: string) {
	local.delete(key);
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return;
	try {
		await redis.del(key);
	} catch (_) {
		return;
	}
}
