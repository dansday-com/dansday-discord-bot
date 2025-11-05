import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../backend/logger.js';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration in .env file. Need SUPABASE_URL and SUPABASE_KEY or SUPABASE_PASSWORD');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});

// Read and execute schema SQL (only if tables don't exist)
async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error(
            'Please set DATABASE_URL in .env file.\n' +
            'Get it from: Supabase Dashboard > Settings > Database > Connection pooler'
        );
    }

    const client = new Client({ connectionString: databaseUrl });

    try {
        logger.log('🔌 Connecting to database...');
        await client.connect();
        logger.log('✅ Connected to database');

        // Read schema file
        const schemaPath = join(__dirname, 'schema.sql');
        const schemaSQL = readFileSync(schemaPath, 'utf-8');

        logger.log('📦 Executing schema...');

        await client.query(schemaSQL);

        logger.log('✅ Database schema created successfully!');
        logger.log('📊 Tables created: servers, channels, roles, server_settings');
        logger.log('📈 Indexes created: all indexes');

    } catch (error) {
        logger.log(`❌ Migration failed: ${error.message}`);
        if (error.code === '28P01') {
            logger.log('💡 Authentication failed. Check your DATABASE_URL or connection credentials.');
        } else if (error.code === 'ECONNREFUSED') {
            logger.log('💡 Connection refused. Check your connection string and network.');
        }
        throw error;
    } finally {
        await client.end();
        logger.log('🔌 Database connection closed');
    }
}

// Check tables first, only migrate if they don't exist
async function setupDatabase() {
    // First, check if tables exist using Supabase client
    logger.log('🔍 Checking database tables...');

    const tables = [
        { name: 'panel', required: true },
        { name: 'panel_logs', required: true },
        { name: 'bots', required: true },
        { name: 'servers', required: true },
        { name: 'categories', required: true },
        { name: 'channels', required: true },
        { name: 'roles', required: true },
        { name: 'server_settings', required: true }
    ];

    const missingTables = [];

    for (const table of tables) {
        try {
            const { error } = await supabase
                .from(table.name)
                .select('*')
                .limit(0);

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('schema cache')) {
                    missingTables.push(table.name);
                    logger.log(`❌ Table '${table.name}' does not exist`);
                } else {
                    logger.log(`⚠️  Table '${table.name}' check failed: ${error.message}`);
                    if (table.required) {
                        missingTables.push(table.name);
                    }
                }
            } else {
                logger.log(`✅ Table '${table.name}' exists`);
            }
        } catch (err) {
            logger.log(`⚠️  Error checking table '${table.name}': ${err.message}`);
            if (table.required) {
                missingTables.push(table.name);
            }
        }
    }

    // If tables are missing, try to migrate
    if (missingTables.length > 0) {
        logger.log(`❌ Missing tables: ${missingTables.join(', ')}`);

        // Only migrate if DATABASE_URL is set
        if (process.env.DATABASE_URL) {
            try {
                logger.log('🔧 Attempting automatic table creation...');
                await runMigration();
                logger.log('✅ Tables created automatically');
                return true;
            } catch (migrateError) {
                logger.log(`⚠️  Automatic migration failed: ${migrateError.message}`);
                logger.log('📄 Please run the SQL schema manually in Supabase SQL Editor');
                throw new Error(`Missing tables: ${missingTables.join(', ')}`);
            }
        } else {
            logger.log('💡 Set DATABASE_URL in .env to enable automatic table creation');
            logger.log('📄 Or run the SQL schema in Supabase SQL Editor:');
            logger.log('   1. Open Supabase Dashboard → SQL Editor');
            logger.log('   2. Copy and paste the contents of database/schema.sql');
            logger.log('   3. Execute the SQL');
            throw new Error(`Missing tables: ${missingTables.join(', ')}`);
        }
    }

    logger.log('✅ All database tables verified');
    return true;
}

// Initialize database on import
let dbInitialized = false;

export async function initializeDatabase() {
    if (dbInitialized) return;

    try {
        await setupDatabase();
        dbInitialized = true;
    } catch (error) {
        logger.log(`⚠️  Database initialization: ${error.message}`);
        logger.log(`💡 Set DATABASE_URL in .env to enable automatic table creation`);
        logger.log(`📄 Or run the SQL schema from database/schema.sql in Supabase SQL Editor`);
    }
}

