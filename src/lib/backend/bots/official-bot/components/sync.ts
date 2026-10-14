import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../../../../database.js';
import {
	logger,
	separateChannelsAndCategories,
	mapCategoriesForSync,
	mapChannelsForSync,
	createGuildSyncDebouncer,
	isSyncedChannelType,
	channelSyncSignature
} from '../../../../utils/index.js';
import { COMMUNITY_DISCORD_URL, DEFAULT_BOT_NICKNAME, getEmbedConfig, publicSiteOrigin } from '../../../config.js';
import { translate } from '../i18n.js';
import type {
	Client,
	DMChannel,
	Guild,
	GuildBasedChannel,
	GuildMember,
	NonThreadGuildBasedChannel,
	Role,
	TextChannel,
	Collection,
	MessageActionRowComponentBuilder,
	PartialGuildMember
} from 'discord.js';
import { HOUR_MS, SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';
import { EMBED_COLORS } from './embedColors.js';
import { FULL_RESYNC_INTERVAL_MS, EVENT_SYNC_DEBOUNCE_MS, EVENT_SYNC_MAX_WAIT_MS, STARTUP_SYNC_DELAY_MS } from '../../../../utils/guildSyncDebounce.js';
import { channelLogLabel } from '../../../../utils/discordChannels.js';

let client: Client | null = null;
let botId: number | null = null;

const MEMBER_LEAVE_DELETE_DELAY_MS = 30000;
const RETENTION_PURGE_INTERVAL_HOURS = 6;
const RETENTION_PURGE_INTERVAL_MS = RETENTION_PURGE_INTERVAL_HOURS * HOUR_MS;
const MEMBER_FETCH_MIN_RATIO = 0.9;
const SELFBOT_SYNC_WAIT_SECONDS = 10;

let isSyncRunning = false;

async function findBotByToken(token: string) {
	try {
		if (process.env.BOT_ID) {
			const bot = await db.getBot(process.env.BOT_ID);
			if (bot && bot.token === token) {
				return bot;
			}
		}

		const bots = await db.getAllBots();
		const bot = bots.find((b) => b.token === token);
		return bot;
	} catch (error) {
		logger.log(`❌ Error finding bot: ${(error as Error).message}`);
		return null;
	}
}

async function syncGuildData(guild: Guild) {
	try {
		if (!botId) {
			logger.log(`⚠️  Bot ID not set, skipping sync for guild: ${guild.name}`);
			return false;
		}

		await guild.fetch();

		let areMembersFetched = true;
		try {
			await guild.members.fetch();
		} catch (memberFetchError) {
			areMembersFetched = false;
			logger.log(
				`⚠️  Could not fetch all members for ${guild.name}: ${(memberFetchError as Error).message}. Continuing with member count: ${guild.memberCount}`
			);
		}

		if (areMembersFetched) {
			const expected = Number(guild.memberCount) || 0;
			const cached = guild.members.cache.size;
			if (expected > 0 && cached < expected * MEMBER_FETCH_MIN_RATIO) {
				areMembersFetched = false;
				logger.log(`⚠️  Member fetch looks incomplete for ${guild.name}: cached ${cached} of ${expected}. Treating as unreliable.`);
			}
		}

		if (areMembersFetched && guild.available === false) {
			areMembersFetched = false;
			logger.log(`⚠️  Guild ${guild.name} is unavailable; treating member list as unreliable.`);
		}

		await guild.channels.fetch();
		await guild.roles.fetch();

		const serverData = await db.upsertOfficialServer(botId, guild);

		if (!serverData) {
			logger.log(`⚠️  Failed to sync server info for ${guild.name}`);
			return false;
		}

		const serverId = serverData.id;

		const { categories, channels } = separateChannelsAndCategories(guild.channels.cache);

		const categoryMap = await db.syncCategories(serverId, mapCategoriesForSync(categories));

		await db.syncChannels(serverId, mapChannelsForSync(channels), categoryMap);

		const roles = Array.from(guild.roles.cache.values()).filter((role) => role.id !== guild.id);

		await db.syncRoles(
			serverId,
			roles.map((role) => ({
				id: role.id,
				name: role.name,
				position: role.position,
				hexColor: role.hexColor,
				permissions: role.permissions
			}))
		);

		try {
			await db.pruneOrphanedCustomSupporterRoles(
				serverId,
				roles.map((role) => role.id)
			);
		} catch (error) {}

		const members = Array.from(guild.members.cache.values());
		if (areMembersFetched) {
			await db.syncMembers(serverId, members);
		} else {
			logger.log(`⏸️  Skipped member sync for ${guild.name}: member list incomplete, keeping stored members`);
		}

		logger.log(
			`✅ Synced server: ${guild.name} (${guild.memberCount} members, ${categories.length} categories, ${channels.length} channels, ${roles.length} roles)`
		);
		return true;
	} catch (error) {
		logger.log(`❌ Error syncing guild data for ${guild.name}: ${(error as Error).message}`);
		return false;
	}
}

const queueGuildSync = createGuildSyncDebouncer(syncGuildData, EVENT_SYNC_DEBOUNCE_MS, EVENT_SYNC_MAX_WAIT_MS);

async function syncAllGuilds() {
	if (!client || isSyncRunning) {
		return;
	}
	isSyncRunning = true;

	try {
		const guilds = client.guilds.cache;
		logger.log(`🔄 Official bot sync started: ${guilds.size} server(s)`);

		let completed = 0;
		let failed = 0;
		for (const [, guild] of guilds) {
			const isOk = await syncGuildData(guild);
			if (isOk) {
				completed++;
			} else {
				failed++;
			}
		}

		logger.log(`✅ Official bot sync completed: ${completed}/${guilds.size} server(s)`);

		if (failed > 0) {
			logger.log(`⏸️  ${failed} guild(s) failed to sync, skipping stale server cleanup this cycle`);
		} else {
			await reapDepartedGuilds(guilds);
		}

		await runRetentionPurge();
	} catch (error) {
		logger.log(`❌ Error syncing all guilds: ${(error as Error).message}`);
	} finally {
		isSyncRunning = false;
	}
}

async function reapDepartedGuilds(guilds: Collection<string, Guild>) {
	if (!botId) {
		return;
	}

	if (guilds.size === 0) {
		logger.log('⏸️  No guilds in cache, skipping stale server cleanup to avoid deleting live data');
		return;
	}

	const unavailable = Array.from(guilds.values()).filter((g) => g.available === false);
	if (unavailable.length > 0) {
		logger.log(`⏸️  ${unavailable.length} guild(s) unavailable, skipping stale server cleanup this cycle`);
		return;
	}

	try {
		const stale = await db.markServersDeletedForBotExcept(botId, Array.from(guilds.keys()));
		if (stale.length > 0) {
			logger.log(
				`🕗 ${stale.length} server(s) the bot is no longer in, scheduled for deletion in ${db.DELETION_RETENTION_DAYS} days: ${stale.map((s) => s.name || s.discord_server_id).join(', ')}`
			);
		}
	} catch (error) {
		logger.log(`❌ Error scheduling stale server deletion: ${(error as Error).message}`);
	}
}

async function runRetentionPurge() {
	try {
		const purged = await db.purgeExpiredDeletions();
		if (purged.servers > 0 || purged.members > 0) {
			logger.log(`🗑️  Retention purge: removed ${purged.servers} server(s) and ${purged.members} member(s) past ${db.DELETION_RETENTION_DAYS} days`);
		}
	} catch (error) {
		logger.log(`❌ Error running retention purge: ${(error as Error).message}`);
	}
}

async function updateBotInfo() {
	if (!botId || !client || !client.user) {
		return;
	}

	try {
		const avatarUrl = client.user.displayAvatarURL({ size: 256 });

		const displayName = client.user.globalName || client.user.username;
		await db.updateBot(botId, {
			name: displayName,
			bot_icon: avatarUrl || null
		});
		logger.log(`✅ Updated bot name and icon from Discord: ${displayName}`);
	} catch (error) {
		logger.log(`⚠️  Failed to update bot info: ${(error as Error).message}`);
	}
}

async function findGreetingChannel(guild: Guild) {
	const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
	if (!me) {
		return null;
	}

	const canSend = (channel: GuildBasedChannel | null): channel is TextChannel => {
		if (!channel || channel.type !== ChannelType.GuildText) {
			return false;
		}
		const perms = channel.permissionsFor(me);
		return Boolean(perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.SendMessages));
	};

	if (canSend(guild.systemChannel)) {
		return guild.systemChannel;
	}

	const channels = await guild.channels.fetch().catch(() => null);
	if (!channels) {
		return null;
	}

	return [...channels.values()].filter(canSend).sort((a, b) => a.position - b.position)[0] || null;
}

