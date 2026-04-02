import mysql from 'mysql2/promise';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';
import { toMySQLDateTime, parseMySQLDateTime, getNowInTimezone, addMinutesToNow } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getConnectionConfig() {
	const databaseUrl = process.env.DATABASE_URL;

	if (databaseUrl) {
		try {
			const url = new URL(databaseUrl);
			if (!url.hostname) throw new Error('Missing hostname in DATABASE_URL');
			if (!url.username) throw new Error('Missing username in DATABASE_URL');
			if (!url.password) throw new Error('Missing password in DATABASE_URL');
			if (!url.pathname || url.pathname.length <= 1) throw new Error('Missing database name in DATABASE_URL');
			if (!url.port) throw new Error('Missing port in DATABASE_URL');

			return {
				host: url.hostname,
				port: parseInt(url.port),
				user: url.username,
				password: url.password,
				database: url.pathname.slice(1)
			};
		} catch (error: any) {
			throw new Error(`Invalid DATABASE_URL: ${error.message}`);
		}
	}

	if (!process.env.DB_HOST) throw new Error('Missing DB_HOST environment variable');
	if (!process.env.DB_PORT) throw new Error('Missing DB_PORT environment variable');
	if (!process.env.DB_USER) throw new Error('Missing DB_USER environment variable');
	if (!process.env.DB_PASSWORD) throw new Error('Missing DB_PASSWORD environment variable');
	if (!process.env.DB_NAME) throw new Error('Missing DB_NAME environment variable');

	return {
		host: process.env.DB_HOST,
		port: parseInt(process.env.DB_PORT),
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME
	};
}

let connectionConfig: ReturnType<typeof getConnectionConfig> | null = null;

