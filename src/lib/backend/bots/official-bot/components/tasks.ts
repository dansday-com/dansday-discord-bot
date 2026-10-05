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
	DAY_MINUTES,
	minuteKeyFor,
	periodOpen,
	loginReadyInMs,
	streakMilestone,
	xpRewardFor,
	loginRewardFor,
	rarityTierFor,
	rarityMeta,
	type RarityTier,
	type TaskMetric
} from '../../../../tasks.js';
import { snapshotMembers, finalizeXpChanges, resolveServerMemberId } from './items.js';
import { serverTranslator, type Translator } from '../i18n.js';

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

async function grantXpTo(guildId: any, memberId: any, rawXp: number, source: 'task' | 'daily' = 'task') {
	const xp = Math.max(0, Math.round(rawXp) || 0);
	await db.ensureMemberLevel(memberId);
	const snaps = await snapshotMembers([memberId]);
	if (xp > 0) {
		const stats = await db.updateMemberLevelStats(memberId, { xpIncrement: xp });
		await db
			.logMemberLevelGain(memberId, {
				source,
				xp,
				xp_total: stats?.xp != null ? Number(stats.xp) : null,
				level: stats?.level != null ? Number(stats.level) : null,
				rank: stats?.rank != null ? Number(stats.rank) : null
			})
			.catch(() => null);
	}
	await finalizeXpChanges(guildId, snaps, `${source}-claim`);
	return { kind: 'xp', xp };
}

async function deliverReward(guildId: any, memberId: any, plan: { wantsItem: boolean; itemId: any; fallbackXp: number; source?: 'task' | 'daily' }) {
	const source = plan.source ?? 'task';
	const item = plan.wantsItem && plan.itemId != null ? await db.getItem(Number(plan.itemId)).catch(() => null) : null;
	const itemUsable = !!item && (item.enabled as any) !== false && (item.enabled as any) !== 0;

	if (plan.wantsItem && itemUsable) {
		await db.ensureMemberLevel(memberId);
		const owned = await db.grantMemberItem(memberId, Number(plan.itemId), 1);
		await db.logMemberItemAction(memberId, {
			member_item_id: owned?.id ?? null,
			item_id: Number(plan.itemId),
			action: 'task_reward',
			xp: 0,
			outcome: 'success'
		});
		return { kind: 'item', itemId: Number(plan.itemId), name: item.name, effectType: item.effect_type, cost: Number(item.cost) || 0 };
	}

	if (plan.wantsItem || plan.itemId != null) {
		const worth = Number(item?.cost) || 0;
		return grantXpTo(guildId, memberId, worth > 0 ? worth : plan.fallbackXp, source);
	}

	return grantXpTo(guildId, memberId, plan.fallbackXp, source);
}

