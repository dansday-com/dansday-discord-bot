import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import { eq, and, or, inArray, sql, desc, asc, isNull, isNotNull, count, avg, like, ne } from 'drizzle-orm';
import { db } from './drizzle.js';
import * as schema from './schema.js';
import { SERVER_SETTINGS } from './frontend/panelServer.js';
import { logger, toMySQLDateTime, parseMySQLDateTimeUtc, getNowUtc } from './utils/index.js';
import type { DiscordQuestSummary } from './backend/api/discord-quest-api.js';

function getConnectionConfig() {
	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl) {
		const url = new URL(databaseUrl);
		return {
			host: url.hostname,
			port: parseInt(url.port),
			user: url.username,
			password: url.password,
			database: url.pathname.slice(1)
		};
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

async function tableExists(name: string) {
	const cfg = getConnectionConfig();
	const conn = await mysql.createConnection(cfg);
	try {
		const [rows] = await conn.execute('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [
			cfg.database,
			name
		]);
		return (rows as any[])[0]?.count > 0;
	} finally {
		await conn.end();
	}
}

async function runMigration() {
	const connection = await mysql.createConnection(getConnectionConfig());
	try {
		logger.log('🔌 Connecting to database...');
		await connection.connect();
		logger.log('✅ Connected to database');

		const schemaPath = join(process.cwd(), 'src/lib/schema.sql');
		const schemaSQL = readFileSync(schemaPath, 'utf-8');

		logger.log('📦 Executing schema...');
		const statements = schemaSQL
			.split(';')
			.map((s: string) => s.trim())
			.filter((s: string) => s.length > 0 && !s.startsWith('--'));

		for (const statement of statements) {
			if (statement.length > 0) await connection.query(statement);
		}

		logger.log('✅ Database schema created successfully!');
	} catch (error: any) {
		logger.log(`❌ Migration failed: ${error.message}`);
		throw error;
	} finally {
		await connection.end();
		logger.log('🔌 Database connection closed');
	}
}

async function runMigrations() {
	const migrationsDir = join(process.cwd(), 'src/lib/migrations');
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

	const connection = await mysql.createConnection({ ...getConnectionConfig(), multipleStatements: true });
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
			if ((rows as any[]).length > 0) continue;

			logger.log(`🔧 Running migration: ${file}`);
			const migSql = readFileSync(join(migrationsDir, file), 'utf-8');
			await connection.query(migSql);
			await connection.execute('INSERT INTO migrations (name, ran_at) VALUES (?, UTC_TIMESTAMP())', [file]);
			logger.log(`✅ Migration complete: ${file}`);
		}
	} catch (err: any) {
		logger.log(`❌ Migration runner failed: ${err.message}`);
		throw err;
	} finally {
		try {
			await connection.end();
		} catch (_) {}
	}
}

async function markAllMigrationsAsDone() {
	const migrationsDir = join(process.cwd(), 'src/lib/migrations');
	let files: string[];
	try {
		files = readdirSync(migrationsDir)
			.filter((f) => f.endsWith('.sql'))
			.sort();
	} catch (_) {
		return;
	}

	for (const file of files) {
		await db.execute(sql`INSERT IGNORE INTO migrations (name, ran_at) VALUES (${file}, UTC_TIMESTAMP())`);
	}
}

async function setupDatabase() {
	logger.log('🔍 Checking database...');
	const hasBots = await tableExists('bots');
	const hasPanel = await tableExists('panels');

	if (!hasBots && !hasPanel) {
		logger.log('🆕 Fresh database detected, running schema...');
		await runMigration();
		logger.log('✅ Schema applied');
		await markAllMigrationsAsDone();
		return true;
	}

	logger.log('✅ Existing database detected, checking migrations...');
	await runMigrations();
	return true;
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
		} finally {
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

async function retryOnConnectionError<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 2000): Promise<T> {
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
	throw new Error('Max retries exceeded');
}

export async function getAllBots(panelId?: number | null) {
	await initializeDatabase();
	if (panelId != null) {
		return retryOnConnectionError(() =>
			db
				.select()
				.from(schema.bots)
				.where(eq(schema.bots.panel_id, Number(panelId)))
				.orderBy(asc(schema.bots.created_at))
		);
	}
	return retryOnConnectionError(() => db.select().from(schema.bots).orderBy(asc(schema.bots.created_at)));
}

export async function getBot(botId: number | string) {
	await initializeDatabase();
	return retryOnConnectionError(async () => {
		const rows = await db
			.select()
			.from(schema.bots)
			.where(eq(schema.bots.id, Number(botId)))
			.limit(1);
		if (!rows[0]) return null;
		const bot = { ...rows[0] };
		if (bot.uptime_started_at) {
			bot.uptime_started_at = parseMySQLDateTimeUtc(bot.uptime_started_at as any) as any;
		}
		return bot;
	});
}

export async function createBot(botData: any) {
	await initializeDatabase();
	const bots = await getAllBots(botData.panel_id);
	const botNumber = bots.length + 1;
	const now = toMySQLDateTime();

	const result = await db.insert(schema.bots).values({
		name: botData.name || `Bot#${botNumber}`,
		token: botData.token,
		application_id: botData.application_id || null,
		bot_icon: botData.bot_icon || null,
		port: botData.port !== undefined ? botData.port : 7777,
		secret_key: botData.secret_key || null,
		panel_id: botData.panel_id,
		created_at: now as any,
		updated_at: now as any
	});

	const rows = await db
		.select()
		.from(schema.bots)
		.where(eq(schema.bots.id, (result[0] as any).insertId))
		.limit(1);
	return rows[0];
}

export async function updateBot(botId: number, botData: any) {
	const updateData: any = { ...botData, updated_at: toMySQLDateTime() };

	if (botData.status === 'running' && !botData.uptime_started_at) {
		updateData.uptime_started_at = toMySQLDateTime();
	} else if (botData.uptime_started_at) {
		updateData.uptime_started_at = toMySQLDateTime(botData.uptime_started_at);
	}

	if (botData.status === 'stopped') {
		updateData.uptime_started_at = null;
		updateData.process_id = null;
	}

	await db.update(schema.bots).set(updateData).where(eq(schema.bots.id, botId));
	return getBot(botId);
}

export async function deleteBot(botId: number) {
	await db.delete(schema.bots).where(eq(schema.bots.id, botId));
	return true;
}

export async function getBotPanelId(botId: number): Promise<number | null> {
	await initializeDatabase();
	const rows = await db.select({ panel_id: schema.bots.panel_id }).from(schema.bots).where(eq(schema.bots.id, botId)).limit(1);
	return rows[0]?.panel_id ?? null;
}

export async function getServerPanelId(serverId: number): Promise<number | null> {
	await initializeDatabase();
	const rows = await db
		.select({ panel_id: schema.bots.panel_id })
		.from(schema.servers)
		.innerJoin(schema.bots, eq(schema.bots.id, schema.servers.bot_id))
		.where(eq(schema.servers.id, serverId))
		.limit(1);
	return rows[0]?.panel_id ?? null;
}

export async function getServer(serverId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.servers)
		.where(eq(schema.servers.id, Number(serverId)))
		.limit(1);
	return rows[0] || null;
}

export async function getServersForBot(officialBotId: number) {
	return db.select().from(schema.servers).where(eq(schema.servers.bot_id, officialBotId)).orderBy(asc(schema.servers.name));
}

export async function getServersForSelfbot(selfbotId: number) {
	await initializeDatabase();
	return db.select().from(schema.serverBotServers).where(eq(schema.serverBotServers.server_bot_id, selfbotId)).orderBy(asc(schema.serverBotServers.name));
}

export async function getOfficialServerByDiscordId(officialBotId: number, discordServerId: string) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.servers)
		.where(and(eq(schema.servers.bot_id, officialBotId), eq(schema.servers.discord_server_id, discordServerId)))
		.limit(1);
	return rows[0] || null;
}

export async function getSelfbotServerByDiscordId(selfbotId: number, discordServerId: string) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverBotServers)
		.where(and(eq(schema.serverBotServers.server_bot_id, selfbotId), eq(schema.serverBotServers.discord_server_id, discordServerId)))
		.limit(1);
	return rows[0] || null;
}

export async function getServerByDiscordId(botId: number, discordServerId: string, opts?: { forSelfbot?: boolean }) {
	if (opts?.forSelfbot) return getSelfbotServerByDiscordId(botId, discordServerId);
	return getOfficialServerByDiscordId(botId, discordServerId);
}

export async function getOfficialBotServerIdForServer(serverId: any) {
	const server = await getServer(serverId);
	if (!server) return null;
	return server.id;
}

async function getServerIdsInSameGuild(serverId: any) {
	const sub = db
		.select({ discord_server_id: schema.servers.discord_server_id })
		.from(schema.servers)
		.where(eq(schema.servers.id, Number(serverId)))
		.limit(1);
	const rows = await db
		.select({ id: schema.servers.id })
		.from(schema.servers)
		.where(eq(schema.servers.discord_server_id, sql`(${sub})`));
	return rows.map((r) => r.id);
}

export async function getNotificationRolesForServer(serverId: any) {
	await initializeDatabase();
	return db
		.select({ discord_channel_id: schema.serverChannels.discord_channel_id, discord_role_id: schema.serverRoles.discord_role_id })
		.from(schema.serverChannels)
		.innerJoin(schema.serverRoles, eq(schema.serverRoles.id, schema.serverChannels.notification_role_id!))
		.where(and(eq(schema.serverChannels.server_id, Number(serverId)), isNotNull(schema.serverChannels.notification_role_id)));
}

export async function getNotificationRolesWithCategory(serverId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT r.discord_role_id, COALESCE(cat.name, c.name) AS category_name,
		       COALESCE(cat.position, 9999) AS category_position,
		       COALESCE(c.position, 0) AS channel_position,
		       c.name AS channel_name
		FROM server_channels c
		INNER JOIN server_roles r ON r.id = c.notification_role_id
		LEFT JOIN server_categories cat ON cat.id = c.category_id
		WHERE c.server_id = ${Number(serverId)} AND c.notification_role_id IS NOT NULL
		ORDER BY category_position ASC, channel_position ASC, channel_name ASC
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function getNotificationRoleByChannel(serverId: any, discordChannelId: string) {
	await initializeDatabase();
	const rows = await db
		.select({ discord_role_id: schema.serverRoles.discord_role_id })
		.from(schema.serverChannels)
		.innerJoin(schema.serverRoles, eq(schema.serverRoles.id, schema.serverChannels.notification_role_id!))
		.where(and(eq(schema.serverChannels.server_id, Number(serverId)), eq(schema.serverChannels.discord_channel_id, discordChannelId)))
		.limit(1);
	return rows[0]?.discord_role_id || null;
}

export async function upsertNotificationRole(serverId: any, discordChannelId: string, discordRoleId: string) {
	await initializeDatabase();
	const serverIds = await getServerIdsInSameGuild(serverId);
	for (const sid of serverIds) {
		const roleRows = await db
			.select({ id: schema.serverRoles.id })
			.from(schema.serverRoles)
			.where(and(eq(schema.serverRoles.server_id, sid), eq(schema.serverRoles.discord_role_id, discordRoleId)))
			.limit(1);
		const roleId = roleRows[0]?.id;
		if (!roleId) continue;
		await db
			.update(schema.serverChannels)
			.set({ notification_role_id: roleId })
			.where(and(eq(schema.serverChannels.server_id, sid), eq(schema.serverChannels.discord_channel_id, discordChannelId)));
	}
}

export async function deleteNotificationRole(serverId: any, discordChannelId: string) {
	await initializeDatabase();
	const serverIds = await getServerIdsInSameGuild(serverId);
	if (serverIds.length === 0) return;
	await db
		.update(schema.serverChannels)
		.set({ notification_role_id: null })
		.where(and(inArray(schema.serverChannels.server_id, serverIds), eq(schema.serverChannels.discord_channel_id, discordChannelId)));
}

export async function getNotificationRoleDbIds(serverId: any) {
	await initializeDatabase();
	const rows = await db
		.selectDistinct({ notification_role_id: schema.serverChannels.notification_role_id })
		.from(schema.serverChannels)
		.where(and(eq(schema.serverChannels.server_id, Number(serverId)), isNotNull(schema.serverChannels.notification_role_id)));
	return new Set(rows.map((r) => r.notification_role_id).filter(Boolean));
}

export async function getContentCreatorRoleDbIds(serverId: any) {
	await initializeDatabase();
	const permissionsSettings = await getServerSettings(serverId, SERVER_SETTINGS.component.permissions).catch(() => null);
	const contentCreatorSettings = await getServerSettings(serverId, SERVER_SETTINGS.component.content_creator).catch(() => null);
	const roleIds = new Set<string>(
		[...((permissionsSettings as any)?.settings?.content_creator_roles || []), (contentCreatorSettings as any)?.settings?.content_creator_role].filter(Boolean)
	);
	if (roleIds.size === 0) return new Set<number>();
	const rows = await db
		.select({ id: schema.serverRoles.id })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), inArray(schema.serverRoles.discord_role_id, Array.from(roleIds))));
	return new Set(rows.map((r) => r.id).filter(Boolean));
}

async function collectGuildSnapshotForUpsert(guild: any) {
	const iconUrl = guild.iconURL ? guild.iconURL({ dynamic: true }) : null;
	const discordCreatedAt = guild.createdAt ? toMySQLDateTime(guild.createdAt) : null;
	const vanityCode = guild.vanityURLCode ? String(guild.vanityURLCode) : null;
	let inviteCode: string | null = null;
	try {
		const invites = await guild?.invites?.fetch?.();
		const first = invites && typeof invites.values === 'function' ? invites.values().next()?.value : null;
		if (first?.code) inviteCode = String(first.code);
	} catch (_) {}

	let boostLevel = 0;
	if (guild.premiumTier) {
		const tierString = String(guild.premiumTier);
		if (tierString.includes('TIER_')) {
			const match = tierString.match(/TIER_(\d+)/);
			boostLevel = match ? parseInt(match[1], 10) : 0;
		} else {
			boostLevel = parseInt(tierString, 10) || 0;
		}
	}
	return {
		iconUrl,
		discordCreatedAt,
		vanityCode,
		inviteCode,
		boostLevel,
		memberCount: guild.memberCount || 0,
		channelCount: guild.channels?.cache?.size || 0,
		boosters: guild.premiumSubscriptionCount || 0,
		name: guild.name
	};
}

export async function upsertOfficialServer(officialBotId: number, guild: any) {
	const existing = await getOfficialServerByDiscordId(officialBotId, guild.id);
	const isNewServer = existing == null;
	const v = await collectGuildSnapshotForUpsert(guild);
	const now = toMySQLDateTime();
	await db.execute(sql`
		INSERT INTO servers (bot_id, discord_server_id, name, total_members, total_channels, total_boosters, boost_level, server_icon, discord_created_at, vanity_url_code, invite_code, created_at, updated_at)
		VALUES (${officialBotId}, ${guild.id}, ${v.name}, ${v.memberCount}, ${v.channelCount}, ${v.boosters}, ${v.boostLevel}, ${v.iconUrl}, ${v.discordCreatedAt}, ${v.vanityCode}, ${v.inviteCode}, ${now}, ${now})
		ON DUPLICATE KEY UPDATE
			name = VALUES(name), total_members = VALUES(total_members), total_channels = VALUES(total_channels),
			total_boosters = VALUES(total_boosters), boost_level = VALUES(boost_level),
			server_icon = VALUES(server_icon),
			discord_created_at = COALESCE(servers.discord_created_at, VALUES(discord_created_at)),
			vanity_url_code = VALUES(vanity_url_code),
			invite_code = COALESCE(VALUES(invite_code), servers.invite_code),
			bot_id = VALUES(bot_id),
			updated_at = VALUES(updated_at)
	`);

	const server = await getOfficialServerByDiscordId(officialBotId, guild.id);
	if (server) {
		if (isNewServer) {
			await seedNewServerFeatureSettingsDisabled(server.id);
		}
		await ensureLeaderboardSettingsHaveSlug(server.id, guild.name || 'server');
	}
	return server;
}

