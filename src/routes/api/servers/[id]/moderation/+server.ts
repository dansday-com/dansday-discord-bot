import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/frontend/panelServer.js';
import { postBotWebhook, resolveActiveBotForServer } from '$lib/frontend/public/items/index.js';
import { guardMemberAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';

const ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns'];

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canUseEmbedBuilder(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json().catch(() => null);
	const action = String(body?.action ?? '');
	if (!ACTIONS.includes(action)) return json({ ok: false, error: 'Unknown action' }, { status: 400 });

	const server = await db.getServer(serverId);
	if (!server) return json({ ok: false, error: 'Server not found' }, { status: 404 });

	const caseRow = !body?.target_id && body?.case_number ? await db.getModerationCase(serverId, Number(body.case_number)).catch(() => null) : null;
	const targetDiscordId = body?.target_id ? String(body.target_id) : caseRow?.discord_member_id ? String(caseRow.discord_member_id) : null;
	if (targetDiscordId) {
		const denied = await guardMemberAction(locals, serverId, targetDiscordId);
		if (denied) return denied;
	}

	const bot = await resolveActiveBotForServer(server);
	if (!bot) return json({ ok: false, error: 'Bot not found' }, { status: 404 });
	if (bot.status !== 'running') return json({ ok: false, error: 'Bot is not running' }, { status: 400 });
	if (!bot.port || !bot.secret_key) return json({ ok: false, error: 'Bot webhook not configured' }, { status: 400 });

	const result = await postBotWebhook(bot, {
		type: 'moderation_action',
		guild_id: (server as any).discord_server_id,
		action,
		target_id: body?.target_id ? String(body.target_id) : undefined,
		case_number: body?.case_number ? Number(body.case_number) : null,
		reason: body?.reason ? String(body.reason).slice(0, 1000) : null,
		duration_seconds: body?.duration_seconds ? Number(body.duration_seconds) : null,
		staff_name: (locals.user as any).username ?? 'Panel',
		source: 'panel'
	});

	if (result.status === 502) return json({ ok: false, error: 'Bot is unreachable' }, { status: 502 });
	const payload = result.body ?? {};
	if (payload.ok) {
		const caseNumber = payload.case_number ?? body?.case_number ?? null;
		await db
			.createServerPanelLog(serverId, panelActorIds(locals), 'moderation', [
				...(targetDiscordId ? [{ key: 'member', before: null, after: targetDiscordId }] : []),
				{ key: 'action', before: null, after: action },
				...(body?.reason ? [{ key: 'reason', before: null, after: String(body.reason).slice(0, 500) }] : []),
				...(body?.duration_seconds ? [{ key: 'duration seconds', before: null, after: String(Number(body.duration_seconds)) }] : []),
				...(caseNumber ? [{ key: 'case', before: null, after: `#${caseNumber}` }] : [])
			])
			.catch(() => null);
	}
	return json(payload.ok ? payload : { ok: false, error: payload.error || 'Moderation action failed' }, { status: payload.ok ? 200 : result.status || 400 });
};
