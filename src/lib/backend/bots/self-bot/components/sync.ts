import db from '../../../../database.js';
import { logger, separateChannelsAndCategories, mapCategoriesForSync, mapChannelsForSync } from '../../../../utils/index.js';

let client: any = null;
let botId: any = null;

async function findBotById(id: any) {
	try {
		return await db.getSelfbotById(Number(id));
	} catch (error: any) {
		logger.log(`❌ Error finding bot: ${error.message}`);
		return null;
	}
}

async function resolveSelfMember(guild: any) {
	const cached = guild.members?.me;
	if (cached && !cached.partial) return cached;
	try {
		return await guild.members.fetchMe();
	} catch (error: any) {
		logger.log(`⚠️  Could not resolve own member in ${guild.name}: ${error.message}. Treating all channels as visible.`);
		return null;
	}
}

function markChannelVisibility(channels: any[], guild: any, selfMember: any) {
	if (!selfMember) return channels.map((ch) => ({ ...ch, viewable: true }));

	let hidden = 0;
	const marked = channels.map((ch) => {
		const live = guild.channels?.cache?.get(String(ch.id));
		if (!live) return { ...ch, viewable: true };
		let viewable = true;
		try {
			viewable = live.permissionsFor(selfMember)?.has('VIEW_CHANNEL', false) ?? true;
		} catch (_) {
			viewable = true;
		}
		if (!viewable) hidden++;
		return { ...ch, viewable };
	});

	if (hidden > 0) logger.log(`🙈 ${hidden} channel(s) in ${guild.name} are not visible to this account and stay out of the pickers`);
	return marked;
}

async function syncGuildData(guild: any) {
	try {
		if (!botId) {
			logger.log(`⚠️  Selfbot ID not set, skipping sync for guild: ${guild.name}`);
			return;
		}

		await guild.fetch();
		const botServerRow = await (db as any).upsertSelfbotServer(Number(botId), guild).catch(() => null);
		if (!botServerRow) {
			logger.log(`⚠️  Failed to sync server info for ${guild.name}`);
			return;
		}

		try {
			try {
				await guild.channels.fetch();
			} catch (fetchError: any) {
				logger.log(`⚠️  Could not fetch channels for ${guild.name}: ${fetchError.message}`);
			}

			if (guild.channels.cache.size > 0) {
				const { categories, channels } = separateChannelsAndCategories(guild.channels.cache);
				const selfMember = await resolveSelfMember(guild);
				const mappedChannels = markChannelVisibility(mapChannelsForSync(channels), guild, selfMember);
				await (db as any).syncSelfbotCategories(botServerRow.id, mapCategoriesForSync(categories)).catch(() => null);
				await (db as any).syncSelfbotChannels(botServerRow.id, mappedChannels).catch(() => null);
				logger.log(`✅ Synced server: ${guild.name} (${guild.memberCount} members, ${categories.length} categories, ${channels.length} channels)`);
			} else {
				logger.log(`✅ Synced server info: ${guild.name} (${guild.memberCount} members)`);
			}
		} catch (error: any) {
			logger.log(`❌ Error syncing channels/categories for ${guild.name}: ${error.message}`);
			logger.log(`✅ Synced server info: ${guild.name} (${guild.memberCount} members)`);
		}
	} catch (error: any) {
		logger.log(`❌ Error syncing guild data for ${guild.name}: ${error.message}`);
	}
}

async function syncAllGuilds() {
	try {
		if (!client || !botId) {
			logger.log(`⚠️  Client or selfbot ID not set, skipping sync`);
			return;
		}

		const guilds = client.guilds.cache;
		logger.log(`🔄 Selfbot sync started: ${guilds.size} server(s)`);

		let completed = 0;
		for (const [, guild] of guilds) {
			await syncGuildData(guild);
			completed++;
		}

		logger.log(`✅ Selfbot sync completed: ${completed}/${guilds.size} server(s)`);

		await reapDepartedGuilds(guilds);
	} catch (error: any) {
		logger.log(`❌ Error syncing all guilds: ${error.message}`);
	}
}

