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
import type { Guild, GuildMember, TextChannel } from 'discord.js';

const FULL_RESYNC_INTERVAL_MS = 30 * 60 * 1000;
const EVENT_SYNC_DEBOUNCE_MS = 15 * 1000;
const EVENT_SYNC_MAX_WAIT_MS = 2 * 60 * 1000;

let client: any = null;
let botId: any = null;
let syncRunning = false;

function channelLabel(channel: any) {
	if (channel.type === 4 || channel.type === 'GUILD_CATEGORY') {
		return 'Category';
	}
	if (channel.type === 0 || channel.type === 'GUILD_TEXT') {
		return 'Text Channel';
	}
	if (channel.type === 5 || channel.type === 'GUILD_NEWS') {
		return 'News Channel';
	}
	return 'Channel';
}

async function findBotById(id: number | string) {
	try {
		return await db.getSelfbotById(Number(id));
	} catch (error) {
		logger.log(`❌ Error finding bot: ${(error as Error).message}`);
		return null;
	}
}

async function keepViewable(guild: Guild, categories: Record<string, unknown>[], channels: Record<string, unknown>[]) {
	try {
		await guild.members.fetchMe();
	} catch (error) {
		logger.log(`⚠️  Could not resolve own member in ${guild.name}: ${(error as Error).message}. Keeping every channel this pass.`);
		return { categories, channels };
	}

	const visibleCategories = categories.filter((cat) => cat.viewable);
	const visibleChannels = channels.filter((ch) => ch.viewable);
	const hidden = categories.length - visibleCategories.length + (channels.length - visibleChannels.length);
	if (hidden > 0) {
		logger.log(`🙈 ${hidden} channel(s)/category(s) in ${guild.name} are not readable by this account and were removed`);
	}

	return { categories: visibleCategories, channels: visibleChannels };
}

async function syncGuildData(guild: any) {
	try {
		if (!botId) {
			logger.log(`⚠️  Selfbot ID not set, skipping sync for guild: ${guild.name}`);
			return;
		}

		await guild.fetch();
		const botServerRow = await db.upsertSelfbotServer(Number(botId), guild).catch(() => null);
		if (!botServerRow) {
			logger.log(`⚠️  Failed to sync server info for ${guild.name}`);
			return;
		}

		try {
			try {
				await guild.channels.fetch();
			} catch (fetchError) {
				logger.log(`⚠️  Could not fetch channels for ${guild.name}: ${(fetchError as Error).message}`);
			}

			if (guild.channels.cache.size > 0) {
				const all = separateChannelsAndCategories(guild.channels.cache);
				const { categories, channels } = await keepViewable(guild, all.categories, all.channels);
				await db.syncSelfbotCategories(botServerRow.id, mapCategoriesForSync(categories)).catch(() => null);
				await db.syncSelfbotChannels(botServerRow.id, mapChannelsForSync(channels)).catch(() => null);
				logger.log(`✅ Synced server: ${guild.name} (${guild.memberCount} members, ${categories.length} categories, ${channels.length} channels)`);
			} else {
				logger.log(`✅ Synced server info: ${guild.name} (${guild.memberCount} members)`);
			}
		} catch (error) {
			logger.log(`❌ Error syncing channels/categories for ${guild.name}: ${(error as Error).message}`);
			logger.log(`✅ Synced server info: ${guild.name} (${guild.memberCount} members)`);
		}
	} catch (error) {
		logger.log(`❌ Error syncing guild data for ${guild.name}: ${(error as Error).message}`);
	}
}

const queueGuildSync = createGuildSyncDebouncer(syncGuildData, EVENT_SYNC_DEBOUNCE_MS, EVENT_SYNC_MAX_WAIT_MS);

async function syncAllGuilds() {
	if (syncRunning) {
		return;
	}
	syncRunning = true;

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
	} catch (error) {
		logger.log(`❌ Error syncing all guilds: ${(error as Error).message}`);
	} finally {
		syncRunning = false;
	}
}

async function reapDepartedGuilds(guilds: Map<string, unknown>) {
	if (!botId) {
		return;
	}
	try {
		const stale = await db.removeDepartedSelfbotServers(Number(botId), Array.from(guilds.keys()));
		if (stale.length > 0) {
			logger.log(`🗑️  Removed ${stale.length} source server(s) this account is no longer in: ${stale.map((s) => s.name || s.discord_server_id).join(', ')}`);
		}
	} catch (error) {
		logger.log(`❌ Error removing departed source servers: ${(error as Error).message}`);
	}
}

