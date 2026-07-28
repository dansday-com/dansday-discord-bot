import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { effectAccentInt } from '../../../../items.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	LOGIN_CYCLE_DAYS,
	RECENT_WINDOW_DAYS,
	dayKeyFor,
	weekKeyFor,
	weekStartDayKey,
	streakMilestone,
	xpRewardFor,
	loginRewardFor,
	pickWeightedByRarity,
	rarityTierFor,
	rarityMeta,
	type RarityTier,
	type TaskMetric
} from '../../../../tasks.js';
import { snapshotMembers, finalizeXpChanges, resolveServerMemberId } from './items.js';

const ANNOUNCE_DELAY_MS = 7000;

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
	return db.countMemberEventsSince(memberId, def.metric, dayStartMs, row.target_item_id ?? null).catch(() => 0);
}

async function grantXpTo(guildId: any, memberId: any, amount: number) {
	const xp = Math.max(0, Math.round(amount) || 0);
	await db.ensureMemberLevel(memberId);
	const snaps = await snapshotMembers([memberId]);
	if (xp > 0) await db.updateMemberLevelStats(memberId, { experienceIncrement: xp });
	await finalizeXpChanges(guildId, snaps, 'task-claim');
	return { kind: 'xp', xp };
}

async function deliverReward(guildId: any, memberId: any, plan: { wantsItem: boolean; itemId: any; fallbackXp: number }) {
	const item = plan.wantsItem && plan.itemId != null ? await db.getItem(Number(plan.itemId)).catch(() => null) : null;
	const itemUsable = !!item && (item.enabled as any) !== false && (item.enabled as any) !== 0;

	if (plan.wantsItem && itemUsable) {
		await db.ensureMemberLevel(memberId);
		const owned = await db.grantMemberItem(memberId, Number(plan.itemId), 1);
		await db.logMemberItemAction(memberId, {
			member_item_id: owned?.id ?? null,
			item_id: Number(plan.itemId),
			action: 'task_reward',
			xp_amount: 0,
			outcome: 'success'
		});
		return { kind: 'item', itemId: Number(plan.itemId), name: item.name, effectType: item.effect_type, cost: Number(item.cost) || 0 };
	}

	if (plan.wantsItem || plan.itemId != null) {
		const worth = Number(item?.cost) || 0;
		return grantXpTo(guildId, memberId, worth > 0 ? worth : plan.fallbackXp);
	}

	return grantXpTo(guildId, memberId, plan.fallbackXp);
}

export async function handleLoginClaim(client: any, payload: any) {
	const { guild_id, actor_discord_id, tz_offset } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch {
		return { ok: false, error: 'server_not_found' };
	}

	if (!(await isPublicSubFeatureEnabled(guild_id, 'tasks'))) return { ok: false, error: 'tasks_disabled' };

	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) return { ok: false, error: 'member_not_found' };

	const debug = payload?.debug === true;
	const tzOffsetMin = Number(tz_offset) || 0;
	const dayKey = dayKeyFor(Date.now(), tzOffsetMin);

	const before = (await db.ensureMemberClaim(memberId)) as any;
	if (!debug && before?.last_claim_day_key != null && Number(before.last_claim_day_key) >= dayKey) {
		return { ok: false, error: 'already_claimed' };
	}

	const itemsAllowed = await isPublicSubFeatureEnabled(guild_id, 'items');
	const catalog = itemsAllowed ? await loadRewardCatalog(server.id) : [];

	const applied = debug ? { changed: true, row: before } : await db.applyMemberClaim(memberId, dayKey, LOGIN_CYCLE_DAYS);
	if (!applied.changed) return { ok: false, error: 'already_claimed' };

	const day = debug ? (Number(before?.cycle_day) || 0) + 1 : Number(applied.row?.cycle_day) || 1;
	const cycleIndex = Number(applied.row?.cycles_completed) || 0;
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * 86400000;
	const earned = await db.countMemberEventsSince(memberId, 'xp_gained', sinceMs).catch(() => 0);
	const dailyEarn = Math.max(0, Number(earned) || 0) / RECENT_WINDOW_DAYS;
	const reward = debug
		? (() => {
				const picked = pickWeightedByRarity(catalog, Math.random());
				return picked
					? ({ day, kind: 'item', itemId: picked.id, jackpot: day >= LOGIN_CYCLE_DAYS } as const)
					: loginRewardFor(memberId, cycleIndex, day, catalog, dailyEarn);
			})()
		: loginRewardFor(memberId, cycleIndex, day, catalog, dailyEarn);

	let granted: any = null;
	try {
		granted = await deliverReward(guild_id, memberId, {
			wantsItem: reward.kind === 'item',
			itemId: reward.kind === 'item' ? reward.itemId : null,
			fallbackXp: reward.kind === 'xp' ? reward.xp : 200
		});
	} catch (err: any) {
		await logger.log(`❌ Login claim grant failed: ${err.message}`);
		return { ok: false, error: 'grant_failed' };
	}

	if (granted?.kind === 'item') {
		const tier = rarityTierFor(
			Number(granted.cost) || 0,
			catalog.map((c) => c.cost)
		);
		setTimeout(() => {
			announceLoginItem(client, guild_id, actor_discord_id, { day, jackpot: reward.jackpot, item: granted, tier }).catch(() => null);
		}, ANNOUNCE_DELAY_MS);
	}

	return { ok: true, granted, day, jackpot: reward.jackpot, cycleDays: LOGIN_CYCLE_DAYS };
}

