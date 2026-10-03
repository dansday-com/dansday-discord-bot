import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/frontend/panelServer.js';
import { postBotWebhook, resolveActiveBotForServer } from '$lib/frontend/public/items/index.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { TIER_DENIED, canActOn, panelActorOf, type MemberTier } from '$lib/panelHierarchy.js';

const ACTIONS = ['role_add', 'role_remove'];
const MAX_SELECTED = 5000;

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canUseEmbedBuilder(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json().catch(() => null);
	const action = String(body?.action ?? '');
	if (!ACTIONS.includes(action)) return json({ ok: false, error: 'Unknown action' }, { status: 400 });

	const roleId = String(body?.role_id ?? '').trim();
	const targetIds = Array.isArray(body?.target_ids) ? [...new Set((body.target_ids as unknown[]).map(String).filter((id) => /^\d{15,25}$/.test(id)))] : [];
	if (!roleId) return json({ ok: false, error: 'Pick a role' }, { status: 400 });
	if (targetIds.length === 0 || targetIds.length > MAX_SELECTED)
		return json({ ok: false, error: `Select between 1 and ${MAX_SELECTED} members` }, { status: 400 });

	const actor = panelActorOf(locals.user);
	const { staffRoleIds, adminRoleIds, tiers } = await db.getMemberTierMap(serverId);
	const roleTier: MemberTier = adminRoleIds.includes(roleId) ? 'owner' : staffRoleIds.includes(roleId) ? 'staff' : 'member';
	if (!canActOn(actor, roleTier)) return json({ ok: false, error: actor ? TIER_DENIED[actor] : 'Access denied' }, { status: 403 });
	const skipIds = Object.entries(tiers)
		.filter(([, tier]) => !canActOn(actor, tier))
		.map(([id]) => id);

	const server = await db.getServer(serverId);
	if (!server) return json({ ok: false, error: 'Server not found' }, { status: 404 });
	const bot = await resolveActiveBotForServer(server);
	if (!bot) return json({ ok: false, error: 'Bot not found' }, { status: 404 });
	if (bot.status !== 'running') return json({ ok: false, error: 'Bot is not running' }, { status: 400 });
	if (!bot.port || !bot.secret_key) return json({ ok: false, error: 'Bot webhook not configured' }, { status: 400 });

	const result = await postBotWebhook(bot, {
		type: 'moderation_bulk',
		guild_id: (server as any).discord_server_id,
		action,
		role_id: roleId,
		target_ids: targetIds,
		skip_ids: skipIds,
		staff_name: (locals.user as any).username ?? 'Panel',
		source: 'panel'
	});

	if (result.status === 502) return json({ ok: false, error: 'Bot is unreachable' }, { status: 502 });
	const payload = result.body ?? {};
	if (payload.ok) {
		await db
			.createServerPanelLog(serverId, panelActorIds(locals), 'moderation_bulk', [
				{ key: 'action', before: null, after: action },
				{ key: 'role', before: null, after: roleId },
				{ key: 'members', before: null, after: String(payload.queued ?? 0) }
			])
			.catch(() => null);
	}
	return json(payload.ok ? payload : { ok: false, error: payload.error || 'Bulk action failed' }, { status: payload.ok ? 200 : result.status || 400 });
};