async function reapDepartedGuilds(guilds: Map<string, any>) {
	if (!botId) return;
	try {
		const stale = await (db as any).removeDepartedSelfbotServers(Number(botId), Array.from(guilds.keys()));
		if (stale.length > 0) {
			logger.log(
				`🗑️  Removed ${stale.length} source server(s) this account is no longer in: ${stale.map((s: any) => s.name || s.discord_server_id).join(', ')}`
			);
		}
	} catch (error: any) {
		logger.log(`❌ Error removing departed source servers: ${error.message}`);
	}
}

async function updateBotInfo() {
	if (!botId || !client || !client.user) return;

	try {
		const displayName = client.user.globalName || client.user.displayName || client.user.username;
		let botIcon: string | null = null;
		try {
			botIcon = typeof client.user.displayAvatarURL === 'function' ? String(client.user.displayAvatarURL({ size: 128 })) : null;
		} catch (_) {}
		await db.updateSelfbot(Number(botId), { name: displayName, bot_icon: botIcon });
		logger.log(`✅ Updated selfbot profile from Discord: ${displayName}`);
	} catch (error: any) {
		logger.log(`⚠️  Failed to update bot info: ${error.message}`);
	}
}

async function init(discordClient: any, botIdFromEnv: any) {
	client = discordClient;

	if (botIdFromEnv) {
		botId = botIdFromEnv;
		const bot = await findBotById(botId);
		if (bot) {
			logger.log(`✅ Found selfbot in database: ${bot.name} (ID: ${bot.id})`);
			const officialBot = await db.getOfficialBotForSelfbot(bot.id);
			if (officialBot) {
				logger.log(`🔗 Selfbot linked to official bot: ${officialBot.name} (servers stored under selfbot id ${bot.id})`);
			} else {
				logger.log(`⚠️  No official bot linked; selfbot will still sync its own server rows`);
			}
			if (client.user) await updateBotInfo();
		} else {
			logger.log(`❌ Selfbot not found in database with ID: ${botId}`);
		}
	} else {
		logger.log(`⚠️  BOT_ID not set. Sync will be limited.`);
	}

	setTimeout(async () => {
		if (!botId) return;
		logger.log('🔄 Selfbot startup sync (all visible guilds)...');
		await syncAllGuilds();
		logger.log('✅ Selfbot startup sync complete');
	}, 2000);

	client.on('guildCreate', async (guild: any) => {
		logger.log(`🆕 Selfbot joined new guild: ${guild.name}`);
		await syncGuildData(guild);
	});

	client.on('guildDelete', async (guild: any) => {
		if (!botId) return;
		if (guild.available === false || guild.unavailable === true) {
			logger.log(`⏸️  Source server unavailable (Discord outage), keeping data: ${guild.name || guild.id}`);
			return;
		}

		try {
			const removed = await (db as any).removeSelfbotServer(Number(botId), String(guild.id));
			if (removed) logger.log(`🗑️  Account left source server, forwarder data removed: ${guild.name || guild.id}`);
		} catch (error: any) {
			logger.log(`❌ Failed to remove source server ${guild.name || guild.id}: ${error.message}`);
		}
	});

	client.on('guildUpdate', async (_oldGuild: any, newGuild: any) => {
		if (botId) await syncGuildData(newGuild);
	});

	client.on('guildMemberUpdate', async (oldMember: any, newMember: any) => {
		if (!botId || !newMember?.guild) return;
		if (String(newMember.id) !== String(client.user?.id)) return;
		const before = [...(oldMember?.roles?.cache?.keys() ?? [])].sort().join(',');
		const after = [...(newMember?.roles?.cache?.keys() ?? [])].sort().join(',');
		if (before === after) return;
		await logger.log(`🔐 Own roles changed in ${newMember.guild.name}, re-checking channel visibility`);
		await syncGuildData(newMember.guild);
	});

	client.on('channelCreate', async (channel: any) => {
		if (channel.guild && botId) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			await logger.log(`📁 ${channelType} created: **${channel.name || 'Unknown'}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	client.on('channelUpdate', async (oldChannel: any, newChannel: any) => {
		if (newChannel.guild && botId) {
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

	client.on('channelDelete', async (channel: any) => {
		if (channel.guild && botId) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			await logger.log(`🗑️ ${channelType} deleted: **${channel.name || 'Unknown'}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	logger.log('🔄 Selfbot sync component initialized');
}

export default { init, syncGuildData, syncAllGuilds, updateBotInfo };