function resolveConnectionConfig() {
	if (!connectionConfig) {
		connectionConfig = getConnectionConfig();
		console.log(`🔌 Database connection: mysql://${connectionConfig.user}@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);
	}
	return connectionConfig;
}

let pool: any = null;

function getPool() {
	const cfg = resolveConnectionConfig();
	if (!pool) {
		const tz = process.env.TIMEZONE;
		const tzOffset = tz === 'Asia/Jakarta' ? '+07:00' : tz === 'UTC' ? 'Z' : 'Z';
		pool = mysql.createPool({
			...cfg,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			dateStrings: true,
			timezone: tzOffset
		});
	}
	return pool;
}

async function query(sql: string, params: any[] = []) {
	const connection = await getPool().getConnection();
	try {
		const [rows] = await connection.execute(sql, params);
		return rows as any[];
	} finally {
		connection.release();
	}
}

async function runMigration() {
	const connection = await mysql.createConnection(resolveConnectionConfig());

	try {
		logger.log('🔌 Connecting to database...');
		await connection.connect();
		logger.log('✅ Connected to database');

		const schemaPath = join(process.cwd(), 'src/lib/server/schema.sql');
		const schemaSQL = readFileSync(schemaPath, 'utf-8');

		logger.log('📦 Executing schema...');

		const statements = schemaSQL
			.split(';')
			.map((s: string) => s.trim())
			.filter((s: string) => s.length > 0 && !s.startsWith('--'));

		for (const statement of statements) {
			if (statement.length > 0) {
				await connection.query(statement);
			}
		}

		logger.log('✅ Database schema created successfully!');
		logger.log(
			'📊 Tables created: panel, accounts, account_invites, account_server_access, server_selfbot_assignments, bots, servers, server_categories, server_channels, server_roles, server_members, server_member_levels, server_member_roles, server_members_afk, server_settings, server_giveaways, server_giveaway_entries, server_staff_ratings, server_staff_reports, server_feedback'
		);
		logger.log('📈 Indexes created: all indexes');
	} catch (error: any) {
		logger.log(`❌ Migration failed: ${error.message}`);
		if (error.code === 'ER_ACCESS_DENIED_ERROR') {
			logger.log('💡 Authentication failed. Check your database credentials.');
		} else if (error.code === 'ECONNREFUSED') {
			logger.log('💡 Connection refused. Check your connection settings and network.');
		}
		throw error;
	} finally {
		await connection.end();
		logger.log('🔌 Database connection closed');
	}
}

async function runMigrations() {
	const migrationsDir = join(process.cwd(), 'src/lib/server/migrations');

	let files: string[] = [];
	try {
		if (existsSync(migrationsDir)) {
			files = readdirSync(migrationsDir)
				.filter((f) => f.endsWith('.sql'))
				.sort();
		}
	} catch (err: any) {
		logger.log(`ℹ️  Error reading migrations directory: ${err.message}`);
	}

	if (files.length === 0) {
		logger.log('ℹ️  No migration files found to process');
		return;
	}

	logger.log(`🔍 Found ${files.length} migration(s), checking status...`);

	const connection = await mysql.createConnection({ ...resolveConnectionConfig(), multipleStatements: true });
	try {
		await connection.connect();

		await connection.query(
			`CREATE TABLE IF NOT EXISTS migrations (
				id INT PRIMARY KEY AUTO_INCREMENT,
				name VARCHAR(255) NOT NULL UNIQUE,
				ran_at DATETIME NOT NULL
			)`
		);

		for (const file of files) {
			const [rows] = await connection.execute('SELECT id FROM migrations WHERE name = ? LIMIT 1', [file]);
			if ((rows as any[]).length > 0) {
				continue;
			}

			logger.log(`🔧 Running migration: ${file}`);
			const sql = readFileSync(join(migrationsDir, file), 'utf-8');
			await connection.query(sql);

			await connection.execute('INSERT INTO migrations (name, ran_at) VALUES (?, NOW())', [file]);
			logger.log(`✅ Migration complete: ${file}`);
		}
	} catch (err: any) {
		logger.log(`❌ Migration runner failed: ${err.message}`);
		throw err;
	} finally {
		try {
			await connection.end();
		} catch (e) {}
	}
}

async function tableExists(name: string) {
	const result = await query(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`, [
		resolveConnectionConfig().database,
		name
	]);
	return result[0]?.count > 0;
}

async function setupDatabase() {
	logger.log('🔍 Checking database...');

	const hasBots = await tableExists('bots');
	const hasPanel = await tableExists('panel');

	if (!hasBots && !hasPanel) {
		logger.log('🆕 Fresh database detected, running schema...');
		try {
			await runMigration();
			logger.log('✅ Schema applied');
			await markAllMigrationsAsDone();
		} catch (err: any) {
			logger.log(`❌ Schema failed: ${err.message}`);
			throw err;
		}
		return true;
	}

	logger.log('✅ Existing database detected, checking migrations...');
	await runMigrations();
	return true;
}

async function markAllMigrationsAsDone() {
	const migrationsDir = join(process.cwd(), 'src/lib/server/migrations');
	let files: string[];
	try {
		files = readdirSync(migrationsDir)
			.filter((f) => f.endsWith('.sql'))
			.sort();
	} catch (_) {
		return;
	}
	for (const file of files) {
		await query('INSERT IGNORE INTO migrations (name, ran_at) VALUES (?, NOW())', [file]);
	}
}

let dbInitialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeDatabase() {
	if (dbInitialized) return;
	if (initializationPromise) return initializationPromise;

	initializationPromise = (async () => {
		try {
			await setupDatabase();
			dbInitialized = true;
		} catch (error: any) {
			logger.log(`⚠️  Database initialization: ${error.message}`);
			logger.log(`💡 Set DATABASE_URL or DB_* environment variables to enable automatic table creation`);
			logger.log(`📄 Or run the SQL schema from src/lib/server/schema.sql in your MySQL client`);
		} finally {
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

async function retryOnConnectionError(fn: () => Promise<any>, maxRetries = 3, delayMs = 2000) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error: any) {
			const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'PROTOCOL_CONNECTION_LOST';

			if (isConnectionError && attempt < maxRetries) {
				console.log(`⚠️  Connection error (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs / 1000}s...`);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				continue;
			}
			throw error;
		}
	}
}

export async function getAllBots() {
	await initializeDatabase();
	return await retryOnConnectionError(async () => {
		const result = await query('SELECT * FROM bots ORDER BY created_at ASC');
		return result;
	});
}

export async function getBot(botId: number) {
	await initializeDatabase();
	return await retryOnConnectionError(async () => {
		const result = await query('SELECT * FROM bots WHERE id = ? LIMIT 1', [botId]);
		if (!result[0]) return null;

		const bot = result[0];
		if (bot.uptime_started_at) {
			bot.uptime_started_at = parseMySQLDateTime(bot.uptime_started_at);
		}

		return bot;
	});
}

export async function createBot(botData: any) {
	try {
		await initializeDatabase();

		const bots = await getAllBots();
		const botNumber = bots.length + 1;

		const connection = await getPool().getConnection();
		try {
			const now = toMySQLDateTime();
			const [result] = await connection.execute(
				`INSERT INTO bots (
					name, token, application_id, bot_icon, port, secret_key, panel_id, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					botData.name || `Bot#${botNumber}`,
					botData.token,
					botData.application_id || null,
					botData.bot_icon || null,
					botData.port !== undefined ? botData.port : 7777,
					botData.secret_key || null,
					botData.panel_id || null,
					now,
					now
				]
			);

			const insertedBots = await query('SELECT * FROM bots WHERE id = ?', [(result as any).insertId]);
			return insertedBots[0];
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Error creating bot:', error);
		throw error;
	}
}

export async function updateBot(botId: number, botData: any) {
	try {
		const updateData: any = {
			...botData,
			updated_at: toMySQLDateTime()
		};

		if (botData.status === 'running' && !botData.uptime_started_at) {
			updateData.uptime_started_at = toMySQLDateTime();
		} else if (botData.uptime_started_at) {
			updateData.uptime_started_at = toMySQLDateTime(botData.uptime_started_at);
		}

		if (botData.status === 'stopped') {
			updateData.uptime_started_at = null;
			updateData.process_id = null;
		}

		const fields = Object.keys(updateData).filter((key) => updateData[key] !== undefined);
		if (fields.length === 0) {
			return await getBot(botId);
		}

		const setClause = fields.map((field) => `${field} = ?`).join(', ');
		const values = fields.map((field) => updateData[field]);
		values.push(botId);

		await query(`UPDATE bots SET ${setClause} WHERE id = ?`, values);

		return await getBot(botId);
	} catch (error) {
		console.error('Error updating bot:', error);
		throw error;
	}
}

export async function deleteBot(botId: number) {
	try {
		await query('DELETE FROM bots WHERE id = ?', [botId]);
		return true;
	} catch (error) {
		console.error('Error deleting bot:', error);
		throw error;
	}
}

export async function getServer(serverId: any) {
	await initializeDatabase();
	const result = await query('SELECT * FROM servers WHERE id = ? LIMIT 1', [serverId]);
	return result[0] || null;
}

export async function getServersForBot(botId: number) {
	const result = await query('SELECT * FROM servers WHERE bot_id = ? ORDER BY name ASC', [botId]);
	return result;
}

export async function getServerByDiscordId(botId: number, discordServerId: string) {
	await initializeDatabase();
	const result = await query('SELECT * FROM servers WHERE bot_id = ? AND discord_server_id = ? LIMIT 1', [botId, discordServerId]);
	return result[0] || null;
}

export async function getOfficialBotServerIdForServer(serverId: any) {
	const server = await getServer(serverId);
	if (!server) return null;
	const officialServer = await getServerByDiscordId(server.bot_id, server.discord_server_id);
	return officialServer?.id ?? null;
}

async function getServerIdsInSameGuild(serverId: any) {
	const rows = await query('SELECT id FROM servers WHERE discord_server_id = (SELECT discord_server_id FROM servers WHERE id = ? LIMIT 1)', [serverId]);
	return (rows || []).map((r: any) => r.id);
}

export async function getNotificationRolesForServer(serverId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT c.discord_channel_id, r.discord_role_id
		 FROM server_channels c
		 INNER JOIN server_roles r ON r.id = c.notification_role_id
		 WHERE c.server_id = ? AND c.notification_role_id IS NOT NULL`,
		[serverId]
	);
	return result || [];
}

export async function getNotificationRolesWithCategory(serverId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT r.discord_role_id, COALESCE(cat.name, c.name) AS category_name,
		        COALESCE(cat.position, 9999) AS category_position,
		        COALESCE(c.position, 0) AS channel_position,
		        c.name AS channel_name
		 FROM server_channels c
		 INNER JOIN server_roles r ON r.id = c.notification_role_id
		 LEFT JOIN server_categories cat ON cat.id = c.category_id
		 WHERE c.server_id = ? AND c.notification_role_id IS NOT NULL
		 ORDER BY category_position ASC, channel_position ASC, channel_name ASC`,
		[serverId]
	);
	return result || [];
}

export async function getNotificationRoleByChannel(serverId: any, discordChannelId: string) {
	await initializeDatabase();
	const result = await query(
		`SELECT r.discord_role_id FROM server_channels c
		 INNER JOIN server_roles r ON r.id = c.notification_role_id
		 WHERE c.server_id = ? AND c.discord_channel_id = ? LIMIT 1`,
		[serverId, discordChannelId]
	);
	return result[0]?.discord_role_id || null;
}

export async function upsertNotificationRole(serverId: any, discordChannelId: string, discordRoleId: string) {
	await initializeDatabase();
	const serverIds = await getServerIdsInSameGuild(serverId);
	for (const sid of serverIds) {
		const roleRow = await query('SELECT id FROM server_roles WHERE server_id = ? AND discord_role_id = ? LIMIT 1', [sid, discordRoleId]);
		const roleId = roleRow[0]?.id;
		if (!roleId) continue;
		await query('UPDATE server_channels SET notification_role_id = ? WHERE server_id = ? AND discord_channel_id = ?', [roleId, sid, discordChannelId]);
	}
}

export async function deleteNotificationRole(serverId: any, discordChannelId: string) {
	await initializeDatabase();
	const serverIds = await getServerIdsInSameGuild(serverId);
	if (serverIds.length === 0) return;
	const placeholders = serverIds.map(() => '?').join(', ');
	await query(`UPDATE server_channels SET notification_role_id = NULL WHERE server_id IN (${placeholders}) AND discord_channel_id = ?`, [
		...serverIds,
		discordChannelId
	]);
}

export async function getNotificationRoleDbIds(serverId: any) {
	await initializeDatabase();
	const result = await query('SELECT DISTINCT notification_role_id FROM server_channels WHERE server_id = ? AND notification_role_id IS NOT NULL', [serverId]);
	return new Set((result || []).map((r: any) => r.notification_role_id));
}

export async function upsertServer(botId: number, guild: any) {
	try {
		const iconUrl = guild.iconURL ? guild.iconURL({ dynamic: true }) : null;

		let boostLevel = 0;
		if (guild.premiumTier) {
			const tierString = String(guild.premiumTier);
			if (tierString.includes('TIER_')) {
				const tierMatch = tierString.match(/TIER_(\d+)/);
				if (tierMatch) {
					boostLevel = parseInt(tierMatch[1], 10);
				} else {
					boostLevel = parseInt(tierString, 10) || 0;
				}
			} else {
				boostLevel = parseInt(tierString, 10) || 0;
			}
		}

		const now = toMySQLDateTime();
		await query(
			`INSERT INTO servers (
				bot_id, discord_server_id, name, total_members, total_channels,
				total_boosters, boost_level, server_icon, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				total_members = VALUES(total_members),
				total_channels = VALUES(total_channels),
				total_boosters = VALUES(total_boosters),
				boost_level = VALUES(boost_level),
				server_icon = VALUES(server_icon),
				updated_at = VALUES(updated_at)`,
			[
				botId,
				guild.id,
				guild.name,
				guild.memberCount || 0,
				guild.channels?.cache?.size || 0,
				guild.premiumSubscriptionCount || 0,
				boostLevel,
				iconUrl,
				now,
				now
			]
		);

		const servers = await query('SELECT * FROM servers WHERE bot_id = ? AND discord_server_id = ?', [botId, guild.id]);
		return servers[0];
	} catch (error) {
		console.error('Error upserting server:', error);
		throw error;
	}
}

export async function upsertCategory(serverId: any, categoryData: any) {
	try {
		const now = toMySQLDateTime();
		await query(
			`INSERT INTO server_categories (
				server_id, discord_category_id, name, position, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				position = VALUES(position),
				updated_at = VALUES(updated_at)`,
			[serverId, categoryData.id, categoryData.name, categoryData.position !== undefined ? categoryData.position : null, now, now]
		);

		const categories = await query('SELECT * FROM server_categories WHERE server_id = ? AND discord_category_id = ?', [serverId, categoryData.id]);
		return categories[0];
	} catch (error) {
		console.error('Error upserting category:', error);
		throw error;
	}
}

export async function syncCategories(serverId: any, categories: any[]) {
	try {
		if (!categories || categories.length === 0) {
			return new Map();
		}

		const operations = categories.map((category) =>
			upsertCategory(serverId, {
				id: category.id,
				name: category.name,
				position: category.position
			}).catch((err: any) => {
				console.error(`Error upserting category ${category.id}:`, err.message);
				return null;
			})
		);

		const allResults = await Promise.all(operations);

		const categoryMap = new Map();
		allResults.forEach((cat) => {
			if (cat) {
				categoryMap.set(cat.discord_category_id, cat.id);
			}
		});

		const discordCategoryIds = new Set(categories.map((cat) => cat.id));

		const dbCategories = await query('SELECT id, discord_category_id FROM server_categories WHERE server_id = ?', [serverId]);

		if (dbCategories && dbCategories.length > 0) {
			const categoriesToDelete = dbCategories.filter((dbCat: any) => !discordCategoryIds.has(dbCat.discord_category_id));

			if (categoriesToDelete.length > 0) {
				const idsToDelete = categoriesToDelete.map((cat: any) => cat.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				await query(`DELETE FROM server_categories WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...idsToDelete]);
				console.log(`🧹 Removed ${idsToDelete.length} deleted category(ies) from database`);
			}
		}

		return categoryMap;
	} catch (error) {
		console.error('Error syncing categories:', error);
		return new Map();
	}
}

export async function upsertChannel(serverId: any, channelData: any, categoryMap: Map<any, any> | null = null) {
	try {
		let categoryId = null;
		if (channelData.parent_id && categoryMap) {
			categoryId = categoryMap.get(channelData.parent_id) || null;
		}

		const now = toMySQLDateTime();
		await query(
			`INSERT INTO server_channels (
				server_id, discord_channel_id, name, type, category_id, position, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				type = VALUES(type),
				category_id = VALUES(category_id),
				position = VALUES(position),
				updated_at = VALUES(updated_at)`,
			[serverId, channelData.id, channelData.name, channelData.type, categoryId, channelData.position !== undefined ? channelData.position : null, now, now]
		);

		const channels = await query('SELECT * FROM server_channels WHERE server_id = ? AND discord_channel_id = ?', [serverId, channelData.id]);
		return channels[0];
	} catch (error) {
		console.error('Error upserting channel:', error);
		throw error;
	}
}

export async function syncChannels(serverId: any, channels: any[], categoryMap: Map<any, any> | null = null) {
	try {
		const validChannels = channels.filter((ch) => ch.type !== 4);

		try {
			const existingCategoryChannels = await query('SELECT id, discord_channel_id FROM server_channels WHERE server_id = ? AND type = ?', [serverId, '4']);

			if (existingCategoryChannels && existingCategoryChannels.length > 0) {
				const categoryIds = existingCategoryChannels.map((ch: any) => ch.id);
				const placeholders = categoryIds.map(() => '?').join(',');
				await query(`DELETE FROM server_channels WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...categoryIds]);
				console.log(`🧹 Removed ${categoryIds.length} category(ies) from server_channels table`);
			}
		} catch (cleanupError: any) {
			console.error('Error cleaning up categories from server_channels table:', cleanupError.message);
		}

		const operations = validChannels.map((channel) =>
			upsertChannel(
				serverId,
				{
					id: channel.id,
					name: channel.name,
					type: channel.type,
					parent_id: channel.parent_id || null,
					position: channel.position
				},
				categoryMap
			).catch((err: any) => {
				console.error(`Error upserting channel ${channel.id}:`, err.message);
				return null;
			})
		);

		await Promise.all(operations);

		const discordChannelIds = new Set(validChannels.map((ch) => ch.id));

		const dbChannels = await query('SELECT id, discord_channel_id FROM server_channels WHERE server_id = ?', [serverId]);

		if (dbChannels && dbChannels.length > 0) {
			const channelsToDelete = dbChannels.filter((dbCh: any) => !discordChannelIds.has(dbCh.discord_channel_id));

			if (channelsToDelete.length > 0) {
				const idsToDelete = channelsToDelete.map((ch: any) => ch.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				await query(`DELETE FROM server_channels WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...idsToDelete]);
				console.log(`🧹 Removed ${idsToDelete.length} deleted channel(s) from database`);
			}
		}

		return true;
	} catch (error) {
		console.error('Error syncing channels:', error);
		return false;
	}
}

export async function getRoles(serverId: any) {
	const result = await query('SELECT * FROM server_roles WHERE server_id = ? ORDER BY position DESC', [serverId]);
	return result;
}

export async function upsertRole(serverId: any, roleData: any) {
	try {
		const now = toMySQLDateTime();
		await query(
			`INSERT INTO server_roles (
				server_id, discord_role_id, name, position, color, permissions, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				position = VALUES(position),
				color = VALUES(color),
				permissions = VALUES(permissions),
				updated_at = VALUES(updated_at)`,
			[serverId, roleData.id, roleData.name, roleData.position, roleData.hexColor, roleData.permissions?.bitfield?.toString() || null, now, now]
		);

		const roles = await query('SELECT * FROM server_roles WHERE server_id = ? AND discord_role_id = ?', [serverId, roleData.id]);
		return roles[0];
	} catch (error) {
		console.error('Error upserting role:', error);
		throw error;
	}
}

export async function syncRoles(serverId: any, roles: any[]) {
	try {
		if (!roles || roles.length === 0) {
			return true;
		}

		const operations = roles.map((role) =>
			upsertRole(serverId, {
				id: role.id,
				name: role.name,
				position: role.position,
				hexColor: role.hexColor,
				permissions: role.permissions
			}).catch((err: any) => {
				console.error(`Error upserting role ${role.id}:`, err.message);
				return null;
			})
		);

		await Promise.all(operations);

		const discordRoleIds = new Set(roles.map((role) => role.id));

		const dbRoles = await query('SELECT id, discord_role_id FROM server_roles WHERE server_id = ?', [serverId]);

		if (dbRoles && dbRoles.length > 0) {
			const rolesToDelete = dbRoles.filter((dbRole: any) => !discordRoleIds.has(dbRole.discord_role_id));

			if (rolesToDelete.length > 0) {
				const idsToDelete = rolesToDelete.map((role: any) => role.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				await query(`DELETE FROM server_roles WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...idsToDelete]);
				console.log(`🧹 Removed ${idsToDelete.length} deleted role(s) from database`);
			}
		}

		return true;
	} catch (error) {
		console.error('Error syncing roles:', error);
		return false;
	}
}

export async function upsertMember(serverId: any, memberData: any) {
	try {
		const user = memberData.user || memberData;
		const avatarUrl = user?.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null;
		const username = user?.username || null;
		const displayName = user?.globalName || user?.displayName || null;
		const serverDisplayName = memberData.nickname || null;
		const profileCreatedAt = user?.createdAt ? toMySQLDateTime(user.createdAt) : null;
		const memberSince = memberData.joinedAt ? toMySQLDateTime(memberData.joinedAt) : null;
		const isBooster = memberData.premiumSince !== null && memberData.premiumSince !== undefined;
		const boosterSince = memberData.premiumSince ? toMySQLDateTime(memberData.premiumSince) : null;

		const now = toMySQLDateTime();
		await query(
			`INSERT INTO server_members (
				server_id, discord_member_id, username, display_name, server_display_name, avatar, profile_created_at, member_since, is_booster, booster_since, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				username = VALUES(username),
				display_name = VALUES(display_name),
				server_display_name = VALUES(server_display_name),
				avatar = VALUES(avatar),
				profile_created_at = VALUES(profile_created_at),
				member_since = VALUES(member_since),
				is_booster = VALUES(is_booster),
				booster_since = VALUES(booster_since),
				updated_at = VALUES(updated_at)`,
			[
				serverId,
				user?.id || memberData.id,
				username,
				displayName,
				serverDisplayName,
				avatarUrl,
				profileCreatedAt,
				memberSince,
				isBooster,
				boosterSince,
				now,
				now
			]
		);

		const members = await query('SELECT * FROM server_members WHERE server_id = ? AND discord_member_id = ?', [serverId, user?.id || memberData.id]);
		return members[0];
	} catch (error) {
		console.error('Error upserting member:', error);
		throw error;
	}
}

export async function getMemberByDiscordId(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const result = await query('SELECT * FROM server_members WHERE server_id = ? AND discord_member_id = ? LIMIT 1', [serverId, discordMemberId]);
	if (!result[0]) return null;

	const member = result[0];
	if (member.profile_created_at) {
		member.profile_created_at = parseMySQLDateTime(member.profile_created_at);
	}
	if (member.member_since) {
		member.member_since = parseMySQLDateTime(member.member_since);
	}
	if (member.booster_since) {
		member.booster_since = parseMySQLDateTime(member.booster_since);
	}

	return member;
}

export async function syncMemberRoles(memberId: any, discordRoleIds: string[], serverId: any) {
	try {
		if (!discordRoleIds || discordRoleIds.length === 0) {
			await query(
				`DELETE smr FROM server_member_roles smr
				 INNER JOIN server_members sm ON smr.member_id = sm.id
				 WHERE smr.member_id = ? AND sm.server_id = ?`,
				[memberId, serverId]
			);
			return true;
		}

		const placeholders = discordRoleIds.map(() => '?').join(',');
		const roleMapResult = await query(`SELECT id, discord_role_id FROM server_roles WHERE server_id = ? AND discord_role_id IN (${placeholders})`, [
			serverId,
			...discordRoleIds
		]);

		const roleMap = new Map();
		for (const role of roleMapResult) {
			roleMap.set(role.discord_role_id, role.id);
		}

		const roleIdsToAdd: any[] = [];
		for (const discordRoleId of discordRoleIds) {
			const roleId = roleMap.get(discordRoleId);
			if (roleId) {
				roleIdsToAdd.push(roleId);
			}
		}

		const existingRoles = await query(
			`SELECT smr.role_id
			 FROM server_member_roles smr
			 INNER JOIN server_members sm ON smr.member_id = sm.id
			 WHERE smr.member_id = ? AND sm.server_id = ?`,
			[memberId, serverId]
		);
		const existingRoleIds = new Set(existingRoles.map((r: any) => r.role_id));

		const rolesToAdd = roleIdsToAdd.filter((roleId) => !existingRoleIds.has(roleId));
		const rolesToRemove = Array.from(existingRoleIds).filter((roleId: any) => !roleIdsToAdd.includes(roleId));

		if (rolesToAdd.length > 0) {
			const now = toMySQLDateTime();
			const notificationRoleIds = await getNotificationRoleDbIds(serverId);
			const placeholders = rolesToAdd.map(() => '(?, ?, ?, ?, ?)').join(', ');
			const values = rolesToAdd.flatMap((roleId: any) => [memberId, roleId, false, notificationRoleIds.has(roleId), now]);
			await query(`INSERT INTO server_member_roles (member_id, role_id, is_custom, is_notification, created_at) VALUES ${placeholders}`, values);
		}

		if (rolesToRemove.length > 0) {
			const placeholders = rolesToRemove.map(() => '?').join(', ');
			await query(
				`DELETE smr FROM server_member_roles smr
				 INNER JOIN server_members sm ON smr.member_id = sm.id
				 WHERE smr.member_id = ? AND sm.server_id = ? AND smr.role_id IN (${placeholders})`,
				[memberId, serverId, ...rolesToRemove]
			);
		}

		return true;
	} catch (error) {
		console.error('Error syncing member roles:', error);
		return false;
	}
}

export async function memberHasAnyRole(discordMemberId: string, discordRoleIds: string[], serverId: any) {
	try {
		if (!discordRoleIds || discordRoleIds.length === 0) return false;
		if (!discordMemberId || !serverId) return false;

		const memberResult = await query('SELECT id FROM server_members WHERE server_id = ? AND discord_member_id = ?', [serverId, discordMemberId]);

		if (!memberResult || memberResult.length === 0) {
			return false;
		}

		const memberId = memberResult[0].id;

		const placeholders = discordRoleIds.map(() => '?').join(',');
		const roleResult = await query(
			`SELECT sr.id
			 FROM server_roles sr
			 INNER JOIN server_member_roles smr ON sr.id = smr.role_id
			 INNER JOIN server_members sm ON smr.member_id = sm.id
			 WHERE smr.member_id = ? AND sm.server_id = ? AND sr.discord_role_id IN (${placeholders})`,
			[memberId, serverId, ...discordRoleIds]
		);

		return roleResult && roleResult.length > 0;
	} catch (error) {
		console.error('Error checking member roles:', error);
		return false;
	}
}

export async function getMemberLevel(memberId: any) {
	await initializeDatabase();
	const result = await query('SELECT * FROM server_member_levels WHERE member_id = ? LIMIT 1', [memberId]);
	if (!result[0]) return null;

	const levelData = result[0];
	if (levelData.voice_rewarded_at) {
		levelData.voice_rewarded_at = parseMySQLDateTime(levelData.voice_rewarded_at);
	}
	if (levelData.chat_rewarded_at) {
		levelData.chat_rewarded_at = parseMySQLDateTime(levelData.chat_rewarded_at);
	}

	return levelData;
}

export async function ensureMemberLevel(memberId: any) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await query(
		`INSERT INTO server_member_levels (member_id, created_at, updated_at)
		 VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)`,
		[memberId, now, now]
	);
	return await getMemberLevel(memberId);
}

export async function updateMemberLevelStats(memberId: any, updates: any = {}) {
	await initializeDatabase();
	if (!memberId) {
		throw new Error('memberId is required to update leveling stats');
	}

	const clauses: string[] = [];
	const values: any[] = [];

	if (typeof updates.chatIncrement === 'number' && updates.chatIncrement !== 0) {
		clauses.push('chat_total = chat_total + ?');
		values.push(updates.chatIncrement);
	}

	if (typeof updates.voiceMinutesActiveIncrement === 'number' && updates.voiceMinutesActiveIncrement !== 0) {
		clauses.push('voice_minutes_active = voice_minutes_active + ?');
		values.push(updates.voiceMinutesActiveIncrement);
	}

	if (typeof updates.voiceMinutesAfkIncrement === 'number' && updates.voiceMinutesAfkIncrement !== 0) {
		clauses.push('voice_minutes_afk = voice_minutes_afk + ?');
		values.push(updates.voiceMinutesAfkIncrement);
	}

	if (updates.voiceMinutesActiveIncrement !== undefined || updates.voiceMinutesAfkIncrement !== undefined) {
		clauses.push('voice_minutes_total = voice_minutes_active + voice_minutes_afk');
	}

	if (typeof updates.experienceIncrement === 'number' && updates.experienceIncrement !== 0) {
		clauses.push('experience = experience + ?');
		values.push(updates.experienceIncrement);
	}

	if (updates.level !== undefined && updates.level !== null) {
		clauses.push('level = ?');
		values.push(updates.level);
	}

	if (updates.rank !== undefined) {
		clauses.push('rank = ?');
		values.push(updates.rank);
	}

	if (typeof updates.isInVoice === 'boolean') {
		clauses.push('is_in_voice = ?');
		values.push(updates.isInVoice ? 1 : 0);
	}

	if (updates.chatRewardedAt) {
		clauses.push('chat_rewarded_at = ?');
		values.push(toMySQLDateTime(updates.chatRewardedAt));
	}

	if (updates.voiceRewardedAt !== undefined) {
		if (updates.voiceRewardedAt === null) {
			clauses.push('voice_rewarded_at = NULL');
		} else {
			clauses.push('voice_rewarded_at = ?');
			values.push(toMySQLDateTime(updates.voiceRewardedAt));
		}
	}

	if (clauses.length === 0) {
		return await getMemberLevel(memberId);
	}

	clauses.push('updated_at = ?');
	values.push(toMySQLDateTime());
	values.push(memberId);

	await query(
		`UPDATE server_member_levels
		 SET ${clauses.join(', ')}
		 WHERE member_id = ?`,
		values
	);

	return await getMemberLevel(memberId);
}

export async function setMemberLanguage(serverId: any, discordMemberId: string, language = 'en') {
	await initializeDatabase();
	if (!serverId || !discordMemberId || !language) {
		throw new Error('serverId, discordMemberId, and language are required');
	}

	await query('UPDATE server_members SET language = ? WHERE server_id = ? AND discord_member_id = ?', [language, serverId, discordMemberId]);

	return true;
}

export async function getMemberLanguage(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	if (!serverId || !discordMemberId) {
		return 'en';
	}

	const result = await query('SELECT language FROM server_members WHERE server_id = ? AND discord_member_id = ? LIMIT 1', [serverId, discordMemberId]);

	return result[0]?.language || 'en';
}

export async function setMemberLevelDMPreference(memberId: any, enabled = true) {
	await initializeDatabase();
	if (!memberId) {
		throw new Error('memberId is required to update DM preference');
	}

	await query(
		`UPDATE server_member_levels
		 SET dm_notifications_enabled = ?, updated_at = ?
		 WHERE member_id = ?`,
		[enabled ? 1 : 0, toMySQLDateTime(), memberId]
	);

	return await getMemberLevel(memberId);
}

export async function recalculateServerMemberRanks(serverId: any) {
	await initializeDatabase();
	if (!serverId) {
		throw new Error('serverId is required to recalculate ranks');
	}

	const connection = await getPool().getConnection();
	try {
		await connection.query('SET @rank := 0');
		await connection.execute(
			`UPDATE server_member_levels sml
			 INNER JOIN (
			     SELECT ranked.id, (@rank := @rank + 1) AS computed_rank
			     FROM (
			         SELECT sml_inner.id
			         FROM server_member_levels sml_inner
			         INNER JOIN server_members sm_inner ON sml_inner.member_id = sm_inner.id
			         WHERE sm_inner.server_id = ?
			         ORDER BY sml_inner.experience DESC,
			                  sml_inner.level DESC,
			                  sml_inner.created_at ASC
			     ) AS ranked
			 ) AS ranks ON ranks.id = sml.id
			 SET sml.rank = ranks.computed_rank`,
			[serverId]
		);
		return true;
	} catch (error) {
		console.error('Error recalculating server member ranks:', error);
		return false;
	} finally {
		connection.release();
	}
}

export async function getMemberLevelByDiscordId(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const result = await query(
		`SELECT sml.*, sm.username, sm.display_name, sm.server_display_name, sm.discord_member_id
		 FROM server_member_levels sml
		 INNER JOIN server_members sm ON sml.member_id = sm.id
		 WHERE sm.server_id = ? AND sm.discord_member_id = ?
		 LIMIT 1`,
		[serverId, discordMemberId]
	);
	return result[0] || null;
}

export async function getMembersWithInVoiceFlag(serverId: any) {
	await initializeDatabase();
	if (!serverId) {
		throw new Error('serverId is required to fetch members with in-voice flag');
	}
	const result = await query(
		`SELECT sml.member_id, sm.discord_member_id
		 FROM server_member_levels sml
		 INNER JOIN server_members sm ON sml.member_id = sm.id
		 WHERE sm.server_id = ? AND sml.is_in_voice = TRUE`,
		[serverId]
	);
	return result;
}

export async function getServerLeaderboard(serverId: any, limit = 3, sortType = 'xp') {
	await initializeDatabase();
	if (!serverId) {
		throw new Error('serverId is required to fetch leaderboard');
	}
	const safeLimit = Math.max(1, Math.min(50, limit));

	let orderBy: string;
	switch (sortType) {
		case 'voice_total':
			orderBy = 'sml.voice_minutes_total DESC, sml.updated_at ASC, sml.created_at ASC';
			break;
		case 'voice_active':
			orderBy = 'sml.voice_minutes_active DESC, sml.updated_at ASC, sml.created_at ASC';
			break;
		case 'voice_afk':
			orderBy = 'sml.voice_minutes_afk DESC, sml.updated_at ASC, sml.created_at ASC';
			break;
		case 'chat':
			orderBy = 'sml.chat_total DESC, sml.updated_at ASC, sml.created_at ASC';
			break;
		case 'xp':
		default:
			orderBy = 'sml.experience DESC, sml.updated_at ASC, sml.created_at ASC';
			break;
	}

	const result = await query(
		`SELECT sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name, sm.avatar,
		        sml.experience, sml.level, sml.chat_total,
		        sml.voice_minutes_total, sml.voice_minutes_active, sml.voice_minutes_afk, sml.rank
		 FROM server_member_levels sml
		 INNER JOIN server_members sm ON sml.member_id = sm.id
		 WHERE sm.server_id = ?
		 ORDER BY ${orderBy}
		 LIMIT ?`,
		[serverId, String(safeLimit)]
	);
	return result;
}

export async function getServerMembersList(serverId: any) {
	await initializeDatabase();
	if (!serverId) {
		throw new Error('serverId is required to fetch members list');
	}

	const result = await query(
		`SELECT
			sm.id,
			sm.discord_member_id,
			sm.username,
			sm.display_name,
			sm.server_display_name,
			sm.avatar,
			sm.profile_created_at,
			sm.member_since,
			sm.is_booster,
			sm.booster_since,
			sml.level,
			sml.experience,
			sml.chat_total,
			sml.voice_minutes_active,
			sml.voice_minutes_afk,
			sml.rank,
			sma.message as afk_message,
			sma.created_at as afk_since,
			GROUP_CONCAT(
				DISTINCT CONCAT(sr.discord_role_id, ':', sr.name, ':', sr.color, ':', sr.position)
				ORDER BY sr.position DESC
				SEPARATOR ','
			) as roles
		 FROM server_members sm
		 LEFT JOIN server_member_levels sml ON sm.id = sml.member_id
		 LEFT JOIN server_members_afk sma ON sm.id = sma.member_id
		 LEFT JOIN server_member_roles smr ON sm.id = smr.member_id
		 LEFT JOIN server_roles sr ON smr.role_id = sr.id
		 WHERE sm.server_id = ?
		 GROUP BY sm.id, sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name,
		          sm.avatar, sm.profile_created_at, sm.member_since, sm.is_booster, sm.booster_since,
		          sml.level, sml.experience, sml.chat_total, sml.voice_minutes_active,
		          sml.voice_minutes_afk, sml.rank, sma.message, sma.created_at
		 ORDER BY sml.experience DESC, sml.level DESC, sm.created_at ASC`,
		[serverId]
	);

	return result.map((member: any) => ({
		...member,
		roles: member.roles
			? member.roles
					.split(',')
					.map((role: string) => {
						const [roleId, roleName, roleColor, position] = role.split(':');
						return {
							id: roleId,
							name: roleName,
							color: roleColor || null,
							position: position ? parseInt(position, 10) : 0
						};
					})
					.sort((a: any, b: any) => (b.position || 0) - (a.position || 0))
			: [],
		is_afk: !!member.afk_message
	}));
}

export async function getServerOverview(serverId: any) {
	await initializeDatabase();
	if (!serverId) {
		throw new Error('serverId is required to fetch server overview');
	}

	const [serverRow] = await query(
		`SELECT
			id,
			bot_id,
			discord_server_id,
			name,
			total_members,
			total_channels,
			total_boosters,
			boost_level,
			server_icon,
			created_at,
			updated_at
		 FROM servers
		 WHERE id = ?
		 LIMIT 1`,
		[serverId]
	);

	if (!serverRow) {
		throw new Error(`Server not found for id ${serverId}`);
	}

	const [
		memberCounts,
		leveledCount,
		afkCount,
		channelCounts,
		categoriesCount,
		rolesCount,
		levelingStats,
		customRolesCount,
		memberSyncTimes,
		channelSyncTimes,
		categorySyncTimes,
		roleSyncTimes,
		levelSyncTimes,
		settingsRows
	] = await Promise.all([
		query(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_booster = 1 THEN 1 ELSE 0 END) AS unique_boosters FROM server_members WHERE server_id = ?`, [serverId]),
		query(`SELECT COUNT(*) AS leveled FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ?`, [serverId]),
		query(`SELECT COUNT(*) AS afk FROM server_members_afk sma INNER JOIN server_members sm ON sm.id = sma.member_id WHERE sm.server_id = ?`, [serverId]),
		query(
			`SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(COALESCE(type, '')) IN ('guild_text', 'text') THEN 1 ELSE 0 END) AS text_count, SUM(CASE WHEN LOWER(COALESCE(type, '')) IN ('guild_news', 'news', 'guild_announcement', 'announcement') THEN 1 ELSE 0 END) AS announcement_count, SUM(CASE WHEN LOWER(COALESCE(type, '')) IN ('guild_voice', 'voice') THEN 1 ELSE 0 END) AS voice_count, SUM(CASE WHEN LOWER(COALESCE(type, '')) IN ('guild_stage_voice', 'stage', 'stage_voice') THEN 1 ELSE 0 END) AS stage_count FROM server_channels WHERE server_id = ?`,
			[serverId]
		),
		query(`SELECT COUNT(*) AS count FROM server_categories WHERE server_id = ?`, [serverId]),
		query(`SELECT COUNT(*) AS count FROM server_roles WHERE server_id = ?`, [serverId]),
		query(
			`SELECT COALESCE(SUM(experience), 0) AS total_experience, COALESCE(AVG(level), 0) AS avg_level, COALESCE(MAX(level), 0) AS max_level, COALESCE(SUM(chat_total), 0) AS total_chat, COALESCE(SUM(voice_minutes_total), 0) AS total_voice_minutes, COALESCE(SUM(voice_minutes_active), 0) AS total_voice_active, COALESCE(SUM(voice_minutes_afk), 0) AS total_voice_afk FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ?`,
			[serverId]
		),
		query(
			`SELECT COUNT(DISTINCT smr.member_id) AS members_with_custom_roles FROM server_member_roles smr INNER JOIN server_members sm ON sm.id = smr.member_id WHERE sm.server_id = ? AND smr.is_custom = 1`,
			[serverId]
		),
		query(`SELECT MAX(updated_at) AS last_updated FROM server_members WHERE server_id = ?`, [serverId]),
		query(`SELECT MAX(updated_at) AS last_updated FROM server_channels WHERE server_id = ?`, [serverId]),
		query(`SELECT MAX(updated_at) AS last_updated FROM server_categories WHERE server_id = ?`, [serverId]),
		query(`SELECT MAX(updated_at) AS last_updated FROM server_roles WHERE server_id = ?`, [serverId]),
		query(
			`SELECT MAX(sml.updated_at) AS last_updated FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ?`,
			[serverId]
		),
		query(`SELECT component_name, updated_at FROM server_settings WHERE server_id = ? ORDER BY component_name ASC`, [serverId])
	]);

	const settingsLastUpdated = settingsRows.reduce((latest: any, row: any) => {
		if (!row.updated_at) return latest;
		if (!latest) return row.updated_at;
		const rowDate = parseMySQLDateTime(row.updated_at);
		const latestDate = parseMySQLDateTime(latest);
		return rowDate && latestDate && rowDate > latestDate ? row.updated_at : latest;
	}, null);

	return {
		...serverRow,
		stats: {
			members_total: memberCounts[0]?.total || 0,
			members_boosters: serverRow.total_boosters || 0,
			members_unique_boosters: memberCounts[0]?.unique_boosters || 0,
			members_with_levels: leveledCount[0]?.leveled || 0,
			members_afk: afkCount[0]?.afk || 0,
			members_with_custom_roles: customRolesCount[0]?.members_with_custom_roles || 0,
			channels_total: channelCounts[0]?.total || 0,
			channels_text: channelCounts[0]?.text_count || 0,
			channels_announcement: channelCounts[0]?.announcement_count || 0,
			channels_voice: channelCounts[0]?.voice_count || 0,
			channels_stage: channelCounts[0]?.stage_count || 0,
			categories_total: categoriesCount[0]?.count || 0,
			roles_total: rolesCount[0]?.count || 0,
			leveling_total_experience: Math.round(levelingStats[0]?.total_experience || 0),
			leveling_avg_level: Math.round(levelingStats[0]?.avg_level * 100) / 100 || 0,
			leveling_max_level: levelingStats[0]?.max_level || 0,
			leveling_total_chat: levelingStats[0]?.total_chat || 0,
			leveling_total_voice_minutes: levelingStats[0]?.total_voice_minutes || 0,
			leveling_total_voice_active: levelingStats[0]?.total_voice_active || 0,
			leveling_total_voice_afk: levelingStats[0]?.total_voice_afk || 0
		},
		sync: {
			members_last_updated: memberSyncTimes[0]?.last_updated || null,
			channels_last_updated: channelSyncTimes[0]?.last_updated || null,
			categories_last_updated: categorySyncTimes[0]?.last_updated || null,
			roles_last_updated: roleSyncTimes[0]?.last_updated || null,
			levels_last_updated: levelSyncTimes[0]?.last_updated || null,
			settings_last_updated: settingsLastUpdated
		},
		settings: settingsRows.map((row: any) => ({
			component_name: row.component_name,
			updated_at: row.updated_at
		}))
	};
}

export async function updateCustomRoleFlags(serverId: any, roleStartId: string, roleEndId: string) {
	try {
		if (!roleStartId || !roleEndId) {
			await query('UPDATE server_member_roles SET is_custom = FALSE WHERE role_id IN (SELECT id FROM server_roles WHERE server_id = ?)', [serverId]);
			return true;
		}

		const startRole = await query('SELECT id, position FROM server_roles WHERE server_id = ? AND discord_role_id = ?', [serverId, roleStartId]);
		const endRole = await query('SELECT id, position FROM server_roles WHERE server_id = ? AND discord_role_id = ?', [serverId, roleEndId]);

		if (!startRole || startRole.length === 0 || !endRole || endRole.length === 0) {
			await query('UPDATE server_member_roles SET is_custom = FALSE WHERE role_id IN (SELECT id FROM server_roles WHERE server_id = ?)', [serverId]);
			return true;
		}

		const startPosition = startRole[0].position;
		const endPosition = endRole[0].position;

		await query(
			`UPDATE server_member_roles smr
			 INNER JOIN server_roles sr ON smr.role_id = sr.id
			 SET smr.is_custom = TRUE
			 WHERE sr.server_id = ? AND sr.position < ? AND sr.position > ? AND sr.discord_role_id != ?`,
			[serverId, startPosition, endPosition, roleStartId]
		);

		await query(
			`UPDATE server_member_roles smr
			 INNER JOIN server_roles sr ON smr.role_id = sr.id
			 SET smr.is_custom = FALSE
			 WHERE sr.server_id = ? AND (sr.position >= ? OR sr.position <= ? OR sr.discord_role_id = ?)`,
			[serverId, startPosition, endPosition, roleStartId]
		);

		return true;
	} catch (error) {
		console.error('Error updating custom role flags:', error);
		return false;
	}
}

export async function memberHasCustomSupporterRole(discordMemberId: string, serverId: any) {
	try {
		if (!discordMemberId || !serverId) return { has: false, role: null };

		const memberResult = await query('SELECT id FROM server_members WHERE server_id = ? AND discord_member_id = ?', [serverId, discordMemberId]);

		if (!memberResult || memberResult.length === 0) {
			return { has: false, role: null };
		}

		const memberId = memberResult[0].id;

		const roleResult = await query(
			`SELECT sr.id, sr.discord_role_id, sr.name, sr.position, sr.color
			 FROM server_roles sr
			 INNER JOIN server_member_roles smr ON sr.id = smr.role_id
			 INNER JOIN server_members sm ON smr.member_id = sm.id
			 WHERE smr.member_id = ? AND sm.server_id = ? AND smr.is_custom = TRUE
			 ORDER BY sr.position DESC
			 LIMIT 1`,
			[memberId, serverId]
		);

		if (roleResult && roleResult.length > 0) {
			return { has: true, role: roleResult[0] };
		}

		return { has: false, role: null };
	} catch (error) {
		console.error('Error checking custom supporter role:', error);
		return { has: false, role: null };
	}
}

export async function syncMembers(serverId: any, members: any[]) {
	try {
		if (!members || members.length === 0) {
			const dbMembers = await query('SELECT id, discord_member_id FROM server_members WHERE server_id = ?', [serverId]);
			if (dbMembers && dbMembers.length > 0) {
				const idsToDelete = dbMembers.map((m: any) => m.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				await query(`DELETE FROM server_members WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...idsToDelete]);
				console.log(`🧹 Removed ${idsToDelete.length} deleted member(s) from database`);
			}
			return true;
		}

		const operations = members.map(async (member) => {
			try {
				const dbMember = await upsertMember(serverId, member);
				if (dbMember) {
					const memberRoles = member.roles ? Array.from(member.roles.cache.keys()).filter((roleId: any) => roleId !== member.guild?.id) : [];
					await syncMemberRoles(dbMember.id, memberRoles as string[], serverId);
				}
				return dbMember;
			} catch (err: any) {
				const memberId = member.user?.id || member.id;
				console.error(`Error upserting member ${memberId}:`, err.message);
				return null;
			}
		});

		await Promise.all(operations);

		const discordMemberIds = new Set(
			members.map((member) => {
				const user = member.user || member;
				return user?.id || member.id;
			})
		);

		const dbMembers = await query('SELECT id, discord_member_id FROM server_members WHERE server_id = ?', [serverId]);

		if (dbMembers && dbMembers.length > 0) {
			const membersToDelete = dbMembers.filter((dbMember: any) => !discordMemberIds.has(dbMember.discord_member_id));

			if (membersToDelete.length > 0) {
				const idsToDelete = membersToDelete.map((member: any) => member.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				await query(`DELETE FROM server_members WHERE server_id = ? AND id IN (${placeholders})`, [serverId, ...idsToDelete]);
				console.log(`🧹 Removed ${idsToDelete.length} deleted member(s) from database`);
			}
		}

		return true;
	} catch (error) {
		console.error('Error syncing members:', error);
		return false;
	}
}

