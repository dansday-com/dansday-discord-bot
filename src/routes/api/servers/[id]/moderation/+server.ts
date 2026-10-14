import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/backend/panelServer.js';
import { resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { guardMemberAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { HTTP } from '$lib/http.js';
import { MODERATION_REASON_MAX_LENGTH } from '$lib/moderation-rules.js';

const LOG_REASON_MAX_LENGTH = 500;
const ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns', 'edit_reason'];

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

type ModerationBody = Record<string, unknown> | null;
type CaseRow = NonNullable<Awaited<ReturnType<typeof db.getModerationCase>>>;
type ServerRow = NonNullable<Awaited<ReturnType<typeof db.getServer>>>;
type ActionRequest = { serverId: number; action: string; body: ModerationBody; targetDiscordId: string | null };

async function editCaseReason(locals: App.Locals, serverId: number, { caseRow, body }: { caseRow: CaseRow | null; body: ModerationBody }) {
	if (!caseRow) {
		return json({ ok: false, error: 'Case not found' }, { status: HTTP.NOT_FOUND });
	}
	const reason =
		String(body?.reason ?? '')
			.trim()
			.slice(0, MODERATION_REASON_MAX_LENGTH) || null;
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
	const { body, targetDiscordId } = request;
	await db
		.createServerPanelLog(request.serverId, panelActorIds(locals), {
			action: 'moderation',
			changes: [
				...(targetDiscordId ? [{ key: 'member', before: null, after: targetDiscordId }] : []),
				{ key: 'action', before: null, after: request.action },
				...(body?.reason ? [{ key: 'reason', before: null, after: String(body.reason).slice(0, LOG_REASON_MAX_LENGTH) }] : []),
				...(body?.duration_seconds ? [{ key: 'duration seconds', before: null, after: String(Number(body.duration_seconds)) }] : []),
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
	const { body, action } = request;
	const result = await postBotWebhook(bot, {
		type: 'moderation_action',
		guild_id: server.discord_server_id,
		action,
		target_id: body?.target_id ? String(body.target_id) : undefined,
		case_number: body?.case_number ? Number(body.case_number) : null,
		reason: body?.reason ? String(body.reason).slice(0, MODERATION_REASON_MAX_LENGTH) : null,
		duration_seconds: body?.duration_seconds ? Number(body.duration_seconds) : null,
		staff_name: (locals.user.authenticated && locals.user.username) || 'Panel',
		source: 'panel'
	});
	if (result.status === HTTP.BAD_GATEWAY) {
		return json({ ok: false, error: 'Bot is unreachable' }, { status: HTTP.BAD_GATEWAY });
	}
	const payload = result.body ?? {};
	if (payload.ok) {
		await logModerationAction(locals, request, payload.case_number ?? body?.case_number ?? null);
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

	const body: ModerationBody = await request.json().catch(() => null);
	const action = String(body?.action ?? '');
	if (!ACTIONS.includes(action)) {
		return json({ ok: false, error: 'Unknown action' }, { status: HTTP.BAD_REQUEST });
	}

	const server = await db.getServer(serverId);
	if (!server) {
		return json({ ok: false, error: 'Server not found' }, { status: HTTP.NOT_FOUND });
	}

	const caseRow = !body?.target_id && body?.case_number ? await db.getModerationCase(serverId, Number(body.case_number)).catch(() => null) : null;
	const targetDiscordId = body?.target_id ? String(body.target_id) : caseRow?.discord_member_id ? String(caseRow.discord_member_id) : null;
	const denied = targetDiscordId ? await guardMemberAction(locals, serverId, targetDiscordId) : null;
	if (denied) {
		return denied;
	}

	if (action === 'edit_reason') {
		return editCaseReason(locals, serverId, { caseRow, body });
	}
	return sendModerationAction(locals, server, { serverId, action, body, targetDiscordId });
};
