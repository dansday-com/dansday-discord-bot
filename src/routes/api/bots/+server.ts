import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { hasLostBotProcess } from '$lib/botControl.js';

type NewBot = { name: string | null; token: string; application_id: string; bot_icon: string | null; port: number; secret_key: string };

function textField(body: Record<string, unknown>, field: string): string {
	const value = body[field];
	return typeof value === 'string' ? value : '';
}

function readNewBot(body: Record<string, unknown>): { error: string } | { value: NewBot } {
	const token = textField(body, 'token');
	const applicationId = textField(body, 'application_id');
	const secretKey = textField(body, 'secret_key');
	const port = Number(body.port);
	if (!token) {
		return { error: 'Token is required' };
	}
	if (!applicationId) {
		return { error: 'Application ID is required' };
	}
	if (!Number.isInteger(port) || port <= 0) {
		return { error: 'Port is required' };
	}
	if (!secretKey) {
		return { error: 'Secret Key is required' };
	}
	return {
		value: {
			name: textField(body, 'name') || null,
			token,
			application_id: applicationId,
			bot_icon: textField(body, 'bot_icon') || null,
			port,
			secret_key: secretKey
		}
	};
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ error: 'Admin access required' }, { status: HTTP.FORBIDDEN });
	}

	try {
		const bots = await db.getAllBots(locals.user.panel_id);

		const botsWithDetails = await Promise.all(
			bots.map(async (bot) => {
				if (hasLostBotProcess(bot)) {
					await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
					bot.status = 'stopped';
					bot.process_id = null;
					bot.uptime_started_at = null;
				}

				const botData: Record<string, unknown> = {
					id: bot.id,
					name: bot.name,
					bot_icon: bot.bot_icon,
					port: bot.port,
					application_id: bot.application_id,
					status: bot.status || 'stopped',
					process_id: bot.process_id || null,
					uptime_started_at: bot.uptime_started_at || null,
					created_at: bot.created_at,
					updated_at: bot.updated_at
				};

				botData.uptime_ms = getBotUptimeMs(botData);
				return botData;
			})
		);

		return json(botsWithDetails);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_source !== 'accounts') {
		return json({ success: false, error: 'Admin access required' }, { status: HTTP.FORBIDDEN });
	}

	try {
		const account = await db.getAccountById(locals.user.account_id);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: HTTP.UNAUTHORIZED });
		}

		const parsed = readNewBot(await readJsonObject(request));
		if ('error' in parsed) {
			return json({ success: false, error: parsed.error }, { status: HTTP.BAD_REQUEST });
		}
		const { name, port } = parsed.value;

		const existingBots = await db.getAllBots();
		const isPortInUse = existingBots.some((b) => b.port === port);
		if (isPortInUse) {
			return json({ success: false, error: `Port ${port} is already in use by another official bot` }, { status: HTTP.BAD_REQUEST });
		}

		const panel = await db.getPanel(account.id);
		if (!panel) {
			return json({ success: false, error: 'Panel not found for this account' }, { status: HTTP.INTERNAL_ERROR });
		}

		const bot = await db.createBot({ ...parsed.value, name: name || 'Bot', panel_id: panel.id });

		logger.log(`${locals.user.username} added official bot: "${name || 'Bot'}" (ID: ${bot.id})`);

		return json({ success: true, bot });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
