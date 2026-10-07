import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, canEditServerSettings } from '$lib/frontend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { postBotWebhook, resolveActiveBotForServer } from '$lib/frontend/public/items/index.js';
import { REWARD_KEYS, rewardsFromSettings, type RewardRules } from '$lib/rewards.js';

const RULE_LABELS: Record<keyof RewardRules, string> = {
	rewards: 'rewards',
	keep: 'when a level drops',
	stack: 'lower rewards'
};

function describe(rules: RewardRules, key: keyof RewardRules): string {
	if (key === 'rewards') return rules.rewards.map((r) => `Level ${r.level} → ${r.role_id}`).join('; ') || 'None';
	if (key === 'keep') return rules.keep ? 'Keep the role' : 'Take the role back';
	return rules.stack ? 'Keep them' : 'Replace with the newest';
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canEditServerSettings(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	const server = await db.getServer(serverId);
	if (!server) return json({ ok: false, error: 'Server not found' }, { status: 404 });

	const body = await request.json().catch(() => null);
	const roles = await db.getRoles(serverId).catch(() => []);
	const known = new Set((roles as any[]).map((r) => String(r.discord_role_id)).filter((id) => id !== String((server as any).discord_server_id)));
	const rules = rewardsFromSettings({
		[REWARD_KEYS.rewards]: Array.isArray(body?.rewards) ? body.rewards.filter((r: any) => known.has(String(r?.role_id ?? ''))) : [],
		[REWARD_KEYS.keep]: body?.keep !== false,
		[REWARD_KEYS.stack]: body?.stack !== false
	});

	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	const existing = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
	const previous = rewardsFromSettings(existing);
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.main, {
		...existing,
		[REWARD_KEYS.rewards]: rules.rewards,
		[REWARD_KEYS.keep]: rules.keep,
		[REWARD_KEYS.stack]: rules.stack
	});

	const changes = (Object.keys(REWARD_KEYS) as (keyof typeof REWARD_KEYS)[])
		.filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(rules[key]))
		.map((key) => ({ key: RULE_LABELS[key], before: describe(previous, key), after: describe(rules, key) }));
	if (changes.length > 0) await db.createServerPanelLog(serverId, panelActorIds(locals), 'rewards', changes).catch(() => null);

	const bot = await resolveActiveBotForServer(server);
	if (!bot || bot.status !== 'running' || !bot.port || !bot.secret_key) return json({ ok: true, rules, synced: false, blocked: [] });
	const result = await postBotWebhook(bot, { type: 'sync_rewards', guild_id: (server as any).discord_server_id });
	const synced = result.status === 200 && result.body?.ok === true;
	return json({ ok: true, rules, synced, blocked: synced && Array.isArray(result.body.blocked) ? result.body.blocked : [] });
};