async function isAiChatReady() {
	if (!botId) {
		return false;
	}
	try {
		const config = db.aiFromDbRow(await db.getAiByBotId(botId));
		return !!(config.enabled && config.api_url && config.api_key && config.model);
	} catch {
		return false;
	}
}

async function sendJoinGreeting(guild: Guild) {
	try {
		if (!(await db.claimGuildGreeting(botId!, guild.id))) {
			logger.log(`↩️  Greeting already sent for ${guild.name} by another bot, skipping`);
			return;
		}

		const channel = await findGreetingChannel(guild);
		if (!channel) {
			logger.log(`⚠️  No channel available to greet in guild: ${guild.name}`);
			await db.resetGuildGreeting(guild.id).catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(guild.id).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }));
		const botName = embedConfig.NICKNAME;

		let description = await translate('interface.panel.joinBody', { guildId: guild.id, userId: '' }, { botName });
		if (await isAiChatReady()) {
			const botMention = client?.user ? `<@${client.user.id}>` : botName;
			description += `\n\n${await translate('interface.panel.joinAskAi', { guildId: guild.id, userId: '' }, { botMention })}`;
		}

		const embed = new EmbedBuilder()
			.setColor(EMBED_COLORS.success)
			.setTitle(await translate('interface.panel.joinTitle', { guildId: guild.id, userId: '' }, { botName }))
			.setDescription(description);

		const buttons = [];
		buttons.push(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(`${publicSiteOrigin()}/docs`)
				.setLabel((await translate('interface.panel.joinDocsButton', { guildId: guild.id, userId: '' })).slice(0, DISCORD_LIMITS.BUTTON_LABEL))
		);
		buttons.push(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(COMMUNITY_DISCORD_URL)
				.setLabel((await translate('interface.panel.joinSupportButton', { guildId: guild.id, userId: '' })).slice(0, DISCORD_LIMITS.BUTTON_LABEL))
		);

		await channel.send({
			embeds: [embed],
			components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons)]
		});
		logger.log(`👋 Sent join greeting in ${guild.name} (#${channel.name})`);
	} catch (error) {
		logger.log(`⚠️  Failed to send join greeting: ${(error as Error).message}`);
		await db.resetGuildGreeting(guild.id).catch(() => null);
	}
}

