import db from '../../../../database.js';
import { logger, attempt } from '../../../../utils/index.js';
import { effectAccentInt } from '../../../../items.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	LOGIN_CYCLE_DAYS,
	RECENT_WINDOW_DAYS,
	minuteKeyFor,
	periodOpen,
	loginReadyInMs,
	streakMilestone,
	xpRewardFor,
	loginRewardFor,
	rarityTierFor,
	rarityMeta,
	type RarityTier,
	type TaskDifficulty,
	type TaskMetric
} from '../../../../tasks.js';
import { snapshotMembers, finalizeXpChanges, resolveServerMemberId } from './items.js';
import { serverTranslator, type Translator } from '../i18n.js';
import type { Client, GuildMember } from 'discord.js';
import { DAY_MS, MINUTE_MS, DAY_MINUTES } from '../../../../utils/time.js';
import { EMBED_COLORS } from './embedColors.js';

type TaskRow = Awaited<ReturnType<typeof db.getMemberTasks>>[number];
type Milestone = ReturnType<typeof streakMilestone>;
export type StreakOutcome = {
	streak?: number;
	previousStreak?: number;
	freezeUsed?: number;
	freezesLeft?: number;
	daysMissed?: number;
	reset?: boolean;
	row?: { longest_streak?: number | null } | null;
};

const ANNOUNCE_DELAY_MS = 7000;
const DAILY_FALLBACK_XP = 200;
const FALLBACK_MEDIAN_COST = 500;
const STALE_STREAK_BATCH = 500;

const COUNTER_METRICS = new Set<TaskMetric>([
	'chat_total',
	'reactions_given',
	'voice_minutes_active',
	'voice_minutes_afk',
	'voice_minutes_video',
	'voice_minutes_streaming'
]);

async function measureProgress(memberId: number | string, row: TaskRow, dayStartMs: number) {
	const def = TASK_BY_ID.get(row.task_type);
	if (!def) {
		return 0;
	}

	if (COUNTER_METRICS.has(def.metric)) {
		const levels = await db.getMemberLevel(memberId).catch(() => null);
		const current = Number((levels as Record<string, unknown>)?.[def.metric]) || 0;
		return Math.max(0, current - (Number(row.baseline) || 0));
	}
	return db.countMemberEventsSince(memberId, { metric: def.metric, sinceMs: dayStartMs, targetItemId: row.target_item_id ?? null }).catch(() => 0);
}

type XpGrant = { rawXp: number; source?: 'task' | 'daily' };

async function grantXpTo(guildId: string, memberId: number | string, { rawXp, source = 'task' }: XpGrant) {
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
	return { kind: 'xp' as const, xp };
}

async function deliverReward(
	guildId: string,
	memberId: number | string,
	plan: { wantsItem: boolean; itemId: number | string | null; fallbackXp: number; source?: 'task' | 'daily' }
) {
	const source = plan.source ?? 'task';
	const item = plan.wantsItem && plan.itemId != null ? await db.getItem(Number(plan.itemId)).catch(() => null) : null;
	const isItemUsable = !!item && (item.enabled as boolean | number) !== false && (item.enabled as boolean | number) !== 0;

	if (plan.wantsItem && isItemUsable) {
		await db.ensureMemberLevel(memberId);
		const owned = await db.grantMemberItem(memberId, Number(plan.itemId), 1);
		await db.logMemberItemAction(memberId, {
			member_item_id: owned?.id ?? null,
			item_id: Number(plan.itemId),
			action: 'task_reward',
			xp: 0,
			outcome: 'success'
		});
		return { kind: 'item' as const, itemId: Number(plan.itemId), name: item.name, effectType: item.effect_type, cost: Number(item.cost) || 0 };
	}

	if (plan.wantsItem || plan.itemId != null) {
		const worth = Number(item?.cost) || 0;
		return grantXpTo(guildId, memberId, { rawXp: worth > 0 ? worth : plan.fallbackXp, source });
	}

	return grantXpTo(guildId, memberId, { rawXp: plan.fallbackXp, source });
}

