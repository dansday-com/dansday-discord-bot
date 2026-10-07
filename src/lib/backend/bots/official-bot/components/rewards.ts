import { PermissionFlagsBits } from 'discord.js';
import { REWARDS_CONFIG, getServerForCurrentBot, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import {
	limitedRewardCandidates,
	planRewards,
	rewardProgress,
	type Reward,
	type RewardEarning,
	type RewardProgress,
	type RewardRules
} from '../../../../rewards.js';

export type RewardRoleBlock = 'deleted' | 'managed' | 'no_permission' | 'above_bot';

const RULES_TTL_MS = 60_000;

const guildSyncRunning = new Set<string>();
const guildSyncAgain = new Set<string>();
const rulesCache = new Map<string, { at: number; rules: RewardRules | null }>();

function rewardRoleBlock(guild: any, roleId: string): RewardRoleBlock | null {
	const role = guild.roles.cache.get(roleId);
	if (!role) return 'deleted';
	if (role.managed) return 'managed';
	if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'no_permission';
	if (!role.editable) return 'above_bot';
	return null;
}

async function activeRules(guildId: string): Promise<RewardRules | null> {
	if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.leveling))) return null;
	const rules = await REWARDS_CONFIG.getRules(guildId).catch(() => null);
	return rules && rules.rewards.length > 0 ? rules : null;
}

async function cachedRules(guildId: string): Promise<RewardRules | null> {
	const hit = rulesCache.get(guildId);
	if (hit && Date.now() - hit.at < RULES_TTL_MS) return hit.rules;
	const rules = await activeRules(guildId).catch(() => null);
	rulesCache.set(guildId, { at: Date.now(), rules });
	return rules;
}

async function payRewardXp(guildId: string, memberId: number, xp: number) {
	const { snapshotMembers, finalizeXpChanges } = await import('./items.js');
	const snaps = await snapshotMembers([memberId]);
	const stats = await db.updateMemberLevelStats(memberId, { xpIncrement: xp });
	await db
		.logMemberLevelGain(memberId, {
			source: 'reward',
			xp,
			xp_total: stats?.xp != null ? Number(stats.xp) : null,
			level: stats?.level != null ? Number(stats.level) : null,
			rank: stats?.rank != null ? Number(stats.rank) : null
		})
		.catch(() => null);
	await finalizeXpChanges(guildId, snaps, 'reward');
}

async function grantReward(guildId: string, memberId: number, reward: Reward, earnings: Map<number, RewardEarning>) {
	const paid = reward.kind === 'xp';
	const won = await db.earnMemberReward(memberId, reward.id, reward.winner_limit, paid).catch(() => false);
	if (!won) return;
	earnings.set(reward.id, { delivered: paid });
	if (paid) await payRewardXp(guildId, memberId, reward.xp);
}

async function applyRewards(
	guild: any,
	member: any,
	memberId: number,
	rules: RewardRules,
	progress: RewardProgress,
	earnings: Map<number, RewardEarning>,
	before?: Partial<RewardProgress> | null
): Promise<{ added: string[]; removed: string[] }> {
	for (const reward of limitedRewardCandidates(rules, progress, earnings, before)) await grantReward(guild.id, memberId, reward, earnings);

	const plan = planRewards(rules, progress, member.roles.cache.keys(), earnings);
	for (const reward of plan.withdraw) {
		if (await db.withdrawMemberReward(memberId, reward.id).catch(() => false)) earnings.delete(reward.id);
	}
	for (const reward of plan.earn) await grantReward(guild.id, memberId, reward, earnings);

	const added: string[] = [];
	const removed: string[] = [];
	for (const roleId of plan.addRoles) {
		if (rewardRoleBlock(guild, roleId)) continue;
		try {
			await member.roles.add(roleId, 'Reward');
			added.push(roleId);
		} catch (err: any) {
			await logger.log(`⚠️ Reward add ${roleId} failed for ${member.id} in ${guild.id}: ${err.message}`);
		}
	}
	for (const roleId of plan.removeRoles) {
		if (rewardRoleBlock(guild, roleId)) continue;
		try {
			await member.roles.remove(roleId, 'Reward');
			removed.push(roleId);
		} catch (err: any) {
			await logger.log(`⚠️ Reward remove ${roleId} failed for ${member.id} in ${guild.id}: ${err.message}`);
		}
	}
	return { added, removed };
}

