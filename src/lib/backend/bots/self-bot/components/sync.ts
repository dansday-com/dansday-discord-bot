import db from '../../../../database.js';
import { logger, separateChannelsAndCategories, mapCategoriesForSync, mapChannelsForSync } from '../../../../utils/index.js';

let client: any = null;
let botId: any = null;
let officialBotId: any = null;

async function findBotById(id: any) {
	try {
		return await db.getServerBotById(Number(id));
	} catch (error: any) {
		logger.log(`❌ Error finding bot: ${error.message}`);
		return null;
	}
}

async function syncGuildData(guild: any) {
	try {
		if (!officialBotId) {
			logger.log(`⚠️  Official bot ID not set, skipping sync for guild: ${guild.name}`);
			return;
		}

		await guild.fetch();
		const serverData = await db.upsertServer(officialBotId, guild);

		if (!serverData) {
			logger.log(`⚠️  Failed to sync server info for ${guild.name}`);
			return;
		}

		const serverId = serverData.id;

		try {
			try {
				await guild.channels.fetch();
			} catch (fetchError: any) {
				logger.log(`⚠️  Could not fetch channels for ${guild.name}: ${fetchError.message}`);
			}

			if (guild.channels.cache.size > 0) {
				const { categories, channels } = separateChannelsAndCategories(guild.channels.cache);
				const categoryMap = await db.syncCategories(serverId, mapCategoriesForSync(categories));
				await db.syncChannels(serverId, mapChannelsForSync(channels), categoryMap);
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
		if (!client || !officialBotId) {
			logger.log(`⚠️  Client or official bot ID not set, skipping sync`);
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
	} catch (error: any) {
		logger.log(`❌ Error syncing all guilds: ${error.message}`);
	}
}

async function updateBotInfo() {
	if (!botId || !client || !client.user) return;

	try {
		const displayName = client.user.globalName || client.user.displayName || client.user.username;
		await db.updateServerBot(Number(botId), { name: displayName });
		logger.log(`✅ Updated selfbot name from Discord: ${displayName}`);
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
				officialBotId = officialBot.id;
				logger.log(`🔗 Selfbot connected to official bot: ${officialBot.name}`);
			} else {
				logger.log(`⚠️  No official bot found for selfbot via server assignments`);
			}
			if (client.user) await updateBotInfo();
		} else {
			logger.log(`❌ Selfbot not found in database with ID: ${botId}`);
		}
	} else {
		logger.log(`⚠️  BOT_ID not set. Sync will be limited.`);
	}

	setTimeout(async () => {
		if (officialBotId) {
			const needsSync = await db.serversNeedSync(officialBotId);
			if (needsSync) {
				logger.log('🔄 Starting initial guild data sync (servers need data sync)...');
				await syncAllGuilds();
				logger.log('✅ Initial sync complete');
			} else {
				logger.log('⏭️  Skipping initial sync (servers have data). Sync will run on Discord events only.');
			}
		}
	}, 2000);

	client.on('guildCreate', async (guild: any) => {
		logger.log(`🆕 Selfbot joined new guild: ${guild.name}`);
		await syncGuildData(guild);
	});

	client.on('guildUpdate', async (_oldGuild: any, newGuild: any) => {
		if (officialBotId) await syncGuildData(newGuild);
	});

	client.on('channelCreate', async (channel: any) => {
		if (channel.guild && officialBotId) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			await logger.log(`📁 ${channelType} created: **${channel.name || 'Unknown'}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	client.on('channelUpdate', async (oldChannel: any, newChannel: any) => {
		if (newChannel.guild && officialBotId) {
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
		if (channel.guild && officialBotId) {
			const channelType = channel.type === 4 ? 'Category' : channel.type === 0 ? 'Text Channel' : channel.type === 5 ? 'News Channel' : 'Channel';
			await logger.log(`🗑️ ${channelType} deleted: **${channel.name || 'Unknown'}** (${channel.id})`);
			await syncGuildData(channel.guild);
		}
	});

	logger.log('🔄 Selfbot sync component initialized');
}

export default { init, syncGuildData, syncAllGuilds, updateBotInfo };