async function getPanel() {
	const result = await query('SELECT * FROM panel LIMIT 1');
	return result[0] || null;
}

async function createPanel() {
	const existing = await getPanel();
	if (existing) {
		throw new Error('Panel already exists');
	}

	const connection = await getPool().getConnection();
	try {
		const now = toMySQLDateTime();
		const [result] = await connection.execute('INSERT INTO panel (created_at, updated_at) VALUES (?, ?)', [now, now]);
		const panels = await query('SELECT * FROM panel WHERE id = ?', [(result as any).insertId]);
		return panels[0];
	} finally {
		connection.release();
	}
}

async function getAccountById(accountId: any) {
	const result = await query('SELECT * FROM accounts WHERE id = ? LIMIT 1', [accountId]);
	return result[0] || null;
}

async function getAccountByEmail(email: string) {
	const result = await query('SELECT * FROM accounts WHERE email = ? LIMIT 1', [email]);
	return result[0] || null;
}

async function getAccountByUsername(username: string) {
	const result = await query('SELECT * FROM accounts WHERE username = ? LIMIT 1', [username]);
	return result[0] || null;
}

async function createAccount(accountData: any) {
	const connection = await getPool().getConnection();
	try {
		const now = toMySQLDateTime();
		const [result] = await connection.execute(
			`INSERT INTO accounts (
				username, email, password_hash, account_type, email_verified, otp_code, otp_expires_at, panel_id, ip_address, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				accountData.username,
				accountData.email,
				accountData.password_hash,
				accountData.account_type || 'superadmin',
				accountData.email_verified || false,
				accountData.otp_code || null,
				accountData.otp_expires_at ? toMySQLDateTime(accountData.otp_expires_at) : null,
				accountData.panel_id || null,
				accountData.ip_address || null,
				now,
				now
			]
		);
		const accounts = await query('SELECT * FROM accounts WHERE id = ?', [(result as any).insertId]);
		return accounts[0];
	} finally {
		connection.release();
	}
}

async function updateAccount(accountId: any, updateData: any) {
	const fields = Object.keys(updateData).filter((key) => updateData[key] !== undefined);
	if (fields.length === 0) {
		return await getAccountById(accountId);
	}

	const setClause = fields.map((field) => `${field} = ?`).join(', ');

	const values = fields.map((field) => {
		if (field === 'otp_expires_at' && updateData[field]) {
			return toMySQLDateTime(updateData[field]);
		}
		return updateData[field];
	});

	await query(`UPDATE accounts SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, toMySQLDateTime(), accountId]);

	return await getAccountById(accountId);
}