export async function handleLoginClaim(client: Client, payload: { guild_id?: string; actor_discord_id?: string }) {
	const { guild_id, actor_discord_id } = payload || {};
	if (!guild_id || !actor_discord_id) {
		return { ok: false, error: 'missing_fields' };
	}

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	const server = await getServerForCurrentBot(guild_id).catch(() => null);
	if (!server) {
		return { ok: false, error: 'server_not_found' };
	}

	if (!(await isPublicSubFeatureEnabled(guild_id, 'tasks'))) {
		return { ok: false, error: 'tasks_disabled' };
	}

	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) {
		return { ok: false, error: 'member_not_found' };
	}

	const nowMs = Date.now();
	const nowKey = minuteKeyFor(nowMs);

	const before = await db.ensureMemberClaim(memberId);
	const readyInMs = loginReadyInMs(before?.last_claim_day_key == null ? null : Number(before.last_claim_day_key), nowMs);
	if (readyInMs > 0) {
		return { ok: false, error: 'already_claimed', readyInMs };
	}

	const areItemsAllowed = await isPublicSubFeatureEnabled(guild_id, 'items');
	const catalog = areItemsAllowed ? await loadRewardCatalog(server.id) : [];

	const applied = await db.applyMemberClaim(memberId, nowKey, LOGIN_CYCLE_DAYS);
	if (!applied.changed) {
		return { ok: false, error: 'already_claimed' };
	}

	const day = Number(applied.row?.cycle_day) || 1;
	const cycleIndex = Number(applied.row?.cycles_completed) || 0;
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * DAY_MS;
	const earned = await db.countMemberEventsSince(memberId, { metric: 'xp_gained', sinceMs }).catch(() => 0);
	const dailyEarn = Math.max(0, Number(earned) || 0) / RECENT_WINDOW_DAYS;
	const reward = loginRewardFor(memberId, { cycleIndex, day, catalog, dailyEarn });

	let granted: Awaited<ReturnType<typeof deliverReward>> | null = null;
	try {
		granted = await deliverReward(guild_id, memberId, {
			wantsItem: reward.kind === 'item',
			itemId: reward.kind === 'item' ? reward.itemId : null,
			fallbackXp: reward.kind === 'xp' ? reward.xp : DAILY_FALLBACK_XP,
			source: 'daily'
		});
	} catch (err) {
		await logger.log(`❌ Login claim grant failed: ${(err as Error).message}`);
		return { ok: false, error: 'grant_failed' };
	}

	if (granted?.kind === 'item') {
		const tier = rarityTierFor(
			Number(granted.cost) || 0,
			catalog.map((c) => c.cost)
		);
		setTimeout(() => {
			announceLoginItem(client, { guildId: guild_id, discordMemberId: actor_discord_id }, { day, jackpot: reward.jackpot, item: granted, tier }).catch(
				() => null
			);
		}, ANNOUNCE_DELAY_MS);
	}

	return { ok: true, granted, day, jackpot: reward.jackpot, cycleDays: LOGIN_CYCLE_DAYS };
}

async function loadRewardCatalog(serverId: number) {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) {
		return [];
	}
	const all = (await db.listItems(panelId).catch(() => [])) as Record<string, unknown>[];
	return all.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0).map((i) => ({ id: Number(i.id), cost: Number(i.cost) || 0 }));
}

type ClaimFailure = { ok: false; error: string; progress?: number; goal?: number };
type ClaimTarget = { memberId: number; period: 'daily' | 'weekly'; slot: number; tzOffsetMin: number };
type ClaimableTask = { row: Awaited<ReturnType<typeof db.getMemberTasks>>[number]; periodKey: number; dayKey: number | null };
type StreakNotice = { guildId: string; discordMemberId: string };