async function updateBotInfo() {
	if (!botId || !client || !client.user) {
		return;
	}

	try {
		const displayName = client.user.globalName || client.user.displayName || client.user.username;
		let botIcon: string | null = null;
		try {
			botIcon = typeof client.user.displayAvatarURL === 'function' ? String(client.user.displayAvatarURL({ size: 128 })) : null;
		} catch (_) {}
		await db.updateSelfbot(Number(botId), { name: displayName, bot_icon: botIcon });
		logger.log(`✅ Updated selfbot profile from Discord: ${displayName}`);
	} catch (error) {
		logger.log(`⚠️  Failed to update bot info: ${(error as Error).message}`);
	}
}

async function init(discordClient: unknown, botIdFromEnv: unknown) {
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
			if (client.user) {
				await updateBotInfo();
			}
		} else {
			logger.log(`❌ Selfbot not found in database with ID: ${botId}`);
		}
	} else {
		logger.log(`⚠️  BOT_ID not set. Sync will be limited.`);
	}

	setTimeout(async () => {
		if (!botId) {
			return;
		}
		logger.log('🔄 Selfbot startup sync (all visible guilds)...');
		await syncAllGuilds();
		logger.log('✅ Selfbot startup sync complete');
	}, 2000);

	setInterval(() => {
		if (!botId) {
			return;
		}
		logger.log('🔄 Selfbot periodic guild re-sync...');
		syncAllGuilds().catch((error) => logger.log(`❌ Periodic guild re-sync failed: ${error.message}`));
	}, FULL_RESYNC_INTERVAL_MS);

	client.on('guildCreate', async (guild: Guild) => {
		logger.log(`🆕 Selfbot joined new guild: ${guild.name}`);
		await syncGuildData(guild);
	});

	client.on('guildDelete', async (guild: Record<string, unknown>) => {
		if (!botId) {
			return;
		}
		if (guild.available === false || guild.unavailable === true) {
			logger.log(`⏸️  Source server unavailable (Discord outage), keeping data: ${guild.name || guild.id}`);
			return;
		}

		try {
			const removed = await db.removeSelfbotServer(Number(botId), String(guild.id));
			if (removed) {
				logger.log(`🗑️  Account left source server, forwarder data removed: ${guild.name || guild.id}`);
			}
		} catch (error) {
			logger.log(`❌ Failed to remove source server ${guild.name || guild.id}: ${(error as Error).message}`);
		}
	});

	client.on('guildUpdate', async (_oldGuild: unknown, newGuild: unknown) => {
		if (botId) {
			queueGuildSync(newGuild);
		}
	});

	client.on('guildMemberUpdate', async (oldMember: GuildMember, newMember: GuildMember) => {
		if (!botId || !newMember?.guild) {
			return;
		}
		if (String(newMember.id) !== String(client.user?.id)) {
			return;
		}
		const before = [...(oldMember?.roles?.cache?.keys() ?? [])].sort().join(',');
		const after = [...(newMember?.roles?.cache?.keys() ?? [])].sort().join(',');
		if (before === after) {
			return;
		}
		await logger.log(`🔐 Own roles changed in ${newMember.guild.name}, re-checking channel visibility`);
		queueGuildSync(newMember.guild);
	});

	client.on('channelCreate', async (channel: TextChannel) => {
		if (!channel.guild || !botId || !isSyncedChannelType(channel)) {
			return;
		}
		await logger.log(`📁 ${channelLabel(channel)} created: **${channel.name || 'Unknown'}** (${channel.id})`);
		queueGuildSync(channel.guild);
	});

	client.on('channelUpdate', async (oldChannel: any, newChannel: any) => {
		if (!newChannel.guild || !botId || !isSyncedChannelType(newChannel)) {
			return;
		}
		if (channelSyncSignature(oldChannel) === channelSyncSignature(newChannel)) {
			return;
		}

		const oldName = oldChannel.name || 'Unknown';
		const newName = newChannel.name || 'Unknown';
		if (oldName !== newName) {
			await logger.log(`✏️ ${channelLabel(newChannel)} renamed: **${oldName}** → **${newName}** (${newChannel.id})`);
		} else {
			await logger.log(`✏️ ${channelLabel(newChannel)} updated: **${newName}** (${newChannel.id})`);
		}
		queueGuildSync(newChannel.guild);
	});

	client.on('channelDelete', async (channel: TextChannel) => {
		if (!channel.guild || !botId || !isSyncedChannelType(channel)) {
			return;
		}
		await logger.log(`🗑️ ${channelLabel(channel)} deleted: **${channel.name || 'Unknown'}** (${channel.id})`);
		queueGuildSync(channel.guild);
	});

	logger.log('🔄 Selfbot sync component initialized');
}

export default { init, syncGuildData, syncAllGuilds, updateBotInfo };
