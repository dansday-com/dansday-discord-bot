import type { RedisClientType } from 'redis';
import logger from './logger.js';

let client: RedisClientType | null = null;

function normalizeRedisUrl(url: string) {
	try {
		new URL(url);
		return url;
	} catch (_) {
		return url;
	}
}

function buildRedisUrl(): string | null {
	const raw = process.env.REDIS_URL;
	if (!raw || raw.trim() === '') return null;
	const s = raw.trim();
	if (s.includes('://') || s.includes('@')) {
		return normalizeRedisUrl(s);
	}
	return `redis://${s}:6379/0`;
}

export async function getRedisClient(): Promise<RedisClientType | null> {
	if (client) return client;
	const url = buildRedisUrl();
	if (!url) return null;
	try {
		const { createClient } = await import('redis');
		const c = createClient({ url }) as RedisClientType;
		c.on('error', (err: Error) => logger.error('Redis client error', { error: String(err?.message || err) }));
		await c.connect();
		client = c;
		return client;
	} catch (err: any) {
		logger.error('Redis connection failed', { error: String(err?.message || err) });
		return null;
	}
}

export function hasRedis(): boolean {
	return client != null;
}
