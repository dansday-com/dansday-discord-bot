import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { DEFAULT_BOT_PRESENCE, type BotStatusInput } from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const DISCORD_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
const ACTIVITY_TYPES = ['playing', 'streaming', 'listening', 'watching', 'custom', 'competing'] as const;

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
	const activity_name = typeof body.activity_name === 'string' ? body.activity_name : '';
	const activity_url = body.activity_url === null || body.activity_url === undefined ? null : String(body.activity_url);
	const activity_state = body.activity_state === null || body.activity_state === undefined || body.activity_state === '' ? null : String(body.activity_state);

	if (typeof discord_status !== 'string' || !DISCORD_STATUSES.includes(discord_status as (typeof DISCORD_STATUSES)[number])) {
		return json({ success: false, error: 'Invalid discord_status' }, { status: 400 });
	}
	if (typeof activity_type !== 'string' || !ACTIVITY_TYPES.includes(activity_type as (typeof ACTIVITY_TYPES)[number])) {
		return json({ success: false, error: 'Invalid activity_type' }, { status: 400 });
	}
	if (activity_name.length > 128) {
		return json({ success: false, error: 'activity_name must be at most 128 characters' }, { status: 400 });
	}
	if (activity_state && activity_state.length > 128) {
		return json({ success: false, error: 'activity_state must be at most 128 characters' }, { status: 400 });
	}
	if (activity_type === 'streaming' && activity_name.trim() !== '') {
		if (!activity_url || activity_url === '') {
			return json({ success: false, error: 'Streaming activity requires a stream URL' }, { status: 400 });
		}
		if (!/^https?:\/\//i.test(activity_url)) {
			return json({ success: false, error: 'Streaming activity requires a valid http(s) URL' }, { status: 400 });
		}
	}

	const payload: BotStatusInput = {
		discord_status: discord_status as BotStatusInput['discord_status'],
		activity_type: activity_type as BotStatusInput['activity_type'],
		activity_name,
		activity_url: activity_url === '' ? null : activity_url,
		activity_state
	};

	const saved = await db.upsertBotStatus(botId, payload);
	return json({ success: true, presence: saved ? rowToPayload(saved) : payload });
};
