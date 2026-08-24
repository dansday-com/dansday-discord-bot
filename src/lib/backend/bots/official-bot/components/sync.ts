import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../../../../database.js';
import { logger, separateChannelsAndCategories, mapCategoriesForSync, mapChannelsForSync } from '../../../../utils/index.js';
import { COMMUNITY_DISCORD_URL, DEFAULT_BOT_NICKNAME, getEmbedConfig, publicSiteOrigin } from '../../../config.js';
import { translate } from '../i18n.js';

let client = null;
let botId = null;

const MEMBER_LEAVE_DELETE_DELAY_MS = 30000;
const RETENTION_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MEMBER_FETCH_MIN_RATIO = 0.9;

async function findBotByToken(token) {
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
		logger.log(`❌ Error finding bot: ${error.message}`);
		return null;
	}
}

async function syncGuildData(guild) {
	try {
		if (!botId) {
			logger.log(`⚠️  Bot ID not set, skipping sync for guild: ${guild.name}`);
			return false;
		}

		await guild.fetch();

		let membersFetched = true;
		try {
			await guild.members.fetch();
		} catch (memberFetchError) {
			membersFetched = false;
			logger.log(`⚠️  Could not fetch all members for ${guild.name}: ${memberFetchError.message}. Continuing with member count: ${guild.memberCount}`);
		}

		if (membersFetched) {
			const expected = Number(guild.memberCount) || 0;
			const cached = guild.members.cache.size;
			if (expected > 0 && cached < expected * MEMBER_FETCH_MIN_RATIO) {
				membersFetched = false;
				logger.log(`⚠️  Member fetch looks incomplete for ${guild.name}: cached ${cached} of ${expected}. Treating as unreliable.`);
			}
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
			const { CUSTOM_SUPPORTER_ROLE } = await import('../../config.js');
			const constraints = await CUSTOM_SUPPORTER_ROLE.getStoredRoleConstraints(guild.id);
			if (constraints.ROLE_START && constraints.ROLE_END) {
				await db.updateCustomRoleFlags(serverId, constraints.ROLE_START, constraints.ROLE_END);
			} else {
				await db.updateCustomRoleFlags(serverId, null, null);
			}
		} catch (error) {}

		const members = Array.from(guild.members.cache.values()).filter((member) => !member.user.bot);
		if (membersFetched) {
			await db.syncMembers(serverId, members);
		} else {
			logger.log(`⏸️  Skipped member sync for ${guild.name}: member list incomplete, keeping stored members`);
		}

		logger.log(
			`✅ Synced server: ${guild.name} (${guild.memberCount} members, ${categories.length} categories, ${channels.length} channels, ${roles.length} roles)`
		);
		return true;
	} catch (error) {
		logger.log(`❌ Error syncing guild data for ${guild.name}: ${error.message}`);
		return false;
	}
}

async function syncAllGuilds() {
	if (!client) return;

	try {
		const guilds = client.guilds.cache;
		logger.log(`🔄 Official bot sync started: ${guilds.size} server(s)`);

		let completed = 0;
		let failed = 0;
		for (const [, guild] of guilds) {
			const ok = await syncGuildData(guild);
			if (ok) completed++;
			else failed++;
		}

		logger.log(`✅ Official bot sync completed: ${completed}/${guilds.size} server(s)`);

		if (failed > 0) {
			logger.log(`⏸️  ${failed} guild(s) failed to sync, skipping stale server cleanup this cycle`);
		} else {
			await reapDepartedGuilds(guilds);
		}

		await runRetentionPurge();
	} catch (error) {
		logger.log(`❌ Error syncing all guilds: ${error.message}`);
	}
}

async function reapDepartedGuilds(guilds) {
	if (!botId) return;

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
		logger.log(`❌ Error scheduling stale server deletion: ${error.message}`);
	}
}

async function runRetentionPurge() {
	try {
		const purged = await db.purgeExpiredDeletions();
		if (purged.servers > 0 || purged.members > 0) {
			logger.log(`🗑️  Retention purge: removed ${purged.servers} server(s) and ${purged.members} member(s) past ${db.DELETION_RETENTION_DAYS} days`);
		}
	} catch (error) {
		logger.log(`❌ Error running retention purge: ${error.message}`);
	}
}

async function updateBotInfo() {
	if (!botId || !client || !client.user) {
		return;
	}

	try {
		const avatarUrl = client.user.displayAvatarURL({ dynamic: true, size: 256 });

		const displayName = client.user.globalName || client.user.username;
		await db.updateBot(botId, {
			name: displayName,
			bot_icon: avatarUrl || null
		});
		logger.log(`✅ Updated bot name and icon from Discord: ${displayName}`);
	} catch (error) {
		logger.log(`⚠️  Failed to update bot info: ${error.message}`);
	}
}

