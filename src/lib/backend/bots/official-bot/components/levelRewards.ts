import { PermissionFlagsBits } from 'discord.js';
import { LEVEL_REWARDS_CONFIG, getServerForCurrentBot, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { planRewardRoles, type LevelRewardRules } from '../../../../level-rewards.js';

export type RewardRoleBlock = 'deleted' | 'managed' | 'no_permission' | 'above_bot';

const guildSyncRunning = new Set<string>();
const guildSyncAgain = new Set<string>();

function rewardRoleBlock(guild: any, roleId: string): RewardRoleBlock | null {
	const role = guild.roles.cache.get(roleId);
	if (!role) return 'deleted';
	if (role.managed) return 'managed';
	if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'no_permission';
	if (!role.editable) return 'above_bot';
	return null;
}

async function activeRules(guildId: string): Promise<LevelRewardRules | null> {
	if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.leveling))) return null;
	const rules = await LEVEL_REWARDS_CONFIG.getRules(guildId).catch(() => null);
	return rules && rules.rewards.length > 0 ? rules : null;
}

async function applyRewardRoles(guild: any, member: any, rules: LevelRewardRules, level: number): Promise<{ added: string[]; removed: string[] }> {
	const { add, remove } = planRewardRoles(rules, level, member.roles.cache.keys());
	const added: string[] = [];
	const removed: string[] = [];
	const reason = `Level reward · level ${level}`;
	for (const roleId of add) {
		if (rewardRoleBlock(guild, roleId)) continue;
		try {
			await member.roles.add(roleId, reason);
			added.push(roleId);
		} catch (err: any) {
			await logger.log(`⚠️ Level reward add ${roleId} failed for ${member.id} in ${guild.id}: ${err.message}`);
		}
	}
	for (const roleId of remove) {
		if (rewardRoleBlock(guild, roleId)) continue;
		try {
			await member.roles.remove(roleId, reason);
			removed.push(roleId);
		} catch (err: any) {
			await logger.log(`⚠️ Level reward remove ${roleId} failed for ${member.id} in ${guild.id}: ${err.message}`);
		}
	}
	return { added, removed };
}

export async function syncMemberLevelRewards(guild: any, discordMemberId: string, level: number): Promise<string[]> {
	try {
		const rules = await activeRules(guild.id);
		if (!rules) return [];
		const member = await guild.members.fetch(discordMemberId).catch(() => null);
		if (!member || member.user?.bot) return [];
		const { added } = await applyRewardRoles(guild, member, rules, level);
		return added;
	} catch (err: any) {
		await logger.log(`⚠️ Level reward sync failed for ${discordMemberId} in ${guild?.id}: ${err.message}`);
		return [];
	}
}

async function runGuildSync(guild: any) {
	do {
		guildSyncAgain.delete(guild.id);
		const rules = await activeRules(guild.id);
		if (!rules) continue;
		const server = await getServerForCurrentBot(guild.id);
		const levels = await db.getMemberLevelsForServer(server.id);
		const members = await guild.members.fetch().catch(() => null);
		if (!members) {
			await logger.log(`⚠️ Level reward sync could not load members for ${guild.id}`);
			continue;
		}
		let added = 0;
		let removed = 0;
		for (const { discord_member_id, level } of levels) {
			const member = members.get(discord_member_id);
			if (!member || member.user?.bot) continue;
			const result = await applyRewardRoles(guild, member, rules, level);
			added += result.added.length;
			removed += result.removed.length;
		}
		await logger.log(`🎁 Level rewards synced in ${guild.name}: ${added} role(s) given, ${removed} taken back`);
	} while (guildSyncAgain.has(guild.id));
}

export async function syncGuildLevelRewards(client: any, guildId: string) {
	const guild = client.guilds.cache.get(String(guildId));
	if (!guild) return { ok: false, error: 'Bot is not in this server' };

	const rules = await LEVEL_REWARDS_CONFIG.getRules(guild.id).catch(() => null);
	const blocked = (rules?.rewards ?? [])
		.map((r) => ({ role_id: r.role_id, reason: rewardRoleBlock(guild, r.role_id) }))
		.filter((b): b is { role_id: string; reason: RewardRoleBlock } => b.reason !== null);

	if (guildSyncRunning.has(guild.id)) {
		guildSyncAgain.add(guild.id);
		return { ok: true, blocked };
	}
	guildSyncRunning.add(guild.id);
	void runGuildSync(guild)
		.catch(async (err: any) => {
			await logger.log(`❌ Level reward sync failed in ${guild.id}: ${err.message}`);
		})
		.finally(() => guildSyncRunning.delete(guild.id));
	return { ok: true, blocked };
}