export async function upsertSelfbotServer(selfbotId: number, guild: any) {
	return upsertServerBotServer(selfbotId, guild);
}

export async function upsertServerBotServer(serverBotId: number, guild: any) {
	await initializeDatabase();
	const v = await collectGuildSnapshotForUpsert(guild);
	const now = toMySQLDateTime();
	await db.execute(sql`
		INSERT INTO server_bot_servers (server_bot_id, discord_server_id, name, total_members, total_channels, total_boosters, boost_level, server_icon, discord_created_at, vanity_url_code, invite_code, created_at, updated_at)
		VALUES (${serverBotId}, ${guild.id}, ${v.name}, ${v.memberCount}, ${v.channelCount}, ${v.boosters}, ${v.boostLevel}, ${v.iconUrl}, ${v.discordCreatedAt}, ${v.vanityCode}, ${v.inviteCode}, ${now}, ${now})
		ON DUPLICATE KEY UPDATE
			name = VALUES(name),
			total_members = VALUES(total_members),
			total_channels = VALUES(total_channels),
			total_boosters = VALUES(total_boosters),
			boost_level = VALUES(boost_level),
			server_icon = VALUES(server_icon),
			discord_created_at = COALESCE(server_bot_servers.discord_created_at, VALUES(discord_created_at)),
			vanity_url_code = VALUES(vanity_url_code),
			invite_code = COALESCE(VALUES(invite_code), server_bot_servers.invite_code),
			updated_at = VALUES(updated_at)
	`);
	const rows = await db
		.select()
		.from(schema.serverBotServers)
		.where(and(eq(schema.serverBotServers.server_bot_id, Number(serverBotId)), eq(schema.serverBotServers.discord_server_id, String(guild.id))))
		.limit(1);
	return rows[0] || null;
}

export async function syncServerBotCategories(serverBotServerId: number, categories: any[]) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const sid = Number(serverBotServerId);

	if (categories && categories.length > 0) {
		await Promise.all(
			categories.map((cat) =>
				db
					.insert(schema.serverBotServerCategories)
					.values({
						server_bot_server_id: sid,
						discord_category_id: String(cat.id),
						name: cat.name ?? null,
						position: cat.position ?? null,
						created_at: now as any,
						updated_at: now as any
					})
					.onDuplicateKeyUpdate({ set: { name: cat.name ?? null, position: cat.position ?? null, updated_at: now as any } })
					.catch(() => null)
			)
		);
	}

	const discordIds = new Set((categories ?? []).map((c) => String(c.id)));
	const dbCats = await db
		.select({ id: schema.serverBotServerCategories.id, discord_category_id: schema.serverBotServerCategories.discord_category_id })
		.from(schema.serverBotServerCategories)
		.where(eq(schema.serverBotServerCategories.server_bot_server_id, sid));
	const toDelete = dbCats.filter((c) => !discordIds.has(c.discord_category_id)).map((c) => c.id);
	if (toDelete.length > 0) {
		await db
			.delete(schema.serverBotServerCategories)
			.where(and(eq(schema.serverBotServerCategories.server_bot_server_id, sid), inArray(schema.serverBotServerCategories.id, toDelete)));
	}

	return true;
}

export async function syncServerBotChannels(serverBotServerId: number, channels: any[]) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const sid = Number(serverBotServerId);
	const valid = (channels ?? []).filter((ch) => ch.type !== 4);

	if (valid.length > 0) {
		await Promise.all(
			valid.map((ch) =>
				db
					.insert(schema.serverBotServerChannels)
					.values({
						server_bot_server_id: sid,
						discord_channel_id: String(ch.id),
						name: ch.name ?? null,
						type: ch.type ?? null,
						discord_parent_category_id: ch.parent_id ? String(ch.parent_id) : null,
						position: ch.position ?? null,
						created_at: now as any,
						updated_at: now as any
					})
					.onDuplicateKeyUpdate({
						set: {
							name: ch.name ?? null,
							type: ch.type ?? null,
							discord_parent_category_id: ch.parent_id ? String(ch.parent_id) : null,
							position: ch.position ?? null,
							updated_at: now as any
						}
					})
					.catch(() => null)
			)
		);
	}

	const discordIds = new Set(valid.map((ch) => String(ch.id)));
	const dbChannels = await db
		.select({ id: schema.serverBotServerChannels.id, discord_channel_id: schema.serverBotServerChannels.discord_channel_id })
		.from(schema.serverBotServerChannels)
		.where(eq(schema.serverBotServerChannels.server_bot_server_id, sid));
	const toDelete = dbChannels.filter((ch) => !discordIds.has(ch.discord_channel_id)).map((ch) => ch.id);
	if (toDelete.length > 0) {
		await db
			.delete(schema.serverBotServerChannels)
			.where(and(eq(schema.serverBotServerChannels.server_bot_server_id, sid), inArray(schema.serverBotServerChannels.id, toDelete)));
	}

	return true;
}

export async function getServerBotCategoriesForServer(serverBotServerId: number) {
	await initializeDatabase();
	return db
		.select()
		.from(schema.serverBotServerCategories)
		.where(eq(schema.serverBotServerCategories.server_bot_server_id, serverBotServerId))
		.orderBy(asc(schema.serverBotServerCategories.position), asc(schema.serverBotServerCategories.name));
}

export async function getServerBotChannelsForServer(serverBotServerId: number) {
	await initializeDatabase();
	return db
		.select()
		.from(schema.serverBotServerChannels)
		.where(eq(schema.serverBotServerChannels.server_bot_server_id, serverBotServerId))
		.orderBy(asc(schema.serverBotServerChannels.position), asc(schema.serverBotServerChannels.name));
}

export async function upsertServer(botId: number, guild: any) {
	return upsertOfficialServer(botId, guild);
}

function slugify(input: string) {
	const s = String(input || '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');
	return s || 'server';
}

async function generateUniqueLeaderboardSlug(baseName: string) {
	await initializeDatabase();
	const base = slugify(baseName);
	const rows = await db.execute(sql`
		SELECT JSON_UNQUOTE(JSON_EXTRACT(settings, '$.slug')) AS slug
		FROM server_settings
		WHERE component_name = ${SERVER_SETTINGS.component.public_statistics}
		  AND JSON_EXTRACT(settings, '$.slug') IS NOT NULL
		  AND (
				JSON_UNQUOTE(JSON_EXTRACT(settings, '$.slug')) = ${base}
				OR JSON_UNQUOTE(JSON_EXTRACT(settings, '$.slug')) LIKE ${base + '-%'}
		  )
	`);
	const existing = new Set<string>(((rows[0] as unknown as any[]) || []).map((r: any) => String(r.slug || '')).filter(Boolean));
	if (!existing.has(base)) return base;
	for (let i = 2; i < 10_000; i++) {
		const candidate = `${base}-${i}`;
		if (!existing.has(candidate)) return candidate;
	}
	return `${base}-${Date.now()}`;
}

async function ensureLeaderboardSettingsHaveSlug(serverId: number, serverName: string) {
	const row = await getServerSettings(serverId, SERVER_SETTINGS.component.public_statistics);
	const settings = (row as any)?.settings && typeof (row as any).settings === 'object' ? (row as any).settings : {};
	if (settings?.slug) return true;
	const slug = await generateUniqueLeaderboardSlug(serverName);
	const next: Record<string, unknown> = { ...settings, slug };
	if (!('enabled' in next)) next.enabled = true;
	await upsertServerSettings(serverId, SERVER_SETTINGS.component.public_statistics, next);
	return true;
}

async function seedNewServerFeatureSettingsDisabled(serverId: number) {
	for (const component of SERVER_SETTINGS.withFeatureSwitch) {
		await upsertServerSettings(serverId, component, { enabled: false });
	}
}

export async function getServerByLeaderboardSlug(slug: string) {
	await initializeDatabase();
	const s = (slug || '').trim();
	if (!s) return null;
	const rows = await db.execute(sql`
		SELECT sv.*
		FROM servers sv
		INNER JOIN server_settings ss
			ON ss.server_id = sv.id AND ss.component_name = ${SERVER_SETTINGS.component.public_statistics}
		WHERE JSON_UNQUOTE(JSON_EXTRACT(ss.settings, '$.slug')) = ${s}
		LIMIT 1
	`);
	return ((rows[0] as unknown as any[]) || [])[0] || null;
}

function parseLeaderboardSettingsColumn(raw: unknown): Record<string, unknown> {
	if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
	if (typeof raw === 'string') {
		try {
			const v = JSON.parse(raw);
			return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	return {};
}

function leaderboardModuleEnabledFromSettings(s: Record<string, unknown>): boolean {
	return s.enabled !== false;
}

export async function listPublicLeaderboardSlugs() {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT sv.updated_at, ss.settings AS settings
		FROM servers sv
		INNER JOIN server_settings ss
			ON ss.server_id = sv.id AND ss.component_name = ${SERVER_SETTINGS.component.public_statistics}
		WHERE JSON_EXTRACT(ss.settings, '$.slug') IS NOT NULL
	`);
	const list = (rows[0] as unknown as any[]) || [];
	return list
		.filter((r: any) => {
			const s = parseLeaderboardSettingsColumn(r?.settings);
			const slug = typeof s.slug === 'string' ? s.slug.trim() : '';
			return Boolean(slug) && leaderboardModuleEnabledFromSettings(s);
		})
		.map((r: any) => {
			const s = parseLeaderboardSettingsColumn(r?.settings);
			return { slug: String(s.slug || '').trim(), updated_at: r.updated_at };
		});
}

export async function listEnabledLeaderboardServers() {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT
			sv.id,
			sv.name,
			sv.updated_at,
			sv.server_icon,
			ss.settings AS settings
		FROM servers sv
		INNER JOIN server_settings ss
			ON ss.server_id = sv.id AND ss.component_name = ${SERVER_SETTINGS.component.public_statistics}
	`);
	const list = (rows[0] as unknown as any[]) || [];
	return list
		.filter((r: any) => {
			if (!r) return false;
			const s = parseLeaderboardSettingsColumn(r.settings);
			return s.enabled !== false;
		})
		.map((r: any) => ({ id: Number(r.id), name: r.name ?? null, updated_at: r.updated_at, server_icon: r.server_icon ?? null }));
}

export async function upsertCategory(serverId: any, categoryData: any) {
	const now = toMySQLDateTime();
	await db.execute(sql`
		INSERT INTO server_categories (server_id, discord_category_id, name, position, created_at, updated_at)
		VALUES (${Number(serverId)}, ${categoryData.id}, ${categoryData.name}, ${categoryData.position ?? null}, ${now}, ${now})
		ON DUPLICATE KEY UPDATE name = VALUES(name), position = VALUES(position), updated_at = VALUES(updated_at)
	`);
	const rows = await db
		.select()
		.from(schema.serverCategories)
		.where(and(eq(schema.serverCategories.server_id, Number(serverId)), eq(schema.serverCategories.discord_category_id, categoryData.id)))
		.limit(1);
	return rows[0];
}

export async function syncCategories(serverId: any, categories: any[]) {
	if (!categories || categories.length === 0) return new Map();

	const results = await Promise.all(
		categories.map((cat) => upsertCategory(serverId, { id: cat.id, name: cat.name, position: cat.position }).catch(() => null))
	);

	const categoryMap = new Map();
	results.forEach((cat) => {
		if (cat) categoryMap.set(cat.discord_category_id, cat.id);
	});

	const discordIds = new Set(categories.map((c) => c.id));
	const dbCategories = await db
		.select({ id: schema.serverCategories.id, discord_category_id: schema.serverCategories.discord_category_id })
		.from(schema.serverCategories)
		.where(eq(schema.serverCategories.server_id, Number(serverId)));

	const toDelete = dbCategories.filter((c) => !discordIds.has(c.discord_category_id)).map((c) => c.id);
	if (toDelete.length > 0) {
		await db.delete(schema.serverCategories).where(and(eq(schema.serverCategories.server_id, Number(serverId)), inArray(schema.serverCategories.id, toDelete)));
	}

	return categoryMap;
}

export async function upsertChannel(serverId: any, channelData: any, categoryMap: Map<any, any> | null = null) {
	const categoryId = channelData.parent_id && categoryMap ? categoryMap.get(channelData.parent_id) || null : null;
	const now = toMySQLDateTime();
	await db.execute(sql`
		INSERT INTO server_channels (server_id, discord_channel_id, name, type, category_id, position, created_at, updated_at)
		VALUES (${Number(serverId)}, ${channelData.id}, ${channelData.name}, ${channelData.type}, ${categoryId}, ${channelData.position ?? null}, ${now}, ${now})
		ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), category_id = VALUES(category_id), position = VALUES(position), updated_at = VALUES(updated_at)
	`);
	const rows = await db
		.select()
		.from(schema.serverChannels)
		.where(and(eq(schema.serverChannels.server_id, Number(serverId)), eq(schema.serverChannels.discord_channel_id, channelData.id)))
		.limit(1);
	return rows[0];
}

export async function syncChannels(serverId: any, channels: any[], categoryMap: Map<any, any> | null = null) {
	const validChannels = channels.filter((ch) => ch.type !== 4);

	const catRows = await db
		.select({ id: schema.serverChannels.id })
		.from(schema.serverChannels)
		.where(and(eq(schema.serverChannels.server_id, Number(serverId)), eq(schema.serverChannels.type, '4')));
	if (catRows.length > 0) {
		await db.delete(schema.serverChannels).where(
			inArray(
				schema.serverChannels.id,
				catRows.map((r) => r.id)
			)
		);
	}

	await Promise.all(
		validChannels.map((ch) =>
			upsertChannel(serverId, { id: ch.id, name: ch.name, type: ch.type, parent_id: ch.parent_id || null, position: ch.position }, categoryMap).catch(
				() => null
			)
		)
	);

	const discordIds = new Set(validChannels.map((ch) => ch.id));
	const dbChannels = await db
		.select({ id: schema.serverChannels.id, discord_channel_id: schema.serverChannels.discord_channel_id })
		.from(schema.serverChannels)
		.where(eq(schema.serverChannels.server_id, Number(serverId)));

	const toDelete = dbChannels.filter((ch) => !discordIds.has(ch.discord_channel_id)).map((ch) => ch.id);
	if (toDelete.length > 0) {
		await db.delete(schema.serverChannels).where(and(eq(schema.serverChannels.server_id, Number(serverId)), inArray(schema.serverChannels.id, toDelete)));
	}

	return true;
}

export async function getRoles(serverId: any) {
	return db
		.select()
		.from(schema.serverRoles)
		.where(eq(schema.serverRoles.server_id, Number(serverId)))
		.orderBy(desc(schema.serverRoles.position));
}

export async function upsertRole(serverId: any, roleData: any) {
	const now = toMySQLDateTime();
	await db.execute(sql`
		INSERT INTO server_roles (server_id, discord_role_id, name, position, color, permissions, created_at, updated_at)
		VALUES (${Number(serverId)}, ${roleData.id}, ${roleData.name}, ${roleData.position}, ${roleData.hexColor}, ${roleData.permissions?.bitfield?.toString() || null}, ${now}, ${now})
		ON DUPLICATE KEY UPDATE name = VALUES(name), position = VALUES(position), color = VALUES(color), permissions = VALUES(permissions), updated_at = VALUES(updated_at)
	`);
	const rows = await db
		.select()
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, roleData.id)))
		.limit(1);
	return rows[0];
}