async function findGreetingChannel(guild) {
	const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
	if (!me) return null;

	const canSend = (channel) => {
		if (!channel || channel.type !== ChannelType.GuildText) return false;
		const perms = channel.permissionsFor(me);
		return Boolean(perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.SendMessages));
	};

	if (canSend(guild.systemChannel)) return guild.systemChannel;

	const channels = await guild.channels.fetch().catch(() => null);
	if (!channels) return null;

	return [...channels.values()].filter(canSend).sort((a, b) => a.position - b.position)[0] || null;
}

async function isAiChatReady() {
	if (!botId) return false;
	try {
		const config = db.botAiFromDbRow(await db.getBotAiByBotId(botId));
		return !!(config.enabled && config.api_url && config.api_key && config.model);
	} catch {
		return false;
	}
}

async function sendJoinGreeting(guild) {
	try {
		if (!(await db.claimGuildGreeting(botId, guild.id))) {
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

		let description = await translate('interface.panel.joinBody', guild.id, '', { botName });
		if (await isAiChatReady()) {
			const botMention = client?.user ? `<@${client.user.id}>` : botName;
			description += `\n\n${await translate('interface.panel.joinAskAi', guild.id, '', { botMention })}`;
		}

		const embed = new EmbedBuilder()
			.setColor(0x57f287)
			.setTitle(await translate('interface.panel.joinTitle', guild.id, '', { botName }))
			.setDescription(description);

		const buttons = [];
		const origin = publicSiteOrigin();
		if (origin) {
			buttons.push(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setURL(`${origin}/docs`)
					.setLabel((await translate('interface.panel.joinDocsButton', guild.id, '')).slice(0, 80))
			);
		}
		buttons.push(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(COMMUNITY_DISCORD_URL)
				.setLabel((await translate('interface.panel.joinSupportButton', guild.id, '')).slice(0, 80))
		);

		await channel.send({
			embeds: [embed],
			components: [new ActionRowBuilder().addComponents(...buttons)]
		});
		logger.log(`👋 Sent join greeting in ${guild.name} (#${channel.name})`);
	} catch (error) {
		logger.log(`⚠️  Failed to send join greeting: ${error.message}`);
		await db.resetGuildGreeting(guild.id).catch(() => null);
	}
}

async function init(discordClient, botToken) {
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

	setTimeout(async () => {
		if (!botId) return;

		logger.log('🔄 Official bot startup guild sync...');
		await syncAllGuilds();
		logger.log('✅ Official bot startup guild sync complete');

		const botIdNum = typeof botId === 'string' ? parseInt(botId) : botId;
		const connectedSelfbots = await db.getSelfbotsForOfficialBot(botIdNum);
		if (connectedSelfbots.length > 0) {
			logger.log(`⏳ Waiting for ${connectedSelfbots.length} connected selfbot(s) to finish syncing...`);
			await new Promise((resolve) => setTimeout(resolve, 10000));
			logger.log('✅ Connected selfbots should be synced now');
		}

		logger.log('ℹ️  Note: Booster status (is_booster, booster_since) will be updated automatically when member events occur');
	}, 2000);

	setInterval(() => {
		if (!botId) return;
		runRetentionPurge();
	}, RETENTION_PURGE_INTERVAL_MS);

	client.on('guildCreate', async (guild) => {
		logger.log(`🆕 Bot joined new guild: ${guild.name}`);
		await syncGuildData(guild);
		await sendJoinGreeting(guild);
	});

	client.on('guildDelete', async (guild) => {
		if (!botId) return;
		if (guild.available === false || guild.unavailable === true) {
			logger.log(`⏸️  Guild unavailable (Discord outage), keeping data: ${guild.name || guild.id}`);
			return;
		}

		try {
			const marked = await db.markOfficialServerDeletedByDiscordId(botId, guild.id);
			if (marked) {
				logger.log(`🕗 Bot removed from guild, data scheduled for deletion in ${db.DELETION_RETENTION_DAYS} days: ${guild.name || guild.id}`);
			}
		} catch (error) {
			logger.log(`❌ Failed to schedule deletion for ${guild.name || guild.id}: ${error.message}`);
		}
	});

	client.on('channelCreate', async (channel) => {
		if (channel.guild) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			const channelName = channel.name || 'Unknown';
			await logger.log(`📁 ${channelType} created: **${channelName}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	client.on('channelUpdate', async (oldChannel, newChannel) => {
		if (newChannel.guild) {
			const channelType = newChannel.type === 4 ? 'Category' : newChannel.type === 0 ? 'Text Channel' : newChannel.type === 5 ? 'News Channel' : 'Channel';
			const oldName = oldChannel.name || 'Unknown';
			const newName = newChannel.name || 'Unknown';

			if (oldName !== newName) {
				await logger.log(`✏️ ${channelType} renamed: **${oldName}** → **${newName}** (${newChannel.id})`);
			} else {
				await logger.log(`✏️ ${channelType} updated: **${newName}** (${newChannel.id})`);
			}
			await syncGuildData(newChannel.guild);
		}
	});

	client.on('channelDelete', async (channel) => {
		if (channel.guild) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			const channelName = channel.name || 'Unknown';
			await logger.log(`🗑️ ${channelType} deleted: **${channelName}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	client.on('roleCreate', async (role) => {
		if (role.guild) {
			const roleName = role.name || 'Unknown';
			const roleColor = role.hexColor !== '#000000' ? role.hexColor : 'No color';
			await logger.log(`🎭 Role created: **${roleName}** (${roleColor}) (${role.id})`);
		}
	});

	client.on('roleUpdate', async (oldRole, newRole) => {
		if (newRole.guild) {
			const oldName = oldRole.name || 'Unknown';
			const newName = newRole.name || 'Unknown';
			const oldColor = oldRole.hexColor !== '#000000' ? oldRole.hexColor : 'No color';
			const newColor = newRole.hexColor !== '#000000' ? newRole.hexColor : 'No color';

			if (oldName !== newName) {
				await logger.log(`✏️ Role renamed: **${oldName}** → **${newName}** (${newRole.id})`);
			} else if (oldColor !== newColor) {
				await logger.log(`✏️ Role color updated: **${newName}** (${oldColor} → ${newColor}) (${newRole.id})`);
			} else {
				await logger.log(`✏️ Role updated: **${newName}** (${newRole.id})`);
			}
		}
	});

	client.on('roleDelete', async (role) => {
		if (role.guild) {
			const roleName = role.name || 'Unknown';
			await logger.log(`🗑️ Role deleted: **${roleName}** (${role.id})`);
			await syncGuildData(role.guild);
		}
	});

	client.on('guildMemberAdd', async (member) => {
		if (member.guild && botId) {
			try {
				const serverData = await db.getServerByDiscordId(botId, member.guild.id);
				if (serverData) {
					const dbMember = await db.upsertMember(serverData.id, member);
					if (dbMember) {
						const memberRoles = member.roles ? Array.from(member.roles.cache.keys()).filter((roleId) => roleId !== member.guild.id) : [];
						await db.syncMemberRoles(dbMember.id, memberRoles, serverData.id);
					}
				}
			} catch (error) {
				await logger.log(`⚠️ Failed to upsert member ${member.id} on join: ${error.message}`);
			}
			await syncGuildData(member.guild);
		}
	});

	client.on('guildMemberRemove', async (member) => {
		if (member.guild && botId) {
			if (member.guild.available === false) {
				logger.log(`⏸️  Guild unavailable, not marking member ${member.id} deleted`);
				return;
			}

			await syncGuildData(member.guild);

			if (!member.user?.bot) {
				const guildName = member.guild.name;
				const memberTag = member.user?.tag || member.id;
				setTimeout(async () => {
					try {
						if (member.guild.members.cache.has(member.id)) {
							logger.log(`↩️  Member ${memberTag} rejoined ${guildName} before the grace delay, keeping data`);
							return;
						}

						const stillGone = await member.guild.members.fetch(member.id).catch(() => null);
						if (stillGone) {
							logger.log(`↩️  Member ${memberTag} is still in ${guildName}, keeping data`);
							return;
						}

						const serverData = await db.getServerByDiscordId(botId, member.guild.id);
						if (!serverData) return;
						const marked = await db.markMemberDeletedByDiscordId(serverData.id, member.id);
						if (marked) {
							logger.log(`🕗 Member left, data scheduled for deletion in ${db.DELETION_RETENTION_DAYS} days: ${memberTag} in ${guildName}`);
						}
					} catch (error) {
						await logger.log(`⚠️ Failed to delete member ${member.id} on leave: ${error.message}`);
					}
				}, MEMBER_LEAVE_DELETE_DELAY_MS);
			}
		}
	});

	client.on('guildMemberUpdate', async (oldMember, newMember) => {
		if (newMember.guild && botId && newMember.user && !newMember.user.bot) {
			try {
				const serverData = await db.getServerByDiscordId(botId, newMember.guild.id);
				if (serverData) {
					const dbMember = await db.upsertMember(serverData.id, newMember);
					if (dbMember) {
						const memberRoles = newMember.roles ? Array.from(newMember.roles.cache.keys()).filter((roleId) => roleId !== newMember.guild?.id) : [];
						await db.syncMemberRoles(dbMember.id, memberRoles, serverData.id);
					}
				}
			} catch (error) {
				logger.log(`❌ Error syncing member on update: ${error.message}`);
			}
		}
	});

	client.on('guildUpdate', async (oldGuild, newGuild) => {
		if (botId) {
			await syncGuildData(newGuild);
		}
	});
}

export function getBotId() {
	return botId;
}

export async function resendJoinGreeting(discordServerId) {
	const guild = client?.guilds?.cache?.get(String(discordServerId));
	if (!guild) return { success: false, error: 'guild_not_found' };
	await db.resetGuildGreeting(guild.id);
	await sendJoinGreeting(guild);
	const server = await db.getServerByDiscordId(botId, guild.id).catch(() => null);
	if (!server?.greeted_at) return { success: false, error: 'greeting_failed' };
	return { success: true, guild_name: guild.name };
}

export default { init, syncGuildData, syncAllGuilds, getBotId, resendJoinGreeting };