async function deleteAccount(accountId: any) {
	await query('DELETE FROM accounts WHERE id = ?', [accountId]);
}

async function getAllAccounts() {
	return await query('SELECT id, username, email, account_type, email_verified, is_frozen, created_at, updated_at FROM accounts ORDER BY created_at ASC');
}

async function createInviteLink(linkData: any) {
	const connection = await getPool().getConnection();
	try {
		const now = toMySQLDateTime();
		const expiresAt = linkData.expires_at ? toMySQLDateTime(linkData.expires_at) : null;
		const [result] = await connection.execute(
			`INSERT INTO account_invites (
				token, account_type, server_id, created_by, expires_at, created_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
			[linkData.token, linkData.account_type, linkData.server_id || null, linkData.created_by, expiresAt, now]
		);
		const links = await query('SELECT * FROM account_invites WHERE id = ?', [(result as any).insertId]);
		return links[0];
	} finally {
		connection.release();
	}
}

async function getInviteLinkByToken(token: string) {
	const result = await query('SELECT * FROM account_invites WHERE token = ? LIMIT 1', [token]);
	return result[0] || null;
}

async function updateInviteLink(linkId: any, updateData: any) {
	const fields = Object.keys(updateData).filter((key) => updateData[key] !== undefined);
	if (fields.length === 0) {
		return await getInviteLinkByToken(linkId);
	}

	const setClause = fields.map((field) => `${field} = ?`).join(', ');

	const values = fields.map((field) => {
		if (field === 'used_at' && updateData[field]) {
			return toMySQLDateTime(updateData[field]);
		}
		return updateData[field];
	});
	values.push(linkId);

	await query(`UPDATE account_invites SET ${setClause} WHERE id = ?`, values);

	const links = await query('SELECT * FROM account_invites WHERE id = ?', [linkId]);
	return links[0];
}

async function getAllInviteLinks() {
	return await query(
		`SELECT
			ai.*,
			s.name as server_name,
			creator.username as creator_username,
			creator.email as creator_email,
			used.username as used_by_username,
			used.email as used_by_email
		FROM account_invites ai
		LEFT JOIN servers s ON ai.server_id = s.id
		LEFT JOIN accounts creator ON ai.created_by = creator.id
		LEFT JOIN accounts used ON ai.used_by = used.id
		ORDER BY ai.created_at DESC`
	);
}

async function getServerInviteLinks(serverId: number) {
	return await query(
		`SELECT
			ai.*,
			creator.username as creator_username,
			used.username as used_by_username
		FROM account_invites ai
		LEFT JOIN accounts creator ON ai.created_by = creator.id
		LEFT JOIN accounts used ON ai.used_by = used.id
		WHERE ai.server_id = ?
		ORDER BY ai.created_at DESC`,
		[serverId]
	);
}

async function getAccountServerAccess(accountId: number) {
	return await query('SELECT server_id, role FROM account_server_access WHERE account_id = ?', [accountId]);
}

async function createAccountServerAccess(data: { account_id: number; server_id: number; role: 'owner' | 'moderator'; invited_by?: number | null }) {
	const now = toMySQLDateTime();
	await query(
		`INSERT INTO account_server_access (account_id, server_id, role, invited_by, created_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE role = VALUES(role)`,
		[data.account_id, data.server_id, data.role, data.invited_by || null, now]
	);
}

async function deleteAccountServerAccess(accountId: number, serverId: number) {
	await query('DELETE FROM account_server_access WHERE account_id = ? AND server_id = ?', [accountId, serverId]);
}

async function getServerAccounts(serverId: number) {
	return await query(
		`SELECT a.id, a.username, a.email, a.account_type, a.is_frozen, a.created_at, asa.role, asa.invited_by
		 FROM accounts a
		 JOIN account_server_access asa ON asa.account_id = a.id
		 WHERE asa.server_id = ?
		 ORDER BY asa.role ASC, a.created_at ASC`,
		[serverId]
	);
}

async function getServerAccountById(id: number) {
	const result = await query('SELECT * FROM server_accounts WHERE id = ? LIMIT 1', [id]);
	return result[0] || null;
}

async function getServerAccountByEmail(email: string) {
	const result = await query('SELECT * FROM server_accounts WHERE email = ? LIMIT 1', [email]);
	return result[0] || null;
}

async function getServerAccountByUsername(username: string) {
	const result = await query('SELECT * FROM server_accounts WHERE username = ? LIMIT 1', [username]);
	return result[0] || null;
}

async function getServerAccountByEmailServer(email: string, serverId: number) {
	const result = await query('SELECT * FROM server_accounts WHERE email = ? AND server_id = ? LIMIT 1', [email, serverId]);
	return result[0] || null;
}

async function createServerAccount(data: {
	server_id: number;
	username: string;
	email: string;
	password_hash: string;
	account_type: 'owner' | 'moderator';
	email_verified?: boolean;
	otp_code?: string | null;
	otp_expires_at?: string | null;
	is_frozen?: boolean;
	invited_by?: number | null;
}) {
	const now = toMySQLDateTime();
	const result = await query(
		`INSERT INTO server_accounts (server_id, username, email, password_hash, account_type, email_verified, otp_code, otp_expires_at, is_frozen, invited_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			data.server_id,
			data.username,
			data.email,
			data.password_hash,
			data.account_type,
			data.email_verified ?? false,
			data.otp_code ?? null,
			data.otp_expires_at ?? null,
			data.is_frozen ?? false,
			data.invited_by ?? null,
			now,
			now
		]
	);
	return await getServerAccountById((result as any).insertId);
}

async function updateServerAccount(
	id: number,
	data: Partial<{
		username: string;
		email: string;
		password_hash: string;
		account_type: 'owner' | 'moderator';
		email_verified: boolean;
		otp_code: string | null;
		otp_expires_at: string | null;
		is_frozen: boolean;
		invited_by: number | null;
	}>
) {
	const now = toMySQLDateTime();
	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = [...Object.values(data), now, id];
	await query(`UPDATE server_accounts SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

async function deleteServerAccount(id: number) {
	await query('DELETE FROM server_accounts WHERE id = ?', [id]);
}

async function getServerAccountsByServer(serverId: number) {
	return await query(`SELECT * FROM server_accounts WHERE server_id = ? ORDER BY account_type ASC, created_at ASC`, [serverId]);
}

async function createServerAccountInvite(data: {
	token: string;
	server_id: number;
	account_type: 'owner' | 'moderator';
	created_by: number;
	expires_at: string;
}) {
	const now = toMySQLDateTime();
	await query(
		`INSERT INTO server_account_invites (token, server_id, account_type, created_by, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[data.token, data.server_id, data.account_type, data.created_by, data.expires_at, now]
	);
}

async function getServerAccountInviteByToken(token: string) {
	const result = await query('SELECT * FROM server_account_invites WHERE token = ? LIMIT 1', [token]);
	return result[0] || null;
}

async function updateServerAccountInvite(id: number, data: Partial<{ used_by: number; used_at: string }>) {
	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	await query(`UPDATE server_account_invites SET ${fields} WHERE id = ?`, [...Object.values(data), id]);
}

async function getServerAccountInvitesByServer(serverId: number) {
	return await query(
		`SELECT sai.*, creator.username as creator_username, sa.username as used_by_username
		 FROM server_account_invites sai
		 LEFT JOIN accounts creator ON sai.created_by = creator.id
		 LEFT JOIN server_accounts sa ON sai.used_by = sa.id
		 WHERE sai.server_id = ?
		 ORDER BY sai.created_at DESC`,
		[serverId]
	);
}

async function getAllServerBots() {
	return await query(`SELECT * FROM server_bots`, []);
}

async function getServerBots(serverId: number) {
	return await query(`SELECT * FROM server_bots WHERE server_id = ?`, [serverId]);
}

async function addServerBot(data: { server_id: number; name: string; token: string; is_testing: boolean }) {
	const now = toMySQLDateTime();
	const result = await query(
		`INSERT INTO server_bots (server_id, name, token, is_testing, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'stopped', ?, ?)`,
		[data.server_id, data.name, data.token, data.is_testing, now, now]
	);
	return (result as any).insertId;
}

async function updateServerBot(
	id: number,
	data: Partial<{ name: string; token: string; status: string; process_id: number | null; is_testing: boolean; uptime_started_at: string | null }>
) {
	const now = toMySQLDateTime();
	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = [...Object.values(data), now, id];
	await query(`UPDATE server_bots SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

async function removeServerBot(id: number) {
	await query('DELETE FROM server_bots WHERE id = ?', [id]);
}

async function getServerBotById(id: number) {
	const result = await query('SELECT * FROM server_bots WHERE id = ? LIMIT 1', [id]);
	return result[0] || null;
}

async function getOfficialBotForSelfbot(selfbotId: number) {
	const result = await query(
		`SELECT b.* FROM server_bots sb
		 JOIN servers s ON s.id = sb.server_id
		 JOIN bots b ON b.id = s.bot_id
		 WHERE sb.id = ? LIMIT 1`,
		[selfbotId]
	);
	return result[0] || null;
}

async function getSelfbotsForOfficialBot(officialBotId: number) {
	return await query(
		`SELECT sb.* FROM server_bots sb
		 JOIN servers s ON s.id = sb.server_id
		 WHERE s.bot_id = ?`,
		[officialBotId]
	);
}

async function getServerSettings(serverId: any, componentName: string | null = null) {
	await initializeDatabase();

	let result: any[];
	if (componentName) {
		result = await query('SELECT * FROM server_settings WHERE server_id = ? AND component_name = ? LIMIT 1', [serverId, componentName]);
		if (result[0] && result[0].settings) {
			try {
				result[0].settings = typeof result[0].settings === 'string' ? JSON.parse(result[0].settings) : result[0].settings;
			} catch (e) {
				console.error('Error parsing settings JSON:', e);
				result[0].settings = {};
			}
		}
	} else {
		result = await query('SELECT * FROM server_settings WHERE server_id = ?', [serverId]);
		result = result.map((row) => {
			if (row.settings) {
				try {
					row.settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
				} catch (e) {
					console.error('Error parsing settings JSON:', e);
					row.settings = {};
				}
			}
			return row;
		});
	}

	return componentName ? result[0] || null : result;
}

async function upsertServerSettings(serverId: any, componentName: string, settings: any) {
	try {
		await initializeDatabase();
		const now = toMySQLDateTime();

		await query(
			`INSERT INTO server_settings (server_id, component_name, settings, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE
			     settings = VALUES(settings),
			     updated_at = VALUES(updated_at)`,
			[serverId, componentName, JSON.stringify(settings), now, now]
		);

		const resultSettings = await query('SELECT * FROM server_settings WHERE server_id = ? AND component_name = ?', [serverId, componentName]);
		return resultSettings[0];
	} catch (error) {
		console.error('Error upserting server settings:', error);
		throw error;
	}
}

async function getChannelsForServer(serverId: any) {
	await initializeDatabase();
	const result = await query('SELECT * FROM server_channels WHERE server_id = ? ORDER BY position ASC, name ASC', [serverId]);
	return result;
}

async function getCategoriesForServer(serverId: any) {
	await initializeDatabase();
	const result = await query('SELECT * FROM server_categories WHERE server_id = ? ORDER BY position ASC', [serverId]);
	return result;
}

export async function getAFKStatus(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const result = await query(
		`SELECT sma.*, sm.server_display_name
		 FROM server_members_afk sma
		 INNER JOIN server_members sm ON sma.member_id = sm.id
		 WHERE sm.server_id = ? AND sm.discord_member_id = ?`,
		[serverId, discordMemberId]
	);
	if (!result || result.length === 0) {
		return null;
	}
	const afkData = result[0];
	let timestamp: number;
	if (afkData.created_at) {
		if (afkData.created_at instanceof Date) {
			timestamp = afkData.created_at.getTime();
		} else {
			const parsedDate = parseMySQLDateTime(afkData.created_at);
			timestamp = parsedDate ? parsedDate.getTime() : Date.now();
		}
	} else {
		timestamp = Date.now();
	}
	return {
		message: afkData.message || 'Away',
		timestamp: timestamp,
		serverDisplayName: afkData.server_display_name
	};
}

export async function setAFKStatus(serverId: any, discordMemberId: string, afkData: any) {
	await initializeDatabase();
	try {
		const memberResult = await query('SELECT id FROM server_members WHERE server_id = ? AND discord_member_id = ?', [serverId, discordMemberId]);

		if (!memberResult || memberResult.length === 0) {
			return null;
		}

		const memberId = memberResult[0].id;

		const now = toMySQLDateTime();
		await query(
			`INSERT INTO server_members_afk (
				member_id, message, created_at, updated_at
			) VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				message = VALUES(message),
				updated_at = VALUES(updated_at)`,
			[memberId, afkData.message || 'Away', now, now]
		);

		return await getAFKStatus(serverId, discordMemberId);
	} catch (error) {
		console.error('Error setting AFK status:', error);
		throw error;
	}
}

export async function removeAFKStatus(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	try {
		await query(
			`DELETE sma FROM server_members_afk sma
			 INNER JOIN server_members sm ON sma.member_id = sm.id
			 WHERE sm.server_id = ? AND sm.discord_member_id = ?`,
			[serverId, discordMemberId]
		);
		return true;
	} catch (error) {
		console.error('Error removing AFK status:', error);
		return false;
	}
}

export async function serversNeedSync(botId: number) {
	await initializeDatabase();

	const servers = await getServersForBot(botId);
	if (!servers || servers.length === 0) {
		return true;
	}

	for (const server of servers) {
		const categoriesResult = await query('SELECT COUNT(*) as count FROM server_categories WHERE server_id = ?', [server.id]);
		const channelsResult = await query('SELECT COUNT(*) as count FROM server_channels WHERE server_id = ?', [server.id]);
		const rolesResult = await query('SELECT COUNT(*) as count FROM server_roles WHERE server_id = ?', [server.id]);
		const membersResult = await query('SELECT COUNT(*) as count FROM server_members WHERE server_id = ?', [server.id]);

		const categoriesCount = categoriesResult[0]?.count || 0;
		const channelsCount = channelsResult[0]?.count || 0;
		const rolesCount = rolesResult[0]?.count || 0;
		const membersCount = membersResult[0]?.count || 0;

		if (categoriesCount === 0 || channelsCount === 0 || rolesCount === 0 || membersCount === 0) {
			return true;
		}
	}

	return false;
}

export async function createGiveaway(giveawayData: any) {
	await initializeDatabase();

	const endsAt = toMySQLDateTime(addMinutesToNow(giveawayData.duration_minutes));
	const createdAt = toMySQLDateTime();

	const result = await query(
		`INSERT INTO server_giveaways (
			member_id, title, prize,
			duration_minutes, allowed_roles, multiple_entries_allowed, winner_count,
			status, ends_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			giveawayData.member_id,
			giveawayData.title,
			giveawayData.prize,
			giveawayData.duration_minutes,
			giveawayData.allowed_roles ? JSON.stringify(giveawayData.allowed_roles) : null,
			giveawayData.multiple_entries_allowed || false,
			giveawayData.winner_count || 1,
			'active',
			endsAt,
			createdAt,
			createdAt
		]
	);

	const insertedId = (result as any).insertId;
	return await getGiveawayById(insertedId);
}

export async function updateGiveawayMessageId(giveawayId: any, discordMessageId: string) {
	await initializeDatabase();
	await query('UPDATE server_giveaways SET discord_message_id = ? WHERE id = ?', [discordMessageId, giveawayId]);
}

export async function getEndedGiveaways() {
	await initializeDatabase();

	const result = await query(
		`SELECT g.*, sm.server_id
		 FROM server_giveaways g
		 INNER JOIN server_members sm ON g.member_id = sm.id
		 WHERE g.status = ? AND g.winners_announced = ?`,
		['active', false]
	);

	const now = getNowInTimezone().toJSDate();

	const endedGiveaways = result.filter((row: any) => {
		const endsAt = parseMySQLDateTime(row.ends_at);
		return endsAt && endsAt <= now;
	});

	return endedGiveaways.map((row: any) => {
		if (row.allowed_roles) {
			try {
				row.allowed_roles = typeof row.allowed_roles === 'string' ? JSON.parse(row.allowed_roles) : row.allowed_roles;
			} catch (e) {
				row.allowed_roles = [];
			}
		}
		return row;
	});
}

export async function getGiveawayById(giveawayId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT g.*, sm.server_id
		 FROM server_giveaways g
		 INNER JOIN server_members sm ON g.member_id = sm.id
		 WHERE g.id = ?`,
		[giveawayId]
	);

	if (!result[0]) return null;

	if (result[0].allowed_roles) {
		try {
			result[0].allowed_roles = typeof result[0].allowed_roles === 'string' ? JSON.parse(result[0].allowed_roles) : result[0].allowed_roles;
		} catch (e) {
			result[0].allowed_roles = [];
		}
	}

	if (result[0].ends_at) {
		result[0].ends_at = parseMySQLDateTime(result[0].ends_at);
	}

	return result[0];
}

export async function getActiveGiveawayByMember(serverId: any, memberId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT g.* FROM server_giveaways g
		 INNER JOIN server_members sm ON g.member_id = sm.id
		 WHERE sm.server_id = ? AND g.member_id = ? AND g.status = ?`,
		[serverId, memberId, 'active']
	);

	if (!result[0]) return null;

	if (result[0].allowed_roles) {
		try {
			result[0].allowed_roles = typeof result[0].allowed_roles === 'string' ? JSON.parse(result[0].allowed_roles) : result[0].allowed_roles;
		} catch (e) {
			result[0].allowed_roles = [];
		}
	}

	if (result[0].ends_at) {
		result[0].ends_at = parseMySQLDateTime(result[0].ends_at);
	}

	return result[0];
}

export async function addGiveawayEntry(giveawayId: any, memberId: any, increment = true) {
	await initializeDatabase();
	const now = toMySQLDateTime();

	if (increment) {
		await query(
			`INSERT INTO server_giveaway_entries (giveaway_id, member_id, entry_count, created_at, updated_at)
			 VALUES (?, ?, 1, ?, ?)
			 ON DUPLICATE KEY UPDATE
			     entry_count = entry_count + 1,
			     updated_at = ?`,
			[giveawayId, memberId, now, now, now]
		);
	} else {
		await query(
			`INSERT INTO server_giveaway_entries (giveaway_id, member_id, entry_count, created_at, updated_at)
			 VALUES (?, ?, 1, ?, ?)
			 ON DUPLICATE KEY UPDATE updated_at = ?`,
			[giveawayId, memberId, now, now, now]
		);
	}

	const entry = await query('SELECT * FROM server_giveaway_entries WHERE giveaway_id = ? AND member_id = ?', [giveawayId, memberId]);

	return entry[0] || null;
}

export async function getGiveawayEntries(giveawayId: any) {
	await initializeDatabase();
	return await query(
		`SELECT ge.*, sm.discord_member_id
		 FROM server_giveaway_entries ge
		 INNER JOIN server_members sm ON ge.member_id = sm.id
		 WHERE ge.giveaway_id = ?
		 ORDER BY RAND()`,
		[giveawayId]
	);
}

export async function getRandomGiveawayWinners(giveawayId: any, winnerCount: number) {
	await initializeDatabase();
	const entries = await getGiveawayEntries(giveawayId);

	if (entries.length === 0) {
		return [];
	}

	const crypto = await import('crypto');
	const shuffledEntries = [...entries];

	for (let shuffleRound = 0; shuffleRound < 10; shuffleRound++) {
		for (let i = shuffledEntries.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[shuffledEntries[i], shuffledEntries[j]] = [shuffledEntries[j], shuffledEntries[i]];
		}
	}

	const weightedEntries: any[] = [];
	for (const entry of shuffledEntries) {
		for (let i = 0; i < entry.entry_count; i++) {
			weightedEntries.push(entry);
		}
	}

	for (let round = 0; round < 10; round++) {
		for (let i = weightedEntries.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[weightedEntries[i], weightedEntries[j]] = [weightedEntries[j], weightedEntries[i]];
		}
	}

	const winners: any[] = [];
	const usedMemberIds = new Set();
	const availableEntries = [...weightedEntries];

	while (winners.length < winnerCount && availableEntries.length > 0) {
		const randomIndex = crypto.randomInt(0, availableEntries.length);
		const selectedEntry = availableEntries[randomIndex];

		if (!usedMemberIds.has(selectedEntry.member_id)) {
			winners.push(selectedEntry);
			usedMemberIds.add(selectedEntry.member_id);
		}

		for (let i = availableEntries.length - 1; i >= 0; i--) {
			if (availableEntries[i].member_id === selectedEntry.member_id) {
				availableEntries.splice(i, 1);
			}
		}
	}

	return winners;
}

export async function markGiveawayEnded(giveawayId: any) {
	await initializeDatabase();
	await query('UPDATE server_giveaways SET status = ?, winners_announced = ? WHERE id = ?', ['ended', true, giveawayId]);
}

export async function markGiveawayEndedForce(giveawayId: any) {
	await initializeDatabase();
	await query('UPDATE server_giveaways SET status = ?, winners_announced = ? WHERE id = ?', ['ended_force', true, giveawayId]);
}

export async function markGiveawayWinners(giveawayId: any, winnerMemberIds: any[]) {
	await initializeDatabase();
	if (!winnerMemberIds || winnerMemberIds.length === 0) {
		return;
	}

	const placeholders = winnerMemberIds.map(() => '?').join(',');
	await query(
		`UPDATE server_giveaway_entries
		 SET is_winner = TRUE
		 WHERE giveaway_id = ? AND member_id IN (${placeholders})`,
		[giveawayId, ...winnerMemberIds]
	);
}

export async function getStaffRating(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT sr.* FROM server_staff_ratings sr
		 INNER JOIN server_members sm ON sr.staff_member_id = sm.id
		 WHERE sm.server_id = ? AND sr.staff_member_id = ?`,
		[serverId, staffMemberId]
	);
	return result[0] || null;
}

export async function upsertStaffRating(serverId: any, staffMemberId: any, ratingValue: number, totalReports: number) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const existing = await getStaffRating(serverId, staffMemberId);
	if (existing) {
		await query(
			`UPDATE server_staff_ratings
			 SET current_rating = ?, total_reports = ?, updated_at = ?
			 WHERE staff_member_id = ?`,
			[ratingValue, totalReports, now, staffMemberId]
		);
	} else {
		await query(
			`INSERT INTO server_staff_ratings
			 (staff_member_id, current_rating, total_reports, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[staffMemberId, ratingValue, totalReports, now, now]
		);
	}
	return await getStaffRating(serverId, staffMemberId);
}

export async function createStaffRatingReport(
	_serverId: any,
	reporterMemberId: any,
	reportedStaffId: any,
	rating: number,
	category: string,
	description: string,
	isAnonymous: boolean
) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result = await query(
		`INSERT INTO server_staff_reports
		 (reporter_member_id, reported_staff_id, rating, category, description, is_anonymous, status, reported_at)
		 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
		[reporterMemberId, reportedStaffId, rating, category, description, isAnonymous ? 1 : 0, now]
	);
	return (result as any).insertId;
}

export async function getLastStaffRatingReport(serverId: any, reporterMemberId: any, reportedStaffId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT sr.* FROM server_staff_reports sr
		 INNER JOIN server_members sm ON sr.reporter_member_id = sm.id
		 WHERE sm.server_id = ? AND sr.reporter_member_id = ? AND sr.reported_staff_id = ?
		 ORDER BY sr.reported_at DESC
		 LIMIT 1`,
		[serverId, reporterMemberId, reportedStaffId]
	);
	return result[0] || null;
}

export async function getStaffRatingAggregate(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT
			COUNT(*) as total_reports,
			AVG(rating) as average_rating
		 FROM server_staff_reports sr
		 INNER JOIN server_members sm ON sr.reported_staff_id = sm.id
		 WHERE sm.server_id = ? AND sr.reported_staff_id = ? AND sr.status = 'approved'`,
		[serverId, staffMemberId]
	);
	const row = result[0] || { total_reports: 0, average_rating: 0 };
	return {
		total_reports: row.total_reports || 0,
		average_rating: row.average_rating || 0
	};
}

export async function getStaffReportById(serverId: any, reportId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT
			sr.*,
			reporter.discord_member_id AS reporter_discord_id,
			staff.discord_member_id AS staff_discord_id
		 FROM server_staff_reports sr
		 INNER JOIN server_members reporter ON sr.reporter_member_id = reporter.id
		 INNER JOIN server_members staff ON sr.reported_staff_id = staff.id
		 WHERE reporter.server_id = ? AND sr.id = ?
		 LIMIT 1`,
		[serverId, reportId]
	);
	return result[0] || null;
}

