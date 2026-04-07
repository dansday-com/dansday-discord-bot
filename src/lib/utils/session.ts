import { createClient } from 'redis';
import { randomBytes } from 'crypto';

export type SessionData = {
	authenticated: boolean;
	account_id?: number;
	account_type?: string;
	account_source?: 'accounts' | 'server_accounts';
	is_demo?: boolean;
	demo_panel_slug?: string;
	expires_at?: number;
};

const SESSION_TTL = 60 * 60 * 24;
const COOKIE_NAME = 'sid';

export const DEMO_EXPIRE_REDIS_PREFIX = 'dansday:demo-expire:';

export function demoExpireRedisKey(panelSlug: string): string {
	return `${DEMO_EXPIRE_REDIS_PREFIX}${panelSlug}`;
}

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
	if (redisClient) return redisClient;
	const url = process.env.REDIS_URL;
	if (!url) return null;
	try {
		const client = createClient({ url });
		await client.connect();
		redisClient = client;
		return client;
	} catch (_) {
		return null;
	}
}

function sessionKey(id: string) {
	return `dansday:sess:${id}`;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
	const redis = await getRedis();
	if (!redis) return null;
	try {
		const raw = await redis.get(sessionKey(sessionId));
		if (!raw) return null;
		return JSON.parse(raw) as SessionData;
	} catch (_) {
		return null;
	}
}

export async function setSession(sessionId: string, data: SessionData, ttlSeconds: number = SESSION_TTL): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	const ttl = Math.max(5, Math.floor(ttlSeconds));
	const expires_at = Date.now() + ttl * 1000;
	await redis.setEx(sessionKey(sessionId), ttl, JSON.stringify({ ...data, expires_at }));
	if (data.is_demo === true && data.demo_panel_slug) {
		await redis.setEx(demoExpireRedisKey(data.demo_panel_slug), ttl, '1');
	}
}

export async function destroySession(sessionId: string): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	const sidKey = sessionKey(sessionId);
	try {
		const raw = await redis.get(sidKey);
		if (raw) {
			const data = JSON.parse(raw) as SessionData;
			if (data.is_demo === true && data.demo_panel_slug) {
				await redis.del(demoExpireRedisKey(data.demo_panel_slug));
			}
		}
	} catch (_) {}
	await redis.del(sidKey);
}

export async function deleteSessionsWithDemoPanelSlug(panelSlug: string): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	try {
		const keys = await redis.keys('dansday:sess:*');
		for (const key of keys) {
			const raw = await redis.get(key);
			if (!raw) continue;
			try {
				const data = JSON.parse(raw) as SessionData;
				if (data.is_demo === true && data.demo_panel_slug === panelSlug) {
					await redis.del(key);
				}
			} catch (_) {}
		}
	} catch (_) {}
}

export async function destroySessionsForAccount(accountId: number): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	try {
		const keys = await redis.keys('dansday:sess:*');
		for (const key of keys) {
			const raw = await redis.get(key);
			if (!raw) continue;
			const data = JSON.parse(raw) as SessionData;
			if (data.account_id === accountId) {
				await redis.del(key);
			}
		}
	} catch (_) {}
}

export function newSessionId(): string {
	return randomBytes(32).toString('hex');
}

export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const [k, v] = part.trim().split('=');
		if (k === COOKIE_NAME) return decodeURIComponent(v ?? '');
	}
	return null;
}

export function makeSessionCookie(sessionId: string): string {
	const maxAge = SESSION_TTL;
	return `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
	return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

const VERIFY_TOKEN_TTL = 60 * 15;

function verifyTokenKey(token: string) {
	return `dansday:verify:${token}`;
}

export async function createVerifyToken(accountId: number): Promise<string | null> {
	const redis = await getRedis();
	if (!redis) return null;
	const token = randomBytes(32).toString('hex');
	await redis.setEx(verifyTokenKey(token), VERIFY_TOKEN_TTL, String(accountId));
	return token;
}

export async function consumeVerifyToken(token: string): Promise<number | null> {
	const redis = await getRedis();
	if (!redis) return null;
	const key = verifyTokenKey(token);
	const raw = await redis.get(key);
	if (!raw) return null;
	await redis.del(key);
	const id = parseInt(raw, 10);
	return isNaN(id) ? null : id;
}

export async function peekVerifyToken(token: string): Promise<number | null> {
	const redis = await getRedis();
	if (!redis) return null;
	const raw = await redis.get(verifyTokenKey(token));
	if (!raw) return null;
	const id = parseInt(raw, 10);
	return isNaN(id) ? null : id;
}
