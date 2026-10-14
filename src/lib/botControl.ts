import { randomUUID } from 'crypto';
import { getRedisClient } from './redis.js';
import { logger, attemptSync } from './utils/index.js';
import { HTTP } from './http.js';
import { postToLocalBot, type BotWebhookResult, type BotWebhookTarget } from './botWebhook.js';
import {
	RUNNER_COMMAND_CHANNEL,
	RUNNER_LEADER_KEY,
	RUNNER_REPLY_CHANNEL,
	RUNNER_STATUS_CHANNEL,
	botKindOf,
	botProcessMapKey,
	getBotUptimeMs,
	restartBotById as restartBotInProcess,
	startBotById as startBotInProcess,
	stopBotById as stopBotInProcess,
	subscribeBotStatus as subscribeBotStatusInProcess,
	type BotProcessKind,
	type BotProcessRow,
	type BotStatusEvent,
	type RunnerAction,
	type RunnerResult
} from './botProcesses.js';

export { getBotUptimeMs };

const COMMAND_TIMEOUT_MS = 30_000;
const isExternalRunner = (process.env.BOT_RUNNER ?? '').trim().toLowerCase() === 'external';

type StatusListener = (e: BotStatusEvent) => void;

const pendingCommands = new Map<string, (result: RunnerResult) => void>();
const statusListeners = new Map<string, Set<StatusListener>>();
let subscriberReady: Promise<boolean> | null = null;

export function runsBotsInProcess(): boolean {
	return !isExternalRunner;
}

function parseMessage(raw: string): Record<string, unknown> | null {
	try {
		return JSON.parse(raw);
	} catch (_) {
		return null;
	}
}

function connectRunnerSubscriber(): Promise<boolean> {
	if (subscriberReady) {
		return subscriberReady;
	}
	subscriberReady = (async () => {
		const redis = await getRedisClient();
		if (!redis) {
			return false;
		}
		const subscriber = redis.duplicate();
		subscriber.on('error', (err: Error) => logger.error('Bot runner subscriber error', { error: String(err?.message || err) }));
		await subscriber.connect();
		await subscriber.subscribe(RUNNER_REPLY_CHANNEL, (raw) => {
			const { requestId, ...result } = parseMessage(raw) ?? {};
			pendingCommands.get(String(requestId))?.(result as RunnerResult);
		});
		await subscriber.subscribe(RUNNER_STATUS_CHANNEL, (raw) => {
			const { key, ...event } = parseMessage(raw) ?? {};
			for (const fn of statusListeners.get(String(key)) ?? []) {
				fn(event as BotStatusEvent);
			}
		});
		return true;
	})()
		.catch((err: Error) => {
			logger.error('Bot runner subscriber failed to connect', { error: String(err?.message || err) });
			return false;
		})
		.then((isConnected) => {
			if (!isConnected) {
				subscriberReady = null;
			}
			return isConnected;
		});
	return subscriberReady;
}

type RunnerRequest = { action: RunnerAction; kind: BotProcessKind; id: number; payload?: unknown };

async function sendRunnerCommand({ action, kind, id, payload }: RunnerRequest): Promise<RunnerResult> {
	if (!(await connectRunnerSubscriber())) {
		return { success: false, error: 'The bot runner needs Redis, and Redis is not reachable' };
	}
	const redis = await getRedisClient();
	if (!redis) {
		return { success: false, error: 'The bot runner needs Redis, and Redis is not reachable' };
	}

	try {
		if (!(await redis.exists(RUNNER_LEADER_KEY))) {
			return { success: false, error: 'The bot runner is offline, try again in a moment' };
		}
	} catch (err) {
		return { success: false, error: String((err as Error)?.message || err) };
	}

	const requestId = randomUUID();
	return new Promise<RunnerResult>((resolve) => {
		const settle = (result: RunnerResult) => {
			clearTimeout(timer);
			pendingCommands.delete(requestId);
			resolve(result);
		};
		const timer = setTimeout(() => settle({ success: false, error: 'The bot runner did not answer in time' }), COMMAND_TIMEOUT_MS);
		pendingCommands.set(requestId, settle);
		redis.publish(RUNNER_COMMAND_CHANNEL, JSON.stringify({ requestId, action, kind, id, payload })).catch((err) => {
			settle({ success: false, error: String(err?.message || err) });
		});
	});
}

export function startBotById(botId: number, bot: BotProcessRow): Promise<RunnerResult> {
	return isExternalRunner ? sendRunnerCommand({ action: 'start', kind: botKindOf(bot), id: botId }) : startBotInProcess(botId, bot);
}

export function stopBotById(botId: number, bot?: BotProcessRow): Promise<RunnerResult> {
	return isExternalRunner ? sendRunnerCommand({ action: 'stop', kind: bot ? botKindOf(bot) : 'official', id: botId }) : stopBotInProcess(botId, bot);
}

export function restartBotById(botId: number, bot: BotProcessRow): Promise<RunnerResult> {
	return isExternalRunner ? sendRunnerCommand({ action: 'restart', kind: botKindOf(bot), id: botId }) : restartBotInProcess(botId, bot);
}

export type { BotWebhookBody } from './botWebhook.js';

export async function postBotWebhook(bot: BotWebhookTarget & { id: number }, payload: unknown): Promise<BotWebhookResult> {
	if (!isExternalRunner) {
		return postToLocalBot(bot, payload);
	}
	const result = await sendRunnerCommand({ action: 'webhook', kind: 'official', id: bot.id, payload });
	return result.webhook ?? { status: HTTP.BAD_GATEWAY, body: null };
}

const LIVE_STATUSES = new Set(['running', 'starting', 'stopping']);

export function hasLostBotProcess(row: { status?: string | null; process_id?: number | null }): boolean {
	const pid = row.process_id;
	if (isExternalRunner || !pid || !LIVE_STATUSES.has(String(row.status))) {
		return false;
	}
	return !attemptSync(() => process.kill(pid, 0)).ok;
}

export function subscribeBotStatus(kind: BotProcessKind, botNumericId: number, fn: StatusListener): () => void {
	if (!isExternalRunner) {
		return subscribeBotStatusInProcess(kind, botNumericId, fn);
	}

	const mapKey = botProcessMapKey(kind, botNumericId);
	if (!statusListeners.has(mapKey)) {
		statusListeners.set(mapKey, new Set());
	}
	statusListeners.get(mapKey)!.add(fn);
	connectRunnerSubscriber();
	return () => statusListeners.get(mapKey)?.delete(fn);
}