export async function syncRoles(serverId: any, roles: any[]) {
	if (!roles || roles.length === 0) return true;

	await Promise.all(
		roles.map((role) =>
			upsertRole(serverId, { id: role.id, name: role.name, position: role.position, hexColor: role.hexColor, permissions: role.permissions }).catch(() => null)
		)
	);

	const discordIds = new Set(roles.map((r) => r.id));
	const dbRoles = await db
		.select({ id: schema.serverRoles.id, discord_role_id: schema.serverRoles.discord_role_id })
		.from(schema.serverRoles)
		.where(eq(schema.serverRoles.server_id, Number(serverId)));

	const toDelete = dbRoles.filter((r) => !discordIds.has(r.discord_role_id)).map((r) => r.id);
	if (toDelete.length > 0) {
		await db.delete(schema.serverRoles).where(and(eq(schema.serverRoles.server_id, Number(serverId)), inArray(schema.serverRoles.id, toDelete)));
	}

	return true;
}

export async function upsertMember(serverId: any, memberData: any) {
	const user = memberData.user || memberData;
	const avatarUrl = user?.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null;
	const now = toMySQLDateTime();

	await db.execute(sql`
		INSERT INTO server_members (server_id, discord_member_id, username, display_name, server_display_name, avatar,
			profile_created_at, member_since, is_booster, booster_since, created_at, updated_at)
		VALUES (
			${Number(serverId)}, ${user?.id || memberData.id},
			${user?.username || null}, ${user?.globalName || user?.displayName || null},
			${memberData.nickname || null}, ${avatarUrl},
			${user?.createdAt ? toMySQLDateTime(user.createdAt) : null},
			${memberData.joinedAt ? toMySQLDateTime(memberData.joinedAt) : null},
			${memberData.premiumSince != null ? 1 : 0},
			${memberData.premiumSince ? toMySQLDateTime(memberData.premiumSince) : null},
			${now}, ${now}
		)
		ON DUPLICATE KEY UPDATE
			username = VALUES(username), display_name = VALUES(display_name),
			server_display_name = VALUES(server_display_name), avatar = VALUES(avatar),
			profile_created_at = VALUES(profile_created_at), member_since = VALUES(member_since),
			is_booster = VALUES(is_booster), booster_since = VALUES(booster_since),
			updated_at = VALUES(updated_at)
	`);

	const rows = await db
		.select()
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, user?.id || memberData.id)))
		.limit(1);
	return rows[0];
}

export async function getMemberByDiscordId(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	if (!rows[0]) return null;
	const member = { ...rows[0] };
	if (member.profile_created_at) member.profile_created_at = parseMySQLDateTimeUtc(member.profile_created_at as any) as any;
	if (member.member_since) member.member_since = parseMySQLDateTimeUtc(member.member_since as any) as any;
	if (member.booster_since) member.booster_since = parseMySQLDateTimeUtc(member.booster_since as any) as any;
	return member;
}

export async function searchServerMembers(serverId: any, queryText: string | null, limit = 15) {
	await initializeDatabase();
	const q = (queryText || '').trim();
	const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
	const likeValue = `%${q.replace(/[%_]/g, '\\$&')}%`;

	if (!q) {
		return db
			.select({
				id: schema.serverMembers.id,
				discord_member_id: schema.serverMembers.discord_member_id,
				username: schema.serverMembers.username,
				display_name: schema.serverMembers.display_name,
				server_display_name: schema.serverMembers.server_display_name,
				avatar: schema.serverMembers.avatar
			})
			.from(schema.serverMembers)
			.where(eq(schema.serverMembers.server_id, Number(serverId)))
			.orderBy(schema.serverMembers.updated_at)
			.limit(safeLimit);
	}

	return db
		.select({
			id: schema.serverMembers.id,
			discord_member_id: schema.serverMembers.discord_member_id,
			username: schema.serverMembers.username,
			display_name: schema.serverMembers.display_name,
			server_display_name: schema.serverMembers.server_display_name,
			avatar: schema.serverMembers.avatar
		})
		.from(schema.serverMembers)
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				or(
					like(schema.serverMembers.discord_member_id, likeValue),
					like(schema.serverMembers.username, likeValue),
					like(schema.serverMembers.display_name, likeValue),
					like(schema.serverMembers.server_display_name, likeValue)
				)
			)
		)
		.orderBy(schema.serverMembers.updated_at)
		.limit(safeLimit);
}

async function refreshMemberIsContentCreator(memberId: number, serverId: number, discordRoleIds: string[]) {
	await initializeDatabase();
	const ccRoleDbIds = await getContentCreatorRoleDbIds(serverId);
	let has = false;
	if (ccRoleDbIds.size > 0 && discordRoleIds.length > 0) {
		const rows = await db
			.select({ id: schema.serverRoles.id })
			.from(schema.serverRoles)
			.where(and(eq(schema.serverRoles.server_id, Number(serverId)), inArray(schema.serverRoles.discord_role_id, discordRoleIds)));
		has = rows.some((r) => ccRoleDbIds.has(r.id));
	}
	if (has) {
		const now = toMySQLDateTime();
		await db.execute(sql`
			INSERT INTO server_member_content_creators (member_id, created_at) VALUES (${memberId}, ${now})
			ON DUPLICATE KEY UPDATE member_id = member_id
		`);
	} else {
		await db.delete(schema.serverMemberContentCreators).where(eq(schema.serverMemberContentCreators.member_id, memberId));
	}
}

async function syncMemberCustomSupporterRoles(memberId: number, discordRoleIds: string[], serverId: number) {
	await initializeDatabase();
	await db.delete(schema.serverMemberCustomSupporterRoles).where(eq(schema.serverMemberCustomSupporterRoles.member_id, memberId));

	const customSettings = await getServerSettings(serverId, SERVER_SETTINGS.component.custom_supporter_role).catch(() => null);
	const roleStartDiscord = (customSettings as any)?.settings?.role_start as string | null | undefined;
	const roleEndDiscord = (customSettings as any)?.settings?.role_end as string | null | undefined;
	if (!roleStartDiscord || !roleEndDiscord || discordRoleIds.length === 0) return;

	const startRows = await db
		.select({ position: schema.serverRoles.position })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, roleStartDiscord)))
		.limit(1);
	const endRows = await db
		.select({ position: schema.serverRoles.position })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, roleEndDiscord)))
		.limit(1);
	if (!startRows[0]?.position || !endRows[0]?.position) return;

	const startPosition = startRows[0].position!;
	const endPosition = endRows[0].position!;

	const roleRows = await db
		.select({
			id: schema.serverRoles.id,
			discord_role_id: schema.serverRoles.discord_role_id,
			position: schema.serverRoles.position
		})
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), inArray(schema.serverRoles.discord_role_id, discordRoleIds)));

	const now = toMySQLDateTime();
	const toInsert = roleRows
		.filter((r) => r.discord_role_id !== roleStartDiscord && r.position != null && r.position < startPosition && r.position > endPosition)
		.map((r) => ({ member_id: memberId, role_id: r.id, created_at: now as any }));

	if (toInsert.length > 0) {
		await db.insert(schema.serverMemberCustomSupporterRoles).values(toInsert);
	}
}

export async function syncMemberRoles(memberId: any, discordRoleIds: string[], serverId: any) {
	const sid = Number(serverId);
	const mid = Number(memberId);
	const roleList = Array.isArray(discordRoleIds) ? discordRoleIds.filter(Boolean) : [];

	if (roleList.length === 0) {
		await db.delete(schema.serverMemberRoles).where(eq(schema.serverMemberRoles.member_id, mid));
		await db.delete(schema.serverMemberNotifications).where(eq(schema.serverMemberNotifications.member_id, mid));
		await db.delete(schema.serverMemberCustomSupporterRoles).where(eq(schema.serverMemberCustomSupporterRoles.member_id, mid));
		await refreshMemberIsContentCreator(mid, sid, []);
		return true;
	}

	const roleMapRows = await db
		.select({ id: schema.serverRoles.id, discord_role_id: schema.serverRoles.discord_role_id })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, sid), inArray(schema.serverRoles.discord_role_id, roleList)));

	const roleIdsOnMember = roleMapRows.map((r) => r.id);

	await db.delete(schema.serverMemberRoles).where(eq(schema.serverMemberRoles.member_id, mid));
	if (roleIdsOnMember.length > 0) {
		const smrNow = toMySQLDateTime();
		await db.insert(schema.serverMemberRoles).values(
			roleIdsOnMember.map((role_id) => ({
				member_id: mid,
				role_id,
				created_at: smrNow as any
			}))
		);
	}

	const notificationRoleDbIds = await getNotificationRoleDbIds(serverId);
	const notificationRoleIdsForMember = roleIdsOnMember.filter((id) => notificationRoleDbIds.has(id));

	await db.delete(schema.serverMemberNotifications).where(eq(schema.serverMemberNotifications.member_id, mid));

	if (notificationRoleIdsForMember.length > 0) {
		const now = toMySQLDateTime();
		await db.insert(schema.serverMemberNotifications).values(
			notificationRoleIdsForMember.map((role_id) => ({
				member_id: mid,
				role_id,
				created_at: now as any
			}))
		);
	}

	await syncMemberCustomSupporterRoles(mid, roleList, sid);
	await refreshMemberIsContentCreator(mid, sid, roleList);
	return true;
}

export async function syncMembers(serverId: any, members: any[]) {
	if (!members || members.length === 0) {
		const dbMembers = await db
			.select({ id: schema.serverMembers.id })
			.from(schema.serverMembers)
			.where(eq(schema.serverMembers.server_id, Number(serverId)));
		if (dbMembers.length > 0) {
			await db.delete(schema.serverMembers).where(
				inArray(
					schema.serverMembers.id,
					dbMembers.map((m) => m.id)
				)
			);
		}
		return true;
	}

	await Promise.all(
		members.map(async (member) => {
			const dbMember = await upsertMember(serverId, member).catch(() => null);
			if (dbMember) {
				const memberRoles = member.roles ? Array.from(member.roles.cache.keys()).filter((id: any) => id !== member.guild?.id) : [];
				await syncMemberRoles(dbMember.id, memberRoles as string[], serverId);
			}
		})
	);

	const discordIds = new Set(members.map((m) => (m.user || m)?.id || m.id));
	const dbMembers = await db
		.select({ id: schema.serverMembers.id, discord_member_id: schema.serverMembers.discord_member_id })
		.from(schema.serverMembers)
		.where(eq(schema.serverMembers.server_id, Number(serverId)));

	const toDelete = dbMembers.filter((m) => !discordIds.has(m.discord_member_id)).map((m) => m.id);
	if (toDelete.length > 0) {
		await db.delete(schema.serverMembers).where(and(eq(schema.serverMembers.server_id, Number(serverId)), inArray(schema.serverMembers.id, toDelete)));
	}

	return true;
}

export async function getMemberLevel(memberId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMemberLevels)
		.where(eq(schema.serverMemberLevels.member_id, Number(memberId)))
		.limit(1);
	if (!rows[0]) return null;
	const data = { ...rows[0] };
	if (data.voice_rewarded_at) data.voice_rewarded_at = parseMySQLDateTimeUtc(data.voice_rewarded_at as any) as any;
	if (data.video_rewarded_at) data.video_rewarded_at = parseMySQLDateTimeUtc(data.video_rewarded_at as any) as any;
	if (data.stream_rewarded_at) data.stream_rewarded_at = parseMySQLDateTimeUtc(data.stream_rewarded_at as any) as any;
	if (data.chat_rewarded_at) data.chat_rewarded_at = parseMySQLDateTimeUtc(data.chat_rewarded_at as any) as any;
	return data;
}

export async function ensureMemberLevel(memberId: any) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberLevels)
		.values({ member_id: Number(memberId), created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { member_id: Number(memberId) } });
	return getMemberLevel(memberId);
}

export async function updateMemberLevelStats(memberId: any, updates: any = {}) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');

	const clauses: any[] = [];

	if (typeof updates.chatIncrement === 'number' && updates.chatIncrement !== 0) clauses.push(sql`chat_total = chat_total + ${updates.chatIncrement}`);
	if (typeof updates.voiceMinutesActiveIncrement === 'number' && updates.voiceMinutesActiveIncrement !== 0)
		clauses.push(sql`voice_minutes_active = voice_minutes_active + ${updates.voiceMinutesActiveIncrement}`);
	if (typeof updates.voiceMinutesAfkIncrement === 'number' && updates.voiceMinutesAfkIncrement !== 0)
		clauses.push(sql`voice_minutes_afk = voice_minutes_afk + ${updates.voiceMinutesAfkIncrement}`);
	if (typeof updates.voiceMinutesVideoIncrement === 'number' && updates.voiceMinutesVideoIncrement !== 0)
		clauses.push(sql`voice_minutes_video = voice_minutes_video + ${updates.voiceMinutesVideoIncrement}`);
	if (typeof updates.voiceMinutesStreamingIncrement === 'number' && updates.voiceMinutesStreamingIncrement !== 0)
		clauses.push(sql`voice_minutes_streaming = voice_minutes_streaming + ${updates.voiceMinutesStreamingIncrement}`);
	if (updates.voiceMinutesActiveIncrement !== undefined || updates.voiceMinutesAfkIncrement !== undefined)
		clauses.push(sql`voice_minutes_total = voice_minutes_active + voice_minutes_afk`);
	if (typeof updates.experienceIncrement === 'number' && updates.experienceIncrement !== 0)
		clauses.push(sql`experience = experience + ${updates.experienceIncrement}`);
	if (updates.level !== undefined && updates.level !== null) clauses.push(sql`level = ${updates.level}`);
	if (updates.rank !== undefined) clauses.push(sql`rank = ${updates.rank}`);
	if (typeof updates.isInVoice === 'boolean') clauses.push(sql`is_in_voice = ${updates.isInVoice ? 1 : 0}`);
	if (typeof updates.isInVideo === 'boolean') clauses.push(sql`is_in_video = ${updates.isInVideo ? 1 : 0}`);
	if (typeof updates.isInStream === 'boolean') clauses.push(sql`is_in_stream = ${updates.isInStream ? 1 : 0}`);
	if (updates.chatRewardedAt) clauses.push(sql`chat_rewarded_at = ${toMySQLDateTime(updates.chatRewardedAt)}`);
	if (updates.voiceRewardedAt !== undefined) {
		if (updates.voiceRewardedAt === null) clauses.push(sql`voice_rewarded_at = NULL`);
		else clauses.push(sql`voice_rewarded_at = ${toMySQLDateTime(updates.voiceRewardedAt)}`);
	}
	if (updates.videoRewardedAt !== undefined) {
		if (updates.videoRewardedAt === null) clauses.push(sql`video_rewarded_at = NULL`);
		else clauses.push(sql`video_rewarded_at = ${toMySQLDateTime(updates.videoRewardedAt)}`);
	}
	if (updates.streamRewardedAt !== undefined) {
		if (updates.streamRewardedAt === null) clauses.push(sql`stream_rewarded_at = NULL`);
		else clauses.push(sql`stream_rewarded_at = ${toMySQLDateTime(updates.streamRewardedAt)}`);
	}

	if (clauses.length === 0) return getMemberLevel(memberId);

	clauses.push(sql`updated_at = ${toMySQLDateTime()}`);

	await db.execute(sql`UPDATE server_member_levels SET ${sql.join(clauses, sql`, `)} WHERE member_id = ${Number(memberId)}`);
	return getMemberLevel(memberId);
}

export async function setMemberLanguage(serverId: any, discordMemberId: string, language = 'en') {
	await initializeDatabase();
	await db
		.update(schema.serverMembers)
		.set({ language })
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)));
	return true;
}

export async function getMemberLanguage(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	if (!serverId || !discordMemberId) return 'en';
	const rows = await db
		.select({ language: schema.serverMembers.language })
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	return rows[0]?.language || 'en';
}

export async function setMemberLevelDMPreference(memberId: any, enabled = true) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	await db
		.update(schema.serverMemberLevels)
		.set({ dm_notifications_enabled: enabled, updated_at: toMySQLDateTime() as any })
		.where(eq(schema.serverMemberLevels.member_id, Number(memberId)));
	return getMemberLevel(memberId);
}