export async function updateStaffReportStatus(reportId: any, status: string) {
	await initializeDatabase();
	await query(`UPDATE server_staff_reports SET status = ? WHERE id = ?`, [status, reportId]);
}

export async function createFeedback(_serverId: any, memberId: any, description: string, isAnonymous: boolean) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result = await query(
		`INSERT INTO server_feedback
		 (member_id, description, is_anonymous, submitted_at)
		 VALUES (?, ?, ?, ?)`,
		[memberId, description, isAnonymous ? 1 : 0, now]
	);
	return (result as any).insertId;
}

export async function getFeedback(serverId: any, feedbackId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT f.* FROM server_feedback f
		 INNER JOIN server_members sm ON f.member_id = sm.id
		 WHERE sm.server_id = ? AND f.id = ?`,
		[serverId, feedbackId]
	);
	return result[0] || null;
}

export async function getFeedbackByServer(serverId: any, limit = 100, offset = 0) {
	await initializeDatabase();
	const lim = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
	const off = Math.max(0, parseInt(String(offset), 10) || 0);
	const result = await query(
		`SELECT f.* FROM server_feedback f
		 INNER JOIN server_members sm ON f.member_id = sm.id
		 WHERE sm.server_id = ?
		 ORDER BY f.submitted_at DESC
		 LIMIT ? OFFSET ?`,
		[serverId, String(lim), String(off)]
	);
	return result;
}

export async function getFeedbackCount(serverId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT COUNT(*) as count FROM server_feedback f
		 INNER JOIN server_members sm ON f.member_id = sm.id
		 WHERE sm.server_id = ?`,
		[serverId]
	);
	return result[0]?.count || 0;
}