async function claimableTask(target: ClaimTarget): Promise<ClaimableTask | ClaimFailure> {
	const { memberId, period } = target;
	await db.ensureMemberStreak(memberId, target.tzOffsetMin).catch(() => null);
	const nowMs = Date.now();
	const [latestDaily, latestWeekly] = await Promise.all([db.getLatestTaskKey(memberId, 'daily'), db.getLatestTaskKey(memberId, 'weekly')]);
	const dayKey = periodOpen(latestDaily, 'daily', nowMs) ? latestDaily : null;
	const periodKey = period === 'weekly' ? (periodOpen(latestWeekly, 'weekly', nowMs) ? latestWeekly : null) : dayKey;
	if (periodKey == null) {
		return { ok: false, error: 'task_not_found' };
	}

	const rows = await db.getMemberTasks(memberId, periodKey, period).catch(() => []);
	const row = rows.find((r) => Number(r.slot) === target.slot);
	if (!row) {
		return { ok: false, error: 'task_not_found' };
	}
	if (row.claimed_at) {
		return { ok: false, error: 'already_claimed' };
	}
	const goal = Number(row.goal) || 1;
	const progress = await measureProgress(memberId, row, periodKey * MINUTE_MS);
	return progress < goal ? { ok: false, error: 'task_incomplete', progress, goal } : { row, periodKey, dayKey };
}

async function recordStreak(client: Client, memberId: number, { dayKey, notice }: { dayKey: number | null; notice: StreakNotice }) {
	const streakResult =
		dayKey != null ? await db.applyStreakDay(memberId, { dayKey, freezeMax: STREAK_FREEZE_MAX, earnEvery: STREAK_FREEZE_EARN_EVERY }).catch(() => null) : null;
	const milestone: Milestone = streakResult?.changed ? streakMilestone(Number(streakResult.streak) || 0) : null;
	if (streakResult?.changed) {
		await announceStreak(client, notice, { streakResult, milestone }).catch(() => null);
	}
	const streak = streakResult?.row
		? {
				current: Number(streakResult.row.current_streak) || 0,
				longest: Number(streakResult.row.longest_streak) || 0,
				freezes: Number(streakResult.row.freezes_available) || 0,
				freezeUsed: Number(streakResult.freezeUsed) || 0
			}
		: null;
	return { streak, milestone };
}

async function areDailyTasksClaimed(memberId: number, dayKey: number | null) {
	const after = dayKey == null ? [] : ((await db.getMemberTasks(memberId, dayKey, 'daily').catch(() => [])) as Record<string, unknown>[]);
	return after.length > 0 && after.every((r) => !!r.claimed_at);
}

export async function handleTaskClaim(
	client: Client,
	payload: { guild_id?: string; actor_discord_id?: string; slot?: number | string; tz_offset?: unknown; period?: string }
) {
	const { guild_id, actor_discord_id, slot, tz_offset } = payload || {};
	const period: 'daily' | 'weekly' = payload?.period === 'weekly' ? 'weekly' : 'daily';
	if (!guild_id || !actor_discord_id || slot == null) {
		return { ok: false, error: 'missing_fields' };
	}

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');
	const server = await getServerForCurrentBot(guild_id).catch(() => null);
	if (!server) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isPublicSubFeatureEnabled(guild_id, 'tasks'))) {
		return { ok: false, error: 'tasks_disabled' };
	}
	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) {
		return { ok: false, error: 'member_not_found' };
	}

	const task = await claimableTask({ memberId, period, slot: Number(slot), tzOffsetMin: Number(tz_offset) || 0 });
	if ('ok' in task) {
		return task;
	}
	const { row, periodKey, dayKey } = task;

	const doesGrantItem = row.reward_kind === 'item' && row.reward_item_id != null && (await isPublicSubFeatureEnabled(guild_id, 'items'));
	if (!(await db.claimMemberTask(memberId, { dayKey: periodKey, slot: Number(slot), period }))) {
		return { ok: false, error: 'already_claimed' };
	}

	const granted = await attempt(() =>
		deliverReward(guild_id, memberId, {
			wantsItem: doesGrantItem,
			itemId: row.reward_item_id,
			fallbackXp: Number(row.xp_reward) || xpRewardFor(row.difficulty as TaskDifficulty, 0, FALLBACK_MEDIAN_COST)
		})
	);
	if (!granted.ok) {
		await logger.log(`❌ Task reward grant failed: ${(granted.error as Error).message}`);
		return { ok: false, error: 'grant_failed' };
	}

	const areAllClaimed = await areDailyTasksClaimed(memberId, dayKey);
	const { streak, milestone } = await recordStreak(client, memberId, { dayKey, notice: { guildId: guild_id, discordMemberId: actor_discord_id } });
	return { ok: true, granted: granted.value, allClaimed: areAllClaimed, streak, milestone, slots: DAILY_TASK_SLOTS };
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

