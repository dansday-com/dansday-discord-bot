import { spawn, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import db from './database.js';
import { logger, getCurrentDateTime, parseMySQLDateTimeUtc, getNowUtc, getDateTimeFromJSDate } from './utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isProjectRoot(dir: string): boolean {
	return existsSync(join(dir, 'bots', 'backend', 'bots')) || existsSync(join(dir, 'bots', 'bots')) || existsSync(join(dir, 'src', 'lib', 'backend', 'bots'));
}

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
	spawnId?: number;
}

const RESTART_BASE_DELAY_MS = 35_000;
const RESTART_MAX_DELAY_MS = 5 * 60_000;
const RESTART_MAX_ATTEMPTS = 5;
const RESTART_STABLE_UPTIME_MS = 10 * 60_000;

let spawnCounter = 0;
const manualStopSpawns = new Set<number>();
const restartAttempts = new Map<string, number>();
const restartTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelScheduledRestart(mapKey: string): void {
	const timer = restartTimers.get(mapKey);
	if (timer) {
		clearTimeout(timer);
		restartTimers.delete(mapKey);
	}
}

export type BotProcessKind = 'official' | 'selfbot';

export function botProcessMapKey(kind: BotProcessKind, id: number): string {
	return `${kind}:${id}`;
}

function processKeyForBot(bot: any): string {
	return botProcessMapKey(isSelfbot(bot) ? 'selfbot' : 'official', bot.id);
}

function processKeyForStop(botId: number, bot?: any): string {
	if (bot) return processKeyForBot(bot);
	return botProcessMapKey('official', botId);
}

export const botProcesses = new Map<string, BotProcessInfo>();

export type BotStatusEvent = { status: string; process_id: number | null; uptime_started_at: number | null };
type StatusListener = (e: BotStatusEvent) => void;
const statusListeners = new Map<string, Set<StatusListener>>();

export function subscribeBotStatus(kind: BotProcessKind, botNumericId: number, fn: StatusListener): () => void {
	const mapKey = botProcessMapKey(kind, botNumericId);
	if (!statusListeners.has(mapKey)) statusListeners.set(mapKey, new Set());
	statusListeners.get(mapKey)!.add(fn);
	return () => statusListeners.get(mapKey)?.delete(fn);
}

function emitBotStatus(mapKey: string, status: string, process_id: number | null, uptime_started_at: number | null) {
	const listeners = statusListeners.get(mapKey);
	if (!listeners || listeners.size === 0) return;
	for (const fn of listeners) fn({ status, process_id, uptime_started_at });
}

function isSelfbot(bot: any): boolean {
	return !!bot && !('secret_key' in bot);
}