function startSyncTimers() {
	setTimeout(async () => {
		if (!botId) {
			return;
		}

		logger.log('🔄 Official bot startup guild sync...');
		await syncAllGuilds();
		logger.log('✅ Official bot startup guild sync complete');

		const connectedSelfbots = await db.getSelfbotsForOfficialBot(botId);
		if (connectedSelfbots.length > 0) {
			logger.log(`⏳ Waiting for ${connectedSelfbots.length} connected selfbot(s) to finish syncing...`);
			await new Promise((resolve) => setTimeout(resolve, SELFBOT_SYNC_WAIT_SECONDS * SECOND_MS));
			logger.log('✅ Connected selfbots should be synced now');
		}

		logger.log('ℹ️  Note: Booster status (is_booster, booster_since) will be updated automatically when member events occur');
	}, STARTUP_SYNC_DELAY_MS);

	setInterval(() => {
		if (botId) {
			runRetentionPurge();
		}
	}, RETENTION_PURGE_INTERVAL_MS);

	setInterval(() => {
		if (!botId) {
			return;
		}
		logger.log('🔄 Official bot periodic guild re-sync...');
		syncAllGuilds().catch((error) => logger.log(`❌ Periodic guild re-sync failed: ${error.message}`));
	}, FULL_RESYNC_INTERVAL_MS);
}

