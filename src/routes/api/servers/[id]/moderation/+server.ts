import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/backend/panelServer.js';
import { resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { guardMemberAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { MODERATION_REASON_MAX_LENGTH } from '$lib/moderation-rules.js';

const LOG_REASON_MAX_LENGTH = 500;
const ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns', 'edit_reason'];
const TEXT_FIELDS = ['action', 'target_id', 'reason'] as const;
const NUMBER_FIELDS = ['case_number', 'duration_seconds'] as const;

type ModerationInput = { action: string; targetId: string | null; caseNumber: number | null; reason: string; durationSeconds: number | null };
type CaseRow = NonNullable<Awaited<ReturnType<typeof db.getModerationCase>>>;
type ServerRow = NonNullable<Awaited<ReturnType<typeof db.getServer>>>;
type ActionRequest = { serverId: number; action: string; input: ModerationInput; targetDiscordId: string | null };

function isText(value: unknown): value is string | number {
	return typeof value === 'string' || typeof value === 'number';
}

function invalidModerationField(body: Record<string, unknown>): string | null {
	const badText = TEXT_FIELDS.find((key) => body[key] != null && !isText(body[key]));
	if (badText) {
		return `${badText} must be text`;
	}
	const badNumber = NUMBER_FIELDS.find((key) => body[key] != null && !(isText(body[key]) && Number.isFinite(Number(body[key]))));
	return badNumber ? `${badNumber} must be a number` : null;
}

function moderationInput(body: Record<string, unknown>): ModerationInput {
	const text = (value: unknown) => (isText(value) ? String(value) : '');
	const amount = (value: unknown) => (isText(value) && value ? Number(value) : null);
	return {
		action: text(body.action),
		targetId: text(body.target_id) || null,
		caseNumber: amount(body.case_number),
		reason: text(body.reason),
		durationSeconds: amount(body.duration_seconds)
	};
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ ok: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ ok: false, error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST });
	}
	if (!(await canUseEmbedBuilder(locals, serverId))) {
		return json({ ok: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const discordId = String(url.searchParams.get('member') ?? '').trim();
	if (!discordId) {
		return json({ ok: false, error: 'member is required' }, { status: HTTP.BAD_REQUEST });
	}
	const cases = await db.getMemberModerationCases(serverId, discordId);
	return json({
		ok: true,
		cases: cases.map((c) => ({
			id: String(c.id),
			case_number: Number(c.case_number),
			action: String(c.action),
			reason: c.reason ?? null,
			duration_seconds: c.duration_seconds == null ? null : Number(c.duration_seconds),
			expires_at: c.expires_at ?? null,
			active: Boolean(Number(c.active)),
			revoked_at: c.revoked_at ?? null,
			source: String(c.source),
			created_at: c.created_at,
			staff_name: c.staff_name ?? null
		}))
	});
};

async function editCaseReason(locals: App.Locals, serverId: number, { caseRow, input }: { caseRow: CaseRow | null; input: ModerationInput }) {
	if (!caseRow) {
		return json({ ok: false, error: 'Case not found' }, { status: HTTP.NOT_FOUND });
	}
	const reason = input.reason.trim().slice(0, MODERATION_REASON_MAX_LENGTH) || null;
	const updated = await db.updateModerationCaseReason(serverId, Number(caseRow.case_number), reason);
	if (!updated) {
		return json({ ok: false, error: 'Case not found' }, { status: HTTP.NOT_FOUND });
	}
	await db
		.createServerPanelLog(serverId, panelActorIds(locals), {
			action: 'moderation',
			changes: [
				{ key: 'member', before: null, after: updated.discord_member_id },
				{ key: 'case', before: null, after: `#${caseRow.case_number}` },
				{ key: 'reason', before: updated.before, after: reason }
			]
		})
		.catch(() => null);
	return json({ ok: true });
}

async function runningBot(server: ServerRow) {
	const bot = await resolveActiveBotForServer(server);
	if (!bot) {
		return json({ ok: false, error: 'Bot not found' }, { status: HTTP.NOT_FOUND });
	}
	if (bot.status !== 'running') {
		return json({ ok: false, error: 'Bot is not running' }, { status: HTTP.BAD_REQUEST });
	}
	if (!bot.port || !bot.secret_key) {
		return json({ ok: false, error: 'Bot webhook not configured' }, { status: HTTP.BAD_REQUEST });
	}
	return bot;
}

async function logModerationAction(locals: App.Locals, request: ActionRequest, caseNumber: unknown) {
	const { input, targetDiscordId } = request;
	await db
		.createServerPanelLog(request.serverId, panelActorIds(locals), {
			action: 'moderation',
			changes: [
				...(targetDiscordId ? [{ key: 'member', before: null, after: targetDiscordId }] : []),
				{ key: 'action', before: null, after: request.action },
				...(input.reason ? [{ key: 'reason', before: null, after: input.reason.slice(0, LOG_REASON_MAX_LENGTH) }] : []),
				...(input.durationSeconds ? [{ key: 'duration seconds', before: null, after: String(input.durationSeconds) }] : []),
				...(caseNumber ? [{ key: 'case', before: null, after: `#${caseNumber}` }] : [])
			]
		})
		.catch(() => null);
}

async function sendModerationAction(locals: App.Locals, server: ServerRow, request: ActionRequest) {
	const bot = await runningBot(server);
	if (bot instanceof Response) {
		return bot;
	}
	const { input, action } = request;
	const result = await postBotWebhook(bot, {
		type: 'moderation_action',
		guild_id: server.discord_server_id,
		action,
		target_id: input.targetId ?? undefined,
		case_number: input.caseNumber,
		reason: input.reason ? input.reason.slice(0, MODERATION_REASON_MAX_LENGTH) : null,
		duration_seconds: input.durationSeconds,
		staff_name: (locals.user.authenticated && locals.user.username) || 'Panel',
		source: 'panel'
	});
	if (result.status === HTTP.BAD_GATEWAY) {
		return json({ ok: false, error: 'Bot is unreachable' }, { status: HTTP.BAD_GATEWAY });
	}
	const payload = result.body ?? {};
	if (payload.ok) {
		await logModerationAction(locals, request, payload.case_number ?? input.caseNumber);
	}
	return json(payload.ok ? payload : { ok: false, error: payload.error || 'Moderation action failed' }, {
		status: payload.ok ? HTTP.OK : result.status || HTTP.BAD_REQUEST
	});
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ ok: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ ok: false, error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST });
	}
	if (!(await canUseEmbedBuilder(locals, serverId))) {
		return json({ ok: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body = await readJsonObject(request);
	const invalid = invalidModerationField(body);
	if (invalid) {
		return json({ ok: false, error: invalid }, { status: HTTP.BAD_REQUEST });
	}
	const input = moderationInput(body);
	const { action } = input;
	if (!ACTIONS.includes(action)) {
		return json({ ok: false, error: 'Unknown action' }, { status: HTTP.BAD_REQUEST });
	}

	const server = await db.getServer(serverId);
	if (!server) {
		return json({ ok: false, error: 'Server not found' }, { status: HTTP.NOT_FOUND });
	}

	const caseRow = !input.targetId && input.caseNumber ? await db.getModerationCase(serverId, input.caseNumber).catch(() => null) : null;
	const targetDiscordId = input.targetId ?? (caseRow?.discord_member_id ? String(caseRow.discord_member_id) : null);
	const denied = targetDiscordId ? await guardMemberAction(locals, serverId, targetDiscordId) : null;
	if (denied) {
		return denied;
	}

	if (action === 'edit_reason') {
		return editCaseReason(locals, serverId, { caseRow, input });
	}
	return sendModerationAction(locals, server, { serverId, action, input, targetDiscordId });
};
