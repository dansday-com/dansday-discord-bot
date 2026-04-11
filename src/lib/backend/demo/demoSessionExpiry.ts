import { cleanupDemoSession } from './seedDemo.js';
import { DEMO_EXPIRE_REDIS_PREFIX, deleteSessionsWithDemoPanelSlug, getRedis } from '../../utils/session.js';

let listenerStarted = false;

function expiredKeyToDemoSlug(key: string): string | null {
	if (!key.startsWith(DEMO_EXPIRE_REDIS_PREFIX)) return null;
	const slug = key.slice(DEMO_EXPIRE_REDIS_PREFIX.length);
	if (!slug.startsWith('demo_')) return null;
	return slug;
}

export async function startDemoSessionExpiryListener(): Promise<void> {
	if (listenerStarted) return;
	const url = process.env.REDIS_URL;
	if (!url) return;

	try {
		const redis = await getRedis();
		if (!redis) return;

		listenerStarted = true;

		try {
			await redis.configSet('notify-keyspace-events', 'Ex');
		} catch {
			console.warn(
				'[demo-expiry] Could not set Redis notify-keyspace-events Ex. Demo DB cleanup on TTL needs expired key events; set notify-keyspace-events Ex on the Redis server.'
			);
		}

		const sub = redis.duplicate();
		await sub.connect();

		await sub.pSubscribe('__keyevent@*__:expired', async (message) => {
			const key = typeof message === 'string' ? message : String(message);
			const slug = expiredKeyToDemoSlug(key);
			if (!slug) return;

			try {
				await deleteSessionsWithDemoPanelSlug(slug);
			} catch (e) {
				console.warn(`[demo-expiry] Redis session sweep failed for ${slug}:`, e);
			}
			try {
				await cleanupDemoSession(slug);
			} catch (e) {
				console.warn(`[demo-expiry] MySQL cleanup failed for ${slug}:`, e);
			}
		});
	} catch (e) {
		listenerStarted = false;
		console.warn('[demo-expiry] Failed to start Redis expiry listener:', e);
	}
}
