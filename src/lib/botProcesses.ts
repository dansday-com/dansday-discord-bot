import { spawn, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import db from './database.js';
import { logger, getCurrentDateTime, parseMySQLDateTime, getNowInTimezone, getDateTimeFromJSDate } from './utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isProjectRoot(dir: string): boolean {
	return existsSync(join(dir, 'bots', 'backend', 'bots')) || existsSync(join(dir, 'bots', 'bots')) || existsSync(join(dir, 'src', 'lib', 'backend', 'bots'));
}

/** Repo / image root: `process.cwd()` when running `node build/index.js` from `/app`, else walk up from bundled chunk (e.g. `build/server/chunks`). */
function findProjectRoot(): string {
	if (isProjectRoot(process.cwd())) return process.cwd();

	let dir = __dirname;
	for (let i = 0; i < 24; i++) {
		if (isProjectRoot(dir)) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return process.cwd();
}
const projectRoot = findProjectRoot();

function resolveNodeBin(): string {
	if (existsSync(process.execPath)) return process.execPath;
	const result = spawnSync('which', ['node'], { encoding: 'utf8' });
	const found = result.stdout?.trim();
	if (found && existsSync(found)) return found;
	return 'node';
}

export interface BotProcessInfo {
	process: ReturnType<typeof spawn> | null;
	pid: number | null;
	startTime: number | null;
	status: string;
}

export const botProcesses = new Map<number, BotProcessInfo>();

export type BotStatusEvent = { status: string; process_id: number | null; uptime_started_at: number | null };
type StatusListener = (e: BotStatusEvent) => void;
const statusListeners = new Map<number, Set<StatusListener>>();

export function subscribeBotStatus(botId: number, fn: StatusListener): () => void {
	if (!statusListeners.has(botId)) statusListeners.set(botId, new Set());
	statusListeners.get(botId)!.add(fn);
	return () => statusListeners.get(botId)?.delete(fn);
}

function emitBotStatus(botId: number, status: string, process_id: number | null, uptime_started_at: number | null) {
	const listeners = statusListeners.get(botId);
	if (!listeners || listeners.size === 0) return;
	for (const fn of listeners) fn({ status, process_id, uptime_started_at });
}

function isSelfbot(bot: any): boolean {
	return bot.server_id !== undefined && bot.server_id !== null;
}

async function updateBotStatus(bot: any, data: { status: string; process_id?: number | null; uptime_started_at?: any }) {
	if (isSelfbot(bot)) {
		await db.updateServerBot(bot.id, data);
	} else {
		await db.updateBot(bot.id, data);
	}
}

async function getConnectedSelfbots(officialBotId: number) {
	try {
		return await db.getSelfbotsForOfficialBot(officialBotId);
	} catch (_) {
		return [];
	}
}

/** Start linked selfbots in the background so official bot success is not blocked or undone by selfbot/token failures. */
function startConnectedSelfbotsInBackground(selfbots: any[], officialBotId: number): void {
	if (selfbots.length === 0) return;
	logger.log(`🔗 Scheduling ${selfbots.length} connected selfbot(s) for official bot ${officialBotId} (independent of official process)`);
	Promise.allSettled(selfbots.map((sb: any) => startBotById(sb.id, sb))).then((results) => {
		for (let i = 0; i < results.length; i++) {
			const sb = selfbots[i];
			const r = results[i];
			if (r.status === 'rejected') {
				logger.log(`⚠️  Selfbot ${sb.id} (${sb.name ?? 'unnamed'}) start failed: ${String(r.reason)}`);
			} else if (!r.value.success) {
				logger.log(`⚠️  Selfbot ${sb.id} (${sb.name ?? 'unnamed'}) did not start: ${r.value.error ?? 'unknown error'}`);
			}
		}
	});
}

export async function startBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	try {
		await updateBotStatus(bot, { status: 'starting' });
		emitBotStatus(botId, 'starting', null, null);
	} catch (err: any) {
		logger.log(`⚠️  Failed to update bot status: ${err.message}`);
	}

	const existing = botProcesses.get(botId);
	if (existing && existing.process && !existing.process.killed && (existing.process as any).exitCode === null) {
		return { success: false, error: 'Bot is already running' };
	}

	if (existing && existing.pid) {
		try {
			process.kill(existing.pid, 0);
			return { success: false, error: 'Bot process is already running' };
		} catch (_) {}
	}

	try {
		const botsRoot = existsSync(join(projectRoot, 'bots', 'backend', 'bots'))
			? join(projectRoot, 'bots', 'backend', 'bots')
			: existsSync(join(projectRoot, 'bots', 'bots'))
				? join(projectRoot, 'bots', 'bots')
				: join(projectRoot, 'src', 'lib', 'backend', 'bots');

		const selfbot = isSelfbot(bot);
		const botPath = join(botsRoot, selfbot ? 'self-bot' : 'official-bot');
		const botScript = selfbot ? 'selfbot.js' : 'officialbot.js';
		const scriptPath = join(botPath, botScript);
		const nodeBin = resolveNodeBin();

		const botProcess = spawn(nodeBin, [scriptPath], {
			cwd: botPath,
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false,
			detached: false,
			env: {
				...process.env,
				BOT_TOKEN: bot.token,
				BOT_ID: String(botId),
				BOT_KIND: selfbot ? 'selfbot' : 'official'
			}
		});

		const processInfo: BotProcessInfo = {
			process: botProcess,
			pid: botProcess.pid ?? null,
			startTime: Date.now(),
			status: 'running'
		};

		botProcesses.set(botId, processInfo);

		botProcess.stdout?.on('data', (data: Buffer) => {
			console.log(`[Bot ${botId}] ${data.toString()}`);
		});

		botProcess.stderr?.on('data', (data: Buffer) => {
			console.error(`[Bot ${botId} Error] ${data.toString()}`);
		});

		botProcess.on('exit', async (code: number | null, signal: string | null) => {
			const info = botProcesses.get(botId);
			if (info) {
				info.status = 'stopped';
				info.pid = null;
				info.startTime = null;
				info.process = null;
			}
			try {
				await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
			emitBotStatus(botId, 'stopped', null, null);
			if (code !== 0 && code !== null) {
				logger.log(`❌ Bot ${botId} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
			}
		});

		botProcess.on('error', async (err: Error) => {
			const info = botProcesses.get(botId);
			if (info) {
				info.status = 'stopped';
				info.pid = null;
				info.startTime = null;
				info.process = null;
			}
			try {
				await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
			emitBotStatus(botId, 'stopped', null, null);
			logger.log(`❌ Failed to start bot ${botId}: ${err.message}`);
		});

		setTimeout(async () => {
			if ((botProcess as any).exitCode !== null) {
				try {
					await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				emitBotStatus(botId, 'stopped', null, null);
			}
		}, 500);

		setTimeout(async () => {
			try {
				if ((botProcess as any).exitCode !== null) return;
				if (botProcess.pid) process.kill(botProcess.pid, 0);
				const startedAt = Date.now();
				try {
					await updateBotStatus(bot, {
						status: 'running',
						process_id: botProcess.pid,
						uptime_started_at: getCurrentDateTime()
					});
					emitBotStatus(botId, 'running', botProcess.pid ?? null, startedAt);
					logger.log(`✅ Updated bot ${botId} status to running (PID: ${botProcess.pid})`);
				} catch (_) {}
			} catch (e: any) {
				try {
					await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				emitBotStatus(botId, 'stopped', null, null);
			}
		}, 2000);

		logger.log(`✅ Started bot ${botId} (${selfbot ? 'selfbot' : 'official'}) with PID ${botProcess.pid}`);

		let connectedSelfbotsScheduled = 0;
		if (!selfbot) {
			const linked = await getConnectedSelfbots(botId);
			connectedSelfbotsScheduled = linked.length;
			startConnectedSelfbotsInBackground(linked, botId);
		}

		return {
			success: true,
			pid: botProcess.pid,
			...(!selfbot && connectedSelfbotsScheduled > 0 ? { connected_selfbots_scheduled: connectedSelfbotsScheduled } : {})
		};
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}

export async function stopBotById(botId: number, bot?: any): Promise<{ success: boolean; error?: string; message?: string }> {
	if (bot) {
		try {
			await updateBotStatus(bot, { status: 'stopping' });
			emitBotStatus(botId, 'stopping', null, null);
		} catch (_) {}
	} else {
		try {
			await db.updateBot(botId, { status: 'stopping' });
			emitBotStatus(botId, 'stopping', null, null);
		} catch (_) {}
	}

	const botInfo = botProcesses.get(botId);

	if (!botInfo || !botInfo.process) {
		if (botInfo && botInfo.pid) {
			try {
				process.kill(botInfo.pid, 'SIGINT');
				setTimeout(() => {
					try {
						if (botInfo.pid) process.kill(botInfo.pid, 'SIGKILL');
					} catch (_) {}
				}, 2000);
				botProcesses.delete(botId);
				try {
					if (bot) {
						await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
					} else {
						await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
					}
				} catch (_) {}
				return { success: true, message: 'Stopped bot process' };
			} catch (_) {
				try {
					if (bot) {
						await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
					} else {
						await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
					}
				} catch (_) {}
				return { success: false, error: 'Bot is not running' };
			}
		}
		try {
			if (bot) {
				await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
			} else {
				await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
			}
		} catch (_) {}
		return { success: false, error: 'Bot is not running' };
	}

	if (botInfo.process && !(botInfo.process as any).killed && (botInfo.process as any).exitCode === null) {
		try {
			botInfo.process.kill('SIGINT');
		} catch (_) {}
	}

	setTimeout(() => {
		if (botInfo.process && !(botInfo.process as any).killed && (botInfo.process as any).exitCode === null) {
			try {
				botInfo.process.kill('SIGKILL');
			} catch (_) {}
		}
	}, 2000);

	botInfo.status = 'stopped';
	botInfo.pid = null;
	botInfo.startTime = null;
	botInfo.process = null;

	try {
		if (bot) {
			await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
		} else {
			await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
		}
		emitBotStatus(botId, 'stopped', null, null);
	} catch (_) {}

	logger.log(`⏹️  Stopped bot ${botId}`);

	if (!bot || !isSelfbot(bot)) {
		try {
			const selfbots = await getConnectedSelfbots(botId);
			if (selfbots.length > 0) {
				await Promise.all(
					selfbots.map((sb: any) =>
						stopBotById(sb.id, sb).catch((err: Error) => {
							logger.log(`⚠️  Failed to stop connected selfbot ${sb.id}: ${err.message}`);
						})
					)
				);
			}
		} catch (_) {}
	}

	return { success: true };
}

export async function restartBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	const stopResult = await stopBotById(botId, bot);
	if (!stopResult.success && stopResult.error !== 'Bot is not running') {
		return { success: false, error: `Failed to stop: ${stopResult.error}` };
	}
	await new Promise((resolve) => setTimeout(resolve, 2000));
	return startBotById(botId, bot);
}

export async function verifyBotStatuses() {
	try {
		const bots = await db.getAllBots();
		for (const bot of bots) {
			if (bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') {
				if (!bot.process_id) {
					await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					continue;
				}
				try {
					process.kill(bot.process_id, 0);
					const cmdline = readFileSync(`/proc/${bot.process_id}/cmdline`, 'utf8').replace(/\0/g, ' ');
					if (cmdline.includes('officialbot.js')) {
						botProcesses.set(bot.id, { process: null, pid: bot.process_id, startTime: null, status: 'running' });
						logger.log(`♻️  Re-adopted official bot ${bot.id} (${bot.name}) PID ${bot.process_id}`);
					} else {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					}
				} catch (_) {
					await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
				}
			}
		}
		const selfbots = await db.getAllServerBots();
		for (const sb of selfbots) {
			if (sb.status === 'running' || sb.status === 'starting' || sb.status === 'stopping') {
				if (!sb.process_id) {
					await db.updateServerBot(sb.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					continue;
				}
				try {
					process.kill(sb.process_id, 0);
					const cmdline = readFileSync(`/proc/${sb.process_id}/cmdline`, 'utf8').replace(/\0/g, ' ');
					if (cmdline.includes('selfbot.js')) {
						botProcesses.set(sb.id, { process: null, pid: sb.process_id, startTime: null, status: 'running' });
						logger.log(`♻️  Re-adopted selfbot ${sb.id} (${sb.name}) PID ${sb.process_id}`);
					} else {
						await db.updateServerBot(sb.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					}
				} catch (_) {
					await db.updateServerBot(sb.id, { status: 'stopped', process_id: null, uptime_started_at: null });
				}
			}
		}
	} catch (error: any) {
		logger.log(`⚠️  Error verifying bot statuses: ${error.message}`);
	}
}

export function getBotUptimeMs(bot: any): number {
	if (bot.status !== 'running' || !bot.uptime_started_at) return 0;
	try {
		let startTime: any;
		if (bot.uptime_started_at instanceof Date) {
			startTime = getDateTimeFromJSDate(bot.uptime_started_at);
		} else {
			const parsed = parseMySQLDateTime(bot.uptime_started_at);
			startTime = parsed ? getDateTimeFromJSDate(parsed) : null;
		}
		if (startTime && startTime.isValid) {
			const now = getNowInTimezone();
			return now.diff(startTime, 'milliseconds').milliseconds;
		}
	} catch (_) {}
	return 0;
}