export async function recalculateServerMemberRanks(serverId: any) {
	await initializeDatabase();
	if (!serverId) throw new Error('serverId is required');
	await db.execute(sql`SET @rank := 0`);
	await db.execute(sql`
		UPDATE server_member_levels sml
		INNER JOIN (
			SELECT ranked.id, (@rank := @rank + 1) AS computed_rank
			FROM (
				SELECT sml_inner.id
				FROM server_member_levels sml_inner
				INNER JOIN server_members sm_inner ON sml_inner.member_id = sm_inner.id
				WHERE sm_inner.server_id = ${Number(serverId)}
				ORDER BY sml_inner.experience DESC, sml_inner.level DESC, sml_inner.created_at ASC
			) AS ranked
		) AS ranks ON ranks.id = sml.id
		SET sml.rank = ranks.computed_rank
	`);
	return true;
}

export async function getMemberLevelByDiscordId(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT sml.*, sm.username, sm.display_name, sm.server_display_name, sm.discord_member_id
		FROM server_member_levels sml
		INNER JOIN server_members sm ON sml.member_id = sm.id
		WHERE sm.server_id = ${Number(serverId)} AND sm.discord_member_id = ${discordMemberId}
		LIMIT 1
	`);
	return (rows[0] as unknown as any[])[0] || null;
}

export async function getMembersWithInVoiceFlag(serverId: any) {
	await initializeDatabase();
	if (!serverId) throw new Error('serverId is required');
	return db
		.select({ member_id: schema.serverMemberLevels.member_id, discord_member_id: schema.serverMembers.discord_member_id })
		.from(schema.serverMemberLevels)
		.innerJoin(schema.serverMembers, eq(schema.serverMembers.id, schema.serverMemberLevels.member_id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMemberLevels.is_in_voice, true)));
}

export async function getServerLeaderboard(serverId: any, limit = 3, sortType = 'xp', range: any = 'all') {
	await initializeDatabase();
	if (!serverId) throw new Error('serverId is required');
	const safeLimit = Math.max(1, Math.min(50, limit));

	const r = String(range || 'all');
	const rangeDays = r === '1d' ? 1 : r === '7d' ? 7 : r === '30d' ? 30 : 0;
	const since = rangeDays > 0 ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000) : null;

	const orderMap: Record<string, any> = {
		voice_total: [desc(schema.serverMemberLevels.voice_minutes_total), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
		voice_active: [desc(schema.serverMemberLevels.voice_minutes_active), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
		voice_afk: [desc(schema.serverMemberLevels.voice_minutes_afk), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
		chat: [desc(schema.serverMemberLevels.chat_total), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
		xp: [desc(schema.serverMemberLevels.experience), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)]
	};
	const orderBy = orderMap[sortType] || orderMap.xp;

	const whereRange = !since
		? undefined
		: sortType === 'chat'
			? and(isNotNull(schema.serverMemberLevels.chat_rewarded_at), sql`${schema.serverMemberLevels.chat_rewarded_at} >= ${toMySQLDateTime(since)}`)
			: sortType.startsWith('voice_')
				? and(isNotNull(schema.serverMemberLevels.voice_rewarded_at), sql`${schema.serverMemberLevels.voice_rewarded_at} >= ${toMySQLDateTime(since)}`)
				: sql`${schema.serverMemberLevels.updated_at} >= ${toMySQLDateTime(since)}`;

	return db
		.select({
			discord_member_id: schema.serverMembers.discord_member_id,
			username: schema.serverMembers.username,
			display_name: schema.serverMembers.display_name,
			server_display_name: schema.serverMembers.server_display_name,
			avatar: schema.serverMembers.avatar,
			experience: schema.serverMemberLevels.experience,
			level: schema.serverMemberLevels.level,
			chat_total: schema.serverMemberLevels.chat_total,
			voice_minutes_total: schema.serverMemberLevels.voice_minutes_total,
			voice_minutes_active: schema.serverMemberLevels.voice_minutes_active,
			voice_minutes_afk: schema.serverMemberLevels.voice_minutes_afk,
			rank: schema.serverMemberLevels.rank
		})
		.from(schema.serverMemberLevels)
		.innerJoin(schema.serverMembers, eq(schema.serverMembers.id, schema.serverMemberLevels.member_id))
		.where(whereRange ? and(eq(schema.serverMembers.server_id, Number(serverId)), whereRange as any) : eq(schema.serverMembers.server_id, Number(serverId)))
		.orderBy(...orderBy)
		.limit(safeLimit);
}

export async function getServerMembersList(serverId: any) {
	await initializeDatabase();
	if (serverId === undefined || serverId === null || serverId === '') return [];

	const rows = await db.execute(sql`
		SELECT
			sm.id, sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name,
			sm.avatar, sm.profile_created_at, sm.member_since, sm.is_booster, sm.booster_since,
			sml.level, sml.experience, sml.chat_total, sml.voice_minutes_total, sml.voice_minutes_active, sml.voice_minutes_afk,
			sml.voice_minutes_video, sml.voice_minutes_streaming, sml.rank,
			sma.message as afk_message, sma.created_at as afk_since,
			GROUP_CONCAT(
				DISTINCT CONCAT(sr.discord_role_id, ':', sr.name, ':', sr.color, ':', sr.position)
				ORDER BY sr.position DESC SEPARATOR ','
			) as roles
		FROM server_members sm
		LEFT JOIN server_member_levels sml ON sm.id = sml.member_id
		LEFT JOIN server_member_afks sma ON sm.id = sma.member_id
		LEFT JOIN server_member_roles smr ON sm.id = smr.member_id
		LEFT JOIN server_roles sr ON smr.role_id = sr.id
		WHERE sm.server_id = ${Number(serverId)}
		GROUP BY sm.id, sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name,
		         sm.avatar, sm.profile_created_at, sm.member_since, sm.is_booster, sm.booster_since,
		         sml.level, sml.experience, sml.chat_total, sml.voice_minutes_total, sml.voice_minutes_active,
		         sml.voice_minutes_afk, sml.voice_minutes_video, sml.voice_minutes_streaming, sml.rank, sma.message, sma.created_at
		ORDER BY sml.experience DESC, sml.level DESC, sm.created_at ASC
	`);

	return (rows[0] as unknown as any[]).map((member: any) => ({
		...member,
		roles: member.roles
			? member.roles
					.split(',')
					.map((role: string) => {
						const [roleId, roleName, roleColor, position] = role.split(':');
						return { id: roleId, name: roleName, color: roleColor || null, position: position ? parseInt(position, 10) : 0 };
					})
					.sort((a: any, b: any) => (b.position || 0) - (a.position || 0))
			: [],
		is_afk: !!member.afk_message
	}));
}

export async function getServerOverview(serverId: any, opts?: { forPublicPage?: boolean }) {
	await initializeDatabase();
	if (serverId === undefined || serverId === null || serverId === '') return null;

	const id = Number(serverId);
	if (!Number.isFinite(id) || id <= 0) return null;

	const serverRows = await db.select().from(schema.servers).where(eq(schema.servers.id, id)).limit(1);
	const serverRow = serverRows[0];
	if (!serverRow) return null;

	const forPublic = opts?.forPublicPage === true;

	const statsPromises = [
		db.execute(
			sql`SELECT COUNT(*) AS total, SUM(CASE WHEN is_booster = 1 THEN 1 ELSE 0 END) AS unique_boosters FROM server_members WHERE server_id = ${Number(serverId)}`
		),
		db.execute(
			sql`SELECT COUNT(*) AS leveled FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ${Number(serverId)}`
		),
		db.execute(
			sql`SELECT COUNT(*) AS afk FROM server_member_afks sma INNER JOIN server_members sm ON sm.id = sma.member_id WHERE sm.server_id = ${Number(serverId)}`
		),
		db.execute(
			sql`SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(COALESCE(type,'')) IN ('guild_text','text') THEN 1 ELSE 0 END) AS text_count, SUM(CASE WHEN LOWER(COALESCE(type,'')) IN ('guild_news','news','guild_announcement','announcement') THEN 1 ELSE 0 END) AS announcement_count, SUM(CASE WHEN LOWER(COALESCE(type,'')) IN ('guild_voice','voice') THEN 1 ELSE 0 END) AS voice_count, SUM(CASE WHEN LOWER(COALESCE(type,'')) IN ('guild_stage_voice','stage','stage_voice') THEN 1 ELSE 0 END) AS stage_count FROM server_channels WHERE server_id = ${Number(serverId)}`
		),
		db.execute(sql`SELECT COUNT(*) AS count FROM server_categories WHERE server_id = ${Number(serverId)}`),
		db.execute(sql`SELECT COUNT(*) AS count FROM server_roles WHERE server_id = ${Number(serverId)}`),
		db.execute(
			sql`SELECT COALESCE(SUM(experience),0) AS total_experience, COALESCE(AVG(level),0) AS avg_level, COALESCE(MAX(level),0) AS max_level, COALESCE(SUM(chat_total),0) AS total_chat, COALESCE(SUM(voice_minutes_total),0) AS total_voice_minutes, COALESCE(SUM(voice_minutes_active),0) AS total_voice_active, COALESCE(SUM(voice_minutes_afk),0) AS total_voice_afk FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ${Number(serverId)}`
		),
		db.execute(
			sql`SELECT COUNT(DISTINCT smcsr.member_id) AS members_with_custom_roles FROM server_member_custom_supporter_roles smcsr INNER JOIN server_members sm ON sm.id = smcsr.member_id WHERE sm.server_id = ${Number(serverId)}`
		)
	];

	let memberCounts: any;
	let leveledCount: any;
	let afkCount: any;
	let channelCounts: any;
	let categoriesCount: any;
	let rolesCount: any;
	let levelingStats: any;
	let customRolesCount: any;
	let memberSyncTimes: any;
	let channelSyncTimes: any;
	let categorySyncTimes: any;
	let roleSyncTimes: any;
	let levelSyncTimes: any;
	let settingsRows: any;

	if (forPublic) {
		[memberCounts, leveledCount, afkCount, channelCounts, categoriesCount, rolesCount, levelingStats, customRolesCount] = await Promise.all(statsPromises);
	} else {
		[
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
			...statsPromises,
			db.execute(sql`SELECT MAX(updated_at) AS last_updated FROM server_members WHERE server_id = ${Number(serverId)}`),
			db.execute(sql`SELECT MAX(updated_at) AS last_updated FROM server_channels WHERE server_id = ${Number(serverId)}`),
			db.execute(sql`SELECT MAX(updated_at) AS last_updated FROM server_categories WHERE server_id = ${Number(serverId)}`),
			db.execute(sql`SELECT MAX(updated_at) AS last_updated FROM server_roles WHERE server_id = ${Number(serverId)}`),
			db.execute(
				sql`SELECT MAX(sml.updated_at) AS last_updated FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ${Number(serverId)}`
			),
			db
				.select({ component_name: schema.serverSettings.component_name, updated_at: schema.serverSettings.updated_at })
				.from(schema.serverSettings)
				.where(eq(schema.serverSettings.server_id, Number(serverId)))
				.orderBy(asc(schema.serverSettings.component_name))
		]);
	}

	const r = (raw: any, idx = 0) => (raw[0] as unknown as any[])[idx] || {};

	const stats = {
		members_total: r(memberCounts).total || 0,
		members_boosters: serverRow.total_boosters || 0,
		members_unique_boosters: r(memberCounts).unique_boosters || 0,
		members_with_levels: r(leveledCount).leveled || 0,
		member_afk: r(afkCount).afk || 0,
		members_with_custom_roles: r(customRolesCount).members_with_custom_roles || 0,
		channels_total: r(channelCounts).total || 0,
		channels_text: r(channelCounts).text_count || 0,
		channels_announcement: r(channelCounts).announcement_count || 0,
		channels_voice: r(channelCounts).voice_count || 0,
		channels_stage: r(channelCounts).stage_count || 0,
		categories_total: r(categoriesCount).count || 0,
		roles_total: r(rolesCount).count || 0,
		leveling_total_experience: Math.round(r(levelingStats).total_experience || 0),
		leveling_avg_level: Math.round((r(levelingStats).avg_level || 0) * 100) / 100,
		leveling_max_level: r(levelingStats).max_level || 0,
		leveling_total_chat: r(levelingStats).total_chat || 0,
		leveling_total_voice_minutes: r(levelingStats).total_voice_minutes || 0,
		leveling_total_voice_active: r(levelingStats).total_voice_active || 0,
		leveling_total_voice_afk: r(levelingStats).total_voice_afk || 0
	};

	if (forPublic) {
		return {
			...serverRow,
			stats
		};
	}

	const settingsLastUpdated = settingsRows.reduce((latest: any, row: any) => {
		if (!row.updated_at) return latest;
		if (!latest) return row.updated_at;
		const rowDate = parseMySQLDateTimeUtc(row.updated_at);
		const latestDate = parseMySQLDateTimeUtc(latest);
		return rowDate && latestDate && rowDate > latestDate ? row.updated_at : latest;
	}, null);

	const panelBotId = await resolveOfficialBotIdForServer(serverRow);

	const enabledFeatures: { component_name: string; label: string; updated_at: unknown }[] = [];
	for (const component of SERVER_SETTINGS.withFeatureSwitch) {
		let sid = id;
		if (component === SERVER_SETTINGS.component.notifications) {
			const alt = await getOfficialBotServerIdForServer(id);
			if (alt != null) sid = Number(alt);
		} else if (component === SERVER_SETTINGS.component.forwarder && serverRow.discord_server_id && panelBotId != null) {
			const officialServer = await getServerByDiscordId(Number(panelBotId), serverRow.discord_server_id);
			if (officialServer?.id != null) sid = Number(officialServer.id);
		}
		const row = await getServerSettings(sid, component).catch(() => null);
		const st = row?.settings;
		const featureOn = !st || typeof st !== 'object' || (st as Record<string, unknown>).enabled !== false;
		if (featureOn) {
			enabledFeatures.push({
				component_name: component,
				label: SERVER_SETTINGS.featureLabel(component),
				updated_at: row?.updated_at ?? null
			});
		}
	}
	enabledFeatures.sort((a, b) => a.label.localeCompare(b.label));

	return {
		...serverRow,
		bot_id: panelBotId,
		stats,
		sync: {
			members_last_updated: r(memberSyncTimes).last_updated || null,
			channels_last_updated: r(channelSyncTimes).last_updated || null,
			categories_last_updated: r(categorySyncTimes).last_updated || null,
			roles_last_updated: r(roleSyncTimes).last_updated || null,
			levels_last_updated: r(levelSyncTimes).last_updated || null,
			settings_last_updated: settingsLastUpdated
		},
		enabledFeatures
	};
}

export async function updateCustomRoleFlags(serverId: any, roleStartId: string, roleEndId: string) {
	await initializeDatabase();
	if (!roleStartId || !roleEndId) {
		await db.execute(sql`
			DELETE smcsr FROM server_member_custom_supporter_roles smcsr
			INNER JOIN server_roles sr ON smcsr.role_id = sr.id
			WHERE sr.server_id = ${Number(serverId)}
		`);
		return true;
	}

	const startRows = await db
		.select({ position: schema.serverRoles.position })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, roleStartId)))
		.limit(1);
	const endRows = await db
		.select({ position: schema.serverRoles.position })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, roleEndId)))
		.limit(1);

	if (!startRows[0] || !endRows[0]) {
		return true;
	}

	const startPosition = startRows[0].position!;
	const endPosition = endRows[0].position!;

	await db.execute(sql`
		DELETE smcsr FROM server_member_custom_supporter_roles smcsr
		INNER JOIN server_roles sr ON smcsr.role_id = sr.id
		WHERE sr.server_id = ${Number(serverId)}
			AND NOT (
				sr.position < ${startPosition}
				AND sr.position > ${endPosition}
				AND sr.discord_role_id != ${roleStartId}
			)
	`);

	return true;
}

export async function memberHasCustomSupporterRole(discordMemberId: string, serverId: any) {
	if (!discordMemberId || !serverId) return { has: false, role: null };

	const memberRows = await db
		.select({ id: schema.serverMembers.id })
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	if (!memberRows[0]) return { has: false, role: null };

	const roleRows = await db
		.select({
			id: schema.serverRoles.id,
			discord_role_id: schema.serverRoles.discord_role_id,
			name: schema.serverRoles.name,
			position: schema.serverRoles.position,
			color: schema.serverRoles.color
		})
		.from(schema.serverRoles)
		.innerJoin(schema.serverMemberCustomSupporterRoles, eq(schema.serverRoles.id, schema.serverMemberCustomSupporterRoles.role_id))
		.where(and(eq(schema.serverMemberCustomSupporterRoles.member_id, memberRows[0].id), eq(schema.serverRoles.server_id, Number(serverId))))
		.orderBy(desc(schema.serverRoles.position))
		.limit(1);

	if (roleRows[0]) return { has: true, role: roleRows[0] };
	return { has: false, role: null };
}

async function getPanel(accountId: number) {
	const rows = await db.select().from(schema.panel).where(eq(schema.panel.account_id, accountId)).limit(1);
	return rows[0] || null;
}

async function createPanel(accountId: number) {
	const now = toMySQLDateTime();
	const result = await db
		.insert(schema.panel)
		.values({ account_id: accountId, created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { updated_at: now as any } });

	const insertedId = (result?.[0] as any)?.insertId;
	if (insertedId) {
		const rows = await db.select().from(schema.panel).where(eq(schema.panel.id, insertedId)).limit(1);
		return rows[0] || null;
	}
	return getPanel(accountId);
}

async function hasAnyPanel() {
	const rows = await db.select({ id: schema.panel.id }).from(schema.panel).limit(1);
	return rows.length > 0;
}

async function getAccountById(accountId: any) {
	const rows = await db
		.select()
		.from(schema.accounts)
		.where(eq(schema.accounts.id, Number(accountId)))
		.limit(1);
	return rows[0] || null;
}

async function getAccountByEmail(email: string) {
	const rows = await db.select().from(schema.accounts).where(eq(schema.accounts.email, email)).limit(1);
	return rows[0] || null;
}

async function getAccountByNormalizedEmail(email: string) {
	const atIndex = email.lastIndexOf('@');
	if (atIndex === -1) return null;
	const domain = email.substring(atIndex + 1);
	if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
		return getAccountByEmail(email);
	}
	const normalizedLocal = email.substring(0, atIndex).replace(/\./g, '');
	const rows = await db
		.select()
		.from(schema.accounts)
		.where(
			sql`SUBSTRING_INDEX(${schema.accounts.email}, '@', -1) IN ('gmail.com', 'googlemail.com')
			    AND REPLACE(SUBSTRING_INDEX(${schema.accounts.email}, '@', 1), '.', '') = ${normalizedLocal}`
		)
		.limit(1);
	return rows[0] || null;
}

async function getAccountByUsername(username: string) {
	const rows = await db.select().from(schema.accounts).where(eq(schema.accounts.username, username)).limit(1);
	return rows[0] || null;
}

async function createAccount(accountData: any) {
	const now = toMySQLDateTime();
	const result = await db.insert(schema.accounts).values({
		username: accountData.username,
		email: accountData.email,
		password_hash: accountData.password_hash,
		account_type: accountData.account_type || 'superadmin',
		email_verified: accountData.email_verified || false,
		otp_code: accountData.otp_code || null,
		otp_expires_at: accountData.otp_expires_at ? (toMySQLDateTime(accountData.otp_expires_at) as any) : null,
		ip_address: accountData.ip_address || null,
		created_at: now as any,
		updated_at: now as any
	});
	return getAccountById((result[0] as any).insertId);
}

async function updateAccount(accountId: any, updateData: any) {
	const data: any = { ...updateData, updated_at: toMySQLDateTime() };
	if (data.otp_expires_at) data.otp_expires_at = toMySQLDateTime(data.otp_expires_at);
	await db
		.update(schema.accounts)
		.set(data)
		.where(eq(schema.accounts.id, Number(accountId)));
	return getAccountById(accountId);
}

async function deleteAccount(accountId: any) {
	await db.delete(schema.accounts).where(eq(schema.accounts.id, Number(accountId)));
}

async function getAllAccounts() {
	return db
		.select({
			id: schema.accounts.id,
			username: schema.accounts.username,
			email: schema.accounts.email,
			account_type: schema.accounts.account_type,
			email_verified: schema.accounts.email_verified,
			created_at: schema.accounts.created_at,
			updated_at: schema.accounts.updated_at
		})
		.from(schema.accounts)
		.orderBy(asc(schema.accounts.created_at));
}

async function createInviteLink(linkData: any) {
	const now = toMySQLDateTime();
	const result = await db.insert(schema.accountInvites).values({
		token: linkData.token,
		account_type: linkData.account_type,
		server_id: linkData.server_id || null,
		created_by: linkData.created_by,
		expires_at: linkData.expires_at ? (toMySQLDateTime(linkData.expires_at) as any) : null,
		created_at: now as any
	});
	const rows = await db
		.select()
		.from(schema.accountInvites)
		.where(eq(schema.accountInvites.id, (result[0] as any).insertId))
		.limit(1);
	return rows[0];
}

async function getInviteLinkByToken(token: string) {
	const rows = await db.select().from(schema.accountInvites).where(eq(schema.accountInvites.token, token)).limit(1);
	return rows[0] || null;
}

async function updateInviteLink(linkId: any, updateData: any) {
	const data: any = { ...updateData };
	if (data.used_at) data.used_at = toMySQLDateTime(data.used_at);
	await db
		.update(schema.accountInvites)
		.set(data)
		.where(eq(schema.accountInvites.id, Number(linkId)));
	const rows = await db
		.select()
		.from(schema.accountInvites)
		.where(eq(schema.accountInvites.id, Number(linkId)))
		.limit(1);
	return rows[0];
}

async function getAllInviteLinks() {
	return db
		.select({
			invite: schema.accountInvites,
			server_name: schema.servers.name,
			creator_username: schema.accounts.username,
			creator_email: schema.accounts.email
		})
		.from(schema.accountInvites)
		.leftJoin(schema.servers, eq(schema.accountInvites.server_id, schema.servers.id))
		.leftJoin(schema.accounts, eq(schema.accountInvites.created_by, schema.accounts.id))
		.orderBy(desc(schema.accountInvites.created_at))
		.then((rows) => rows.map((r) => ({ ...r.invite, server_name: r.server_name, creator_username: r.creator_username, creator_email: r.creator_email })));
}

async function getServerInviteLinks(serverId: number) {
	return db
		.select({
			invite: schema.accountInvites,
			creator_username: schema.accounts.username
		})
		.from(schema.accountInvites)
		.leftJoin(schema.accounts, eq(schema.accountInvites.created_by, schema.accounts.id))
		.where(eq(schema.accountInvites.server_id, serverId))
		.orderBy(desc(schema.accountInvites.created_at))
		.then((rows) => rows.map((r) => ({ ...r.invite, creator_username: r.creator_username })));
}

async function getAccountServerAccess(accountId: number) {
	return db
		.select({ server_id: schema.accountServerAccess.server_id, role: schema.accountServerAccess.role })
		.from(schema.accountServerAccess)
		.where(eq(schema.accountServerAccess.account_id, accountId));
}

async function createAccountServerAccess(data: { account_id: number; server_id: number; role: 'owner' | 'staff' }) {
	const now = toMySQLDateTime();
	await db
		.insert(schema.accountServerAccess)
		.values({ account_id: data.account_id, server_id: data.server_id, role: data.role, created_at: now as any })
		.onDuplicateKeyUpdate({ set: { role: data.role } });
}

async function deleteAccountServerAccess(accountId: number, serverId: number) {
	await db
		.delete(schema.accountServerAccess)
		.where(and(eq(schema.accountServerAccess.account_id, accountId), eq(schema.accountServerAccess.server_id, serverId)));
}

async function getServerAccountById(id: number) {
	const rows = await db.select().from(schema.serverAccounts).where(eq(schema.serverAccounts.id, id)).limit(1);
	return rows[0] || null;
}

async function getServerAccountByEmail(email: string) {
	const rows = await db.select().from(schema.serverAccounts).where(eq(schema.serverAccounts.email, email)).limit(1);
	return rows[0] || null;
}

async function getServerAccountByUsername(username: string) {
	const rows = await db.select().from(schema.serverAccounts).where(eq(schema.serverAccounts.username, username)).limit(1);
	return rows[0] || null;
}

async function getServerAccountByEmailServer(email: string, serverId: number) {
	const rows = await db
		.select()
		.from(schema.serverAccounts)
		.where(and(eq(schema.serverAccounts.email, email), eq(schema.serverAccounts.server_id, serverId)))
		.limit(1);
	return rows[0] || null;
}

async function getServerAccountByNormalizedEmailServer(email: string, serverId: number) {
	const atIndex = email.lastIndexOf('@');
	if (atIndex === -1) return null;
	const domain = email.substring(atIndex + 1);
	if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
		return getServerAccountByEmailServer(email, serverId);
	}
	const normalizedLocal = email.substring(0, atIndex).replace(/\./g, '');
	const rows = await db
		.select()
		.from(schema.serverAccounts)
		.where(
			and(
				eq(schema.serverAccounts.server_id, serverId),
				sql`SUBSTRING_INDEX(${schema.serverAccounts.email}, '@', -1) IN ('gmail.com', 'googlemail.com')
				    AND REPLACE(SUBSTRING_INDEX(${schema.serverAccounts.email}, '@', 1), '.', '') = ${normalizedLocal}`
			)
		)
		.limit(1);
	return rows[0] || null;
}

async function createServerAccount(data: {
	server_id: number;
	username: string;
	email: string;
	password_hash: string;
	account_type: 'owner' | 'staff';
	email_verified?: boolean;
	otp_code?: string | null;
	otp_expires_at?: string | null;
	ip_address?: string | null;
	is_frozen?: boolean;
}) {
	const now = toMySQLDateTime();
	const result = await db.insert(schema.serverAccounts).values({
		server_id: data.server_id,
		username: data.username,
		email: data.email,
		password_hash: data.password_hash,
		account_type: data.account_type,
		email_verified: data.email_verified ?? false,
		otp_code: data.otp_code ?? null,
		otp_expires_at: data.otp_expires_at ?? (null as any),
		ip_address: data.ip_address ?? null,
		is_frozen: data.is_frozen ?? false,
		created_at: now as any,
		updated_at: now as any
	});
	return getServerAccountById((result[0] as any).insertId);
}

async function updateServerAccount(
	id: number,
	data: Partial<{
		username: string;
		email: string;
		password_hash: string;
		account_type: 'owner' | 'staff';
		email_verified: boolean;
		otp_code: string | null;
		otp_expires_at: string | null;
		ip_address: string | null;
		is_frozen: boolean;
	}>
) {
	await db
		.update(schema.serverAccounts)
		.set({ ...(data as any), updated_at: toMySQLDateTime() as any })
		.where(eq(schema.serverAccounts.id, id));
}

async function deleteServerAccount(id: number) {
	await db.delete(schema.serverAccounts).where(eq(schema.serverAccounts.id, id));
}

async function getServerAccountsByServer(serverId: number) {
	return db
		.select()
		.from(schema.serverAccounts)
		.where(eq(schema.serverAccounts.server_id, serverId))
		.orderBy(asc(schema.serverAccounts.account_type), asc(schema.serverAccounts.created_at));
}

const SERVER_ACCOUNT_INVITE_TTL_MINUTES = 10;

async function createServerAccountInvite(data: { token: string; server_id: number; account_type: 'owner' | 'staff' }) {
	const now = getNowUtc();
	const createdAt = now.toJSDate();
	const expiresAt = now.plus({ minutes: SERVER_ACCOUNT_INVITE_TTL_MINUTES }).toJSDate();
	await db.insert(schema.serverAccountInvites).values({
		token: data.token,
		server_id: data.server_id,
		account_type: data.account_type,
		expires_at: expiresAt as any,
		created_at: createdAt as any
	});
}

async function getServerAccountInviteByToken(token: string) {
	const rows = await db.select().from(schema.serverAccountInvites).where(eq(schema.serverAccountInvites.token, token)).limit(1);
	return rows[0] || null;
}

async function getServerAccountInviteByIdForServer(inviteId: number, serverId: number) {
	const rows = await db
		.select()
		.from(schema.serverAccountInvites)
		.where(and(eq(schema.serverAccountInvites.id, inviteId), eq(schema.serverAccountInvites.server_id, serverId)))
		.limit(1);
	return rows[0] || null;
}

async function updateServerAccountInvite(id: number, data: Partial<{ used_by: number; used_at: string | Date; expires_at: Date | string }>) {
	await db
		.update(schema.serverAccountInvites)
		.set(data as any)
		.where(eq(schema.serverAccountInvites.id, id));
}

async function getServerAccountInvitesByServer(serverId: number) {
	return db
		.select()
		.from(schema.serverAccountInvites)
		.where(eq(schema.serverAccountInvites.server_id, serverId))
		.orderBy(desc(schema.serverAccountInvites.created_at));
}

async function getAllServerBots() {
	return db.select().from(schema.serverBots);
}

async function getServerBots(serverId: number) {
	return db.select().from(schema.serverBots).where(eq(schema.serverBots.server_id, serverId));
}

async function addServerBot(data: { server_id: number; name: string; token: string }) {
	const now = toMySQLDateTime();
	const result = await db.insert(schema.serverBots).values({
		server_id: data.server_id,
		name: data.name,
		token: data.token,
		status: 'stopped',
		created_at: now as any,
		updated_at: now as any
	});
	return (result[0] as any).insertId;
}

async function updateServerBot(
	id: number,
	data: Partial<{
		name: string;
		token: string;
		bot_icon: string | null;
		status: string;
		process_id: number | null;
		uptime_started_at: string | null;
	}>
) {
	await db
		.update(schema.serverBots)
		.set({ ...data, updated_at: toMySQLDateTime() as any } as any)
		.where(eq(schema.serverBots.id, id));
}

async function removeServerBot(id: number) {
	await db.delete(schema.serverBots).where(eq(schema.serverBots.id, id));
}

async function getServerBotById(id: number) {
	const rows = await db.select().from(schema.serverBots).where(eq(schema.serverBots.id, id)).limit(1);
	return rows[0] || null;
}

async function getOfficialBotForSelfbot(selfbotId: number) {
	const rows = await db
		.select({ bot: schema.bots })
		.from(schema.serverBots)
		.innerJoin(schema.servers, eq(schema.servers.id, schema.serverBots.server_id))
		.innerJoin(schema.bots, eq(schema.bots.id, schema.servers.bot_id))
		.where(and(eq(schema.serverBots.id, selfbotId), isNotNull(schema.servers.bot_id)))
		.limit(1);
	return rows[0]?.bot || null;
}

export async function resolveOfficialBotIdForServer(server: typeof schema.servers.$inferSelect | null) {
	if (!server) return null;
	if ((server as any).bot_id != null) return (server as any).bot_id;
	return null;
}

export async function getOfficialBotIdForServer(serverId: number): Promise<number | null> {
	const server = await getServer(serverId);
	return resolveOfficialBotIdForServer(server);
}

async function getSelfbotsForOfficialBot(officialBotId: number) {
	return db
		.select({ selfbot: schema.serverBots })
		.from(schema.serverBots)
		.innerJoin(schema.servers, eq(schema.servers.id, schema.serverBots.server_id))
		.where(eq(schema.servers.bot_id, officialBotId))
		.then((rows) => rows.map((r) => r.selfbot));
}

async function getFirstRunningSelfbotForServer(serverId: number) {
	await initializeDatabase();
	const selfbots = await getServerBots(serverId);
	const running = selfbots.filter((s) => s.status === 'running' && typeof s.token === 'string' && s.token.trim() !== '');
	running.sort((a, b) => a.id - b.id);
	return running[0] ?? null;
}

async function getServerSettings(serverId: any, componentName: string | null = null) {
	await initializeDatabase();
	if (componentName) {
		const rows = await db
			.select()
			.from(schema.serverSettings)
			.where(and(eq(schema.serverSettings.server_id, Number(serverId)), eq(schema.serverSettings.component_name, componentName)))
			.limit(1);
		if (!rows[0]) return null;
		const row = { ...rows[0] };
		if (row.settings && typeof row.settings === 'string') {
			try {
				row.settings = JSON.parse(row.settings);
			} catch {
				row.settings = {};
			}
		}
		return row;
	}

	const rows = await db
		.select()
		.from(schema.serverSettings)
		.where(eq(schema.serverSettings.server_id, Number(serverId)));
	return rows.map((row) => {
		const r = { ...row };
		if (r.settings && typeof r.settings === 'string') {
			try {
				r.settings = JSON.parse(r.settings as any);
			} catch {
				r.settings = {};
			}
		}
		return r;
	});
}

async function upsertServerSettings(serverId: any, componentName: string, settings: any) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverSettings)
		.values({ server_id: Number(serverId), component_name: componentName, settings, created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { settings, updated_at: now as any } });
	const rows = await db
		.select()
		.from(schema.serverSettings)
		.where(and(eq(schema.serverSettings.server_id, Number(serverId)), eq(schema.serverSettings.component_name, componentName)))
		.limit(1);
	return rows[0];
}

function questIsoToDbDate(iso: string | undefined | null): Date | null {
	if (iso == null || typeof iso !== 'string' || !iso.trim()) return null;
	return toMySQLDateTime(iso.trim());
}

function snapshotFromDiscordQuestSummary(q: DiscordQuestSummary) {
	return {
		quest_name: q.questName?.trim() || null,
		game_title: q.gameTitle?.trim() || null,
		quest_url: q.questUrl?.trim() || null,
		quest_description: q.description?.trim() || null,
		reward: q.reward?.trim() || null,
		task_detail_line: q.taskDetailLine?.trim() || null,
		starts_at: questIsoToDbDate(q.startsAt),
		expires_at: questIsoToDbDate(q.expiresAt)
	};
}

async function syncServerDiscordQuestsFromApi(botId: number, serverId: number, quests: DiscordQuestSummary[]): Promise<void> {
	await initializeDatabase();
	if (quests.length === 0) return;
	const now = toMySQLDateTime();
	for (const q of quests) {
		const snap = snapshotFromDiscordQuestSummary(q);
		await db
			.insert(schema.botDiscordQuest)
			.values({
				bot_id: botId,
				quest_id: q.id,
				quest_task_type: q.taskTypeKey || '',
				quest_task_label: q.taskTypeLabel || '',
				created_at: now as any,
				...snap
			})
			.onDuplicateKeyUpdate({
				set: {
					bot_id: botId,
					quest_task_type: q.taskTypeKey || '',
					quest_task_label: q.taskTypeLabel || '',
					created_at: now as any,
					...snap
				} as any
			});
		const [questRow] = await db
			.select({ id: schema.botDiscordQuest.id })
			.from(schema.botDiscordQuest)
			.where(eq(schema.botDiscordQuest.quest_id, q.id))
			.limit(1);
		if (!questRow) continue;
		await db
			.insert(schema.serverDiscordQuest)
			.values({ server_id: serverId, quest_id: questRow.id, message_posted_at: null })
			.onDuplicateKeyUpdate({ set: { server_id: serverId } as any });
	}
}

async function listServerDiscordQuestUnpostedIds(serverId: number, activeQuestIds: string[]): Promise<string[]> {
	if (activeQuestIds.length === 0) return [];
	await initializeDatabase();
	const rows = await db
		.select({ quest_id: schema.botDiscordQuest.quest_id })
		.from(schema.serverDiscordQuest)
		.innerJoin(schema.botDiscordQuest, eq(schema.serverDiscordQuest.quest_id, schema.botDiscordQuest.id))
		.where(
			and(
				eq(schema.serverDiscordQuest.server_id, serverId),
				inArray(schema.botDiscordQuest.quest_id, activeQuestIds),
				isNull(schema.serverDiscordQuest.message_posted_at)
			)
		);
	return rows.map((r) => r.quest_id);
}

async function markServerDiscordQuestMessagePosted(serverId: number, questId: string): Promise<void> {
	await initializeDatabase();
	const posted = toMySQLDateTime();
	const [questRow] = await db
		.select({ id: schema.botDiscordQuest.id })
		.from(schema.botDiscordQuest)
		.where(eq(schema.botDiscordQuest.quest_id, questId))
		.limit(1);
	if (!questRow) return;
	await db
		.update(schema.serverDiscordQuest)
		.set({ message_posted_at: posted as any })
		.where(and(eq(schema.serverDiscordQuest.server_id, serverId), eq(schema.serverDiscordQuest.quest_id, questRow.id)));
}

type RobloxCatalogItemSnapshot = {
	assetId: number;
	assetType?: number | null;
	name?: string | null;
	description?: string | null;
	creatorName?: string | null;
	price?: number | null;
	lowestPrice?: number | null;
	lowestResalePrice?: number | null;
	totalQuantity?: number | null;
	thumbnailUrl?: string | null;
	itemUrl?: string | null;
	itemCreatedUtc?: string | null;
};

async function syncServerRobloxItemsFromApi(botId: number, serverId: number, items: RobloxCatalogItemSnapshot[]): Promise<void> {
	await initializeDatabase();
	if (!items || items.length === 0) return;
	const now = toMySQLDateTime();

	for (const it of items) {
		if (!it || !Number.isFinite(Number(it.assetId))) continue;

		const itemCreatedAt = it.itemCreatedUtc && typeof it.itemCreatedUtc === 'string' ? toMySQLDateTime(it.itemCreatedUtc) : null;

		await db
			.insert(schema.botRobloxItems)
			.values({
				bot_id: botId,
				asset_id: Number(it.assetId),
				asset_type: it.assetType == null ? null : Number(it.assetType),
				name: it.name ?? null,
				description: it.description ?? null,
				creator_name: it.creatorName ?? null,
				price: it.price == null ? null : Number(it.price),
				lowest_price: it.lowestPrice == null ? null : Number(it.lowestPrice),
				lowest_resale_price: it.lowestResalePrice == null ? null : Number(it.lowestResalePrice),
				total_quantity: it.totalQuantity == null ? null : Number(it.totalQuantity),
				thumbnail_url: it.thumbnailUrl ?? null,
				item_url: it.itemUrl ?? null,
				item_created_at: itemCreatedAt as any,
				created_at: now as any
			})
			.onDuplicateKeyUpdate({
				set: {
					bot_id: botId,
					asset_type: it.assetType == null ? null : Number(it.assetType),
					name: it.name ?? null,
					description: it.description ?? null,
					creator_name: it.creatorName ?? null,
					price: it.price == null ? null : Number(it.price),
					lowest_price: it.lowestPrice == null ? null : Number(it.lowestPrice),
					lowest_resale_price: it.lowestResalePrice == null ? null : Number(it.lowestResalePrice),
					total_quantity: it.totalQuantity == null ? null : Number(it.totalQuantity),
					thumbnail_url: it.thumbnailUrl ?? null,
					item_url: it.itemUrl ?? null,
					item_created_at: itemCreatedAt as any,
					created_at: now as any
				} as any
			});

		const [row] = await db
			.select({ id: schema.botRobloxItems.id })
			.from(schema.botRobloxItems)
			.where(eq(schema.botRobloxItems.asset_id, Number(it.assetId)))
			.limit(1);
		if (!row) continue;

		await db
			.insert(schema.serverRobloxItems)
			.values({ server_id: serverId, item_id: row.id, message_posted_at: null })
			.onDuplicateKeyUpdate({ set: { server_id: serverId } as any });
	}
}

async function listServerRobloxUnpostedAssetIds(serverId: number, activeAssetIds: number[]): Promise<number[]> {
	if (!activeAssetIds || activeAssetIds.length === 0) return [];
	await initializeDatabase();
	const rows = await db
		.select({ asset_id: schema.botRobloxItems.asset_id })
		.from(schema.serverRobloxItems)
		.innerJoin(schema.botRobloxItems, eq(schema.serverRobloxItems.item_id, schema.botRobloxItems.id))
		.where(
			and(
				eq(schema.serverRobloxItems.server_id, serverId),
				inArray(schema.botRobloxItems.asset_id, activeAssetIds as any),
				isNull(schema.serverRobloxItems.message_posted_at)
			)
		);
	return rows.map((r) => Number(r.asset_id));
}

async function markServerRobloxItemMessagePosted(serverId: number, assetId: number): Promise<void> {
	await initializeDatabase();
	const posted = toMySQLDateTime();
	const [item] = await db
		.select({
			id: schema.botRobloxItems.id,
			price: schema.botRobloxItems.price,
			lowest_price: schema.botRobloxItems.lowest_price,
			lowest_resale_price: schema.botRobloxItems.lowest_resale_price,
			total_quantity: schema.botRobloxItems.total_quantity
		})
		.from(schema.botRobloxItems)
		.where(eq(schema.botRobloxItems.asset_id, Number(assetId)))
		.limit(1);
	if (!item) return;
	await db
		.update(schema.botRobloxItems)
		.set({
			last_price: item.price ?? null,
			last_lowest_price: item.lowest_price ?? null,
			last_lowest_resale_price: item.lowest_resale_price ?? null,
			last_total_quantity: item.total_quantity ?? null
		} as any)
		.where(eq(schema.botRobloxItems.id, item.id));
	await db
		.update(schema.serverRobloxItems)
		.set({ message_posted_at: posted as any })
		.where(and(eq(schema.serverRobloxItems.server_id, serverId), eq(schema.serverRobloxItems.item_id, item.id)));
}

export type RobloxItemChange = {
	assetId: number;
	field: 'price' | 'lowest_price' | 'lowest_resale_price' | 'total_quantity';
	oldValue: number | null;
	newValue: number | null;
};

async function isBotRobloxItemsEmpty(botId: number): Promise<boolean> {
	await initializeDatabase();
	const [row] = await db.select({ id: schema.botRobloxItems.id }).from(schema.botRobloxItems).where(eq(schema.botRobloxItems.bot_id, botId)).limit(1);
	return !row;
}

async function detectAndUpdateServerRobloxItemChanges(serverId: number, items: RobloxCatalogItemSnapshot[]): Promise<Map<number, RobloxItemChange[]>> {
	await initializeDatabase();
	const result = new Map<number, RobloxItemChange[]>();
	if (!items || items.length === 0) return result;

	const assetIds = items.map((x) => Number(x.assetId));

	const rows = await db
		.select({
			asset_id: schema.botRobloxItems.asset_id,
			bot_item_id: schema.botRobloxItems.id,
			last_price: schema.botRobloxItems.last_price,
			last_lowest_price: schema.botRobloxItems.last_lowest_price,
			last_lowest_resale_price: schema.botRobloxItems.last_lowest_resale_price,
			last_total_quantity: schema.botRobloxItems.last_total_quantity,
			message_posted_at: schema.serverRobloxItems.message_posted_at
		})
		.from(schema.serverRobloxItems)
		.innerJoin(schema.botRobloxItems, eq(schema.serverRobloxItems.item_id, schema.botRobloxItems.id))
		.where(and(eq(schema.serverRobloxItems.server_id, serverId), inArray(schema.botRobloxItems.asset_id, assetIds as any)));

	const rowMap = new Map(rows.map((r) => [Number(r.asset_id), r]));

	for (const it of items) {
		const assetId = Number(it.assetId);
		const row = rowMap.get(assetId);
		if (!row || !row.message_posted_at) continue;

		const changes: RobloxItemChange[] = [];

		if (row.last_price !== null && it.price !== null && it.price !== undefined && row.last_price !== it.price) {
			changes.push({ assetId, field: 'price', oldValue: row.last_price, newValue: it.price });
		}
		if (row.last_lowest_price !== null && it.lowestPrice !== null && it.lowestPrice !== undefined && row.last_lowest_price !== it.lowestPrice) {
			changes.push({ assetId, field: 'lowest_price', oldValue: row.last_lowest_price, newValue: it.lowestPrice });
		}
		if (
			row.last_lowest_resale_price !== null &&
			it.lowestResalePrice !== null &&
			it.lowestResalePrice !== undefined &&
			row.last_lowest_resale_price !== it.lowestResalePrice
		) {
			changes.push({ assetId, field: 'lowest_resale_price', oldValue: row.last_lowest_resale_price, newValue: it.lowestResalePrice });
		}
		if (row.last_total_quantity !== null && it.totalQuantity !== null && it.totalQuantity !== undefined && row.last_total_quantity !== it.totalQuantity) {
			changes.push({ assetId, field: 'total_quantity', oldValue: row.last_total_quantity, newValue: it.totalQuantity });
		}

		if (changes.length > 0) result.set(assetId, changes);
	}

	return result;
}

async function updateBotRobloxItemLastValues(items: RobloxCatalogItemSnapshot[]): Promise<void> {
	await initializeDatabase();
	if (!items || items.length === 0) return;
	const assetIds = items.map((x) => Number(x.assetId));
	const rows = await db
		.select({ id: schema.botRobloxItems.id, asset_id: schema.botRobloxItems.asset_id })
		.from(schema.botRobloxItems)
		.where(inArray(schema.botRobloxItems.asset_id, assetIds as any));
	const rowMap = new Map(rows.map((r) => [Number(r.asset_id), r.id]));
	for (const it of items) {
		const botItemId = rowMap.get(Number(it.assetId));
		if (!botItemId) continue;
		await db
			.update(schema.botRobloxItems)
			.set({
				last_price: it.price ?? null,
				last_lowest_price: it.lowestPrice ?? null,
				last_lowest_resale_price: it.lowestResalePrice ?? null,
				last_total_quantity: it.totalQuantity ?? null
			} as any)
			.where(eq(schema.botRobloxItems.id, botItemId));
	}
}

async function getBotDiscordQuestByQuestId(questId: string) {
	await initializeDatabase();
	const [row] = await db.select().from(schema.botDiscordQuest).where(eq(schema.botDiscordQuest.quest_id, questId)).limit(1);
	return row ?? null;
}

async function hasServerMemberClaimedDiscordQuest(serverId: number, memberId: number, questId: string): Promise<boolean> {
	await initializeDatabase();
	const [botQuest] = await db
		.select({ id: schema.botDiscordQuest.id })
		.from(schema.botDiscordQuest)
		.where(eq(schema.botDiscordQuest.quest_id, questId))
		.limit(1);
	if (!botQuest) return false;
	const [serverQuest] = await db
		.select({ id: schema.serverDiscordQuest.id })
		.from(schema.serverDiscordQuest)
		.where(and(eq(schema.serverDiscordQuest.server_id, serverId), eq(schema.serverDiscordQuest.quest_id, botQuest.id)))
		.limit(1);
	if (!serverQuest) return false;
	const [row] = await db
		.select({ id: schema.serverMemberDiscordQuest.id })
		.from(schema.serverMemberDiscordQuest)
		.where(
			and(
				eq(schema.serverMemberDiscordQuest.member_id, memberId),
				eq(schema.serverMemberDiscordQuest.quest_id, serverQuest.id),
				eq(schema.serverMemberDiscordQuest.reward_claimed, true)
			)
		)
		.limit(1);
	return !!row;
}

async function markServerMemberDiscordQuestClaimed(serverId: number, memberId: number, questId: string): Promise<void> {
	await initializeDatabase();
	const [botQuest] = await db
		.select({ id: schema.botDiscordQuest.id })
		.from(schema.botDiscordQuest)
		.where(eq(schema.botDiscordQuest.quest_id, questId))
		.limit(1);
	if (!botQuest) return;
	const [serverQuest] = await db
		.select({ id: schema.serverDiscordQuest.id })
		.from(schema.serverDiscordQuest)
		.where(and(eq(schema.serverDiscordQuest.server_id, serverId), eq(schema.serverDiscordQuest.quest_id, botQuest.id)))
		.limit(1);
	if (!serverQuest) return;
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberDiscordQuest)
		.values({ member_id: memberId, quest_id: serverQuest.id, reward_claimed: true, created_at: now as any })
		.onDuplicateKeyUpdate({ set: { reward_claimed: true } as any });
}

async function getChannelsForServer(serverId: any) {
	await initializeDatabase();
	return db
		.select()
		.from(schema.serverChannels)
		.where(eq(schema.serverChannels.server_id, Number(serverId)))
		.orderBy(asc(schema.serverChannels.position), asc(schema.serverChannels.name));
}

async function getCategoriesForServer(serverId: any) {
	await initializeDatabase();
	return db
		.select()
		.from(schema.serverCategories)
		.where(eq(schema.serverCategories.server_id, Number(serverId)))
		.orderBy(asc(schema.serverCategories.position));
}

export async function getAFKStatus(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const rows = await db
		.select({
			message: schema.serverMemberAfks.message,
			created_at: schema.serverMemberAfks.created_at,
			server_display_name: schema.serverMembers.server_display_name
		})
		.from(schema.serverMemberAfks)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberAfks.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	const afkData = rows[0];
	if (!afkData) return null;

	let timestamp: number;
	if (afkData.created_at instanceof Date) {
		timestamp = (afkData.created_at as Date).getTime();
	} else {
		const parsed = parseMySQLDateTimeUtc(afkData.created_at as any);
		timestamp = parsed ? parsed.getTime() : Date.now();
	}
	return { message: afkData.message || 'Away', timestamp, serverDisplayName: afkData.server_display_name };
}

export async function setAFKStatus(serverId: any, discordMemberId: string, afkData: any) {
	await initializeDatabase();
	const memberRows = await db
		.select({ id: schema.serverMembers.id })
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	if (!memberRows[0]) return null;

	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberAfks)
		.values({ member_id: memberRows[0].id, message: afkData.message || 'Away', created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { message: afkData.message || 'Away', updated_at: now as any } });
	return getAFKStatus(serverId, discordMemberId);
}

export async function removeAFKStatus(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	await db.execute(sql`
		DELETE sma FROM server_member_afks sma
		INNER JOIN server_members sm ON sma.member_id = sm.id
		WHERE sm.server_id = ${Number(serverId)} AND sm.discord_member_id = ${discordMemberId}
	`);
	return true;
}

export async function serversNeedSync(botId: number) {
	await initializeDatabase();
	const servers = await getServersForBot(botId);
	if (!servers || servers.length === 0) return true;

	for (const server of servers) {
		const [cats, chans, roles, members] = await Promise.all([
			db.select({ count: count() }).from(schema.serverCategories).where(eq(schema.serverCategories.server_id, server.id)),
			db.select({ count: count() }).from(schema.serverChannels).where(eq(schema.serverChannels.server_id, server.id)),
			db.select({ count: count() }).from(schema.serverRoles).where(eq(schema.serverRoles.server_id, server.id)),
			db.select({ count: count() }).from(schema.serverMembers).where(eq(schema.serverMembers.server_id, server.id))
		]);
		if (!cats[0].count || !chans[0].count || !roles[0].count || !members[0].count) return true;
	}
	return false;
}

export async function createGiveaway(giveawayData: any) {
	await initializeDatabase();
	const createdAt = new Date();
	const durationMin = Number(giveawayData.duration_minutes);
	const endsAt = new Date(createdAt.getTime() + (Number.isFinite(durationMin) ? durationMin : 0) * 60_000);

	const result = await db.insert(schema.serverMemberGiveaways).values({
		member_id: giveawayData.member_id,
		title: giveawayData.title,
		prize: giveawayData.prize,
		duration_minutes: giveawayData.duration_minutes,
		allowed_roles: giveawayData.allowed_roles ? JSON.stringify(giveawayData.allowed_roles) : null,
		multiple_entries_allowed: giveawayData.multiple_entries_allowed || false,
		winner_count: giveawayData.winner_count || 1,
		status: 'active',
		ends_at: endsAt as any,
		created_at: createdAt as any,
		updated_at: createdAt as any
	});
	return getGiveawayById((result[0] as any).insertId);
}

export async function updateGiveawayMessageId(giveawayId: any, discordMessageId: string) {
	await initializeDatabase();
	await db
		.update(schema.serverMemberGiveaways)
		.set({ discord_message_id: discordMessageId })
		.where(eq(schema.serverMemberGiveaways.id, Number(giveawayId)));
}

export async function getEndedGiveaways() {
	await initializeDatabase();
	const rows = await db
		.select({ giveaway: schema.serverMemberGiveaways, server_id: schema.serverMembers.server_id })
		.from(schema.serverMemberGiveaways)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberGiveaways.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMemberGiveaways.status, 'active'), eq(schema.serverMemberGiveaways.winners_announced, false)));
	const now = new Date();
	return rows
		.filter((r) => {
			const endsAt = parseMySQLDateTimeUtc(r.giveaway.ends_at as any);
			return endsAt != null && endsAt.getTime() <= now.getTime();
		})
		.map((r) => {
			const g = { ...r.giveaway, server_id: r.server_id } as any;
			if (g.allowed_roles) {
				try {
					g.allowed_roles = typeof g.allowed_roles === 'string' ? JSON.parse(g.allowed_roles) : g.allowed_roles;
				} catch {
					g.allowed_roles = [];
				}
			}
			return g;
		});
}

export async function getGiveawayById(giveawayId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ giveaway: schema.serverMemberGiveaways, server_id: schema.serverMembers.server_id })
		.from(schema.serverMemberGiveaways)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberGiveaways.member_id, schema.serverMembers.id))
		.where(eq(schema.serverMemberGiveaways.id, Number(giveawayId)))
		.limit(1);
	if (!rows[0]) return null;
	const g = { ...rows[0].giveaway, server_id: rows[0].server_id } as any;
	if (g.allowed_roles) {
		try {
			g.allowed_roles = typeof g.allowed_roles === 'string' ? JSON.parse(g.allowed_roles) : g.allowed_roles;
		} catch {
			g.allowed_roles = [];
		}
	}
	if (g.ends_at) g.ends_at = parseMySQLDateTimeUtc(g.ends_at) ?? g.ends_at;
	return g;
}

export async function getActiveGiveawayByMember(serverId: any, memberId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ giveaway: schema.serverMemberGiveaways })
		.from(schema.serverMemberGiveaways)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberGiveaways.member_id, schema.serverMembers.id))
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				eq(schema.serverMemberGiveaways.member_id, Number(memberId)),
				eq(schema.serverMemberGiveaways.status, 'active')
			)
		)
		.limit(1);
	if (!rows[0]) return null;
	const g = { ...rows[0].giveaway } as any;
	if (g.allowed_roles) {
		try {
			g.allowed_roles = typeof g.allowed_roles === 'string' ? JSON.parse(g.allowed_roles) : g.allowed_roles;
		} catch {
			g.allowed_roles = [];
		}
	}
	if (g.ends_at) g.ends_at = parseMySQLDateTimeUtc(g.ends_at) ?? g.ends_at;
	return g;
}

export async function addGiveawayEntry(giveawayId: any, memberId: any, increment = true) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	if (increment) {
		await db.execute(sql`
			INSERT INTO server_member_giveaway_entries (giveaway_id, member_id, entry_count, created_at, updated_at)
			VALUES (${Number(giveawayId)}, ${Number(memberId)}, 1, ${now}, ${now})
			ON DUPLICATE KEY UPDATE entry_count = entry_count + 1, updated_at = ${now}
		`);
	} else {
		await db.execute(sql`
			INSERT INTO server_member_giveaway_entries (giveaway_id, member_id, entry_count, created_at, updated_at)
			VALUES (${Number(giveawayId)}, ${Number(memberId)}, 1, ${now}, ${now})
			ON DUPLICATE KEY UPDATE updated_at = ${now}
		`);
	}
	const rows = await db
		.select()
		.from(schema.serverMemberGiveawayEntries)
		.where(and(eq(schema.serverMemberGiveawayEntries.giveaway_id, Number(giveawayId)), eq(schema.serverMemberGiveawayEntries.member_id, Number(memberId))))
		.limit(1);
	return rows[0] || null;
}

export async function getGiveawayEntries(giveawayId: any) {
	await initializeDatabase();
	return db
		.select({ entry: schema.serverMemberGiveawayEntries, discord_member_id: schema.serverMembers.discord_member_id })
		.from(schema.serverMemberGiveawayEntries)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberGiveawayEntries.member_id, schema.serverMembers.id))
		.where(eq(schema.serverMemberGiveawayEntries.giveaway_id, Number(giveawayId)))
		.orderBy(sql`RAND()`)
		.then((rows) => rows.map((r) => ({ ...r.entry, discord_member_id: r.discord_member_id })));
}

export async function getRandomGiveawayWinners(giveawayId: any, winnerCount: number) {
	await initializeDatabase();
	const entries = await getGiveawayEntries(giveawayId);
	if (entries.length === 0) return [];

	const crypto = await import('crypto');
	const shuffledEntries = [...entries];
	for (let round = 0; round < 10; round++) {
		for (let i = shuffledEntries.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[shuffledEntries[i], shuffledEntries[j]] = [shuffledEntries[j], shuffledEntries[i]];
		}
	}

	const weighted: any[] = [];
	for (const entry of shuffledEntries) {
		for (let i = 0; i < (entry.entry_count ?? 1); i++) weighted.push(entry);
	}
	for (let round = 0; round < 10; round++) {
		for (let i = weighted.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[weighted[i], weighted[j]] = [weighted[j], weighted[i]];
		}
	}

	const winners: any[] = [];
	const used = new Set();
	const available = [...weighted];
	while (winners.length < winnerCount && available.length > 0) {
		const idx = crypto.randomInt(0, available.length);
		const selected = available[idx];
		if (!used.has(selected.member_id)) {
			winners.push(selected);
			used.add(selected.member_id);
		}
		for (let i = available.length - 1; i >= 0; i--) {
			if (available[i].member_id === selected.member_id) available.splice(i, 1);
		}
	}
	return winners;
}

export async function markGiveawayEnded(giveawayId: any) {
	await initializeDatabase();
	await db
		.update(schema.serverMemberGiveaways)
		.set({ status: 'ended', winners_announced: true })
		.where(eq(schema.serverMemberGiveaways.id, Number(giveawayId)));
}

export async function markGiveawayEndedForce(giveawayId: any) {
	await initializeDatabase();
	await db
		.update(schema.serverMemberGiveaways)
		.set({ status: 'ended_force', winners_announced: true })
		.where(eq(schema.serverMemberGiveaways.id, Number(giveawayId)));
}

export async function markGiveawayWinners(giveawayId: any, winnerMemberIds: any[]) {
	await initializeDatabase();
	if (!winnerMemberIds?.length) return;
	await db
		.update(schema.serverMemberGiveawayEntries)
		.set({ is_winner: true })
		.where(and(eq(schema.serverMemberGiveawayEntries.giveaway_id, Number(giveawayId)), inArray(schema.serverMemberGiveawayEntries.member_id, winnerMemberIds)));
}

export async function getStaffRating(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMemberStaffRatings)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberStaffRatings.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMemberStaffRatings.member_id, Number(staffMemberId))))
		.limit(1);
	return rows[0]?.server_member_staff_ratings || null;
}

export async function upsertStaffRating(serverId: any, staffMemberId: any, ratingValue: number, totalReports: number) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const existing = await getStaffRating(serverId, staffMemberId);
	if (existing) {
		await db
			.update(schema.serverMemberStaffRatings)
			.set({ current_rating: String(ratingValue), total_reports: totalReports, updated_at: now as any })
			.where(eq(schema.serverMemberStaffRatings.member_id, Number(staffMemberId)));
	} else {
		await db.insert(schema.serverMemberStaffRatings).values({
			member_id: Number(staffMemberId),
			role_id: null,
			current_rating: String(ratingValue),
			total_reports: totalReports,
			created_at: now as any,
			updated_at: now as any
		});
	}
	return getStaffRating(serverId, staffMemberId);
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
	const result = await db.insert(schema.serverMemberStaffRatingReviews).values({
		reporter_member_id: Number(reporterMemberId),
		reported_staff_id: Number(reportedStaffId),
		rating,
		category,
		description,
		is_anonymous: isAnonymous,
		status: 'pending',
		reported_at: now as any
	});
	return (result[0] as any).insertId;
}

export async function getLastStaffRatingReport(serverId: any, reporterMemberId: any, reportedStaffId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ report: schema.serverMemberStaffRatingReviews })
		.from(schema.serverMemberStaffRatingReviews)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberStaffRatingReviews.reporter_member_id, schema.serverMembers.id))
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				eq(schema.serverMemberStaffRatingReviews.reporter_member_id, Number(reporterMemberId)),
				eq(schema.serverMemberStaffRatingReviews.reported_staff_id, Number(reportedStaffId))
			)
		)
		.orderBy(desc(schema.serverMemberStaffRatingReviews.reported_at))
		.limit(1);
	return rows[0]?.report || null;
}

export async function getStaffRatingAggregate(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ total_reports: count(), average_rating: avg(schema.serverMemberStaffRatingReviews.rating) })
		.from(schema.serverMemberStaffRatingReviews)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberStaffRatingReviews.reported_staff_id, schema.serverMembers.id))
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				eq(schema.serverMemberStaffRatingReviews.reported_staff_id, Number(staffMemberId)),
				eq(schema.serverMemberStaffRatingReviews.status, 'approved')
			)
		);
	return { total_reports: rows[0]?.total_reports || 0, average_rating: rows[0]?.average_rating || 0 };
}

export async function getStaffReportById(serverId: any, reportId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT sr.*, reporter.discord_member_id AS reporter_discord_id, staff.discord_member_id AS staff_discord_id, reviewer.discord_member_id AS reviewer_discord_id
		FROM server_member_staff_rating_reviews sr
		INNER JOIN server_members reporter ON sr.reporter_member_id = reporter.id
		INNER JOIN server_members staff ON sr.reported_staff_id = staff.id
		LEFT JOIN server_members reviewer ON sr.reviewed_by_member_id = reviewer.id
		WHERE reporter.server_id = ${Number(serverId)} AND sr.id = ${Number(reportId)}
		LIMIT 1
	`);
	return (rows[0] as unknown as any[])[0] || null;
}

