import { getRedisClient } from '../redis.js';

const RATE_LIMIT_WINDOW = 30 * 60 * 1000;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(
	ip: string,
	endpoint: string,
	maxAttempts: number,
	windowMs: number = RATE_LIMIT_WINDOW
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
	const redisClient = await getRedisClient();

	if (redisClient) {
		const key = `dansday:ratelimit:${ip}:${endpoint}`;
		const count = await redisClient.incr(key);
		if (count === 1) await redisClient.pExpire(key, windowMs);
		const ttl = await redisClient.pTTL(key);
		const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);
		if (count > maxAttempts) return { allowed: false, remaining: 0, resetTime };
		return { allowed: true, remaining: maxAttempts - count, resetTime };
	}

	const key = `${ip}:${endpoint}`;
	const now = Date.now();
	const attempts = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

	if (now > attempts.resetTime) {
		attempts.count = 0;
		attempts.resetTime = now + windowMs;
	}

	if (attempts.count >= maxAttempts) {
		return { allowed: false, remaining: 0, resetTime: attempts.resetTime };
	}

	attempts.count++;
	rateLimitStore.set(key, attempts);

	if (Math.random() < 0.01) {
		for (const [k, v] of rateLimitStore.entries()) {
			if (now > v.resetTime) rateLimitStore.delete(k);
		}
	}

	return { allowed: true, remaining: maxAttempts - attempts.count, resetTime: attempts.resetTime };
}

export function getClientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
	);
}