export async function syncMemberRewards(guild: any, discordMemberId: string, before?: Partial<RewardProgress> | null): Promise<string[]> {
	try {
		const rules = await activeRules(guild.id);
		if (!rules) return [];
		const member = await guild.members.fetch(discordMemberId).catch(() => null);
		if (!member || member.user?.bot) return [];
		const server = await getServerForCurrentBot(guild.id);
		const stats = await db.getMemberLevelByDiscordId(server.id, String(discordMemberId));
		if (!stats?.member_id) return [];
		const earnings = await db.getMemberRewardEarnings(stats.member_id);
		const { added } = await applyRewards(guild, member, Number(stats.member_id), rules, rewardProgress(stats), earnings, before);
		return added;
	} catch (err: any) {
		await logger.log(`⚠️ Reward sync failed for ${discordMemberId} in ${guild?.id}: ${err.message}`);
		return [];
	}
}

export async function checkRewardProgress(guild: any, discordMemberId: string, beforeStats: any, afterStats: any) {
	try {
		if (!guild || !beforeStats || !afterStats) return;
		const rules = await cachedRules(guild.id);
		if (!rules) return;
		const before = rewardProgress(beforeStats);
		const after = rewardProgress(afterStats);
		const crossed = rules.rewards.some((r) => r.goal_type !== 'level' && before[r.goal_type] < r.goal && after[r.goal_type] >= r.goal);
		if (crossed) await syncMemberRewards(guild, discordMemberId, before);
	} catch (_) {}
}

async function runGuildSync(guild: any) {
	do {
		guildSyncAgain.delete(guild.id);
		const rules = await activeRules(guild.id);
		if (!rules) continue;
		const server = await getServerForCurrentBot(guild.id);
		const rows = await db.getRewardProgressForServer(server.id);
		const earningsByMember = await db.getRewardEarningsForServer(server.id);
		const members = await guild.members.fetch().catch(() => null);
		if (!members) {
			await logger.log(`⚠️ Reward sync could not load members for ${guild.id}`);
			continue;
		}
		let added = 0;
		let removed = 0;
		for (const row of rows) {
			const member = members.get(row.discord_member_id);
			if (!member || member.user?.bot) continue;
			const earnings = earningsByMember.get(row.member_id) ?? new Map<number, RewardEarning>();
			const result = await applyRewards(guild, member, row.member_id, rules, rewardProgress(row.stats), earnings);
			added += result.added.length;
			removed += result.removed.length;
		}
		await logger.log(`🎁 Rewards synced in ${guild.name}: ${added} role(s) given, ${removed} taken back`);
	} while (guildSyncAgain.has(guild.id));
}

export async function syncGuildRewards(client: any, guildId: string) {
	const guild = client.guilds.cache.get(String(guildId));
	if (!guild) return { ok: false, error: 'Bot is not in this server' };
	rulesCache.delete(guild.id);

	const rules = await REWARDS_CONFIG.getRules(guild.id).catch(() => null);
	const blocked = (rules?.rewards ?? [])
		.filter((r) => r.kind === 'role' && r.role_id)
		.map((r) => ({ role_id: r.role_id as string, reason: rewardRoleBlock(guild, r.role_id as string) }))
		.filter((b): b is { role_id: string; reason: RewardRoleBlock } => b.reason !== null);

	if (guildSyncRunning.has(guild.id)) {
		guildSyncAgain.add(guild.id);
		return { ok: true, blocked };
	}
	guildSyncRunning.add(guild.id);
	void runGuildSync(guild)
		.catch(async (err: any) => {
			await logger.log(`❌ Reward sync failed in ${guild.id}: ${err.message}`);
		})
		.finally(() => guildSyncRunning.delete(guild.id));
	return { ok: true, blocked };
}
