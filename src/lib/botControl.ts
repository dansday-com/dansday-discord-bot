import { randomUUID } from 'crypto';
import { getRedisClient } from './redis.js';
import { logger } from './utils/index.js';
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
	type BotStatusEvent,
	type RunnerAction,
	type RunnerResult
} from './botProcesses.js';

export { getBotUptimeMs };

const COMMAND_TIMEOUT_MS = 30_000;
const externalRunner = (process.env.BOT_RUNNER ?? '').trim().toLowerCase() === 'external';

type StatusListener = (e: BotStatusEvent) => void;

const pendingCommands = new Map<string, (result: RunnerResult) => void>();
const statusListeners = new Map<string, Set<StatusListener>>();
let subscriberReady: Promise<boolean> | null = null;

export function runsBotsInProcess(): boolean {
	return !externalRunner;
}

function parseMessage(raw: string): any {
	try {
		return JSON.parse(raw);
	} catch (_) {
		return null;
	}
}

function connectRunnerSubscriber(): Promise<boolean> {
	if (subscriberReady) return subscriberReady;
	subscriberReady = (async () => {
		const redis = await getRedisClient();
		if (!redis) return false;
		const subscriber = redis.duplicate();
		subscriber.on('error', (err: Error) => logger.error('Bot runner subscriber error', { error: String(err?.message || err) }));
		await subscriber.connect();
		await subscriber.subscribe(RUNNER_REPLY_CHANNEL, (raw) => {
			const { requestId, ...result } = parseMessage(raw) ?? {};
			pendingCommands.get(requestId)?.(result as RunnerResult);
		});
		await subscriber.subscribe(RUNNER_STATUS_CHANNEL, (raw) => {
			const { key, ...event } = parseMessage(raw) ?? {};
			for (const fn of statusListeners.get(key) ?? []) fn(event as BotStatusEvent);
		});
		return true;
	})()
		.catch((err: any) => {
			logger.error('Bot runner subscriber failed to connect', { error: String(err?.message || err) });
			return false;
		})
		.then((connected) => {
			if (!connected) subscriberReady = null;
			return connected;
		});
	return subscriberReady;
}

async function sendRunnerCommand(action: RunnerAction, kind: BotProcessKind, id: number): Promise<RunnerResult> {
	if (!(await connectRunnerSubscriber())) return { success: false, error: 'The bot runner needs Redis, and Redis is not reachable' };
	const redis = await getRedisClient();
	if (!redis) return { success: false, error: 'The bot runner needs Redis, and Redis is not reachable' };

	try {
		if (!(await redis.exists(RUNNER_LEADER_KEY))) return { success: false, error: 'The bot runner is offline, try again in a moment' };
	} catch (err: any) {
		return { success: false, error: String(err?.message || err) };
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
		redis.publish(RUNNER_COMMAND_CHANNEL, JSON.stringify({ requestId, action, kind, id })).catch((err: any) => {
			settle({ success: false, error: String(err?.message || err) });
		});
	});
}

export function startBotById(botId: number, bot: any): Promise<RunnerResult> {
	return externalRunner ? sendRunnerCommand('start', botKindOf(bot), botId) : startBotInProcess(botId, bot);
}

export function stopBotById(botId: number, bot?: any): Promise<RunnerResult> {
	return externalRunner ? sendRunnerCommand('stop', bot ? botKindOf(bot) : 'official', botId) : stopBotInProcess(botId, bot);
}

export function restartBotById(botId: number, bot: any): Promise<RunnerResult> {
	return externalRunner ? sendRunnerCommand('restart', botKindOf(bot), botId) : restartBotInProcess(botId, bot);
}

export function subscribeBotStatus(kind: BotProcessKind, botNumericId: number, fn: StatusListener): () => void {
	if (!externalRunner) return subscribeBotStatusInProcess(kind, botNumericId, fn);

	const mapKey = botProcessMapKey(kind, botNumericId);
	if (!statusListeners.has(mapKey)) statusListeners.set(mapKey, new Set());
	statusListeners.get(mapKey)!.add(fn);
	void connectRunnerSubscriber();
	return () => statusListeners.get(mapKey)?.delete(fn);
}