async function onGuildCreate(guild: Guild) {
	logger.log(`🆕 Bot joined new guild: ${guild.name}`);
	await syncGuildData(guild);
	await sendJoinGreeting(guild);
}

async function onGuildDelete(guild: Guild) {
	if (!botId) {
		return;
	}
	if (guild.available === false) {
		logger.log(`⏸️  Guild unavailable (Discord outage), keeping data: ${guild.name || guild.id}`);
		return;
	}
	try {
		const marked = await db.markOfficialServerDeletedByDiscordId(botId, guild.id);
		if (marked) {
			logger.log(`🕗 Bot removed from guild, data scheduled for deletion in ${db.DELETION_RETENTION_DAYS} days: ${guild.name || guild.id}`);
		}
	} catch (error) {
		logger.log(`❌ Failed to schedule deletion for ${guild.name || guild.id}: ${(error as Error).message}`);
	}
}

async function onChannelCreate(channel: NonThreadGuildBasedChannel) {
	if (!channel.guild || !isSyncedChannelType(channel)) {
		return;
	}
	await logger.log(`📁 ${channelLogLabel(channel)} created: **${channel.name || 'Unknown'}** (${channel.id})`);
	queueGuildSync(channel.guild);
}

async function onChannelUpdate(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
	if (newChannel.isDMBased() || !isSyncedChannelType(newChannel)) {
		return;
	}
	if (channelSyncSignature(oldChannel) === channelSyncSignature(newChannel)) {
		return;
	}
	const oldName = (oldChannel as NonThreadGuildBasedChannel).name || 'Unknown';
	const newName = newChannel.name || 'Unknown';
	if (oldName !== newName) {
		await logger.log(`✏️ ${channelLogLabel(newChannel)} renamed: **${oldName}** → **${newName}** (${newChannel.id})`);
	} else {
		await logger.log(`✏️ ${channelLogLabel(newChannel)} updated: **${newName}** (${newChannel.id})`);
	}
	queueGuildSync(newChannel.guild);
}

async function onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
	if (channel.isDMBased() || !isSyncedChannelType(channel)) {
		return;
	}
	await logger.log(`🗑️ ${channelLogLabel(channel)} deleted: **${channel.name || 'Unknown'}** (${channel.id})`);
	queueGuildSync(channel.guild);
}

function roleColorLabel(role: Role) {
	return role.hexColor !== '#000000' ? role.hexColor : 'No color';
}

async function onRoleUpdate(oldRole: Role, newRole: Role) {
	if (!newRole.guild) {
		return;
	}
	const oldName = oldRole.name || 'Unknown';
	const newName = newRole.name || 'Unknown';
	const oldColor = roleColorLabel(oldRole);
	const newColor = roleColorLabel(newRole);
	if (oldName !== newName) {
		await logger.log(`✏️ Role renamed: **${oldName}** → **${newName}** (${newRole.id})`);
	} else if (oldColor !== newColor) {
		await logger.log(`✏️ Role color updated: **${newName}** (${oldColor} → ${newColor}) (${newRole.id})`);
	} else {
		await logger.log(`✏️ Role updated: **${newName}** (${newRole.id})`);
	}
}

async function upsertMemberWithRoles(member: GuildMember) {
	const serverData = await db.getServerByDiscordId(botId!, member.guild.id);
	if (!serverData) {
		return;
	}
	const dbMember = await db.upsertMember(serverData.id, member);
	if (dbMember && !member.user?.bot) {
		const memberRoles = Array.from(member.roles.cache.keys()).filter((roleId) => roleId !== member.guild.id);
		await db.syncMemberRoles(dbMember.id, memberRoles, serverData.id);
	}
}