async function updateBotStatus(bot: any, data: { status: string; process_id?: number | null; uptime_started_at?: any }) {
	if (isSelfbot(bot)) {
		await db.updateSelfbot(bot.id, data);
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

function isSelfbotProcessAlive(sb: any): boolean {
	const mapKey = botProcessMapKey('selfbot', sb.id);
	const info = botProcesses.get(mapKey);
	if (info?.process && !info.process.killed && (info.process as any).exitCode === null) return true;
	if (info?.pid) {
		try {
			process.kill(info.pid, 0);
			return true;
		} catch (_) {}
	}
	return false;
}

function startConnectedSelfbotsInBackground(selfbots: any[], officialBotId: number): void {
	const eligible = (selfbots || []).filter((sb: any) => typeof sb.token === 'string' && sb.token.trim() !== '' && !isSelfbotProcessAlive(sb));
	if (eligible.length === 0) return;
	logger.log(`🔗 Starting ${eligible.length} selfbot(s) with official bot ${officialBotId}`);
	Promise.allSettled(eligible.map((sb: any) => startBotById(sb.id, sb))).then((results) => {
		for (let i = 0; i < results.length; i++) {
			const sb = eligible[i];
			const r = results[i];
			if (r.status === 'rejected') {
				logger.log(`⚠️  Selfbot ${sb.id} (${sb.name ?? 'unnamed'}) start failed: ${String(r.reason)}`);
			} else if (!r.value.success) {
				logger.log(`⚠️  Selfbot ${sb.id} (${sb.name ?? 'unnamed'}) did not start: ${r.value.error ?? 'unknown error'}`);
			}
		}
	});
}

function isOfficialProcessAlive(bot: any): boolean {
	const info = botProcesses.get(botProcessMapKey('official', bot.id));
	if (info?.process && !info.process.killed && (info.process as any).exitCode === null) return true;
	if (info?.pid) {
		try {
			process.kill(info.pid, 0);
			return true;
		} catch (_) {}
	}
	return false;
}

async function anotherOfficialBotStillRunning(officialBotId: number): Promise<boolean> {
	const panelId = await db.getBotPanelId(officialBotId).catch(() => null);
	if (panelId == null) return false;
	const bots = await db.getAllBots(panelId).catch(() => []);
	return (bots || []).some((b: any) => b.id !== officialBotId && isOfficialProcessAlive(b));
}

async function stopConnectedSelfbots(officialBotId: number): Promise<void> {
	if (await anotherOfficialBotStillRunning(officialBotId)) return;
	const selfbots = await getConnectedSelfbots(officialBotId);
	const alive = (selfbots || []).filter((sb: any) => isSelfbotProcessAlive(sb) || sb.status === 'running' || sb.status === 'starting');
	if (alive.length === 0) return;
	logger.log(`🔗 Stopping ${alive.length} selfbot(s) with official bot ${officialBotId}`);
	await Promise.allSettled(alive.map((sb: any) => stopBotById(sb.id, sb)));
}

export async function startBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	const mapKey = processKeyForBot(bot);

	try {
		await updateBotStatus(bot, { status: 'starting' });
		emitBotStatus(mapKey, 'starting', null, null);
	} catch (err: any) {
		logger.log(`⚠️  Failed to update bot status: ${err.message}`);
	}

	const existing = botProcesses.get(mapKey);
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

		const spawnId = ++spawnCounter;
		const spawnedAt = Date.now();

		const processInfo: BotProcessInfo = {
			process: botProcess,
			pid: botProcess.pid ?? null,
			startTime: spawnedAt,
			status: 'running',
			spawnId
		};

		cancelScheduledRestart(mapKey);
		botProcesses.set(mapKey, processInfo);

		botProcess.stdout?.on('data', (data: Buffer) => {
			console.log(`[Bot ${mapKey}] ${data.toString()}`);
		});

		botProcess.stderr?.on('data', (data: Buffer) => {
			console.error(`[Bot ${mapKey} Error] ${data.toString()}`);
		});

		botProcess.on('exit', async (code: number | null, signal: string | null) => {
			const stoppedByHand = manualStopSpawns.delete(spawnId);

			const info = botProcesses.get(mapKey);
			if (info !== undefined && info.spawnId !== spawnId) return;

			if (info) {
				info.status = 'stopped';
				info.pid = null;
				info.startTime = null;
				info.process = null;
			}
			try {
				await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
			emitBotStatus(mapKey, 'stopped', null, null);
			if (code !== 0 && code !== null) {
				logger.log(`❌ Bot ${mapKey} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
			}

			if (!selfbot && !isOfficialProcessAlive(bot)) {
				if (stoppedByHand) await stopConnectedSelfbots(botId).catch(() => {});
				else logger.log(`🔗 Official bot ${mapKey} exited unexpectedly, leaving connected selfbot(s) running`);
			}

			if (stoppedByHand) {
				restartAttempts.delete(mapKey);
				return;
			}

			const crashed = code === null ? signal !== 'SIGINT' && signal !== 'SIGTERM' : code !== 0;
			if (!crashed) {
				restartAttempts.delete(mapKey);
				logger.log(`⏹️  Bot ${mapKey} exited cleanly on its own, not restarting`);
				return;
			}

			if (Date.now() - spawnedAt >= RESTART_STABLE_UPTIME_MS) restartAttempts.delete(mapKey);

			const attempt = (restartAttempts.get(mapKey) ?? 0) + 1;
			if (attempt > RESTART_MAX_ATTEMPTS) {
				logger.log(`🛑 Bot ${mapKey} crashed ${RESTART_MAX_ATTEMPTS} times without staying up, giving up until started by hand`);
				return;
			}
			restartAttempts.set(mapKey, attempt);

			const delay = Math.min(RESTART_BASE_DELAY_MS * Math.pow(2, attempt - 1), RESTART_MAX_DELAY_MS);
			logger.log(`🔁 Bot ${mapKey} crashed, restarting in ${Math.round(delay / 1000)}s (attempt ${attempt}/${RESTART_MAX_ATTEMPTS})`);

			cancelScheduledRestart(mapKey);
			const timer = setTimeout(async () => {
				restartTimers.delete(mapKey);
				if (hasLiveChildProcess(mapKey)) return;
				const fresh = await (selfbot ? db.getSelfbotById(Number(botId)) : db.getBot(botId)).catch(() => null);
				const target = fresh ?? bot;
				const result = await startBotById(botId, target).catch((err: any) => ({ success: false, error: String(err?.message || err) }));
				if (!result.success) logger.log(`⚠️  Auto-restart of ${mapKey} failed: ${result.error ?? 'unknown error'}`);
			}, delay);
			timer.unref?.();
			restartTimers.set(mapKey, timer);
		});

		botProcess.on('error', async (err: Error) => {
			manualStopSpawns.delete(spawnId);
			const info = botProcesses.get(mapKey);
			if (info && info.spawnId !== spawnId) return;
			if (info) {
				info.status = 'stopped';
				info.pid = null;
				info.startTime = null;
				info.process = null;
			}
			try {
				await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
			emitBotStatus(mapKey, 'stopped', null, null);
			logger.log(`❌ Failed to start bot ${mapKey}: ${err.message}`);
		});

		setTimeout(async () => {
			if ((botProcess as any).exitCode !== null) {
				try {
					await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				emitBotStatus(mapKey, 'stopped', null, null);
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
					emitBotStatus(mapKey, 'running', botProcess.pid ?? null, startedAt);
					logger.log(`✅ Updated bot ${mapKey} status to running (PID: ${botProcess.pid})`);
				} catch (_) {}
			} catch (e: any) {
				try {
					await updateBotStatus(bot, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				emitBotStatus(mapKey, 'stopped', null, null);
			}
		}, 2000);

		logger.log(`✅ Started bot ${mapKey} with PID ${botProcess.pid}`);

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
	const mapKey = processKeyForStop(botId, bot);

	cancelScheduledRestart(mapKey);
	restartAttempts.delete(mapKey);
	const stoppingSpawnId = botProcesses.get(mapKey)?.spawnId;
	if (stoppingSpawnId !== undefined) manualStopSpawns.add(stoppingSpawnId);

	if (!bot || !isSelfbot(bot)) {
		await stopConnectedSelfbots(botId).catch(() => {});
	}

	if (bot) {
		try {
			await updateBotStatus(bot, { status: 'stopping' });
			emitBotStatus(mapKey, 'stopping', null, null);
		} catch (_) {}
	} else {
		try {
			await db.updateBot(botId, { status: 'stopping' });
			emitBotStatus(mapKey, 'stopping', null, null);
		} catch (_) {}
	}

	const botInfo = botProcesses.get(mapKey);

	const scriptName = bot && isSelfbot(bot) ? 'selfbot.js' : 'officialbot.js';

	if (!botInfo || !botInfo.process) {
		if (botInfo && botInfo.pid && pidMatchesBotScript(botInfo.pid, scriptName)) {
			const adoptedPid = botInfo.pid;
			try {
				process.kill(adoptedPid, 'SIGINT');
				setTimeout(() => {
					try {
						if (pidMatchesBotScript(adoptedPid, scriptName)) process.kill(adoptedPid, 'SIGKILL');
					} catch (_) {}
				}, 2000);
				botProcesses.delete(mapKey);
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

	const childProcess = botInfo.process;
	const childPid = botInfo.pid;

	if (childProcess && !(childProcess as any).killed && (childProcess as any).exitCode === null) {
		try {
			childProcess.kill('SIGINT');
		} catch (_) {}
	}

	setTimeout(() => {
		if (childProcess && !(childProcess as any).killed && (childProcess as any).exitCode === null) {
			try {
				childProcess.kill('SIGKILL');
			} catch (_) {}
		} else if (childPid && pidMatchesBotScript(childPid, scriptName)) {
			try {
				process.kill(childPid, 'SIGKILL');
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
		emitBotStatus(mapKey, 'stopped', null, null);
	} catch (_) {}

	logger.log(`⏹️  Stopped bot ${mapKey}`);

	return { success: true };
}

function processCmdline(pid: number): string | null {
	try {
		return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
	} catch (_) {}
	try {
		const result = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
		if (result.status === 0 && result.stdout) return result.stdout.trim();
	} catch (_) {}
	return null;
}

function pidMatchesBotScript(pid: number, scriptName: string): boolean {
	const cmdline = processCmdline(pid);
	if (cmdline === null) return false;
	return cmdline.includes(scriptName);
}

async function waitForProcessExit(pid: number, scriptName: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!pidMatchesBotScript(pid, scriptName)) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	if (pidMatchesBotScript(pid, scriptName)) {
		try {
			process.kill(pid, 'SIGKILL');
		} catch (_) {}
	}
}

export async function restartBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	const mapKey = processKeyForBot(bot);
	const scriptName = isSelfbot(bot) ? 'selfbot.js' : 'officialbot.js';
	const candidatePid = botProcesses.get(mapKey)?.pid ?? (bot?.process_id ? Number(bot.process_id) : null);
	const previousPid = candidatePid && Number.isFinite(candidatePid) && pidMatchesBotScript(candidatePid, scriptName) ? candidatePid : null;

	const stopResult = await stopBotById(botId, bot);
	if (!stopResult.success && stopResult.error !== 'Bot is not running') {
		return { success: false, error: `Failed to stop: ${stopResult.error}` };
	}

	if (previousPid) {
		await waitForProcessExit(previousPid, scriptName, 8000);
	} else {
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	return startBotById(botId, bot);
}

function hasLiveChildProcess(mapKey: string): boolean {
	const info = botProcesses.get(mapKey);
	return !!info?.process && !info.process.killed && (info.process as any).exitCode === null;
}

async function verifyOne(kind: BotProcessKind, row: any, scriptName: string): Promise<void> {
	const mapKey = botProcessMapKey(kind, row.id);
	const markStopped = () => updateBotStatus(row, { status: 'stopped', process_id: null, uptime_started_at: null });

	if (hasLiveChildProcess(mapKey)) return;

	if (!row.process_id) {
		await markStopped();
		emitBotStatus(mapKey, 'stopped', null, null);
		return;
	}

	try {
		process.kill(row.process_id, 0);
		if (!pidMatchesBotScript(row.process_id, scriptName)) {
			botProcesses.delete(mapKey);
			await markStopped();
			emitBotStatus(mapKey, 'stopped', null, null);
			return;
		}
		if (botProcesses.get(mapKey)?.pid !== row.process_id) {
			logger.log(`♻️  Re-adopted ${kind} ${row.id} (${row.name}) PID ${row.process_id}`);
		}
		botProcesses.set(mapKey, { process: null, pid: row.process_id, startTime: null, status: 'running' });
	} catch (_) {
		botProcesses.delete(mapKey);
		await markStopped();
		emitBotStatus(mapKey, 'stopped', null, null);
	}
}

export async function verifyBotStatuses() {
	try {
		const bots = await db.getAllBots();
		for (const bot of bots) {
			if (bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') {
				await verifyOne('official', bot, 'officialbot.js');
			}
		}
		const selfbots = await db.getAllSelfbots();
		for (const sb of selfbots) {
			if (sb.status === 'running' || sb.status === 'starting' || sb.status === 'stopping') {
				await verifyOne('selfbot', sb, 'selfbot.js');
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
			const parsed = parseMySQLDateTimeUtc(bot.uptime_started_at);
			startTime = parsed ? getDateTimeFromJSDate(parsed) : null;
		}
		if (startTime && startTime.isValid) {
			const now = getNowUtc();
			return now.diff(startTime, 'milliseconds').milliseconds;
		}
	} catch (_) {}
	return 0;
}