export async function handleLoginClaim(client: any, payload: any) {
	const { guild_id, actor_discord_id } = payload || {};
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

	const nowMs = Date.now();
	const nowKey = minuteKeyFor(nowMs);

	const before = (await db.ensureMemberClaim(memberId)) as any;
	const readyInMs = loginReadyInMs(before?.last_claim_day_key == null ? null : Number(before.last_claim_day_key), nowMs);
	if (readyInMs > 0) return { ok: false, error: 'already_claimed', readyInMs };

	const itemsAllowed = await isPublicSubFeatureEnabled(guild_id, 'items');
	const catalog = itemsAllowed ? await loadRewardCatalog(server.id) : [];

	const applied = await db.applyMemberClaim(memberId, nowKey, LOGIN_CYCLE_DAYS);
	if (!applied.changed) return { ok: false, error: 'already_claimed' };

	const day = Number(applied.row?.cycle_day) || 1;
	const cycleIndex = Number(applied.row?.cycles_completed) || 0;
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * 86400000;
	const earned = await db.countMemberEventsSince(memberId, 'xp_gained', sinceMs).catch(() => 0);
	const dailyEarn = Math.max(0, Number(earned) || 0) / RECENT_WINDOW_DAYS;
	const reward = loginRewardFor(memberId, cycleIndex, day, catalog, dailyEarn);

	let granted: any = null;
	try {
		granted = await deliverReward(guild_id, memberId, {
			wantsItem: reward.kind === 'item',
			itemId: reward.kind === 'item' ? reward.itemId : null,
			fallbackXp: reward.kind === 'xp' ? reward.xp : 200,
			source: 'daily'
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
	const [latestDaily, latestWeekly] = await Promise.all([db.getLatestTaskKey(memberId, 'daily'), db.getLatestTaskKey(memberId, 'weekly')]);
	const dayKey = periodOpen(latestDaily, 'daily', nowMs) ? latestDaily : null;
	const periodKey = period === 'weekly' ? (periodOpen(latestWeekly, 'weekly', nowMs) ? latestWeekly : null) : dayKey;
	if (periodKey == null) return { ok: false, error: 'task_not_found' };
	const windowStartMs = periodKey * 60000;

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
			fallbackXp: Number(row.xp_reward) || xpRewardFor(row.difficulty, 0, 500)
		});
	} catch (err: any) {
		await logger.log(`❌ Task reward grant failed: ${err.message}`);
		return { ok: false, error: 'grant_failed' };
	}

	const after = dayKey == null ? [] : ((await db.getMemberTasks(memberId, dayKey, 'daily').catch(() => [])) as any[]);
	const allClaimed = after.length > 0 && after.every((r) => !!r.claimed_at);

	let streakResult: any = null;
	let milestone: any = null;
	if (dayKey != null) streakResult = await db.applyStreakDay(memberId, dayKey, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY).catch(() => null);
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

function rarityLabel(tr: Translator, tier: RarityTier): string {
	const meta = rarityMeta(tier);
	const key = `tasks.rarity.${meta.id}`;
	const label = tr(key);
	return label === key ? meta.label : label;
}

function milestoneLabel(tr: Translator, milestone: { at: number; label: string }): string {
	const key = `tasks.milestones.${milestone.at}`;
	const label = tr(key);
	return label === key ? milestone.label : label;
}

function streakAnnouncement(tr: Translator, streakResult: any, milestone: any, member: any) {
	const streak = Number(streakResult.streak) || 0;
	const freezeUsed = Number(streakResult.freezeUsed) || 0;
	const daysMissed = Number(streakResult.daysMissed) || 0;
	const previous = Number(streakResult.previousStreak) || 0;
	const dayCount = (n: number) => tr(n === 1 ? 'tasks.streak.day' : 'tasks.streak.days', { count: n });
	const mention = `${member}`;

	if (streakResult.reset) {
		const lost = { member: mention, days: dayCount(daysMissed), previous };
		const description =
			freezeUsed > 0
				? tr('tasks.streak.reset.descriptionBurned', {
						...lost,
						burned: tr(freezeUsed === 1 ? 'tasks.streak.reset.burnedOne' : 'tasks.streak.reset.burnedMany', { count: freezeUsed })
					})
				: tr('tasks.streak.reset.description', lost);
		return {
			accent: 'bomb',
			title: tr('tasks.streak.reset.title'),
			description,
			fields: [{ name: tr('tasks.streak.fields.longest'), value: dayCount(Number(streakResult.row?.longest_streak) || previous), inline: true }]
		};
	}

	if (freezeUsed > 0) {
		const left = Number(streakResult.freezesLeft) || 0;
		return {
			accent: 'shield',
			title: tr('tasks.streak.frozen.title'),
			description: tr('tasks.streak.frozen.description', {
				member: mention,
				days: dayCount(daysMissed),
				freezes: tr(freezeUsed === 1 ? 'tasks.streak.frozen.one' : 'tasks.streak.frozen.many', { count: freezeUsed }),
				streak
			}),
			fields: [
				{ name: tr('tasks.streak.fields.freezesUsed'), value: `${freezeUsed}`, inline: true },
				{ name: tr('tasks.streak.fields.freezesLeft'), value: `${left}`, inline: true }
			]
		};
	}

	if (milestone) {
		return {
			accent: 'luck',
			title: tr('tasks.streak.milestone.title', { emoji: milestone.emoji, label: milestoneLabel(tr, milestone) }),
			description: tr('tasks.streak.milestone.description', { member: mention, streak }),
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
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: '' }));

		const worth = Number(ctx.item?.cost) || 0;
		const meta = rarityMeta(ctx.tier);
		const rarity = rarityLabel(tr, ctx.tier);
		const embed = new EmbedBuilder()
			.setColor(parseInt(meta.accent.slice(1), 16))
			.setTitle(ctx.jackpot ? tr('tasks.login.jackpotTitle', { day: ctx.day, rarity }) : tr('tasks.login.dropTitle', { rarity }))
			.setDescription(tr('tasks.login.description', { member: `${member}`, rarity, day: ctx.day }))
			.addFields(
				{ name: tr('tasks.login.fields.item'), value: String(ctx.item?.name || '—'), inline: true },
				{ name: tr('tasks.login.fields.rarity'), value: rarity, inline: true },
				{ name: tr('tasks.login.fields.worth'), value: `${worth.toLocaleString()} XP`, inline: true }
			)
			.setFooter({ text: embedConfig.FOOTER || tr('tasks.footer') })
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

	const tr = await serverTranslator(String(guildId));
	const plan = streakAnnouncement(tr, streakResult, milestone, member);
	if (!plan) return;

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: '' }));

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt(plan.accent))
		.setTitle(plan.title)
		.setDescription(plan.description)
		.setFooter({ text: embedConfig.FOOTER || tr('tasks.footer') })
		.setTimestamp();

	if (plan.fields.length > 0) embed.addFields(plan.fields);

	await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
}

export async function sweepBrokenStreaks(client: any) {
	const stale = (await db.listStaleStreaks(500).catch(() => [])) as any[];
	const nowKey = minuteKeyFor(Date.now());

	for (const row of stale) {
		const last = Number(row.last_claim_day_key);
		const missed = Math.floor((nowKey - last) / DAY_MINUTES) - 1;
		if (missed < 1) continue;

		const streak = Number(row.current_streak) || 0;
		const freezes = Number(row.freezes_available) || 0;
		const longest = Number(row.longest_streak) || streak;

		if (freezes >= missed) {
			await db.expireStreak(row.member_id, last + missed * DAY_MINUTES, freezes - missed, false).catch(() => null);
			await announceStreak(
				client,
				row.discord_server_id,
				row.discord_member_id,
				{
					streak,
					previousStreak: streak,
					freezeUsed: missed,
					freezesLeft: freezes - missed,
					daysMissed: missed,
					reset: false,
					row: { longest_streak: longest }
				},
				null
			).catch(() => null);
			continue;
		}

		await db.expireStreak(row.member_id, nowKey - DAY_MINUTES, freezes, true).catch(() => null);
		await announceStreak(
			client,
			row.discord_server_id,
			row.discord_member_id,
			{ streak: 0, previousStreak: streak, freezeUsed: 0, freezesLeft: freezes, daysMissed: missed, reset: true, row: { longest_streak: longest } },
			null
		).catch(() => null);
	}

	return stale.length;
}

export default { handleTaskClaim, handleLoginClaim, sweepBrokenStreaks };