export async function updateStaffReportStatus(reportId: any, status: string, reviewedByMemberId?: any, reviewReason?: string | null) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const payload: Record<string, unknown> = {
		status: status as any,
		reviewed_by_member_id: reviewedByMemberId ? Number(reviewedByMemberId) : null,
		reviewed_at: now as any
	};
	if (reviewReason !== undefined) {
		payload.review_reason = reviewReason;
	}
	await db
		.update(schema.serverMemberStaffRatingReviews)
		.set(payload as any)
		.where(eq(schema.serverMemberStaffRatingReviews.id, Number(reportId)));
}

export async function createContentCreatorApplication(_serverId: any, memberId: any, tiktokUsername: string, reason: string) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result = await db.insert(schema.serverMemberContentCreatorReviews).values({
		member_id: Number(memberId),
		tiktok_username: tiktokUsername,
		reason,
		status: 'pending',
		submitted_at: now as any
	});
	return (result[0] as any).insertId;
}

export async function getLastContentCreatorApplication(serverId: any, memberId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ application: schema.serverMemberContentCreatorReviews })
		.from(schema.serverMemberContentCreatorReviews)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberContentCreatorReviews.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMemberContentCreatorReviews.member_id, Number(memberId))))
		.orderBy(desc(schema.serverMemberContentCreatorReviews.submitted_at))
		.limit(1);
	return rows[0]?.application || null;
}

