import { spawn, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import db from './db.js';
import logger from './logger.js';
import { getCurrentDateTime, parseMySQLDateTime, getNowInTimezone, getDateTimeFromJSDate } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _root3 = join(__dirname, '..', '..', '..');
const _root4 = join(__dirname, '..', '..', '..', '..');
const projectRoot = existsSync(join(_root3, 'src', 'lib', 'server', 'bots')) ? _root3 : _root4;

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

async function getConnectedSelfbots(officialBotId: number) {
	try {
		const allBots = await db.getAllBots();
		return allBots.filter((b: any) => {
			if (b.bot_type !== 'selfbot') return false;
			if (!b.connect_to) return false;
			return Number(b.connect_to) === officialBotId;
		});
	} catch (_) {
		return [];
	}
}

export async function startBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	try {
		await db.updateBot(botId, { status: 'starting' });
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
		let botPath: string;
		let botScript: string;

		const botsRoot = existsSync(join(projectRoot, 'build-bots', 'bots'))
			? join(projectRoot, 'build-bots', 'bots')
			: join(projectRoot, 'src', 'lib', 'server', 'bots');

		if (bot.bot_type === 'official') {
			botPath = join(botsRoot, 'official-bot');
			botScript = 'officialbot.js';
		} else if (bot.bot_type === 'selfbot') {
			botPath = join(botsRoot, 'self-bot');
			botScript = 'selfbot.js';
		} else {
			return { success: false, error: `Unknown bot type: ${bot.bot_type}` };
		}

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
				BOT_ID: String(botId)
			}
		});

		const processInfo: BotProcessInfo = {
			process: botProcess,
			pid: botProcess.pid ?? null,
			startTime: Date.now(),
			status: 'running'
		};

		botProcesses.set(botId, processInfo);

		let stdoutBuffer = '';
		let stderrBuffer = '';

		botProcess.stdout?.on('data', (data: Buffer) => {
			const output = data.toString();
			stdoutBuffer += output;
			console.log(`[Bot ${botId}] ${output}`);
		});

		botProcess.stderr?.on('data', (data: Buffer) => {
			const output = data.toString();
			stderrBuffer += output;
			console.error(`[Bot ${botId} Error] ${output}`);
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
				await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
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
				await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
			} catch (_) {}
			logger.log(`❌ Failed to start bot ${botId}: ${err.message}`);
		});

		setTimeout(async () => {
			if ((botProcess as any).exitCode !== null) {
				try {
					await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				return;
			}
		}, 500);

		setTimeout(async () => {
			try {
				if ((botProcess as any).exitCode !== null) return;
				if (botProcess.pid) process.kill(botProcess.pid, 0);
				try {
					await db.updateBot(botId, {
						status: 'running',
						process_id: botProcess.pid,
						uptime_started_at: getCurrentDateTime()
					});
					logger.log(`✅ Updated bot ${botId} status to running (PID: ${botProcess.pid})`);
				} catch (_) {}
			} catch (e: any) {
				try {
					await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
			}
		}, 2000);

		logger.log(`✅ Started bot ${botId} (${bot.bot_type}) with PID ${botProcess.pid}`);

		if (bot.bot_type === 'official') {
			const selfbots = await getConnectedSelfbots(botId);
			if (selfbots.length > 0) {
				await Promise.all(
					selfbots.map((selfbot: any) =>
						startBotById(selfbot.id, selfbot).catch((err: Error) => {
							logger.log(`⚠️  Failed to start connected selfbot ${selfbot.id}: ${err.message}`);
						})
					)
				);
			}
		}

		return { success: true, pid: botProcess.pid };
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}

export async function stopBotById(botId: number): Promise<{ success: boolean; error?: string; message?: string }> {
	try {
		await db.updateBot(botId, { status: 'stopping' });
	} catch (_) {}

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
					await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				return { success: true, message: 'Stopped bot process' };
			} catch (_) {
				try {
					await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
				} catch (_) {}
				return { success: false, error: 'Bot is not running' };
			}
		}
		try {
			await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
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
		await db.updateBot(botId, { status: 'stopped', process_id: null, uptime_started_at: null });
	} catch (_) {}

	logger.log(`⏹️  Stopped bot ${botId}`);

	try {
		const bot = await db.getBot(botId);
		if (bot && bot.bot_type === 'official') {
			const selfbots = await getConnectedSelfbots(botId);
			if (selfbots.length > 0) {
				await Promise.all(
					selfbots.map((selfbot: any) =>
						stopBotById(selfbot.id).catch((err: Error) => {
							logger.log(`⚠️  Failed to stop connected selfbot ${selfbot.id}: ${err.message}`);
						})
					)
				);
			}
		}
	} catch (_) {}

	return { success: true };
}

export async function restartBotById(botId: number, bot: any): Promise<{ success: boolean; error?: string; pid?: number }> {
	const stopResult = await stopBotById(botId);
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
					const isOurBot = cmdline.includes('officialbot.js') || cmdline.includes('selfbot.js');
					if (isOurBot) {
						botProcesses.set(bot.id, { process: null, pid: bot.process_id, startTime: null, status: 'running' });
						logger.log(`♻️  Re-adopted bot ${bot.id} (${bot.name}) PID ${bot.process_id}`);
					} else {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					}
				} catch (_) {
					await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
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
