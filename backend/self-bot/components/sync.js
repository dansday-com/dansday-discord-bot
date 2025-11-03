import db from '../../../database/supabase.js';
import logger from '../../logger.js';

let client = null;
let botId = null;
let syncInterval = null;

// Find bot in database by ID
async function findBotById(botId) {
    try {
        const bot = await db.getBot(botId);
        return bot;
    } catch (error) {
        logger.log(`❌ Error finding bot: ${error.message}`);
        return null;
    }
}

// Sync server info for a guild (selfbots don't sync channels/roles, just server info)
async function syncGuildData(guild) {
    try {
        if (!botId) {
            logger.log(`⚠️  Bot ID not set, skipping sync for guild: ${guild.name}`);
            return;
        }

        // Fetch complete guild data
        await guild.fetch();

        // Sync server info only (selfbots have limited permissions, can't fetch channels/roles)
        const serverData = await db.upsertServer(botId, guild);

        if (!serverData) {
            logger.log(`⚠️  Failed to sync server info for ${guild.name}`);
            return;
        }

        logger.log(`✅ Synced server: ${guild.name} (${guild.memberCount} members)`);
    } catch (error) {
        logger.log(`❌ Error syncing guild data for ${guild.name}: ${error.message}`);
    }
}

// Sync all guilds the bot is in
async function syncAllGuilds() {
    try {
        if (!client || !botId) {
            logger.log(`⚠️  Client or bot ID not set, skipping sync`);
            return;
        }

        const guilds = client.guilds.cache;
        
        logger.log(`🔄 Syncing ${guilds.size} server(s)...`);

        for (const [guildId, guild] of guilds) {
            await syncGuildData(guild);
        }
    } catch (error) {
        logger.log(`❌ Error syncing all guilds: ${error.message}`);
    }
}

// Update bot name and icon from Discord
async function updateBotInfo() {
    if (!botId || !client || !client.user) {
        return;
    }
    
    try {
        const avatarUrl = client.user.displayAvatarURL({ dynamic: true, size: 256 });
        await db.updateBot(botId, {
            name: client.user.username,
            bot_icon: avatarUrl || null
        });
        logger.log(`✅ Updated selfbot name and icon from Discord: ${client.user.username}`);
    } catch (error) {
        logger.log(`⚠️  Failed to update bot info: ${error.message}`);
    }
}

async function init(discordClient, botIdFromEnv) {
    client = discordClient;
    
    // Use BOT_ID from environment (set by control panel)
    if (botIdFromEnv) {
        botId = botIdFromEnv;
        const bot = await findBotById(botId);
        if (bot) {
            logger.log(`✅ Found selfbot in database: ${bot.name} (${bot.bot_type})`);
            
            // Update bot info immediately if client is already ready
            if (client.user) {
                await updateBotInfo();
            }
        }
    } else {
        logger.log(`⚠️  BOT_ID not set. Sync will be limited.`);
    }

    // Sync when bot is ready
    client.once('ready', async () => {
        // Update bot name and icon from Discord
        await updateBotInfo();

        // Small delay to ensure all components are initialized
        setTimeout(async () => {
            if (botId) {
                logger.log('🔄 Starting initial guild data sync...');
                await syncAllGuilds();
                logger.log('✅ Initial sync complete');
            }
        }, 2000);
    });

    // Sync when bot joins a new guild
    client.on('guildCreate', async (guild) => {
        logger.log(`🆕 Selfbot joined new guild: ${guild.name}`);
        await syncGuildData(guild);
    });

    // Sync on member count changes
    client.on('guildMemberAdd', async (member) => {
        if (member.guild && botId) {
            await syncGuildData(member.guild);
        }
    });

    client.on('guildMemberRemove', async (member) => {
        if (member.guild && botId) {
            await syncGuildData(member.guild);
        }
    });

    // Sync on server boost changes
    client.on('guildUpdate', async (oldGuild, newGuild) => {
        if (botId) {
            await syncGuildData(newGuild);
        }
    });

    // Periodic sync every 30 seconds
    syncInterval = setInterval(async () => {
        if (botId) {
            await syncAllGuilds();
        }
    }, 30000);

    logger.log('🔄 Selfbot sync component initialized');
}

function stop() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

export default {
    init,
    stop,
    syncGuildData,
    syncAllGuilds,
    updateBotInfo
};