export async function getContentCreatorTiktokConflict(normalizedUsername: string, excludeDiscordMemberId: string) {
	await initializeDatabase();
	const u = String(normalizedUsername || '')
		.trim()
		.toLowerCase()
		.replace(/^@+/, '');
	const ex = String(excludeDiscordMemberId || '').trim();
	if (!u || !ex) return null;

	const tiktokMatch = sql`LOWER(TRIM(REPLACE(${schema.serverMemberContentCreatorReviews.tiktok_username}, '@', ''))) = ${u}`;

	const pendRows = await db
		.select({ discord_id: schema.serverMembers.discord_member_id })
		.from(schema.serverMemberContentCreatorReviews)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberContentCreatorReviews.member_id, schema.serverMembers.id))
		.where(and(tiktokMatch, ne(schema.serverMembers.discord_member_id, ex), eq(schema.serverMemberContentCreatorReviews.status, 'pending' as any)))
		.limit(1);

	const pend = pendRows[0];
	if (pend?.discord_id != null) {
		return { kind: 'pending' as const, discordId: String(pend.discord_id) };
	}

	const apprRows = await db.execute(sql`
		SELECT sm.discord_member_id AS discord_id
		FROM server_member_content_creator_reviews cca
		INNER JOIN server_members sm ON cca.member_id = sm.id
		INNER JOIN (
			SELECT member_id, MAX(id) AS max_id
			FROM server_member_content_creator_reviews
			GROUP BY member_id
		) latest ON cca.id = latest.max_id
		WHERE cca.status = 'approved'
			AND LOWER(TRIM(REPLACE(cca.tiktok_username, '@', ''))) = ${u}
			AND sm.discord_member_id <> ${ex}
		LIMIT 1
	`);
	const appr = (apprRows[0] as unknown as { discord_id: string }[])[0];
	if (appr?.discord_id != null) {
		return { kind: 'approved' as const, discordId: String(appr.discord_id) };
	}
	return null;
}