async function loadRewardCatalog(serverId: any) {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) return [];
	const all = (await db.listItems(panelId).catch(() => [])) as any[];
	return all.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0).map((i) => ({ id: Number(i.id), cost: Number(i.cost) || 0 }));
}

export async function handleTaskClaim(client: any, payload: any) {
	const { guild_id, actor_discord_id, slot, tz_offset } = payload || {};
	const period: 'daily' | 'weekly' = payload?.period === 'weekly' ? 'weekly' : 'daily';
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
	await db.ensureMemberStreak(memberId, tzOffsetMin).catch(() => null);
	const nowMs = Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	const weekKey = weekKeyFor(nowMs, tzOffsetMin);
	const periodKey = period === 'weekly' ? weekKey : dayKey;
	const windowStartMs = period === 'weekly' ? weekStartDayKey(weekKey) * 86400000 + tzOffsetMin * 60000 : dayKey * 86400000 + tzOffsetMin * 60000;

	const rows = (await db.getMemberTasks(memberId, periodKey, period).catch(() => [])) as any[];
	const row = rows.find((r) => Number(r.slot) === Number(slot));
	if (!row) return { ok: false, error: 'task_not_found' };
	if (row.claimed_at) return { ok: false, error: 'already_claimed' };

	const goal = Number(row.goal) || 1;
	const progress = await measureProgress(memberId, row, windowStartMs);
	if (progress < goal) return { ok: false, error: 'task_incomplete', progress, goal };

	const itemsAllowed = await isPublicSubFeatureEnabled(guild_id, 'items');
	const grantsItem = row.reward_kind === 'item' && row.reward_item_id != null && itemsAllowed;

	const claimed = await db.claimMemberTask(memberId, periodKey, Number(slot), period);
	if (!claimed) return { ok: false, error: 'already_claimed' };

	let granted: any = null;
	try {
		granted = await deliverReward(guild_id, memberId, {
			wantsItem: grantsItem,
			itemId: row.reward_item_id,
			fallbackXp: Number(row.reward_xp) || xpRewardFor(row.difficulty, 0, 500)
		});
	} catch (err: any) {
		await logger.log(`❌ Task reward grant failed: ${err.message}`);
		return { ok: false, error: 'grant_failed' };
	}

	const after = (await db.getMemberTasks(memberId, dayKey, 'daily').catch(() => [])) as any[];
	const allClaimed = after.length > 0 && after.every((r) => !!r.claimed_at);

	let streakResult: any = null;
	let milestone: any = null;
	streakResult = await db.applyStreakDay(memberId, dayKey, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY).catch(() => null);
	if (streakResult?.changed) {
		milestone = streakMilestone(Number(streakResult.streak) || 0);
		await announceStreak(client, guild_id, actor_discord_id, streakResult, milestone).catch(() => null);
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

function streakAnnouncement(streakResult: any, milestone: any, member: any) {
	const streak = Number(streakResult.streak) || 0;
	const freezeUsed = Number(streakResult.freezeUsed) || 0;
	const daysMissed = Number(streakResult.daysMissed) || 0;
	const previous = Number(streakResult.previousStreak) || 0;
	const dayWord = (n: number) => (n === 1 ? 'day' : 'days');

	if (streakResult.reset) {
		const burned = freezeUsed > 0 ? ` Burned ${freezeUsed} ${freezeUsed === 1 ? 'freeze' : 'freezes'} trying to hold it.` : '';
		return {
			accent: 'bomb',
			title: '💔 Streak Reset',
			description: `${member} missed **${daysMissed} ${dayWord(daysMissed)}** and lost a **${previous}-day** streak.${burned} Back to day 1.`,
			fields: [{ name: 'Longest ever', value: `${Number(streakResult.row?.longest_streak) || previous} days`, inline: true }]
		};
	}

	if (freezeUsed > 0) {
		const left = Number(streakResult.freezesLeft) || 0;
		return {
			accent: 'shield',
			title: '🧊 Streak Frozen',
			description: `${member} missed **${daysMissed} ${dayWord(daysMissed)}** — ${freezeUsed === 1 ? 'a streak freeze' : `${freezeUsed} streak freezes`} kept the **${streak}-day** streak alive.`,
			fields: [
				{ name: 'Freezes used', value: `${freezeUsed}`, inline: true },
				{ name: 'Freezes left', value: `${left}`, inline: true }
			]
		};
	}

	if (milestone) {
		return {
			accent: 'luck',
			title: `${milestone.emoji} ${milestone.label} Streak`,
			description: `${member} just hit a **${streak}-day** streak!`,
			fields: []
		};
	}

	return null;
}

async function announceLoginItem(client: any, guildId: any, discordMemberId: any, ctx: { day: number; jackpot: boolean; item: any; tier: RarityTier }) {
	try {
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
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: 'Tasks' }));

		const worth = Number(ctx.item?.cost) || 0;
		const meta = rarityMeta(ctx.tier);
		const embed = new EmbedBuilder()
			.setColor(parseInt(meta.accent.slice(1), 16))
			.setTitle(ctx.jackpot ? `🎁 Day ${ctx.day} jackpot — ${meta.label}!` : `✨ ${meta.label} drop!`)
			.setDescription(`${member} rolled a **${meta.label}** item on day ${ctx.day}!`)
			.addFields(
				{ name: 'Item', value: String(ctx.item?.name || '—'), inline: true },
				{ name: 'Rarity', value: meta.label, inline: true },
				{ name: 'Worth', value: `${worth.toLocaleString()} XP`, inline: true }
			)
			.setFooter({ text: embedConfig.FOOTER || 'Tasks' })
			.setTimestamp();

		await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Login item announce failed: ${err?.message || String(err)}`);
	}
}

export async function announceStreak(client: any, guildId: any, discordMemberId: any, streakResult: any, milestone: any) {
	const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guildId);
	if (!channelId) return;

	const guild = client?.guilds?.cache?.get(guildId);
	if (!guild) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return;

	const member = await guild.members.fetch(String(discordMemberId)).catch(() => null);
	if (!member) return;

	const plan = streakAnnouncement(streakResult, milestone, member);
	if (!plan) return;

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Tasks' }));

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt(plan.accent))
		.setTitle(plan.title)
		.setDescription(plan.description)
		.setFooter({ text: embedConfig.FOOTER || 'Tasks' })
		.setTimestamp();

	if (plan.fields.length > 0) embed.addFields(plan.fields);

	await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
}

export async function sweepBrokenStreaks(client: any) {
	const stale = (await db.listStaleStreaks(500).catch(() => [])) as any[];

	for (const row of stale) {
		const tzOffsetMin = Number(row.tz_offset_min) || 0;
		const today = dayKeyFor(Date.now(), tzOffsetMin);
		const last = Number(row.last_claim_day_key);
		const missed = today - last - 1;
		if (missed < 1) continue;

		const streak = Number(row.current_streak) || 0;
		const freezes = Number(row.freezes_available) || 0;
		const longest = Number(row.longest_streak) || streak;

		if (freezes > 0) {
			const settled = Math.min(freezes, missed);
			await db.expireStreak(row.member_id, last + settled, freezes - settled, false).catch(() => null);
			await announceStreak(
				client,
				row.discord_server_id,
				row.discord_member_id,
				{
					streak,
					previousStreak: streak,
					freezeUsed: settled,
					freezesLeft: freezes - settled,
					daysMissed: settled,
					reset: false,
					row: { longest_streak: longest }
				},
				null
			).catch(() => null);
			continue;
		}

		await db.expireStreak(row.member_id, today - 1, 0, true).catch(() => null);
		await announceStreak(
			client,
			row.discord_server_id,
			row.discord_member_id,
			{ streak: 0, previousStreak: streak, freezeUsed: 0, freezesLeft: 0, daysMissed: missed, reset: true, row: { longest_streak: longest } },
			null
		).catch(() => null);
	}

	return stale.length;
}

export default { handleTaskClaim, handleLoginClaim, sweepBrokenStreaks };
