import { getRedisClient } from '../../redis.js';
import { logger } from '../../utils/index.js';

const LOCK_TTL_SECONDS = 30;
const RENEW_INTERVAL_MS = 10_000;

function lockKey(kind: string, botId: string): string {
	return `bot:lock:${kind}:${botId}`;
}

export interface BotSingletonLock {
	release: () => Promise<void>;
}

export async function acquireBotSingletonLock(kind: string, botId: string): Promise<BotSingletonLock | null> {
	const redis = await getRedisClient();
	if (!redis) {
		logger.warn('Bot singleton lock skipped: Redis unavailable', { kind, botId });
		return { release: async () => {} };
	}

	const key = lockKey(kind, botId);
	const token = `${process.pid}:${process.hrtime.bigint().toString()}`;

	const acquired = await redis.set(key, token, { NX: true, EX: LOCK_TTL_SECONDS });
	if (acquired !== 'OK') {
		const holder = await redis.get(key).catch(() => null);
		logger.error('Bot singleton lock already held by another process; refusing to start', {
			kind,
			botId,
			holder: holder ?? 'unknown'
		});
		return null;
	}

	logger.info('Bot singleton lock acquired', { kind, botId });

	const renewScript = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end`;
	const releaseScript = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

	const timer: ReturnType<typeof setInterval> = setInterval(() => {
		redis
			.eval(renewScript, { keys: [key], arguments: [token, String(LOCK_TTL_SECONDS)] })
			.then((res) => {
				if (res !== 1) {
					logger.error('Bot singleton lock lost; exiting to avoid duplicate bot', { kind, botId });
					clearInterval(timer);
					process.exit(1);
				}
			})
			.catch((err: Error) => {
				logger.warn('Bot singleton lock renew failed', { kind, botId, error: String(err?.message || err) });
			});
	}, RENEW_INTERVAL_MS);
	timer.unref?.();

	return {
		release: async () => {
			clearInterval(timer);
			try {
				await redis.eval(releaseScript, { keys: [key], arguments: [token] });
			} catch (err: any) {
				logger.warn('Bot singleton lock release failed', { kind, botId, error: String(err?.message || err) });
			}
		}
	};
}