export async function markMemberRatingRole(serverId: any, staffMemberId: any, discordRoleId: string) {
	await initializeDatabase();
	if (!discordRoleId) {
		return;
	}
	await query('UPDATE server_member_roles SET is_rating = FALSE WHERE member_id = ?', [staffMemberId]);
	const roles = await query('SELECT id FROM server_roles WHERE server_id = ? AND discord_role_id = ? LIMIT 1', [serverId, discordRoleId]);
	if (!roles[0]) {
		return;
	}
	const now = toMySQLDateTime();
	await query(
		`INSERT INTO server_member_roles (member_id, role_id, is_custom, is_rating, created_at)
		 VALUES (?, ?, FALSE, TRUE, ?)
		 ON DUPLICATE KEY UPDATE is_rating = VALUES(is_rating)`,
		[staffMemberId, roles[0].id, now]
	);
}

export async function clearMemberRatingRole(staffMemberId: any) {
	await initializeDatabase();
	await query('UPDATE server_member_roles SET is_rating = FALSE WHERE member_id = ?', [staffMemberId]);
}

export async function getAllStaffRatings(serverId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT
			ssr.id,
			ssr.staff_member_id,
			ssr.current_rating,
			ssr.total_reports,
			sr.discord_role_id as rating_role_id,
			ssr.created_at,
			ssr.updated_at
		 FROM server_staff_ratings ssr
		 INNER JOIN server_members sm ON ssr.staff_member_id = sm.id
		 INNER JOIN server_member_roles smr ON ssr.staff_member_id = smr.member_id AND smr.is_rating = TRUE
		 INNER JOIN server_roles sr ON smr.role_id = sr.id
		 WHERE sm.server_id = ? AND ssr.current_rating > 0
		 ORDER BY ssr.current_rating DESC, ssr.created_at ASC`,
		[serverId]
	);
	return result || [];
}

export async function getStaffRatingRole(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const result = await query(
		`SELECT sr.discord_role_id
		 FROM server_member_roles smr
		 INNER JOIN server_roles sr ON smr.role_id = sr.id
		 INNER JOIN server_members sm ON smr.member_id = sm.id
		 WHERE sm.server_id = ? AND smr.member_id = ? AND smr.is_rating = TRUE
		 LIMIT 1`,
		[serverId, staffMemberId]
	);
	return result[0]?.discord_role_id || null;
}

export default {
	getAllBots,
	getBot,
	createBot,
	updateBot,
	deleteBot,
	getServer,
	getServersForBot,
	getServerByDiscordId,
	getOfficialBotServerIdForServer,
	getNotificationRolesForServer,
	getNotificationRolesWithCategory,
	getNotificationRoleByChannel,
	getNotificationRoleDbIds,
	upsertNotificationRole,
	deleteNotificationRole,
	upsertServer,
	upsertCategory,
	syncCategories,
	upsertChannel,
	syncChannels,
	getRoles,
	upsertRole,
	syncRoles,
	upsertMember,
	getMemberByDiscordId,
	syncMembers,
	syncMemberRoles,
	memberHasAnyRole,
	getMemberLevel,
	ensureMemberLevel,
	updateMemberLevelStats,
	setMemberLevelDMPreference,
	setMemberLanguage,
	getMemberLanguage,
	recalculateServerMemberRanks,
	getMemberLevelByDiscordId,
	getMembersWithInVoiceFlag,
	getServerLeaderboard,
	getServerMembersList,
	getServerOverview,
	updateCustomRoleFlags,
	memberHasCustomSupporterRole,
	getPanel,
	createPanel,
	getAccountById,
	getAccountByEmail,
	getAccountByUsername,
	createAccount,
	updateAccount,
	deleteAccount,
	getAllAccounts,
	createInviteLink,
	getInviteLinkByToken,
	updateInviteLink,
	getAllInviteLinks,
	getServerInviteLinks,
	getAccountServerAccess,
	createAccountServerAccess,
	deleteAccountServerAccess,
	getServerAccounts,
	getServerAccountById,
	getServerAccountByEmail,
	getServerAccountByUsername,
	getServerAccountByEmailServer,
	createServerAccount,
	updateServerAccount,
	deleteServerAccount,
	getServerAccountsByServer,
	createServerAccountInvite,
	getServerAccountInviteByToken,
	updateServerAccountInvite,
	getServerAccountInvitesByServer,
	getAllServerBots,
	getServerBots,
	getServerBotById,
	addServerBot,
	updateServerBot,
	removeServerBot,
	getOfficialBotForSelfbot,
	getSelfbotsForOfficialBot,
	getServerSettings,
	upsertServerSettings,
	getChannelsForServer,
	getCategoriesForServer,
	serversNeedSync,
	getAFKStatus,
	setAFKStatus,
	removeAFKStatus,
	createGiveaway,
	updateGiveawayMessageId,
	getEndedGiveaways,
	getGiveawayById,
	getActiveGiveawayByMember,
	addGiveawayEntry,
	getGiveawayEntries,
	getRandomGiveawayWinners,
	markGiveawayEnded,
	markGiveawayEndedForce,
	markGiveawayWinners,
	getStaffRating,
	upsertStaffRating,
	createStaffRatingReport,
	getLastStaffRatingReport,
	getStaffRatingAggregate,
	getStaffReportById,
	updateStaffReportStatus,
	markMemberRatingRole,
	clearMemberRatingRole,
	getAllStaffRatings,
	getStaffRatingRole,
	createFeedback,
	getFeedback,
	getFeedbackByServer,
	getFeedbackCount
};