// Bot operations
export async function getAllBots() {
    try {
        await initializeDatabase();
        const { data, error } = await supabase
            .from('bots')
            .select('*')
            .order('created_at', { ascending: true }); // Oldest first - "added first"

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting bots:', error);
        return [];
    }
}

export async function getBot(botId) {
    try {
        await initializeDatabase();
        const { data, error } = await supabase
            .from('bots')
            .select('*')
            .eq('id', botId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting bot:', error);
        return null;
    }
}

export async function createBot(botData) {
    try {
        await initializeDatabase();

        // Get bot count to generate default name
        const bots = await getAllBots();
        const botNumber = bots.length + 1;

        const { data, error } = await supabase
            .from('bots')
            .insert({
                name: botData.name || `Bot#${botNumber}`, // Default name, will be updated when bot connects
                token: botData.token,
                application_id: botData.application_id,
                bot_type: botData.bot_type, // 'official' or 'selfbot'
                bot_icon: botData.bot_icon || null, // Will be updated from Discord avatar
                port: botData.port !== undefined ? botData.port : (botData.bot_type === 'official' ? 7777 : null), // Port only for official bots, null for selfbots
                secret_key: botData.secret_key || null,
                connect_to: botData.connect_to || null,
                panel_id: botData.panel_id || null
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating bot:', error);
        throw error;
    }
}

export async function updateBot(botId, botData) {
    try {
        const updateData = {
            ...botData,
            updated_at: new Date().toISOString()
        };

        // If status changes to running, set uptime_started_at
        if (botData.status === 'running' && !botData.uptime_started_at) {
            updateData.uptime_started_at = new Date().toISOString();
        }

        // If status changes to stopped, clear uptime_started_at and process_id
        if (botData.status === 'stopped') {
            updateData.uptime_started_at = null;
            updateData.process_id = null;
        }

        const { data, error } = await supabase
            .from('bots')
            .update(updateData)
            .eq('id', botId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating bot:', error);
        throw error;
    }
}

export async function deleteBot(botId) {
    try {
        const { error } = await supabase
            .from('bots')
            .delete()
            .eq('id', botId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting bot:', error);
        throw error;
    }
}

// Discord Server (Guild) operations
export async function getServersForBot(botId) {
    try {
        const { data, error } = await supabase
            .from('servers')
            .select('*')
            .eq('bot_id', botId)
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting servers:', error);
        return [];
    }
}

export async function getServerByDiscordId(botId, discordServerId) {
    try {
        const { data, error } = await supabase
            .from('servers')
            .select('*')
            .eq('bot_id', botId)
            .eq('discord_server_id', discordServerId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    } catch (error) {
        console.error('Error getting server:', error);
        return null;
    }
}

export async function upsertServer(botId, guild) {
    try {
        const iconUrl = guild.iconURL ? guild.iconURL({ dynamic: true }) : null;

        // Convert premiumTier enum to integer (TIER_0 = 0, TIER_1 = 1, etc.)
        let boostLevel = 0;
        if (guild.premiumTier) {
            const tierString = String(guild.premiumTier);
            if (tierString.includes('TIER_')) {
                // Extract number from "TIER_X" format
                const tierMatch = tierString.match(/TIER_(\d+)/);
                if (tierMatch) {
                    boostLevel = parseInt(tierMatch[1], 10);
                } else {
                    // Fallback: try to parse as number if it's already a number string
                    boostLevel = parseInt(tierString, 10) || 0;
                }
            } else {
                // Already a number
                boostLevel = parseInt(tierString, 10) || 0;
            }
        }

        const { data, error } = await supabase
            .from('servers')
            .upsert({
                bot_id: botId,
                discord_server_id: guild.id,
                name: guild.name,
                total_members: guild.memberCount || 0,
                total_channels: guild.channels?.cache?.size || 0,
                total_boosters: guild.premiumSubscriptionCount || 0,
                boost_level: boostLevel,
                server_icon: iconUrl,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'bot_id,discord_server_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting server:', error);
        throw error;
    }
}

// Category operations
export async function upsertCategory(serverId, categoryData) {
    try {
        const { data, error } = await supabase
            .from('categories')
            .upsert({
                server_id: serverId,
                discord_category_id: categoryData.id,
                name: categoryData.name,
                position: categoryData.position !== undefined ? categoryData.position : null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'server_id,discord_category_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting category:', error);
        throw error;
    }
}

export async function syncCategories(serverId, categories) {
    try {
        if (!categories || categories.length === 0) {
            return new Map();
        }

        // Process in batches to avoid overwhelming the database
        const batchSize = 20;
        const batches = [];

        for (let i = 0; i < categories.length; i += batchSize) {
            batches.push(categories.slice(i, i + batchSize));
        }

        const allResults = [];

        for (const batch of batches) {
            const operations = batch.map(category =>
                upsertCategory(serverId, {
                    id: category.id,
                    name: category.name,
                    position: category.position
                }).catch(err => {
                    console.error(`Error upserting category ${category.id}:`, err.message);
                    return null; // Return null on error, continue with others
                })
            );

            const batchResults = await Promise.all(operations);
            allResults.push(...batchResults.filter(r => r !== null));

            // Small delay between batches to avoid rate limiting
            if (batches.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Create a map of discord_category_id to category UUID for channel reference
        const categoryMap = new Map();
        allResults.forEach(cat => {
            if (cat) {
                categoryMap.set(cat.discord_category_id, cat.id);
            }
        });

        // Remove deleted categories from database
        // Get all Discord category IDs that should exist
        const discordCategoryIds = new Set(categories.map(cat => cat.id));
        
        // Get all categories in database for this server
        const { data: dbCategories, error: fetchError } = await supabase
            .from('categories')
            .select('id, discord_category_id')
            .eq('server_id', serverId);

        if (!fetchError && dbCategories) {
            // Find categories in DB that don't exist in Discord anymore
            const categoriesToDelete = dbCategories.filter(dbCat => 
                !discordCategoryIds.has(dbCat.discord_category_id)
            );

            if (categoriesToDelete.length > 0) {
                const idsToDelete = categoriesToDelete.map(cat => cat.id);
                await supabase
                    .from('categories')
                    .delete()
                    .in('id', idsToDelete);
                console.log(`🧹 Removed ${idsToDelete.length} deleted category(ies) from database`);
            }
        }

        return categoryMap;
    } catch (error) {
        console.error('Error syncing categories:', error);
        return new Map();
    }
}

export async function upsertChannel(serverId, channelData, categoryMap = null) {
    try {
        // Find category UUID if parent_id is provided
        let categoryId = null;
        if (channelData.parent_id && categoryMap) {
            categoryId = categoryMap.get(channelData.parent_id) || null;
        }

        const { data, error } = await supabase
            .from('channels')
            .upsert({
                server_id: serverId,
                discord_channel_id: channelData.id,
                name: channelData.name,
                type: channelData.type,
                category_id: categoryId,
                position: channelData.position !== undefined ? channelData.position : null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'server_id,discord_channel_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting channel:', error);
        throw error;
    }
}

export async function syncChannels(serverId, channels, categoryMap = null) {
    try {
        // Ensure no categories (type 4) are included in channels
        const validChannels = channels.filter(ch => ch.type !== 4);

        // Also delete any existing category channels that might be in the channels table
        try {
            const { data: existingCategoryChannels } = await supabase
                .from('channels')
                .select('id, discord_channel_id')
                .eq('server_id', serverId)
                .eq('type', '4');

            if (existingCategoryChannels && existingCategoryChannels.length > 0) {
                const categoryIds = existingCategoryChannels.map(ch => ch.id);
                await supabase
                    .from('channels')
                    .delete()
                    .in('id', categoryIds);
                console.log(`🧹 Removed ${categoryIds.length} category(ies) from channels table`);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up categories from channels table:', cleanupError.message);
        }

        // Process in batches to avoid overwhelming the database
        const batchSize = 20;
        const batches = [];

        for (let i = 0; i < validChannels.length; i += batchSize) {
            batches.push(validChannels.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            const operations = batch.map(channel =>
                upsertChannel(serverId, {
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    parent_id: channel.parent_id || null,
                    position: channel.position
                }, categoryMap).catch(err => {
                    console.error(`Error upserting channel ${channel.id}:`, err.message);
                    return null; // Return null on error, continue with others
                })
            );

            await Promise.all(operations);

            // Small delay between batches to avoid rate limiting
            if (batches.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Remove deleted channels from database
        // Get all Discord channel IDs that should exist
        const discordChannelIds = new Set(validChannels.map(ch => ch.id));
        
        // Get all channels in database for this server
        const { data: dbChannels, error: fetchError } = await supabase
            .from('channels')
            .select('id, discord_channel_id')
            .eq('server_id', serverId);

        if (!fetchError && dbChannels) {
            // Find channels in DB that don't exist in Discord anymore
            const channelsToDelete = dbChannels.filter(dbCh => 
                !discordChannelIds.has(dbCh.discord_channel_id)
            );

            if (channelsToDelete.length > 0) {
                const idsToDelete = channelsToDelete.map(ch => ch.id);
                await supabase
                    .from('channels')
                    .delete()
                    .in('id', idsToDelete);
                console.log(`🧹 Removed ${idsToDelete.length} deleted channel(s) from database`);
            }
        }

        return true;
    } catch (error) {
        console.error('Error syncing channels:', error);
        return false;
    }
}

// Role operations
export async function getRoles(serverId) {
    try {
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .eq('server_id', serverId)
            .order('position', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting roles:', error);
        return [];
    }
}

export async function upsertRole(serverId, roleData) {
    try {
        const { data, error } = await supabase
            .from('roles')
            .upsert({
                server_id: serverId,
                discord_role_id: roleData.id,
                name: roleData.name,
                position: roleData.position,
                color: roleData.hexColor,
                permissions: roleData.permissions?.bitfield?.toString() || null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'server_id,discord_role_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting role:', error);
        throw error;
    }
}

export async function syncRoles(serverId, roles) {
    try {
        if (!roles || roles.length === 0) {
            return true;
        }

        // Process in batches to avoid overwhelming the database
        const batchSize = 20;
        const batches = [];

        for (let i = 0; i < roles.length; i += batchSize) {
            batches.push(roles.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            const operations = batch.map(role =>
                upsertRole(serverId, {
                    id: role.id,
                    name: role.name,
                    position: role.position,
                    hexColor: role.hexColor,
                    permissions: role.permissions
                }).catch(err => {
                    console.error(`Error upserting role ${role.id}:`, err.message);
                    return null; // Return null on error, continue with others
                })
            );

            await Promise.all(operations);

            // Small delay between batches to avoid rate limiting
            if (batches.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Remove deleted roles from database
        // Get all Discord role IDs that should exist
        const discordRoleIds = new Set(roles.map(role => role.id));
        
        // Get all roles in database for this server
        const { data: dbRoles, error: fetchError } = await supabase
            .from('roles')
            .select('id, discord_role_id')
            .eq('server_id', serverId);

        if (!fetchError && dbRoles) {
            // Find roles in DB that don't exist in Discord anymore
            const rolesToDelete = dbRoles.filter(dbRole => 
                !discordRoleIds.has(dbRole.discord_role_id)
            );

            if (rolesToDelete.length > 0) {
                const idsToDelete = rolesToDelete.map(role => role.id);
                await supabase
                    .from('roles')
                    .delete()
                    .in('id', idsToDelete);
                console.log(`🧹 Removed ${idsToDelete.length} deleted role(s) from database`);
            }
        }

        return true;
    } catch (error) {
        console.error('Error syncing roles:', error);
        return false;
    }
}

// Panel functions
async function getPanel() {
    const { data, error } = await supabase
        .from('panel')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No panel found
            return null;
        }
        throw error;
    }

    return data;
}

async function createPanel(passwordHash) {
    // Check if panel already exists
    const existing = await getPanel();
    if (existing) {
        throw new Error('Panel already exists');
    }

    const { data, error } = await supabase
        .from('panel')
        .insert({ password_hash: passwordHash })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function updatePanelPassword(panelId, passwordHash) {
    const { data, error } = await supabase
        .from('panel')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', panelId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function createPanelLog(logData) {
    const { data, error } = await supabase
        .from('panel_logs')
        .insert({
            panel_id: logData.panel_id || null,
            ip_address: logData.ip_address,
            user_agent: logData.user_agent || null,
            success: logData.success || false,
            attempted_at: logData.attempted_at || new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function getPanelLogs(limit = 100) {
    const { data, error } = await supabase
        .from('panel_logs')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// Server settings functions
async function getServerSettings(serverId, componentName = null) {
    try {
        await initializeDatabase();
        let query = supabase
            .from('server_settings')
            .select('*')
            .eq('server_id', serverId);

        if (componentName) {
            query = query.eq('component_name', componentName);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Update last_accessed timestamp when settings are VIEWED/accessed
        // This triggers sync after 30-minute cooldown
        // When ANY component config is viewed, update last_accessed for ALL components of that server
        // This ensures all components share the same cooldown period
        // However, don't reset the timer if a sync was already done recently (within 30 minutes)
        if (data && data.length > 0) {
            const now = new Date();
            const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

            // Check if any component already has a recent last_accessed (within 30 minutes)
            // This prevents resetting the cooldown if bot just synced and user visits config
            const hasRecentAccess = data.some(item => {
                if (!item.last_accessed) return false;
                const lastAccessTime = new Date(item.last_accessed);
                return lastAccessTime > thirtyMinutesAgo;
            });

            // Only update last_accessed if there's no recent access
            // This ensures visiting config right after bot start doesn't reset the cooldown
            if (!hasRecentAccess) {
                const nowISO = now.toISOString();
                // Update last_accessed for ALL components of this server
                // (when any component config is viewed, all components get the same cooldown)
                await supabase
                    .from('server_settings')
                    .update({ last_accessed: nowISO })
                    .eq('server_id', serverId);
            }
        }

        return componentName ? (data[0] || null) : (data || []);
    } catch (error) {
        console.error('Error getting server settings:', error);
        return componentName ? null : [];
    }
}

async function upsertServerSettings(serverId, componentName, settings) {
    try {
        await initializeDatabase();
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('server_settings')
            .upsert({
                server_id: serverId,
                component_name: componentName,
                settings: settings,
                updated_at: now
                // Note: last_accessed is NOT updated here - only when viewing/accessing configs
            }, {
                onConflict: 'server_id,component_name'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting server settings:', error);
        throw error;
    }
}

async function getChannelsForServer(serverId) {
    try {
        await initializeDatabase();
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('server_id', serverId)
            .order('position', { ascending: true, nullsFirst: false })
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting channels for server:', error);
        return [];
    }
}

async function getCategoriesForServer(serverId) {
    try {
        await initializeDatabase();
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('server_id', serverId)
            .order('position', { ascending: true, nullsFirst: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting categories for server:', error);
        return [];
    }
}

// Get servers that need syncing based on last_accessed (30 minute cooldown)
// Returns unique server IDs that have last_accessed updated more than 30 minutes ago
async function getServersNeedingSync(botId) {
    try {
        await initializeDatabase();

        // First, get all servers for this bot
        const servers = await getServersForBot(botId);
        if (!servers || servers.length === 0) {
            return [];
        }

        const serverIds = servers.map(s => s.id);

        // Calculate timestamp 30 minutes ago
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // Get distinct server_ids from server_settings where:
        // - last_accessed is not null
        // - last_accessed is older than 30 minutes
        // - server belongs to the specified bot
        const { data, error } = await supabase
            .from('server_settings')
            .select('server_id')
            .in('server_id', serverIds)
            .not('last_accessed', 'is', null)
            .lt('last_accessed', thirtyMinutesAgo);

        if (error) throw error;

        // Get unique server IDs
        const uniqueServerIds = [...new Set((data || []).map(s => s.server_id))];

        return uniqueServerIds;
    } catch (error) {
        console.error('Error getting servers needing sync:', error);
        return [];
    }
}

// Mark servers as synced by updating last_accessed timestamp
// This is used after bot start sync to prevent immediate re-sync
async function markServersAsSynced(serverIds) {
    try {
        await initializeDatabase();

        if (!serverIds || serverIds.length === 0) {
            return;
        }

        const now = new Date().toISOString();

        // Update last_accessed for all components of all specified servers
        const { error } = await supabase
            .from('server_settings')
            .update({ last_accessed: now })
            .in('server_id', serverIds);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking servers as synced:', error);
        throw error;
    }
}

// Clear last_accessed for a server after syncing
// This prevents repeated syncs until settings are accessed again
async function clearLastAccessed(serverId) {
    try {
        await initializeDatabase();

        const { error } = await supabase
            .from('server_settings')
            .update({ last_accessed: null })
            .eq('server_id', serverId);

        if (error) throw error;
    } catch (error) {
        console.error('Error clearing last_accessed:', error);
        throw error;
    }
}

export default {
    supabase,
    getAllBots,
    getBot,
    createBot,
    updateBot,
    deleteBot,
    getServersForBot,
    getServerByDiscordId,
    upsertServer,
    upsertCategory,
    syncCategories,
    upsertChannel,
    syncChannels,
    getRoles,
    upsertRole,
    syncRoles,
    getPanel,
    createPanel,
    updatePanelPassword,
    createPanelLog,
    getPanelLogs,
    getServerSettings,
    upsertServerSettings,
    getChannelsForServer,
    getCategoriesForServer,
    getServersNeedingSync,
    markServersAsSynced,
    clearLastAccessed
};