async function onMemberAdd(member: GuildMember) {
	if (!member.guild || !botId) {
		return;
	}
	try {
		await upsertMemberWithRoles(member);
	} catch (error) {
		await logger.log(`⚠️ Failed to upsert member ${member.id} on join: ${(error as Error).message}`);
	}
	queueGuildSync(member.guild);
}

async function forgetLeftMember(member: GuildMember | PartialGuildMember, { guildName, memberTag }: { guildName: string; memberTag: string }) {
	try {
		if (member.guild.members.cache.has(member.id)) {
			logger.log(`↩️  Member ${memberTag} rejoined ${guildName} before the grace delay, keeping data`);
			return;
		}
		if (await member.guild.members.fetch(member.id).catch(() => null)) {
			logger.log(`↩️  Member ${memberTag} is still in ${guildName}, keeping data`);
			return;
		}
		const serverData = await db.getServerByDiscordId(botId!, member.guild.id);
		if (!serverData) {
			return;
		}
		if (await db.markMemberDeletedByDiscordId(serverData.id, member.id)) {
			logger.log(`🕗 Member left, data scheduled for deletion in ${db.DELETION_RETENTION_DAYS} days: ${memberTag} in ${guildName}`);
		}
	} catch (error) {
		await logger.log(`⚠️ Failed to delete member ${member.id} on leave: ${(error as Error).message}`);
	}
}

function onMemberRemove(member: GuildMember | PartialGuildMember) {
	if (!member.guild || !botId) {
		return;
	}
	if (member.guild.available === false) {
		logger.log(`⏸️  Guild unavailable, not marking member ${member.id} deleted`);
		return;
	}
	queueGuildSync(member.guild);
	if (!member.user?.bot) {
		const details = { guildName: member.guild.name, memberTag: member.user?.tag || member.id };
		setTimeout(() => forgetLeftMember(member, details), MEMBER_LEAVE_DELETE_DELAY_MS);
	}
}

async function onMemberUpdate(newMember: GuildMember) {
	if (!newMember.guild || !botId || !newMember.user || newMember.user.bot) {
		return;
	}
	try {
		await upsertMemberWithRoles(newMember);
	} catch (error) {
		logger.log(`❌ Error syncing member on update: ${(error as Error).message}`);
	}
}

function registerSyncEvents(discordClient: Client) {
	discordClient.on('guildCreate', onGuildCreate);
	discordClient.on('guildDelete', onGuildDelete);
	discordClient.on('channelCreate', onChannelCreate);
	discordClient.on('channelUpdate', onChannelUpdate);
	discordClient.on('channelDelete', onChannelDelete);
	discordClient.on('roleCreate', async (role: Role) => {
		if (role.guild) {
			await logger.log(`🎭 Role created: **${role.name || 'Unknown'}** (${roleColorLabel(role)}) (${role.id})`);
		}
	});
	discordClient.on('roleUpdate', onRoleUpdate);
	discordClient.on('roleDelete', async (role: Role) => {
		if (role.guild) {
			await logger.log(`🗑️ Role deleted: **${role.name || 'Unknown'}** (${role.id})`);
			queueGuildSync(role.guild);
		}
	});
	discordClient.on('guildMemberAdd', onMemberAdd);
	discordClient.on('guildMemberRemove', onMemberRemove);
	discordClient.on('guildMemberUpdate', (_oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => onMemberUpdate(newMember));
	discordClient.on('guildUpdate', (_oldGuild: Guild, newGuild: Guild) => {
		if (botId) {
			queueGuildSync(newGuild);
		}
	});
}

async function init(discordClient: Client, botToken: string) {
	client = discordClient;

	const bot = await findBotByToken(botToken);
	if (!bot) {
		logger.log(`⚠️  Bot not found in database with token. Sync will be limited.`);
		logger.log(`💡 Create bot entry in database first`);
		return;
	}

	botId = bot.id;
	logger.log(`✅ Found bot in database: ${bot.name} (official)`);

	if (client.user) {
		await updateBotInfo();
	}

	startSyncTimers();
	registerSyncEvents(client);
}

export function getBotId() {
	return botId;
}

export default { init, syncGuildData, syncAllGuilds, getBotId };
