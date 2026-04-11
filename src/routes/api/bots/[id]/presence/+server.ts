import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { request as httpRequest } from 'http';
import db, { DEFAULT_BOT_PRESENCE, type BotStatusInput } from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

function pushPresenceToRunningOfficialBot(bot: { status?: string | null; port?: number | null; secret_key?: string | null }): void {
	if (bot.status !== 'running' || !bot.port || !bot.secret_key) return;
	const payload = JSON.stringify({ type: 'apply_presence' });
	const req = httpRequest(
		{
			hostname: 'localhost',
			port: bot.port,
			path: '/',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(payload),
				'X-Secret-Key': bot.secret_key
			},
			timeout: 10000
		},
		(res) => {
			res.resume();
		}
	);
	req.on('error', () => {});
	req.on('timeout', () => {
		req.destroy();
	});
	req.write(payload);
	req.end();
}

const DISCORD_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
const ACTIVITY_TYPES = ['playing', 'streaming', 'listening', 'watching', 'custom', 'competing'] as const;

function normalizeHttpUrl(input: string): string | null {
	const t = input.trim();
	if (!t) return null;
	return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function isDiscordStreamingUrl(urlStr: string): boolean {
	let u: URL;
	try {
		u = new URL(urlStr);
	} catch {
		return false;
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
	const h = u.hostname.toLowerCase();
	return h === 'twitch.tv' || h === 'www.twitch.tv' || h === 'youtube.com' || h === 'www.youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
}

type StatusRow = {
	discord_status: string;
	activity_type: string;
	activity_name: string | null;
	activity_url: string | null;
	activity_state: string | null;
};

function rowToPayload(row: StatusRow): BotStatusInput {
	return {
		discord_status: row.discord_status as BotStatusInput['discord_status'],
		activity_type: row.activity_type as BotStatusInput['activity_type'],
		activity_name: row.activity_name ?? '',
		activity_url: row.activity_url ?? null,
		activity_state: row.activity_state ?? null
	};
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) {
		return json({ error: 'Invalid bot id' }, { status: 400 });
	}

	const bot = await db.getBot(botId);
	if (!bot) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}

	if (!(await accountOwnsBot(locals, botId))) {
		return json({ error: 'Access denied' }, { status: 403 });
	}

	const row = await db.getBotStatusByBotId(botId);
	return json({ presence: row ? rowToPayload(row) : DEFAULT_BOT_PRESENCE });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) {
		return json({ success: false, error: 'Invalid bot id' }, { status: 400 });
	}

	const bot = await db.getBot(botId);
	if (!bot) {
		return json({ success: false, error: 'Bot not found' }, { status: 404 });
	}

	if (!(await accountOwnsBot(locals, botId))) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const discord_status = body.discord_status;
	const activity_type = body.activity_type;
	let activity_name = typeof body.activity_name === 'string' ? body.activity_name : '';
	const rawUrl = body.activity_url === null || body.activity_url === undefined ? '' : String(body.activity_url);
	const activity_state = body.activity_state === null || body.activity_state === undefined || body.activity_state === '' ? null : String(body.activity_state);

	if (typeof discord_status !== 'string' || !DISCORD_STATUSES.includes(discord_status as (typeof DISCORD_STATUSES)[number])) {
		return json({ success: false, error: 'Invalid discord_status' }, { status: 400 });
	}
	if (typeof activity_type !== 'string' || !ACTIVITY_TYPES.includes(activity_type as (typeof ACTIVITY_TYPES)[number])) {
		return json({ success: false, error: 'Invalid activity_type' }, { status: 400 });
	}

	if (activity_type === 'custom') {
		activity_name = '';
	} else if (activity_name.length > 128) {
		return json({ success: false, error: 'activity_name must be at most 128 characters' }, { status: 400 });
	}
	if (activity_state && activity_state.length > 128) {
		return json({ success: false, error: 'activity_state must be at most 128 characters' }, { status: 400 });
	}

	let activity_url: string | null = null;
	if (activity_type === 'streaming') {
		const normalized = normalizeHttpUrl(rawUrl);
		if (!normalized) {
			return json(
				{
					success: false,
					error: 'Streaming requires a Twitch or YouTube URL (e.g. https://twitch.tv/yourchannel). Plain https:// is added if missing.'
				},
				{ status: 400 }
			);
		}
		if (!isDiscordStreamingUrl(normalized)) {
			return json(
				{
					success: false,
					error: 'Discord only accepts Twitch or YouTube URLs for streaming presence. Use twitch.tv, youtube.com, or youtu.be links.'
				},
				{ status: 400 }
			);
		}
		activity_url = normalized;
		if (activity_name.trim() === '') {
			return json({ success: false, error: 'Streaming activity requires an activity name (e.g. stream title)' }, { status: 400 });
		}
	}

	const payload: BotStatusInput = {
		discord_status: discord_status as BotStatusInput['discord_status'],
		activity_type: activity_type as BotStatusInput['activity_type'],
		activity_name,
		activity_url,
		activity_state
	};

	const saved = await db.upsertBotStatus(botId, payload);
	pushPresenceToRunningOfficialBot(bot);
	return json({ success: true, presence: saved ? rowToPayload(saved) : payload });
};