function streakAnnouncement(tr: Translator, { streakResult, milestone }: StreakNews, member: GuildMember) {
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

async function announceLoginItem(
	client: Client,
	{ guildId, discordMemberId }: MemberRef,
	ctx: { day: number; jackpot: boolean; item: Record<string, unknown>; tier: RarityTier }
) {
	try {
		const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
		const channelId = await getItemsChannelId(guildId);
		if (!channelId) {
			return;
		}

		const guild = client?.guilds?.cache?.get(guildId);
		if (!guild) {
			return;
		}
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			return;
		}

		const member = await guild.members.fetch(String(discordMemberId)).catch(() => null);
		if (!member) {
			return;
		}

		const { EmbedBuilder } = await import('discord.js');
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: EMBED_COLORS.gold, FOOTER: '' }));

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
	} catch (err) {
		await logger.log(`⚠️ Login item announce failed: ${(err as Error)?.message || String(err)}`);
	}
}

type StreakNews = { streakResult: StreakOutcome; milestone: Milestone };

type MemberRef = { guildId: string; discordMemberId: number | string };

export async function announceStreak(client: Client, { guildId, discordMemberId }: MemberRef, { streakResult, milestone }: StreakNews) {
	const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guildId);
	if (!channelId) {
		return;
	}

	const guild = client?.guilds?.cache?.get(guildId);
	if (!guild) {
		return;
	}
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) {
		return;
	}

	const member = await guild.members.fetch(String(discordMemberId)).catch(() => null);
	if (!member) {
		return;
	}

	const tr = await serverTranslator(String(guildId));
	const plan = streakAnnouncement(tr, { streakResult, milestone }, member);
	if (!plan) {
		return;
	}

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: '' }));

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt(plan.accent))
		.setTitle(plan.title)
		.setDescription(plan.description)
		.setFooter({ text: embedConfig.FOOTER || tr('tasks.footer') })
		.setTimestamp();

	if (plan.fields.length > 0) {
		embed.addFields(plan.fields);
	}

	await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
}

export async function sweepBrokenStreaks(client: Client) {
	const stale = await db.listStaleStreaks(STALE_STREAK_BATCH).catch(() => []);
	const nowKey = minuteKeyFor(Date.now());

	for (const row of stale) {
		const last = Number(row.last_claim_day_key);
		const missed = Math.floor((nowKey - last) / DAY_MINUTES) - 1;
		if (missed < 1) {
			continue;
		}

		const streak = Number(row.current_streak) || 0;
		const freezes = Number(row.freezes_available) || 0;
		const longest = Number(row.longest_streak) || streak;

		if (freezes >= missed) {
			await db.expireStreak(row.member_id, { dayKey: last + missed * DAY_MINUTES, freezesLeft: freezes - missed, broke: false }).catch(() => null);
			await announceStreak(
				client,
				{ guildId: row.discord_server_id, discordMemberId: row.discord_member_id },
				{
					streakResult: {
						streak,
						previousStreak: streak,
						freezeUsed: missed,
						freezesLeft: freezes - missed,
						daysMissed: missed,
						reset: false,
						row: { longest_streak: longest }
					},
					milestone: null
				}
			).catch(() => null);
			continue;
		}

		await db.expireStreak(row.member_id, { dayKey: nowKey - DAY_MINUTES, freezesLeft: freezes, broke: true }).catch(() => null);
		await announceStreak(
			client,
			{ guildId: row.discord_server_id, discordMemberId: row.discord_member_id },
			{
				streakResult: {
					streak: 0,
					previousStreak: streak,
					freezeUsed: 0,
					freezesLeft: freezes,
					daysMissed: missed,
					reset: true,
					row: { longest_streak: longest }
				},
				milestone: null
			}
		).catch(() => null);
	}

	return stale.length;
}

export default { handleTaskClaim, handleLoginClaim, sweepBrokenStreaks };
