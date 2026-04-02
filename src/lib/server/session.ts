import { createClient } from 'redis';
import { randomBytes } from 'crypto';

export type SessionData = {
	authenticated: boolean;
	account_id?: number;
	account_type?: string;
};

const SESSION_TTL = 60 * 60 * 24;
const COOKIE_NAME = 'sid';

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
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

export async function setSession(sessionId: string, data: SessionData): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	await redis.setEx(sessionKey(sessionId), SESSION_TTL, JSON.stringify(data));
}

export async function destroySession(sessionId: string): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	await redis.del(sessionKey(sessionId));
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