export async function getContentCreatorApplicationById(serverId: any, applicationId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT cca.*, applicant.discord_member_id AS applicant_discord_id, reviewer.discord_member_id AS reviewer_discord_id
		FROM server_member_content_creator_reviews cca
		INNER JOIN server_members applicant ON cca.member_id = applicant.id
		LEFT JOIN server_members reviewer ON cca.reviewed_by_member_id = reviewer.id
		WHERE applicant.server_id = ${Number(serverId)} AND cca.id = ${Number(applicationId)}
		LIMIT 1
	`);
	return (rows[0] as unknown as any[])[0] || null;
}

export async function updateContentCreatorApplicationStatus(
	applicationId: any,
	status: 'pending' | 'approved' | 'rejected',
	reviewedByMemberId?: any,
	reviewReason?: string | null
) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const payload: Record<string, unknown> = {
		status: status as any,
		reviewed_by_member_id: reviewedByMemberId ? Number(reviewedByMemberId) : null,
		reviewed_at: now as any
	};
	if (reviewReason !== undefined) {
		payload.review_reason = reviewReason;
	}
	await db
		.update(schema.serverMemberContentCreatorReviews)
		.set(payload as any)
		.where(eq(schema.serverMemberContentCreatorReviews.id, Number(applicationId)));
}

export async function getApprovedContentCreators(serverId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT cca.id, cca.member_id, cca.tiktok_username, cca.reviewed_at, sm.discord_member_id
		FROM server_member_content_creator_reviews cca
		INNER JOIN server_members sm ON cca.member_id = sm.id
		INNER JOIN server_member_content_creators smcc ON smcc.member_id = sm.id
		WHERE sm.server_id = ${Number(serverId)}
		  AND cca.status = 'approved'
		  AND cca.id IN (
			SELECT MAX(i.id)
			FROM server_member_content_creator_reviews i
			WHERE i.member_id = cca.member_id
			GROUP BY i.member_id
		  )
		ORDER BY cca.reviewed_at DESC, cca.id DESC
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function createContentCreatorStream(memberId: number, roomId: string | null) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result = await db.insert(schema.serverMemberContentCreatorStreams).values({
		member_id: Number(memberId),
		room_id: roomId || null,
		status: 'active' as any,
		started_at: now as any,
		updated_at: now as any
	});
	return Number((result[0] as any).insertId);
}

export async function endContentCreatorStream(streamId: number, status: 'ended' | 'error', errorMessage: string | null = null) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db
		.update(schema.serverMemberContentCreatorStreams)
		.set({
			status: status as any,
			ended_at: now as any,
			updated_at: now as any,
			error_message: errorMessage
		})
		.where(eq(schema.serverMemberContentCreatorStreams.id, Number(streamId)));
}

export async function incrementContentCreatorStreamCounters(
	streamId: number,
	delta: { chat?: number; like?: number; gift?: number; follow?: number; share?: number }
) {
	await initializeDatabase();
	const chat = Math.max(0, Math.floor(Number(delta.chat) || 0));
	const like = Math.max(0, Math.floor(Number(delta.like) || 0));
	const gift = Math.max(0, Math.floor(Number(delta.gift) || 0));
	const follow = Math.max(0, Math.floor(Number(delta.follow) || 0));
	const share = Math.max(0, Math.floor(Number(delta.share) || 0));
	if (!chat && !like && !gift && !follow && !share) return;
	const now = toMySQLDateTime();
	await db.execute(sql`
		UPDATE server_member_content_creator_streams
		SET
			total_chat_messages = total_chat_messages + ${chat},
			total_likes = total_likes + ${like},
			total_gifts = total_gifts + ${gift},
			total_follows = total_follows + ${follow},
			total_shares = total_shares + ${share},
			updated_at = ${now}
		WHERE id = ${Number(streamId)}
	`);
}

export async function updateContentCreatorStreamPeakViewers(streamId: number, candidate: number) {
	await initializeDatabase();
	const n = Math.floor(Number(candidate));
	if (!Number.isFinite(n) || n < 0) return;
	const now = toMySQLDateTime();
	await db.execute(sql`
		UPDATE server_member_content_creator_streams
		SET
			peak_viewers = GREATEST(COALESCE(peak_viewers, 0), ${n}),
			updated_at = ${now}
		WHERE id = ${Number(streamId)}
	`);
}

export async function insertContentCreatorStreamLog(streamId: number, eventType: string, payload: unknown) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	let jsonPayload: Record<string, unknown> | null = null;
	try {
		const s = JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
		if (s.length > 60000) {
			jsonPayload = { _truncated: true, length: s.length, preview: s.slice(0, 8000) };
		} else {
			jsonPayload = JSON.parse(s) as Record<string, unknown>;
		}
	} catch {
		jsonPayload = { _raw: String(payload).slice(0, 8000) };
	}
	await db.insert(schema.serverMemberContentCreatorStreamLogs).values({
		stream_id: Number(streamId),
		event_type: String(eventType).slice(0, 64),
		occurred_at: now as any,
		payload: jsonPayload as any
	});
}

export async function createFeedback(_serverId: any, memberId: any, description: string, isAnonymous: boolean) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result = await db.insert(schema.serverFeedback).values({
		member_id: Number(memberId),
		description,
		is_anonymous: isAnonymous,
		submitted_at: now as any
	});
	return (result[0] as any).insertId;
}

export async function getFeedback(serverId: any, feedbackId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ feedback: schema.serverFeedback })
		.from(schema.serverFeedback)
		.innerJoin(schema.serverMembers, eq(schema.serverFeedback.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverFeedback.id, Number(feedbackId))))
		.limit(1);
	return rows[0]?.feedback || null;
}

export async function getFeedbackByServer(serverId: any, limit = 100, offset = 0) {
	await initializeDatabase();
	const lim = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
	const off = Math.max(0, parseInt(String(offset), 10) || 0);
	return db
		.select({ feedback: schema.serverFeedback })
		.from(schema.serverFeedback)
		.innerJoin(schema.serverMembers, eq(schema.serverFeedback.member_id, schema.serverMembers.id))
		.where(eq(schema.serverMembers.server_id, Number(serverId)))
		.orderBy(desc(schema.serverFeedback.submitted_at))
		.limit(lim)
		.offset(off)
		.then((rows) => rows.map((r) => r.feedback));
}

export async function getFeedbackCount(serverId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ count: count() })
		.from(schema.serverFeedback)
		.innerJoin(schema.serverMembers, eq(schema.serverFeedback.member_id, schema.serverMembers.id))
		.where(eq(schema.serverMembers.server_id, Number(serverId)));
	return rows[0]?.count || 0;
}

export async function markMemberRatingRole(serverId: any, staffMemberId: any, discordRoleId: string) {
	await initializeDatabase();
	if (!discordRoleId) return;
	const roleRows = await db
		.select({ id: schema.serverRoles.id })
		.from(schema.serverRoles)
		.where(and(eq(schema.serverRoles.server_id, Number(serverId)), eq(schema.serverRoles.discord_role_id, discordRoleId)))
		.limit(1);
	if (!roleRows[0]) return;
	const now = toMySQLDateTime();

	const existing = await getStaffRating(serverId, staffMemberId);
	if (existing) {
		await db
			.update(schema.serverMemberStaffRatings)
			.set({ role_id: roleRows[0].id, updated_at: now as any })
			.where(eq(schema.serverMemberStaffRatings.member_id, Number(staffMemberId)));
	} else {
		await db.insert(schema.serverMemberStaffRatings).values({
			member_id: Number(staffMemberId),
			role_id: roleRows[0].id,
			current_rating: '0',
			total_reports: 0,
			created_at: now as any,
			updated_at: now as any
		});
	}
}

export async function clearMemberRatingRole(staffMemberId: any) {
	await initializeDatabase();
	await db
		.update(schema.serverMemberStaffRatings)
		.set({ role_id: null })
		.where(eq(schema.serverMemberStaffRatings.member_id, Number(staffMemberId)));
}

export async function markMemberContentCreatorRole(serverId: any, memberId: any, memberDiscordRoleIds: string[]) {
	await initializeDatabase();
	const ids = Array.isArray(memberDiscordRoleIds) ? memberDiscordRoleIds.filter(Boolean) : [];
	const mid = Number(memberId);
	const sid = Number(serverId);
	await syncMemberCustomSupporterRoles(mid, ids, sid);
	await refreshMemberIsContentCreator(mid, sid, ids);
}

export async function clearMemberContentCreatorRole(serverId: any, memberId: any, memberDiscordRoleIds: string[]) {
	await initializeDatabase();
	const ids = Array.isArray(memberDiscordRoleIds) ? memberDiscordRoleIds.filter(Boolean) : [];
	const mid = Number(memberId);
	const sid = Number(serverId);
	await syncMemberCustomSupporterRoles(mid, ids, sid);
	await refreshMemberIsContentCreator(mid, sid, ids);
}

export async function getAllStaffRatings(serverId: any) {
	await initializeDatabase();
	return db
		.select({
			id: schema.serverMemberStaffRatings.id,
			member_id: schema.serverMemberStaffRatings.member_id,
			current_rating: schema.serverMemberStaffRatings.current_rating,
			total_reports: schema.serverMemberStaffRatings.total_reports,
			rating_role_id: schema.serverRoles.discord_role_id,
			created_at: schema.serverMemberStaffRatings.created_at,
			updated_at: schema.serverMemberStaffRatings.updated_at
		})
		.from(schema.serverMemberStaffRatings)
		.innerJoin(schema.serverMembers, eq(schema.serverMemberStaffRatings.member_id, schema.serverMembers.id))
		.innerJoin(schema.serverRoles, eq(schema.serverMemberStaffRatings.role_id, schema.serverRoles.id))
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				isNotNull(schema.serverMemberStaffRatings.role_id),
				sql`${schema.serverMemberStaffRatings.current_rating} > 0`
			)
		)
		.orderBy(desc(schema.serverMemberStaffRatings.current_rating), asc(schema.serverMemberStaffRatings.created_at));
}

export async function getStaffRatingRole(serverId: any, staffMemberId: any) {
	await initializeDatabase();
	const rows = await db
		.select({ discord_role_id: schema.serverRoles.discord_role_id })
		.from(schema.serverMemberStaffRatings)
		.innerJoin(schema.serverRoles, eq(schema.serverMemberStaffRatings.role_id, schema.serverRoles.id))
		.innerJoin(schema.serverMembers, eq(schema.serverMemberStaffRatings.member_id, schema.serverMembers.id))
		.where(
			and(
				eq(schema.serverMembers.server_id, Number(serverId)),
				eq(schema.serverMemberStaffRatings.member_id, Number(staffMemberId)),
				isNotNull(schema.serverMemberStaffRatings.role_id)
			)
		)
		.limit(1);
	return rows[0]?.discord_role_id || null;
}

export default {
	getAllBots,
	getBot,
	getBotPanelId,
	getServerPanelId,
	createBot,
	updateBot,
	deleteBot,
	getServer,
	getServersForBot,
	getServersForSelfbot,
	getOfficialServerByDiscordId,
	getSelfbotServerByDiscordId,
	getServerByDiscordId,
	getOfficialBotServerIdForServer,
	getNotificationRolesForServer,
	getNotificationRolesWithCategory,
	getNotificationRoleByChannel,
	getNotificationRoleDbIds,
	getContentCreatorRoleDbIds,
	upsertNotificationRole,
	deleteNotificationRole,
	upsertServer,
	upsertOfficialServer,
	upsertSelfbotServer,
	upsertServerBotServer,
	syncServerBotCategories,
	syncServerBotChannels,
	getServerBotCategoriesForServer,
	getServerBotChannelsForServer,
	getServerByLeaderboardSlug,
	listPublicLeaderboardSlugs,
	listEnabledLeaderboardServers,
	upsertCategory,
	syncCategories,
	upsertChannel,
	syncChannels,
	getRoles,
	upsertRole,
	syncRoles,
	upsertMember,
	getMemberByDiscordId,
	searchServerMembers,
	syncMembers,
	syncMemberRoles,
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
	getServerSettings,
	upsertServerSettings,
	syncServerDiscordQuestsFromApi,
	listServerDiscordQuestUnpostedIds,
	markServerDiscordQuestMessagePosted,
	syncServerRobloxItemsFromApi,
	isBotRobloxItemsEmpty,
	listServerRobloxUnpostedAssetIds,
	markServerRobloxItemMessagePosted,
	detectAndUpdateServerRobloxItemChanges,
	updateBotRobloxItemLastValues,
	getBotDiscordQuestByQuestId,
	hasServerMemberClaimedDiscordQuest,
	markServerMemberDiscordQuestClaimed,
	getPanel,
	createPanel,
	hasAnyPanel,
	getAccountById,
	getAccountByEmail,
	getAccountByNormalizedEmail,
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
	getServerAccountById,
	getServerAccountByEmail,
	getServerAccountByUsername,
	getServerAccountByEmailServer,
	getServerAccountByNormalizedEmailServer,
	createServerAccount,
	updateServerAccount,
	deleteServerAccount,
	getServerAccountsByServer,
	createServerAccountInvite,
	getServerAccountInviteByToken,
	getServerAccountInviteByIdForServer,
	updateServerAccountInvite,
	getServerAccountInvitesByServer,
	getAllServerBots,
	getServerBots,
	getServerBotById,
	addServerBot,
	updateServerBot,
	removeServerBot,
	getOfficialBotForSelfbot,
	resolveOfficialBotIdForServer,
	getOfficialBotIdForServer,
	getSelfbotsForOfficialBot,
	getFirstRunningSelfbotForServer,
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
	createContentCreatorApplication,
	getLastContentCreatorApplication,
	getContentCreatorTiktokConflict,
	getContentCreatorApplicationById,
	updateContentCreatorApplicationStatus,
	getApprovedContentCreators,
	createContentCreatorStream,
	endContentCreatorStream,
	incrementContentCreatorStreamCounters,
	updateContentCreatorStreamPeakViewers,
	insertContentCreatorStreamLog,
	markMemberRatingRole,
	clearMemberRatingRole,
	markMemberContentCreatorRole,
	clearMemberContentCreatorRole,
	getAllStaffRatings,
	getStaffRatingRole,
	createFeedback,
	getFeedback,
	getFeedbackByServer,
	getFeedbackCount
};
