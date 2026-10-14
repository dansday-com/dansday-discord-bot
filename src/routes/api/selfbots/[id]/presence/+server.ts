import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { presenceFromDbRow, type SelfbotStatusInput } from '$lib/database.js';
import { canManagePanelSelfbots } from '$lib/backend/panelServer.js';
import { attemptSync } from '$lib/utils/attempt.js';
import { HTTP } from '$lib/http.js';

const DISCORD_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
const ACTIVITY_TYPES = ['playing', 'streaming', 'listening', 'watching', 'custom', 'competing'] as const;
const ACTIVITY_TEXT_MAX_LENGTH = 128;

function normalizeHttpUrl(input: string): string | null {
	const t = input.trim();
	if (!t) {
		return null;
	}
	return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function isDiscordStreamingUrl(urlStr: string): boolean {
	const parsed = attemptSync(() => new URL(urlStr));
	if (!parsed.ok) {
		return false;
	}
	const u = parsed.value;
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		return false;
	}
	const h = u.hostname.toLowerCase();
	return h === 'twitch.tv' || h === 'www.twitch.tv' || h === 'youtube.com' || h === 'www.youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}

	const selfbotId = Number(params.id);
	if (!Number.isFinite(selfbotId)) {
		return json({ error: 'Invalid selfbot id' }, { status: HTTP.BAD_REQUEST });
	}

	const selfbot = await db.getSelfbotById(selfbotId);
	if (!selfbot) {
		return json({ error: 'Selfbot not found' }, { status: HTTP.NOT_FOUND });
	}

	if (!(await canManagePanelSelfbots(locals, selfbotId))) {
		return json({ error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const row = await db.getSelfbotStatus(selfbotId);
	return json({ presence: presenceFromDbRow(row) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}

	const selfbotId = Number(params.id);
	if (!Number.isFinite(selfbotId)) {
		return json({ success: false, error: 'Invalid selfbot id' }, { status: HTTP.BAD_REQUEST });
	}

	const selfbot = await db.getSelfbotById(selfbotId);
	if (!selfbot) {
		return json({ success: false, error: 'Selfbot not found' }, { status: HTTP.NOT_FOUND });
	}

	if (!(await canManagePanelSelfbots(locals, selfbotId))) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const { discord_status } = body;
	const { activity_type } = body;
	let activity_name = typeof body.activity_name === 'string' ? body.activity_name : '';
	const rawUrl = body.activity_url === null || body.activity_url === undefined ? '' : String(body.activity_url);
	const activity_state = body.activity_state === null || body.activity_state === undefined || body.activity_state === '' ? null : String(body.activity_state);

	if (typeof discord_status !== 'string' || !DISCORD_STATUSES.includes(discord_status as (typeof DISCORD_STATUSES)[number])) {
		return json({ success: false, error: 'Invalid discord_status' }, { status: HTTP.BAD_REQUEST });
	}
	if (typeof activity_type !== 'string' || !ACTIVITY_TYPES.includes(activity_type as (typeof ACTIVITY_TYPES)[number])) {
		return json({ success: false, error: 'Invalid activity_type' }, { status: HTTP.BAD_REQUEST });
	}

	if (activity_type === 'custom') {
		activity_name = '';
	} else if (activity_name.length > ACTIVITY_TEXT_MAX_LENGTH) {
		return json({ success: false, error: 'activity_name must be at most 128 characters' }, { status: HTTP.BAD_REQUEST });
	}
	if (activity_state && activity_state.length > ACTIVITY_TEXT_MAX_LENGTH) {
		return json({ success: false, error: 'activity_state must be at most 128 characters' }, { status: HTTP.BAD_REQUEST });
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
				{ status: HTTP.BAD_REQUEST }
			);
		}
		if (!isDiscordStreamingUrl(normalized)) {
			return json(
				{
					success: false,
					error: 'Discord only accepts Twitch or YouTube URLs for streaming presence. Use twitch.tv, youtube.com, or youtu.be links.'
				},
				{ status: HTTP.BAD_REQUEST }
			);
		}
		activity_url = normalized;
		if (activity_name.trim() === '') {
			return json({ success: false, error: 'Streaming activity requires an activity name (e.g. stream title)' }, { status: HTTP.BAD_REQUEST });
		}
	}

	const payload: SelfbotStatusInput = {
		discord_status: discord_status as SelfbotStatusInput['discord_status'],
		activity_type: activity_type as SelfbotStatusInput['activity_type'],
		activity_name,
		activity_url,
		activity_state
	};

	const saved = await db.upsertSelfbotStatus(selfbotId, payload);
	return json({ success: true, presence: presenceFromDbRow(saved) });
};
