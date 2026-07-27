import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { effectAccentInt, BAG_CAPACITY, effectiveBagStock } from '../../../../items.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	dayKeyFor,
	streakMilestone,
	xpRewardFor,
	type TaskMetric
} from '../../../../tasks.js';
import { snapshotMembers, finalizeXpChanges, resolveServerMemberId } from './items.js';

const COUNTER_METRICS = new Set<TaskMetric>([
	'chat_total',
	'reactions_given',
	'voice_minutes_active',
	'voice_minutes_afk',
	'voice_minutes_video',
	'voice_minutes_streaming'
]);

async function measureProgress(memberId: any, row: any, dayStartMs: number) {
	const def = TASK_BY_ID.get(row.task_type);
	if (!def) return 0;

	if (COUNTER_METRICS.has(def.metric)) {
		const levels = await db.getMemberLevel(memberId).catch(() => null);
		const current = Number((levels as any)?.[def.metric]) || 0;
		return Math.max(0, current - (Number(row.baseline) || 0));
	}
	return db.countMemberEventsSince(memberId, def.metric, dayStartMs).catch(() => 0);
}

export async function handleTaskClaim(client: any, payload: any) {
	const { guild_id, actor_discord_id, slot, tz_offset } = payload || {};
	if (!guild_id || !actor_discord_id || slot == null) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch {
		return { ok: false, error: 'server_not_found' };
	}

	if (!(await isPublicSubFeatureEnabled(guild_id, 'tasks'))) {
		return { ok: false, error: 'tasks_disabled' };
	}

	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) return { ok: false, error: 'member_not_found' };

	const tzOffsetMin = Number(tz_offset) || 0;
	const nowMs = Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	const dayStartMs = dayKey * 86400000 + tzOffsetMin * 60000;

	const rows = (await db.getMemberDailyTasks(memberId, dayKey).catch(() => [])) as any[];
	const row = rows.find((r) => Number(r.slot) === Number(slot));
	if (!row) return { ok: false, error: 'task_not_found' };
	if (row.claimed_at) return { ok: false, error: 'already_claimed' };

	const goal = Number(row.goal) || 1;
	const progress = await measureProgress(memberId, row, dayStartMs);
	if (progress < goal) return { ok: false, error: 'task_incomplete', progress, goal };

	const itemsAllowed = await isPublicSubFeatureEnabled(guild_id, 'items');
	const grantsItem = row.reward_kind === 'item' && row.reward_item_id != null && itemsAllowed;

	if (grantsItem) {
		const inventory = await db.getMemberInventory(memberId).catch(() => []);
		if (effectiveBagStock(inventory as any[]) + 1 > BAG_CAPACITY) {
			return { ok: false, error: 'bag_full', capacity: BAG_CAPACITY };
		}
	}

	const claimed = await db.claimMemberDailyTask(memberId, dayKey, Number(slot));
	if (!claimed) return { ok: false, error: 'already_claimed' };

	async function grantXp(amount: number) {
		const xp = Math.max(0, Math.round(amount) || 0);
		await db.ensureMemberLevel(memberId);
		const snaps = await snapshotMembers([memberId]);
		if (xp > 0) await db.updateMemberLevelStats(memberId, { experienceIncrement: xp });
		await finalizeXpChanges(guild_id, snaps, 'task-claim');
		return { kind: 'xp', xp };
	}

	let granted: any = null;
	try {
		const item = grantsItem ? await db.getItem(Number(row.reward_item_id)).catch(() => null) : null;
		const itemUsable = !!item && (item.enabled as any) !== false && (item.enabled as any) !== 0;

		if (grantsItem && itemUsable) {
			await db.ensureMemberLevel(memberId);
			const owned = await db.grantMemberItem(memberId, Number(row.reward_item_id), 1);
			await db.logMemberItemAction(memberId, {
				member_item_id: owned?.id ?? null,
				item_id: Number(row.reward_item_id),
				action: 'task_reward',
				xp_amount: 0,
				outcome: 'success'
			});
			granted = { kind: 'item', itemId: Number(row.reward_item_id), name: item.name, effectType: item.effect_type };
		} else if (row.reward_kind === 'item') {
			const worth = Number(item?.cost) || 0;
			granted = await grantXp(worth > 0 ? worth : xpRewardFor(row.difficulty, 0, 500));
		} else {
			granted = await grantXp(Number(row.reward_xp) || 0);
		}
	} catch (err: any) {
		await logger.log(`❌ Task reward grant failed: ${err.message}`);
		return { ok: false, error: 'grant_failed' };
	}

	const after = (await db.getMemberDailyTasks(memberId, dayKey).catch(() => [])) as any[];
	const allClaimed = after.length > 0 && after.every((r) => !!r.claimed_at);

	let streakResult: any = null;
	let milestone: any = null;
	if (allClaimed) {
		streakResult = await db.applyStreakClaim(memberId, dayKey, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY).catch(() => null);
		if (streakResult?.changed) {
			milestone = streakMilestone(Number(streakResult.streak) || 0);
			await announceStreak(client, guild_id, actor_discord_id, streakResult, milestone).catch(() => null);
		}
	}

	return {
		ok: true,
		granted,
		allClaimed,
		streak: streakResult?.row
			? {
					current: Number(streakResult.row.current_streak) || 0,
					longest: Number(streakResult.row.longest_streak) || 0,
					freezes: Number(streakResult.row.freezes_available) || 0,
					freezeUsed: Number(streakResult.freezeUsed) || 0
				}
			: null,
		milestone,
		slots: DAILY_TASK_SLOTS
	};
}

async function announceStreak(client: any, guildId: any, discordMemberId: any, streakResult: any, milestone: any) {
	if (!milestone) return;

	const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guildId);
	if (!channelId) return;

	const guild = client?.guilds?.cache?.get(guildId);
	if (!guild) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return;

	const member = await guild.members.fetch(String(discordMemberId)).catch(() => null);
	if (!member) return;

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Tasks' }));
	const streak = Number(streakResult.streak) || 0;

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt('luck'))
		.setTitle(`${milestone.emoji} ${milestone.label} Streak`)
		.setDescription(`${member} just hit a **${streak}-day** streak by clearing every daily task!`)
		.setFooter({ text: embedConfig.FOOTER || 'Tasks' })
		.setTimestamp();

	await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
}

export default { handleTaskClaim };
