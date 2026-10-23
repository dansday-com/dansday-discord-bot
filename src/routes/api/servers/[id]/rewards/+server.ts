import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, canEditServerSettings } from '$lib/backend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { REWARD_KEYS, normalizeRewardDrafts, rewardGoalLabel, rewardRuleFlags, type Reward, type RewardDraft } from '$lib/rewards.js';
import { removeRewardImage, rewardImageBelongsTo } from '$lib/backend/storage/rewards.js';
import { HTTP, readJsonObject } from '$lib/http.js';

function describe(rewards: (Reward | RewardDraft)[]): string {
	return (
		rewards
			.map((r) => {
				const gives = r.kind === 'role' ? r.role_id : r.kind === 'xp' ? `${r.xp.toLocaleString()} XP` : r.name;
				return `${rewardGoalLabel(r)} → ${gives}${r.winner_limit !== null ? ` (first ${r.winner_limit})` : ''}`;
			})
			.join('; ') || 'None'
	);
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ ok: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ ok: false, error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST });
	}
	if (!(await canEditServerSettings(locals, serverId))) {
		return json({ ok: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const server = await db.getServer(serverId);
	if (!server) {
		return json({ ok: false, error: 'Server not found' }, { status: HTTP.NOT_FOUND });
	}

	const body = await readJsonObject(request);
	if ([body.keep, body.stack].some((value) => value != null && typeof value !== 'boolean')) {
		return json({ ok: false, error: 'keep and stack must be true or false' }, { status: HTTP.BAD_REQUEST });
	}
	const roles = await db.getRoles(serverId).catch(() => []);
	const known = new Set(roles.map((r) => String(r.discord_role_id)).filter((id) => id !== String(server.discord_server_id)));
	const { rewards, error } = normalizeRewardDrafts(body.rewards, known);
	if (error) {
		return json({ ok: false, error }, { status: HTTP.BAD_REQUEST });
	}
	for (const r of rewards) {
		if (r.image && !rewardImageBelongsTo(r.image, serverId)) {
			r.image = null;
		}
	}

	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	const existing = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
	const previous = { rewards: await db.getRewards(serverId), ...rewardRuleFlags(existing) };
	const next = { keep: body.keep !== false, stack: body.stack !== false };

	const { removedImages } = await db.saveRewards(serverId, rewards);
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.main, {
		...existing,
		[REWARD_KEYS.keep]: next.keep,
		[REWARD_KEYS.stack]: next.stack
	});
	for (const key of removedImages) {
		await removeRewardImage(key);
	}

	const changes: { key: string; before: string | null; after: string | null }[] = [];
	if (describe(previous.rewards) !== describe(rewards)) {
		changes.push({ key: 'rewards', before: describe(previous.rewards), after: describe(rewards) });
	}
	if (previous.keep !== next.keep) {
		changes.push({
			key: 'when a level drops',
			before: previous.keep ? 'Keep the reward' : 'Take it back',
			after: next.keep ? 'Keep the reward' : 'Take it back'
		});
	}
	if (previous.stack !== next.stack) {
		changes.push({
			key: 'lower rewards',
			before: previous.stack ? 'Keep them' : 'Replace with the newest',
			after: next.stack ? 'Keep them' : 'Replace with the newest'
		});
	}
	if (changes.length > 0) {
		await db.createServerPanelLog(serverId, panelActorIds(locals), { action: 'rewards', changes }).catch(() => null);
	}

	const bot = await resolveActiveBotForServer(server);
	if (!bot || bot.status !== 'running' || !bot.port || !bot.secret_key) {
		return json({ ok: true, synced: false, blocked: [] });
	}
	const result = await postBotWebhook(bot, { type: 'sync_rewards', guild_id: server.discord_server_id });
	const isSynced = result.status === HTTP.OK && result.body?.ok === true;
	return json({ ok: true, synced: isSynced, blocked: isSynced && Array.isArray(result.body?.blocked) ? result.body.blocked : [] });
};
