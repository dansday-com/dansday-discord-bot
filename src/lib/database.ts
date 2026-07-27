import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import { eq, and, or, inArray, notInArray, sql, desc, asc, isNull, isNotNull, count, avg, like, ne } from 'drizzle-orm';
import { db } from './drizzle.js';
import * as schema from './schema.js';
import { SERVER_SETTINGS, AUTO_ENABLED_COMPONENTS } from './frontend/panelServer.js';
import { logger, toMySQLDateTime, parseMySQLDateTimeUtc, getNowUtc } from './utils/index.js';
import { DEFAULT_MAIN_EMBED_COLOR, DEFAULT_MAIN_EMBED_FOOTER, DEFAULT_BOT_NICKNAME } from './utils/mainConfigSettings.js';
import { DEFAULT_LEVELING_SETTINGS, DEFAULT_WELCOMER_MESSAGES, DEFAULT_BOOSTER_MESSAGES } from './backend/config.js';
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

export type BotStatusInput = {
	discord_status: 'online' | 'idle' | 'dnd' | 'invisible';
	activity_type: 'playing' | 'streaming' | 'listening' | 'watching' | 'custom' | 'competing';
	activity_name: string;
	activity_url: string | null;
	activity_state: string | null;
};

import { APP_DOMAIN } from './frontend/panelServer.js';

export const DEFAULT_BOT_PRESENCE: BotStatusInput = {
	discord_status: 'online',
	activity_type: 'playing',
	activity_name: `bot.${APP_DOMAIN}`,
	activity_url: null,
	activity_state: 'Free web panel for your Discord server. Hosted free or self host.'
};

type PresenceDbRow = {
	discord_status: string;
	activity_type: string;
	activity_name: string | null;
	activity_url: string | null;
	activity_state: string | null;
};

export function presenceFromDbRow(row: PresenceDbRow | null | undefined): BotStatusInput {
	const d = DEFAULT_BOT_PRESENCE;
	if (!row) return { ...d };
	const name = (row.activity_name ?? '').trim();
	const state = (row.activity_state ?? '').trim();
	return {
		discord_status: row.discord_status as BotStatusInput['discord_status'],
		activity_type: row.activity_type as BotStatusInput['activity_type'],
		activity_url: row.activity_url?.trim() ? row.activity_url : null,
		activity_name: name || d.activity_name,
		activity_state: state || d.activity_state
	};
}

export async function getBotStatusByBotId(botId: number) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.botStatus)
		.where(eq(schema.botStatus.bot_id, Number(botId)))
		.limit(1);
	return rows[0] ?? null;
}

export async function upsertBotStatus(botId: number, data: BotStatusInput) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const stateTrimmed = data.activity_state?.trim() ? data.activity_state.trim() : null;
	await db
		.insert(schema.botStatus)
		.values({
			bot_id: botId,
			discord_status: data.discord_status,
			activity_type: data.activity_type,
			activity_name: data.activity_name,
			activity_url: data.activity_url?.trim() ? data.activity_url.trim() : null,
			activity_state: stateTrimmed,
			created_at: now as any,
			updated_at: now as any
		})
		.onDuplicateKeyUpdate({
			set: {
				discord_status: data.discord_status,
				activity_type: data.activity_type,
				activity_name: data.activity_name,
				activity_url: data.activity_url?.trim() ? data.activity_url.trim() : null,
				activity_state: stateTrimmed,
				updated_at: now as any
			}
		});
	return getBotStatusByBotId(botId);
}

export type ServerBotStatusInput = BotStatusInput;

export const DEFAULT_SERVER_BOT_PRESENCE: ServerBotStatusInput = DEFAULT_BOT_PRESENCE;

export async function getServerBotStatusByServerBotId(serverBotId: number) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverBotStatus)
		.where(eq(schema.serverBotStatus.server_bot_id, Number(serverBotId)))
		.limit(1);
	return rows[0] ?? null;
}

export async function upsertServerBotStatus(serverBotId: number, data: ServerBotStatusInput) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const stateTrimmed = data.activity_state?.trim() ? data.activity_state.trim() : null;
	await db
		.insert(schema.serverBotStatus)
		.values({
			server_bot_id: serverBotId,
			discord_status: data.discord_status,
			activity_type: data.activity_type,
			activity_name: data.activity_name,
			activity_url: data.activity_url?.trim() ? data.activity_url.trim() : null,
			activity_state: stateTrimmed,
			created_at: now as any,
			updated_at: now as any
		})
		.onDuplicateKeyUpdate({
			set: {
				discord_status: data.discord_status,
				activity_type: data.activity_type,
				activity_name: data.activity_name,
				activity_url: data.activity_url?.trim() ? data.activity_url.trim() : null,
				activity_state: stateTrimmed,
				updated_at: now as any
			}
		});
	return getServerBotStatusByServerBotId(serverBotId);
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

export async function getServerBotServerForSelfbot(selfbotId: number, serverBotServerId: number) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverBotServers)
		.where(and(eq(schema.serverBotServers.server_bot_id, selfbotId), eq(schema.serverBotServers.id, serverBotServerId)))
		.limit(1);
	return rows[0] ?? null;
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

export async function getNotificationChannels(serverId: any, channelIds: string[]) {
	await initializeDatabase();
	if (!channelIds || channelIds.length === 0) return [];
	const rows = await db.execute(sql`
		SELECT c.discord_channel_id, COALESCE(cat.name, c.name) AS category_name,
		       COALESCE(cat.position, 9999) AS category_position,
		       COALESCE(c.position, 0) AS channel_position,
		       c.name AS channel_name
		FROM server_channels c
		LEFT JOIN server_categories cat ON cat.id = c.category_id
		WHERE c.server_id = ${Number(serverId)} AND c.discord_channel_id IN (${sql.join(channelIds, sql`, `)})
		ORDER BY category_position ASC, channel_position ASC, channel_name ASC
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function getMemberNotificationChannelIds(serverId: any, discordMemberId: string) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT c.discord_channel_id
		FROM server_member_notifications n
		INNER JOIN server_members m ON m.id = n.member_id
		INNER JOIN server_channels c ON c.id = n.channel_id
		WHERE m.server_id = ${Number(serverId)} AND m.discord_member_id = ${discordMemberId}
	`);
	return ((rows[0] as unknown as any[]) || []).map((r) => r.discord_channel_id);
}

export async function getNotifiedMemberDiscordIds(serverId: any, discordChannelId: string) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT m.discord_member_id
		FROM server_member_notifications n
		INNER JOIN server_members m ON m.id = n.member_id
		INNER JOIN server_channels c ON c.id = n.channel_id
		WHERE c.server_id = ${Number(serverId)} AND c.discord_channel_id = ${discordChannelId}
	`);
	return ((rows[0] as unknown as any[]) || []).map((r) => r.discord_member_id);
}

export async function updateMemberNotificationChannels(serverId: any, discordMemberId: string, discordChannelIds: string[]) {
	await initializeDatabase();
	const mRows = await db
		.select({ id: schema.serverMembers.id })
		.from(schema.serverMembers)
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), eq(schema.serverMembers.discord_member_id, discordMemberId)))
		.limit(1);
	if (!mRows.length) return false;
	const mid = mRows[0].id;

	await db.delete(schema.serverMemberNotifications).where(eq(schema.serverMemberNotifications.member_id, mid));

	if (discordChannelIds && discordChannelIds.length > 0) {
		const channelRows = await db
			.select({ id: schema.serverChannels.id })
			.from(schema.serverChannels)
			.where(and(eq(schema.serverChannels.server_id, Number(serverId)), inArray(schema.serverChannels.discord_channel_id, discordChannelIds)));
		const channelIds = channelRows.map((c) => c.id);

		if (channelIds.length > 0) {
			const now = toMySQLDateTime();
			await db.insert(schema.serverMemberNotifications).values(
				channelIds.map((cid) => ({
					member_id: mid,
					channel_id: cid,
					created_at: now as any
				}))
			);
		}
	}
	return true;
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
			await seedNewServerSettings(server.id);
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

async function seedNewServerSettings(serverId: number) {
	for (const component of SERVER_SETTINGS.withFeatureSwitch) {
		const baseSettings: Record<string, any> = { enabled: AUTO_ENABLED_COMPONENTS.has(component) };

		if (component === SERVER_SETTINGS.component.leveling) {
			Object.assign(baseSettings, DEFAULT_LEVELING_SETTINGS);
		} else if (component === SERVER_SETTINGS.component.welcomer) {
			baseSettings.messages = DEFAULT_WELCOMER_MESSAGES;
		} else if (component === SERVER_SETTINGS.component.booster) {
			baseSettings.messages = DEFAULT_BOOSTER_MESSAGES;
		}

		await upsertServerSettings(serverId, component, baseSettings);
	}

	await upsertServerSettings(serverId, SERVER_SETTINGS.component.main, {
		color: DEFAULT_MAIN_EMBED_COLOR,
		footer: DEFAULT_MAIN_EMBED_FOOTER,
		bot_nickname: DEFAULT_BOT_NICKNAME
	});

	await upsertServerSettings(serverId, SERVER_SETTINGS.component.permissions, {});
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
		.map((r: any) => {
			const s = parseLeaderboardSettingsColumn(r.settings);
			return {
				id: Number(r.id),
				name: r.name ?? null,
				updated_at: r.updated_at,
				server_icon: r.server_icon ?? null,
				items_enabled: s.items_enabled === true,
				assets_enabled: s.assets_enabled === true,
				minigames_enabled: s.minigames_enabled === true
			};
		});
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
			profile_created_at = COALESCE(VALUES(profile_created_at), profile_created_at),
			member_since = COALESCE(VALUES(member_since), member_since),
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

export async function getServerMemberById(memberId: any) {
	await initializeDatabase();
	if (!memberId) return null;
	const rows = await db.execute(sql`
		SELECT id, server_id, discord_member_id, username, display_name, server_display_name
		FROM server_members
		WHERE id = ${Number(memberId)}
		LIMIT 1
	`);
	return (rows[0] as unknown as any[])[0] || null;
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

export async function searchPanelMembersForGift(panelId: any, queryText: string | null, limit = 60) {
	await initializeDatabase();
	if (panelId == null) return [];
	const q = (queryText || '').trim();
	const safeLimit = Math.max(1, Math.min(200, Number(limit) || 60));
	const likeValue = `%${q.replace(/[%_]/g, '\\$&')}%`;
	const searchClause = q
		? sql`AND (
				m.discord_member_id LIKE ${likeValue}
				OR m.username LIKE ${likeValue}
				OR m.display_name LIKE ${likeValue}
				OR m.server_display_name LIKE ${likeValue}
			)`
		: sql``;

	const rows = await db.execute(sql`
		SELECT
			m.id,
			m.discord_member_id,
			m.username,
			m.display_name,
			m.server_display_name,
			m.avatar,
			sv.id AS server_id,
			sv.name AS server_name,
			COALESCE(inv.total, 0) AS inventory_total
		FROM server_members m
		INNER JOIN servers sv ON sv.id = m.server_id
		INNER JOIN bots b ON b.id = sv.bot_id AND b.panel_id = ${Number(panelId)}
		INNER JOIN server_settings ss
			ON ss.server_id = sv.id AND ss.component_name = ${SERVER_SETTINGS.component.public_statistics}
			AND JSON_EXTRACT(ss.settings, '$.enabled') != false
			AND JSON_EXTRACT(ss.settings, '$.items_enabled') = true
		LEFT JOIN (
			SELECT member_id, SUM(quantity) AS total
			FROM server_member_items
			GROUP BY member_id
		) inv ON inv.member_id = m.id
		WHERE 1=1 ${searchClause}
		ORDER BY sv.name ASC, COALESCE(inv.total, 0) DESC, m.updated_at DESC
		LIMIT ${safeLimit}
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function memberServerHasItemsEnabled(memberId: any, panelId: any) {
	await initializeDatabase();
	if (memberId == null || panelId == null) return false;
	const rows = await db.execute(sql`
		SELECT 1
		FROM server_members m
		INNER JOIN servers sv ON sv.id = m.server_id
		INNER JOIN bots b ON b.id = sv.bot_id AND b.panel_id = ${Number(panelId)}
		INNER JOIN server_settings ss
			ON ss.server_id = sv.id AND ss.component_name = ${SERVER_SETTINGS.component.public_statistics}
			AND JSON_EXTRACT(ss.settings, '$.enabled') != false
			AND JSON_EXTRACT(ss.settings, '$.items_enabled') = true
		WHERE m.id = ${Number(memberId)}
		LIMIT 1
	`);
	return ((rows[0] as unknown as any[]) || []).length > 0;
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

export async function getMemberStreak(memberId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMemberStreaks)
		.where(eq(schema.serverMemberStreaks.member_id, Number(memberId)))
		.limit(1);
	return rows[0] || null;
}

export async function ensureMemberStreak(memberId: any) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberStreaks)
		.values({ member_id: Number(memberId), created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { member_id: Number(memberId) } });
	return getMemberStreak(memberId);
}

export async function applyStreakClaim(memberId: any, dayKey: number, freezeMax: number, earnEvery: number) {
	await initializeDatabase();
	const existing = await ensureMemberStreak(memberId);
	const last = existing?.last_claim_day_key == null ? null : Number(existing.last_claim_day_key);
	if (last === dayKey) return { changed: false, streak: Number(existing?.current_streak) || 0, row: existing };

	const gap = last == null ? null : dayKey - last;
	let streak = Number(existing?.current_streak) || 0;
	let freezes = Number(existing?.freezes_available) || 0;
	let freezeUsed = 0;

	if (gap == null || gap === 1) {
		streak += 1;
	} else {
		const missed = (gap ?? 1) - 1;
		if (missed > 0 && freezes >= missed) {
			freezes -= missed;
			freezeUsed = missed;
			streak += 1;
		} else {
			streak = 1;
		}
	}

	const totalClaims = (Number(existing?.total_claims) || 0) + 1;
	if (earnEvery > 0 && totalClaims % earnEvery === 0) freezes = Math.min(freezeMax, freezes + 1);

	const longest = Math.max(Number(existing?.longest_streak) || 0, streak);
	const now = toMySQLDateTime();
	await db
		.update(schema.serverMemberStreaks)
		.set({
			current_streak: streak,
			longest_streak: longest,
			last_claim_day_key: dayKey,
			freezes_available: freezes,
			total_claims: totalClaims,
			updated_at: now as any
		})
		.where(eq(schema.serverMemberStreaks.member_id, Number(memberId)));

	return { changed: true, streak, freezeUsed, row: await getMemberStreak(memberId) };
}

export async function getMemberTasks(memberId: any, dayKey: number, period = 'daily') {
	await initializeDatabase();
	return db
		.select()
		.from(schema.serverMemberTasks)
		.where(
			and(
				eq(schema.serverMemberTasks.member_id, Number(memberId)),
				eq(schema.serverMemberTasks.period, String(period)),
				eq(schema.serverMemberTasks.day_key, Number(dayKey))
			)
		)
		.orderBy(schema.serverMemberTasks.slot);
}

export async function persistMemberTasks(memberId: any, dayKey: number, rows: any[], period = 'daily') {
	await initializeDatabase();
	if (!rows || rows.length === 0) return getMemberTasks(memberId, dayKey, period);
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberTasks)
		.values(
			rows.map((r) => ({
				member_id: Number(memberId),
				period: String(period),
				day_key: Number(dayKey),
				slot: Number(r.slot),
				task_type: String(r.taskType),
				difficulty: String(r.difficulty),
				goal: Number(r.goal) || 1,
				baseline: Number(r.baseline) || 0,
				reward_kind: String(r.rewardKind),
				reward_xp: Number(r.rewardXp) || 0,
				reward_item_id: r.rewardItemId == null ? null : Number(r.rewardItemId),
				created_at: now as any
			})) as any
		)
		.onDuplicateKeyUpdate({ set: { day_key: sql`day_key` } });
	return getMemberTasks(memberId, dayKey, period);
}

export async function claimMemberTask(memberId: any, dayKey: number, slot: number, period = 'daily') {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result: any = await db.execute(
		sql`UPDATE server_member_tasks SET claimed_at = ${now} WHERE member_id = ${Number(memberId)} AND period = ${String(period)} AND day_key = ${Number(dayKey)} AND slot = ${Number(slot)} AND claimed_at IS NULL`
	);
	const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
	return affected > 0;
}

export async function getMemberClaim(memberId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMemberClaims)
		.where(eq(schema.serverMemberClaims.member_id, Number(memberId)))
		.limit(1);
	return rows[0] || null;
}

export async function ensureMemberClaim(memberId: any) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db
		.insert(schema.serverMemberClaims)
		.values({ member_id: Number(memberId), created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { member_id: Number(memberId) } });
	return getMemberClaim(memberId);
}

export async function applyMemberClaim(memberId: any, dayKey: number, cycleDays: number) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const result: any = await db.execute(
		sql`UPDATE server_member_claims
			SET cycle_day = CASE
					WHEN last_claim_day_key IS NULL OR last_claim_day_key < ${Number(dayKey)} - 1 THEN 1
					WHEN cycle_day >= ${cycleDays} THEN 1
					ELSE cycle_day + 1
				END,
				cycles_completed = cycles_completed + IF(cycle_day >= ${cycleDays} AND last_claim_day_key = ${Number(dayKey)} - 1, 1, 0),
				last_claim_day_key = ${Number(dayKey)},
				updated_at = ${now}
			WHERE member_id = ${Number(memberId)} AND (last_claim_day_key IS NULL OR last_claim_day_key < ${Number(dayKey)})`
	);
	const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
	if (affected === 0) return { changed: false, row: await getMemberClaim(memberId) };
	return { changed: true, row: await getMemberClaim(memberId) };
}

export async function countMemberEventsSince(memberId: any, metric: string, sinceMs: number) {
	await initializeDatabase();
	const since = toMySQLDateTime(new Date(sinceMs));
	const id = Number(memberId);

	if (metric === 'gamble_played' || metric === 'gamble_won') {
		const onlyWins = metric === 'gamble_won' ? sql` AND outcome = 'win'` : sql``;
		const rows: any = await db.execute(
			sql`SELECT COUNT(*) AS c FROM server_member_minigame_logs WHERE member_id = ${id} AND created_at >= ${since}${onlyWins}`
		);
		return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
	}

	if (metric === 'xp_gained') {
		const rows: any = await db.execute(
			sql`SELECT COALESCE(SUM(amount), 0) AS c FROM server_member_level_logs WHERE member_id = ${id} AND created_at >= ${since}`
		);
		return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
	}

	if (metric === 'xp_spent') {
		const rows: any = await db.execute(
			sql`SELECT COALESCE(SUM(xp_amount), 0) AS c FROM server_member_item_logs WHERE member_id = ${id} AND created_at >= ${since} AND action = 'buy'`
		);
		return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
	}

	if (metric === 'asset_bought' || metric === 'asset_sold') {
		const act = metric === 'asset_bought' ? 'buy' : 'sell';
		const rows: any = await db.execute(
			sql`SELECT COUNT(*) AS c FROM server_member_asset_logs WHERE member_id = ${id} AND created_at >= ${since} AND action = ${act}`
		);
		return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
	}

	if (metric === 'asset_profit') {
		const rows: any = await db.execute(
			sql`SELECT COALESCE(SUM(GREATEST(net, 0)), 0) AS c FROM server_member_asset_logs WHERE member_id = ${id} AND created_at >= ${since} AND action = 'sell'`
		);
		return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
	}

	const effectMatch = /^use_([a-z]+)$/.exec(String(metric));
	const actionFilter = effectMatch
		? sql`action = ${effectMatch[1]}`
		: metric === 'steal_success'
			? sql`action = 'steal' AND outcome = 'success'`
			: metric === 'item_used'
				? sql`action NOT IN ('buy', 'discard', 'task_reward', 'bounty_collected') AND member_item_id IS NOT NULL`
				: metric === 'item_bought'
					? sql`action = 'buy'`
					: null;

	if (!actionFilter) return 0;

	const rows: any = await db.execute(
		sql`SELECT COUNT(*) AS c FROM server_member_item_logs WHERE member_id = ${id} AND created_at >= ${since} AND ${actionFilter}`
	);
	return Number(rows?.[0]?.[0]?.c ?? rows?.[0]?.c ?? 0) || 0;
}

export async function updateMemberLevelStats(memberId: any, updates: any = {}) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');

	const clauses: any[] = [];

	if (typeof updates.chatIncrement === 'number' && updates.chatIncrement !== 0) clauses.push(sql`chat_total = chat_total + ${updates.chatIncrement}`);
	if (typeof updates.reactionsIncrement === 'number' && updates.reactionsIncrement !== 0)
		clauses.push(sql`reactions_given = GREATEST(0, reactions_given + ${updates.reactionsIncrement})`);
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

export async function claimVoiceRewardWindow(memberId: any, cooldownMs: number) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	const now = toMySQLDateTime();
	const cooldownSeconds = Math.max(0, Math.floor(Number(cooldownMs) / 1000));
	const result = await db.execute(sql`
		UPDATE server_member_levels
		SET voice_rewarded_at = ${now}, updated_at = ${now}
		WHERE member_id = ${Number(memberId)}
			AND (voice_rewarded_at IS NULL OR voice_rewarded_at <= DATE_SUB(${now}, INTERVAL ${cooldownSeconds} SECOND))
	`);
	const affected = (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0;
	return affected > 0;
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

export async function listItems(panelId: any, options: any = {}) {
	await initializeDatabase();
	if (!panelId) throw new Error('panelId is required');
	const conditions: any[] = [eq(schema.items.panel_id, Number(panelId))];
	if (options.enabledOnly) conditions.push(eq(schema.items.enabled, true));
	return db
		.select()
		.from(schema.items)
		.where(and(...conditions))
		.orderBy(asc(schema.items.sort_order), asc(schema.items.id));
}

export async function getItem(itemId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.items)
		.where(eq(schema.items.id, Number(itemId)))
		.limit(1);
	return rows[0] || null;
}

export async function setItemEnabled(itemId: any, enabled: boolean) {
	await initializeDatabase();
	await db
		.update(schema.items)
		.set({ enabled: !!enabled })
		.where(eq(schema.items.id, Number(itemId)));
	return true;
}

export async function createItem(panelId: any, data: any = {}) {
	await initializeDatabase();
	if (!panelId) throw new Error('panelId is required');
	const now = toMySQLDateTime();
	const result: any = await db.insert(schema.items).values({
		panel_id: Number(panelId),
		name: String(data.name ?? ''),
		effect_type: String(data.effect_type ?? ''),
		description: data.description ?? null,
		cost: Number(data.cost ?? 0),
		config: data.config ?? {},
		enabled: data.enabled === undefined ? true : !!data.enabled,
		usable: data.usable === undefined ? true : !!data.usable,
		available_from: data.available_from ?? null,
		available_to: data.available_to ?? null,
		recurring_schedule: data.recurring_schedule ?? null,
		sort_order: Number(data.sort_order ?? 0),
		created_at: now as any,
		updated_at: now as any
	});
	const insertId = result?.insertId ?? result?.[0]?.insertId;
	return getItem(insertId);
}

export async function updateItem(itemId: any, data: any = {}) {
	await initializeDatabase();
	if (!itemId) throw new Error('itemId is required');
	const set: any = { updated_at: toMySQLDateTime() as any };
	if (data.name !== undefined) set.name = String(data.name);
	if (data.effect_type !== undefined) set.effect_type = String(data.effect_type);
	if (data.description !== undefined) set.description = data.description ?? null;
	if (data.cost !== undefined) set.cost = Number(data.cost);
	if (data.config !== undefined) set.config = data.config ?? {};
	if (data.enabled !== undefined) set.enabled = !!data.enabled;
	if (data.usable !== undefined) set.usable = !!data.usable;
	if (data.available_from !== undefined) set.available_from = data.available_from ?? null;
	if (data.available_to !== undefined) set.available_to = data.available_to ?? null;
	if (data.recurring_schedule !== undefined) set.recurring_schedule = data.recurring_schedule ?? null;
	if (data.sort_order !== undefined) set.sort_order = Number(data.sort_order);
	await db
		.update(schema.items)
		.set(set)
		.where(eq(schema.items.id, Number(itemId)));
	return getItem(itemId);
}

export async function deleteItem(itemId: any) {
	await initializeDatabase();
	if (!itemId) throw new Error('itemId is required');
	await db.delete(schema.items).where(eq(schema.items.id, Number(itemId)));
	return true;
}

export async function getMemberInventory(memberId: any) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	const rows = await db.execute(sql`
		SELECT smi.*, bi.name, bi.effect_type, bi.description, bi.cost, bi.config, bi.usable, bi.enabled
		FROM server_member_items smi
		INNER JOIN items bi ON bi.id = smi.item_id
		WHERE smi.member_id = ${Number(memberId)} AND smi.quantity > 0
		ORDER BY smi.updated_at DESC
	`);
	return rows[0] as unknown as any[];
}

export async function getMemberItem(memberItemId: any) {
	await initializeDatabase();
	const rows = await db
		.select()
		.from(schema.serverMemberItems)
		.where(eq(schema.serverMemberItems.id, Number(memberItemId)))
		.limit(1);
	return rows[0] || null;
}

export async function grantMemberItem(memberId: any, itemId: any, quantity = 1) {
	await initializeDatabase();
	if (!memberId || !itemId) throw new Error('memberId and itemId are required');
	const now = toMySQLDateTime();
	const qty = Math.max(1, Number(quantity) || 1);
	await db
		.insert(schema.serverMemberItems)
		.values({ member_id: Number(memberId), item_id: Number(itemId), quantity: qty, acquired_at: now as any, created_at: now as any, updated_at: now as any })
		.onDuplicateKeyUpdate({ set: { quantity: sql`quantity + ${qty}`, updated_at: now as any } });
	const rows = await db
		.select()
		.from(schema.serverMemberItems)
		.where(and(eq(schema.serverMemberItems.member_id, Number(memberId)), eq(schema.serverMemberItems.item_id, Number(itemId))))
		.limit(1);
	return rows[0] || null;
}

export async function consumeMemberItem(memberItemId: any, quantity = 1) {
	await initializeDatabase();
	if (!memberItemId) throw new Error('memberItemId is required');
	const id = Number(memberItemId);
	const qty = Math.max(1, Number(quantity) || 1);
	const result: any = await db.execute(
		sql`UPDATE server_member_items SET quantity = quantity - ${qty}, updated_at = ${toMySQLDateTime()} WHERE id = ${id} AND quantity >= ${qty}`
	);
	const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
	return affected > 0;
}

export async function backfillItemLogItemIds() {
	await initializeDatabase();
	const result: any = await db.execute(sql`
		UPDATE server_member_item_logs sml
		JOIN server_member_items smi ON smi.id = sml.member_item_id
		SET sml.item_id = smi.item_id
		WHERE sml.item_id IS NULL AND sml.member_item_id IS NOT NULL
	`);
	return result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
}

export async function purgeDepletedMemberItems() {
	await initializeDatabase();
	const result: any = await db.execute(sql`
		DELETE smi FROM server_member_items smi
		WHERE smi.quantity <= 0
		  AND smi.updated_at <= UTC_TIMESTAMP() - INTERVAL 60 SECOND
		  AND NOT EXISTS (
		    SELECT 1 FROM server_member_item_actives a
		    WHERE a.member_item_id = smi.id AND a.expires_at > UTC_TIMESTAMP()
		  )
	`);
	return result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
}

export async function addMemberItemActive(memberItemId: any, data: any = {}) {
	await initializeDatabase();
	if (!memberItemId) throw new Error('memberItemId is required');
	const now = toMySQLDateTime();
	const result: any = await db.insert(schema.serverMemberItemActives).values({
		member_item_id: Number(memberItemId),
		effect_value: String(data.effect_value ?? 0) as any,
		beneficiary_member_id: data.beneficiary_member_id != null ? Number(data.beneficiary_member_id) : null,
		target_member_id: data.target_member_id != null ? Number(data.target_member_id) : null,
		expires_at: toMySQLDateTime(data.expires_at) as any,
		created_at: now as any
	});
	const insertId = result?.insertId ?? result?.[0]?.insertId;
	return insertId;
}

export async function getActiveEffectsForMember(memberId: any) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	const rows = await db.execute(sql`
		SELECT sma.id, sma.member_item_id, sma.effect_value, sma.beneficiary_member_id, sma.target_member_id, sma.expires_at,
		       bi.id AS item_id, bi.name, bi.effect_type, bi.config,
		       smi.member_id AS owner_member_id,
		       ben.server_display_name AS beneficiary_server_display_name, ben.display_name AS beneficiary_display_name, ben.username AS beneficiary_username,
		       tgt.server_display_name AS target_server_display_name, tgt.display_name AS target_display_name, tgt.username AS target_username
		FROM server_member_item_actives sma
		INNER JOIN server_member_items smi ON smi.id = sma.member_item_id
		INNER JOIN items bi ON bi.id = smi.item_id
		LEFT JOIN server_members ben ON ben.id = sma.beneficiary_member_id
		LEFT JOIN server_members tgt ON tgt.id = sma.target_member_id
		WHERE sma.expires_at > UTC_TIMESTAMP()
		  AND (
		    (sma.target_member_id IS NULL AND smi.member_id = ${Number(memberId)})
		    OR sma.target_member_id = ${Number(memberId)}
		    OR sma.beneficiary_member_id = ${Number(memberId)}
		  )
	`);
	return rows[0] as unknown as any[];
}

export async function getActiveLeechByBeneficiary(beneficiaryMemberId: any) {
	await initializeDatabase();
	if (!beneficiaryMemberId) return null;
	const rows = await db.execute(sql`
		SELECT sma.id, sma.target_member_id, sma.expires_at,
		       tgt.server_display_name AS target_server_display_name, tgt.display_name AS target_display_name, tgt.username AS target_username
		FROM server_member_item_actives sma
		INNER JOIN server_member_items smi ON smi.id = sma.member_item_id
		INNER JOIN items bi ON bi.id = smi.item_id
		LEFT JOIN server_members tgt ON tgt.id = sma.target_member_id
		WHERE bi.effect_type = 'leech'
		  AND sma.beneficiary_member_id = ${Number(beneficiaryMemberId)}
		  AND sma.expires_at > UTC_TIMESTAMP()
		ORDER BY sma.expires_at DESC
		LIMIT 1
	`);
	return (rows[0] as unknown as any[])?.[0] ?? null;
}

export async function clearExpiredMemberItemActives() {
	await initializeDatabase();
	await db.execute(sql`DELETE FROM server_member_item_actives WHERE expires_at <= UTC_TIMESTAMP()`);
	return true;
}

export async function getNewlyExpiredEffects(botId: any, limit = 100) {
	await initializeDatabase();
	if (!botId) return [] as any[];
	const rows = await db.execute(sql`
		SELECT sma.id, sma.effect_value, sma.expires_at, sma.beneficiary_member_id, sma.target_member_id,
		       bi.effect_type, bi.name AS item_name,
		       sm.id AS member_id, sm.discord_member_id, s.discord_server_id,
		       tgt.discord_member_id AS target_discord_member_id,
		       tgt.server_display_name AS target_server_display_name,
		       tgt.display_name AS target_display_name,
		       tgt.username AS target_username,
		       (
		         SELECT l.actor_disguised
		         FROM server_member_item_logs l
		         WHERE l.member_item_id = sma.member_item_id AND l.action = bi.effect_type
		         ORDER BY l.created_at DESC, l.id DESC
		         LIMIT 1
		       ) AS disguised_at_activation
		FROM server_member_item_actives sma
		INNER JOIN server_member_items smi ON smi.id = sma.member_item_id
		INNER JOIN items bi ON bi.id = smi.item_id
		INNER JOIN server_members sm ON sm.id = smi.member_id
		INNER JOIN servers s ON s.id = sm.server_id
		LEFT JOIN server_members tgt ON tgt.id = sma.target_member_id
		WHERE sma.expiry_notified = FALSE
		  AND sma.expires_at <= UTC_TIMESTAMP()
		  AND s.bot_id = ${Number(botId)}
		ORDER BY sma.expires_at ASC
		LIMIT ${Number(limit)}
	`);
	return rows[0] as unknown as any[];
}

export async function markEffectExpiryNotified(ids: any[]) {
	await initializeDatabase();
	const list = (Array.isArray(ids) ? ids : []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
	if (list.length === 0) return 0;
	await db.execute(
		sql`UPDATE server_member_item_actives SET expiry_notified = TRUE WHERE id IN (${sql.join(
			list.map((n) => sql`${n}`),
			sql`, `
		)})`
	);
	return list.length;
}

export async function recordItemNotification(memberId: any, notificationType: string, notifiedForAt: any) {
	await initializeDatabase();
	if (!memberId || !notificationType || !notifiedForAt) return false;
	try {
		const result: any = await db.insert(schema.serverMemberItemNotifications).values({
			member_id: Number(memberId),
			notification_type: String(notificationType),
			notified_for_at: toMySQLDateTime(notifiedForAt) as any,
			created_at: toMySQLDateTime() as any
		});
		const affected = result?.affectedRows ?? result?.[0]?.affectedRows ?? 1;
		return Number(affected) > 0;
	} catch (_) {
		return false;
	}
}

export async function getRecentVictimHits(botId: any, sinceMinutes = 720) {
	await initializeDatabase();
	if (!botId) return [] as any[];
	const rows = await db.execute(sql`
		SELECT sml.target_member_id AS member_id, sml.action AS action, MAX(sml.created_at) AS last_hit,
		       sm.discord_member_id, s.discord_server_id
		FROM server_member_item_logs sml
		INNER JOIN server_members sm ON sm.id = sml.target_member_id
		INNER JOIN servers s ON s.id = sm.server_id
		WHERE sml.action IN ('steal', 'bomb')
		  AND sml.outcome = 'success'
		  AND sml.immunity_cleared = 0
		  AND sml.target_member_id IS NOT NULL
		  AND sml.created_at >= (UTC_TIMESTAMP() - INTERVAL ${Number(sinceMinutes)} MINUTE)
		  AND s.bot_id = ${Number(botId)}
		GROUP BY sml.target_member_id, sml.action, sm.discord_member_id, s.discord_server_id
	`);
	return rows[0] as unknown as any[];
}

export async function getRecentAttackerActions(botId: any, sinceMinutes = 720) {
	await initializeDatabase();
	if (!botId) return [] as any[];
	const rows = await db.execute(sql`
		SELECT smi.member_id AS member_id, sml.action AS action, MAX(sml.created_at) AS last_attack,
		       sm.discord_member_id, s.discord_server_id
		FROM server_member_item_logs sml
		INNER JOIN server_member_items smi ON smi.id = sml.member_item_id
		INNER JOIN server_members sm ON sm.id = smi.member_id
		INNER JOIN servers s ON s.id = sm.server_id
		WHERE sml.action IN ('steal', 'bomb')
		  AND sml.created_at >= (UTC_TIMESTAMP() - INTERVAL ${Number(sinceMinutes)} MINUTE)
		  AND s.bot_id = ${Number(botId)}
		GROUP BY smi.member_id, sml.action, sm.discord_member_id, s.discord_server_id
	`);
	return rows[0] as unknown as any[];
}

export async function getRecentInsuranceActivations(botId: any, sinceMinutes = 2880) {
	await initializeDatabase();
	if (!botId) return [] as any[];
	const rows = await db.execute(sql`
		SELECT smi.member_id AS member_id, MAX(sml.created_at) AS last_activation,
		       sm.discord_member_id, s.discord_server_id
		FROM server_member_item_logs sml
		INNER JOIN server_member_items smi ON smi.id = sml.member_item_id
		INNER JOIN items bi ON bi.id = smi.item_id
		INNER JOIN server_members sm ON sm.id = smi.member_id
		INNER JOIN servers s ON s.id = sm.server_id
		WHERE sml.action = 'insurance' AND sml.outcome = 'success' AND bi.effect_type = 'insurance'
		  AND sml.created_at >= (UTC_TIMESTAMP() - INTERVAL ${Number(sinceMinutes)} MINUTE)
		  AND s.bot_id = ${Number(botId)}
		GROUP BY smi.member_id, sm.discord_member_id, s.discord_server_id
	`);
	return rows[0] as unknown as any[];
}

export async function expireMemberItemActive(activeId: any) {
	await initializeDatabase();
	if (!activeId) return false;
	await db.delete(schema.serverMemberItemActives).where(eq(schema.serverMemberItemActives.id, Number(activeId)));
	return true;
}

export async function endMemberItemActiveNow(activeId: any) {
	await initializeDatabase();
	if (!activeId) return false;
	await db
		.update(schema.serverMemberItemActives)
		.set({ expires_at: toMySQLDateTime() as any })
		.where(eq(schema.serverMemberItemActives.id, Number(activeId)));
	return true;
}

export async function logMemberItemAction(memberId: any, data: any = {}) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	let itemId = data.item_id != null ? Number(data.item_id) : null;
	if (itemId == null && data.member_item_id != null) {
		const rows = await db.execute(sql`SELECT item_id FROM server_member_items WHERE id = ${Number(data.member_item_id)}`);
		const row = (rows[0] as unknown as any[])[0];
		if (row?.item_id != null) itemId = Number(row.item_id);
	}
	await db.insert(schema.serverMemberItemLogs).values({
		member_id: Number(memberId),
		member_item_id: data.member_item_id != null ? Number(data.member_item_id) : null,
		target_member_id: data.target_member_id != null ? Number(data.target_member_id) : null,
		item_id: itemId,
		action: String(data.action ?? ''),
		xp_amount: Number(data.xp_amount ?? 0),
		outcome: String(data.outcome ?? ''),
		rate_percent: data.rate_percent != null ? (String(data.rate_percent) as any) : null,
		luck_percent: data.luck_percent != null ? (String(data.luck_percent) as any) : null,
		actor_disguised: data.actor_disguised ? 1 : 0,
		created_at: toMySQLDateTime() as any
	});
	return true;
}

export async function logMinigameAction(memberId: any, data: any = {}) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	await db.insert(schema.serverMemberMinigameLogs).values({
		member_id: Number(memberId),
		game: String(data.game ?? 'gamble'),
		multiplier: String(data.multiplier ?? 2) as any,
		wager: Number(data.wager ?? 0),
		payout: Number(data.payout ?? 0),
		xp_amount: Number(data.xp_amount ?? 0),
		outcome: String(data.outcome ?? ''),
		chance: data.chance != null ? (String(data.chance) as any) : null,
		luck_percent: data.luck_percent != null ? (String(data.luck_percent) as any) : null,
		created_at: toMySQLDateTime() as any
	});
	return true;
}

export async function recordLevelFriends(actorMemberId: any, friendDiscordIds: string[], perFriendXp = 0) {
	await initializeDatabase();
	const actorId = Number(actorMemberId);
	if (!actorId || !Array.isArray(friendDiscordIds) || friendDiscordIds.length === 0) return;

	const ids = friendDiscordIds.map((x) => String(x)).filter(Boolean);
	if (ids.length === 0) return;

	const actorRow = await db.execute(sql`SELECT server_id FROM server_members WHERE id = ${actorId} LIMIT 1`);
	const serverId = Number(((actorRow[0] as unknown as any[]) || [])[0]?.server_id);
	if (!Number.isFinite(serverId)) return;

	const rows = await db.execute(sql`
		SELECT id FROM server_members WHERE server_id = ${serverId} AND discord_member_id IN (${sql.join(ids, sql`, `)})
	`);
	const friendIds = ((rows[0] as unknown as any[]) || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n !== actorId);
	if (friendIds.length === 0) return;

	const xp = Math.max(0, Math.floor(Number(perFriendXp) || 0));
	const now = toMySQLDateTime();
	for (const fid of friendIds) {
		const a = Math.min(actorId, fid);
		const b = Math.max(actorId, fid);
		await db
			.execute(
				sql`
			INSERT INTO server_member_level_friends (member_a_id, member_b_id, ticks, xp_together, updated_at)
			VALUES (${a}, ${b}, 1, ${xp}, ${now})
			ON DUPLICATE KEY UPDATE ticks = ticks + 1, xp_together = xp_together + ${xp}, updated_at = ${now}
		`
			)
			.catch(() => null);
	}
}

export async function getMemberLevelFriends(memberId: any, limit = 5) {
	await initializeDatabase();
	const mid = Number(memberId);
	if (!mid) return [] as any[];
	const nameExpr = sql`COALESCE(NULLIF(m.server_display_name, ''), NULLIF(m.display_name, ''), m.username)`;
	const rows = await db.execute(sql`
		SELECT
			CASE WHEN t.member_a_id = ${mid} THEN t.member_b_id ELSE t.member_a_id END AS buddy_id,
			${nameExpr} AS name, m.avatar AS avatar, t.ticks AS ticks, t.xp_together AS xp
		FROM server_member_level_friends t
		INNER JOIN server_members m ON m.id = CASE WHEN t.member_a_id = ${mid} THEN t.member_b_id ELSE t.member_a_id END
		WHERE t.member_a_id = ${mid} OR t.member_b_id = ${mid}
		ORDER BY t.ticks DESC
		LIMIT ${Number(limit) || 5}
	`);
	return ((rows[0] as unknown as any[]) || []).map((r) => ({
		name: r.name || 'a member',
		avatar: r.avatar ?? null,
		ticks: Number(r.ticks) || 0,
		xp: Number(r.xp) || 0
	}));
}

export async function getMemberMinigameHistory(memberId: any, limit = 600) {
	await initializeDatabase();
	if (!memberId) return [] as any[];
	const lim = Number(limit) > 0 ? sql`LIMIT ${Number(limit)}` : sql``;
	const rows = await db.execute(sql`
		SELECT id, game, multiplier, wager, payout, xp_amount, outcome, chance, luck_percent, created_at
		FROM server_member_minigame_logs
		WHERE member_id = ${Number(memberId)}
		ORDER BY created_at DESC
		${lim}
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function getMinigamesLeaderboard(serverId: any, since: Date | null) {
	await initializeDatabase();
	if (!serverId) return [] as any[];

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const hideDisguised = disguisedIds.length > 0 ? notInArray(schema.serverMembers.id, disguisedIds) : undefined;

	const rows = await db
		.select({
			discord_member_id: schema.serverMembers.discord_member_id,
			username: schema.serverMembers.username,
			display_name: schema.serverMembers.display_name,
			server_display_name: schema.serverMembers.server_display_name,
			avatar: schema.serverMembers.avatar,
			level: schema.serverMemberLevels.level,
			minigame_net: sql<number>`COALESCE(SUM(${schema.serverMemberMinigameLogs.xp_amount}), 0)`,
			minigame_wins: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberMinigameLogs.outcome} = 'win' THEN 1 ELSE 0 END), 0)`,
			minigame_total: sql<number>`COUNT(${schema.serverMemberMinigameLogs.id})`,
			minigame_big_win: sql<number>`COALESCE(MAX(${schema.serverMemberMinigameLogs.xp_amount}), 0)`
		})
		.from(schema.serverMembers)
		.leftJoin(
			schema.serverMemberMinigameLogs,
			and(
				eq(schema.serverMemberMinigameLogs.member_id, schema.serverMembers.id),
				...(since ? [sql`${schema.serverMemberMinigameLogs.created_at} >= ${toMySQLDateTime(since)}`] : [])
			)
		)
		.leftJoin(schema.serverMemberLevels, eq(schema.serverMemberLevels.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), ...(hideDisguised ? [hideDisguised] : [])))
		.groupBy(
			schema.serverMembers.id,
			schema.serverMembers.discord_member_id,
			schema.serverMembers.username,
			schema.serverMembers.display_name,
			schema.serverMembers.server_display_name,
			schema.serverMembers.avatar,
			schema.serverMemberLevels.level
		);

	return rows as any[];
}

export async function logMemberLevelGain(memberId: any, data: any = {}) {
	await initializeDatabase();
	if (!memberId) return false;
	const amount = Math.floor(Number(data.amount) || 0);
	if (amount <= 0) return false;
	await db.insert(schema.serverMemberLevelLogs).values({
		member_id: Number(memberId),
		source: String(data.source ?? 'unknown').slice(0, 24),
		amount,
		total_xp: data.total_xp != null ? Number(data.total_xp) : null,
		level: data.level != null ? Number(data.level) : null,
		rank: data.rank != null ? Number(data.rank) : null,
		multiplier: data.multiplier != null ? (String(data.multiplier) as any) : null,
		skim_percent: data.skim_percent != null ? Number(data.skim_percent) : null,
		friend_percent: data.friend_percent != null ? Number(data.friend_percent) : null,
		luck_percent: data.luck_percent != null ? Number(data.luck_percent) : null,
		created_at: toMySQLDateTime() as any
	});
	return true;
}

export async function getMemberLevelHistory(memberId: any, limit = 200) {
	await initializeDatabase();
	if (!memberId) return [] as any[];
	const lim = Number(limit) > 0 ? sql`LIMIT ${Number(limit)}` : sql``;
	const rows = await db.execute(sql`
		SELECT id, source, amount, total_xp, level, \`rank\`, multiplier, skim_percent, friend_percent, luck_percent, created_at
		FROM server_member_level_logs
		WHERE member_id = ${Number(memberId)}
		ORDER BY created_at DESC, id DESC
		${lim}
	`);
	return rows[0] as unknown as any[];
}

export async function getMemberItemHistory(memberId: any, limit = 200) {
	await initializeDatabase();
	if (!memberId) return [] as any[];
	const rows = await db.execute(sql`
		SELECT
			sml.id, sml.action, sml.xp_amount, sml.outcome, sml.rate_percent, sml.luck_percent, sml.actor_disguised, sml.created_at,
			COALESCE(bi.name, bi2.name) AS item_name,
			COALESCE(bi.effect_type, bi2.effect_type) AS effect_type,
			CASE WHEN sml.member_id = ${Number(memberId)} THEN 'outgoing' ELSE 'incoming' END AS direction,
			tgt.username AS target_username, tgt.display_name AS target_display_name, tgt.server_display_name AS target_server_display_name,
			act.username AS actor_username, act.display_name AS actor_display_name, act.server_display_name AS actor_server_display_name
		FROM server_member_item_logs sml
		LEFT JOIN items bi ON bi.id = sml.item_id
		LEFT JOIN server_member_items smi ON smi.id = sml.member_item_id
		LEFT JOIN items bi2 ON bi2.id = smi.item_id
		LEFT JOIN server_members tgt ON tgt.id = sml.target_member_id
		LEFT JOIN server_members act ON act.id = sml.member_id
		WHERE (
			sml.member_id = ${Number(memberId)}
			OR (sml.target_member_id = ${Number(memberId)} AND NOT (sml.action = 'spy' AND sml.outcome = 'success'))
		)
		ORDER BY sml.created_at DESC, sml.id DESC
		${Number(limit) > 0 ? sql`LIMIT ${Number(limit)}` : sql``}
	`);
	return rows[0] as unknown as any[];
}

export async function getLastActionByActor(memberId: any, action: string) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	const rows = await db.execute(sql`
		SELECT sml.created_at
		FROM server_member_item_logs sml
		WHERE sml.member_id = ${Number(memberId)} AND sml.action = ${String(action)}
		ORDER BY sml.created_at DESC
		LIMIT 1
	`);
	const row = (rows[0] as unknown as any[])[0];
	return row ? parseMySQLDateTimeUtc(row.created_at) : null;
}

export async function getLastAttackActionByActor(memberId: any, actions: string[]) {
	await initializeDatabase();
	if (!memberId) throw new Error('memberId is required');
	const list = (Array.isArray(actions) ? actions : [actions]).map((a) => String(a));
	if (list.length === 0) return null;
	const rows = await db.execute(sql`
		SELECT sml.created_at
		FROM server_member_item_logs sml
		WHERE sml.member_id = ${Number(memberId)} AND sml.action IN (${sql.join(
			list.map((a) => sql`${a}`),
			sql`, `
		)})
		ORDER BY sml.created_at DESC
		LIMIT 1
	`);
	const row = (rows[0] as unknown as any[])[0];
	return row ? parseMySQLDateTimeUtc(row.created_at) : null;
}

export async function getLastActionAgainstTarget(targetMemberId: any, actions: string[]) {
	await initializeDatabase();
	if (!targetMemberId) throw new Error('targetMemberId is required');
	const list = (Array.isArray(actions) ? actions : [actions]).map((a) => String(a));
	if (list.length === 0) return null;
	const rows = await db.execute(sql`
		SELECT created_at
		FROM server_member_item_logs
		WHERE target_member_id = ${Number(targetMemberId)} AND outcome = 'success' AND immunity_cleared = 0 AND action IN (${sql.join(
			list.map((a) => sql`${a}`),
			sql`, `
		)})
		ORDER BY created_at DESC
		LIMIT 1
	`);
	const row = (rows[0] as unknown as any[])[0];
	return row ? parseMySQLDateTimeUtc(row.created_at) : null;
}

export async function clearImmunityForMember(targetMemberId: any) {
	await initializeDatabase();
	if (!targetMemberId) return 0;
	const result: any = await db.execute(sql`
		UPDATE server_member_item_logs
		SET immunity_cleared = 1
		WHERE target_member_id = ${Number(targetMemberId)}
		  AND outcome = 'success'
		  AND immunity_cleared = 0
		  AND action IN ('steal', 'bomb')
	`);
	return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0) || 0;
}

export async function placeBounty(targetMemberId: any, placedByMemberId: any, amount: any) {
	await initializeDatabase();
	if (!targetMemberId) throw new Error('targetMemberId is required');
	await db.insert(schema.serverMemberItemBounties).values({
		target_member_id: Number(targetMemberId),
		placed_by_member_id: placedByMemberId != null ? Number(placedByMemberId) : null,
		amount: Number(amount) || 0,
		collected: false,
		created_at: toMySQLDateTime() as any
	});
	return true;
}

export async function getActiveBountyTotal(targetMemberId: any) {
	await initializeDatabase();
	const rows = await db.execute(
		sql`SELECT COALESCE(SUM(amount), 0) AS total FROM server_member_item_bounties WHERE target_member_id = ${Number(targetMemberId)} AND collected = FALSE`
	);
	const row = (rows[0] as unknown as any[])[0];
	return Number(row?.total ?? 0) || 0;
}

export async function collectBounties(targetMemberId: any) {
	await initializeDatabase();
	if (!targetMemberId) return 0;
	const total = await getActiveBountyTotal(targetMemberId);
	if (total <= 0) return 0;
	await db.execute(sql`UPDATE server_member_item_bounties SET collected = TRUE WHERE target_member_id = ${Number(targetMemberId)} AND collected = FALSE`);
	return total;
}

export async function getDistinctHeldAssetIds(assetType?: string) {
	await initializeDatabase();
	if (assetType) {
		const rows = await db.execute(sql`SELECT DISTINCT asset_id FROM server_member_assets WHERE asset_type = ${String(assetType)}`);
		return (rows[0] as unknown as any[]) || [];
	}
	const rows = await db.execute(sql`SELECT DISTINCT asset_type, asset_id FROM server_member_assets`);
	return (rows[0] as unknown as any[]) || [];
}

export async function logAssetEvent(data: {
	member_id: number;
	action: 'buy' | 'sell';
	asset_type: string;
	asset_id: string;
	symbol: string;
	asset_name: string;
	asset_image: string | null;
	xp_amount: number;
	price: number | string;
	net?: number;
}) {
	await initializeDatabase();
	await db.insert(schema.serverMemberAssetLogs).values({
		member_id: Number(data.member_id),
		action: data.action,
		asset_type: String(data.asset_type),
		asset_id: String(data.asset_id),
		symbol: String(data.symbol),
		asset_name: String(data.asset_name),
		asset_image: data.asset_image != null ? String(data.asset_image) : null,
		xp_amount: Number(data.xp_amount) || 0,
		price: String(data.price ?? 0) as any,
		net: Number(data.net) || 0,
		created_at: toMySQLDateTime() as any
	});
	return true;
}

export async function openAssetPosition(data: {
	member_id: number;
	asset_type: string;
	asset_id: string;
	symbol: string;
	asset_name: string;
	asset_image: string | null;
	xp_invested: number;
	buy_price: number;
}) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	const [result] = await db.insert(schema.serverMemberAssets).values({
		member_id: Number(data.member_id),
		asset_type: String(data.asset_type),
		asset_id: String(data.asset_id),
		symbol: String(data.symbol),
		asset_name: String(data.asset_name),
		asset_image: data.asset_image != null ? String(data.asset_image) : null,
		xp_invested: Number(data.xp_invested) || 0,
		buy_price: String(data.buy_price) as any,
		opened_at: now as any,
		created_at: now as any,
		updated_at: now as any
	});
	const id = (result as any)?.insertId ?? null;
	return id ? getAssetPosition(id) : null;
}

export async function getAssetPosition(positionId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`SELECT * FROM server_member_assets WHERE id = ${Number(positionId)} LIMIT 1`);
	return ((rows[0] as unknown as any[]) || [])[0] ?? null;
}

export async function getOpenAssetPositions(memberId: any) {
	await initializeDatabase();
	const rows = await db.execute(sql`SELECT * FROM server_member_assets WHERE member_id = ${Number(memberId)} ORDER BY opened_at DESC`);
	return (rows[0] as unknown as any[]) || [];
}

export async function getOpenAssetPosition(memberId: any, assetType: string, assetId: string) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT * FROM server_member_assets
		WHERE member_id = ${Number(memberId)} AND asset_type = ${String(assetType)} AND asset_id = ${String(assetId)}
		LIMIT 1
	`);
	return ((rows[0] as unknown as any[]) || [])[0] ?? null;
}

export async function mergeAssetPosition(positionId: any, data: { xp_invested: number; buy_price: number }) {
	await initializeDatabase();
	const now = toMySQLDateTime();
	await db.execute(sql`
		UPDATE server_member_assets
		SET xp_invested = ${Number(data.xp_invested) || 0}, buy_price = ${String(data.buy_price)}, updated_at = ${now}
		WHERE id = ${Number(positionId)}
	`);
	return true;
}

export async function getMemberAssetHistory(memberId: any, limit = 600) {
	await initializeDatabase();
	const rows = await db.execute(sql`
		SELECT id, action, asset_type, asset_id, symbol, asset_name, asset_image, xp_amount, price, net, created_at
		FROM server_member_asset_logs
		WHERE member_id = ${Number(memberId)}
		ORDER BY created_at DESC
		${Number(limit) > 0 ? sql`LIMIT ${Number(limit)}` : sql``}
	`);
	return (rows[0] as unknown as any[]) || [];
}

export async function getServerEconomyStats(serverId: any, priceMap: Record<string, { price: number }> = {}) {
	await initializeDatabase();
	const sid = Number(serverId);

	const [posRows, assetLogRows, minigameRows, itemRows] = await Promise.all([
		db.execute(sql`
			SELECT a.asset_type, a.asset_id, a.xp_invested, a.buy_price, a.member_id
			FROM server_member_assets a INNER JOIN server_members sm ON sm.id = a.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COALESCE(SUM(CASE WHEN al.action = 'buy' THEN al.xp_amount ELSE 0 END), 0) AS buy_volume,
				COALESCE(SUM(CASE WHEN al.action = 'sell' THEN al.xp_amount ELSE 0 END), 0) AS sell_volume,
				COALESCE(SUM(CASE WHEN al.action = 'sell' THEN al.net ELSE 0 END), 0) AS realized_net,
				COUNT(*) AS trade_count
			FROM server_member_asset_logs al INNER JOIN server_members sm ON sm.id = al.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COALESCE(SUM(ml.wager), 0) AS wagered,
				COALESCE(SUM(ml.payout), 0) AS paid_out,
				COALESCE(SUM(ml.xp_amount), 0) AS net,
				COALESCE(SUM(CASE WHEN ml.outcome = 'win' THEN 1 ELSE 0 END), 0) AS wins,
				COUNT(*) AS plays,
				COALESCE(MAX(CASE WHEN ml.outcome = 'win' THEN ml.payout ELSE 0 END), 0) AS biggest_win
			FROM server_member_minigame_logs ml INNER JOIN server_members sm ON sm.id = ml.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COALESCE(SUM(CASE WHEN il.action = 'steal' AND il.outcome = 'success' THEN il.xp_amount ELSE 0 END), 0) AS stolen,
				COALESCE(SUM(CASE WHEN il.action = 'bomb' AND il.outcome = 'success' THEN il.xp_amount ELSE 0 END), 0) AS bombed,
				COALESCE(SUM(CASE WHEN il.action = 'gift' THEN il.xp_amount ELSE 0 END), 0) AS gifted,
				COALESCE(SUM(CASE WHEN il.action = 'steal' THEN 1 ELSE 0 END), 0) AS steal_attempts,
				COALESCE(SUM(CASE WHEN il.action = 'bomb' THEN 1 ELSE 0 END), 0) AS bomb_attempts,
				COALESCE(SUM(CASE WHEN il.action = 'spy' THEN 1 ELSE 0 END), 0) AS spies,
				COALESCE(SUM(CASE WHEN il.action = 'bounty' THEN 1 ELSE 0 END), 0) AS bounties_placed,
				COALESCE(MAX(CASE WHEN il.action = 'steal' AND il.outcome = 'success' THEN il.xp_amount ELSE 0 END), 0) AS biggest_steal,
				COALESCE(SUM(CASE WHEN il.action = 'buy' THEN 1 ELSE 0 END), 0) AS buys,
				COALESCE(SUM(CASE WHEN il.action = 'buy' THEN il.xp_amount ELSE 0 END), 0) AS buy_spend,
				COALESCE(SUM(CASE WHEN il.action = 'gift' THEN 1 ELSE 0 END), 0) AS gifts,
				COALESCE(SUM(CASE WHEN il.action = 'discard' THEN 1 ELSE 0 END), 0) AS discards,
				COALESCE(SUM(CASE WHEN il.action NOT IN ('buy','discard','steal','bomb','gift','spy','bounty') THEN 1 ELSE 0 END), 0) AS activations,
				COALESCE(SUM(CASE WHEN il.action = 'steal' AND il.outcome = 'caught' THEN 1 ELSE 0 END), 0) AS steals_caught,
				COALESCE(SUM(CASE WHEN il.action = 'steal' AND il.outcome = 'success' THEN 1 ELSE 0 END), 0) AS steals_landed,
				COUNT(DISTINCT CASE WHEN il.action = 'buy' THEN il.item_id END) AS distinct_items_bought
			FROM server_member_item_logs il INNER JOIN server_members sm ON sm.id = il.member_id
			WHERE sm.server_id = ${sid}
		`)
	]);

	const positions = (posRows[0] as unknown as any[]) || [];
	let invested = 0;
	let marketValue = 0;
	const traders = new Set<number>();
	for (const p of positions) {
		const xpInv = Number(p.xp_invested) || 0;
		const buy = Number(p.buy_price) || 0;
		const live = priceMap[`${p.asset_type}:${p.asset_id}`];
		const price = Number(live?.price) > 0 ? Number(live.price) : buy;
		invested += xpInv;
		marketValue += buy > 0 ? Math.round(xpInv * (price / buy)) : xpInv;
		traders.add(Number(p.member_id));
	}

	const al = (assetLogRows[0] as unknown as any[])[0] || {};
	const mg = (minigameRows[0] as unknown as any[])[0] || {};
	const it = (itemRows[0] as unknown as any[])[0] || {};

	return {
		assets_invested: invested,
		assets_market_value: marketValue,
		assets_unrealized_net: marketValue - invested,
		assets_open_positions: positions.length,
		assets_traders: traders.size,
		assets_buy_volume: Number(al.buy_volume) || 0,
		assets_sell_volume: Number(al.sell_volume) || 0,
		assets_realized_net: Number(al.realized_net) || 0,
		assets_trade_count: Number(al.trade_count) || 0,
		minigames_wagered: Number(mg.wagered) || 0,
		minigames_paid_out: Number(mg.paid_out) || 0,
		minigames_net: Number(mg.net) || 0,
		minigames_wins: Number(mg.wins) || 0,
		minigames_plays: Number(mg.plays) || 0,
		minigames_biggest_win: Number(mg.biggest_win) || 0,
		items_stolen: Number(it.stolen) || 0,
		items_bombed: Number(it.bombed) || 0,
		items_gifted: Number(it.gifted) || 0,
		items_steal_attempts: Number(it.steal_attempts) || 0,
		items_bomb_attempts: Number(it.bomb_attempts) || 0,
		items_spies: Number(it.spies) || 0,
		items_bounties_placed: Number(it.bounties_placed) || 0,
		items_biggest_steal: Number(it.biggest_steal) || 0,
		items_buys: Number(it.buys) || 0,
		items_buy_spend: Number(it.buy_spend) || 0,
		items_gifts: Number(it.gifts) || 0,
		items_discards: Number(it.discards) || 0,
		items_activations: Number(it.activations) || 0,
		items_steals_caught: Number(it.steals_caught) || 0,
		items_steals_landed: Number(it.steals_landed) || 0,
		items_distinct_bought: Number(it.distinct_items_bought) || 0
	};
}

export async function getServerFeatureStats(serverId: any) {
	await initializeDatabase();
	const sid = Number(serverId);

	const [giveawayRows, entryRows, streamRows, questRows, bountyRows, staffReviewRows, feedbackRows, afkRows] = await Promise.all([
		db.execute(sql`
			SELECT
				COUNT(*) AS total,
				COALESCE(SUM(CASE WHEN g.status = 'active' THEN 1 ELSE 0 END), 0) AS active,
				COALESCE(SUM(CASE WHEN g.winners_announced = 1 THEN g.winner_count ELSE 0 END), 0) AS winners
			FROM server_member_giveaways g INNER JOIN server_members sm ON sm.id = g.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COUNT(DISTINCT e.member_id) AS unique_entrants,
				COALESCE(SUM(e.entry_count), 0) AS total_entries
			FROM server_member_giveaway_entries e
			INNER JOIN server_member_giveaways g ON g.id = e.giveaway_id
			INNER JOIN server_members sm ON sm.id = g.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) AS total_streams,
				COUNT(DISTINCT s.member_id) AS creators,
				COALESCE(SUM(CASE WHEN s.status = 'live' THEN 1 ELSE 0 END), 0) AS live_now,
				COALESCE(MAX(s.peak_viewers), 0) AS peak_viewers,
				COALESCE(SUM(s.total_likes), 0) AS likes,
				COALESCE(SUM(s.total_chat_messages), 0) AS chat_messages,
				COALESCE(SUM(s.total_gifts), 0) AS gifts,
				COALESCE(SUM(s.total_follows), 0) AS follows,
				COALESCE(SUM(s.total_shares), 0) AS shares,
				COALESCE(SUM(s.unique_chatters), 0) AS unique_chatters
			FROM server_member_content_creator_streams s INNER JOIN server_members sm ON sm.id = s.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) AS enrolled,
				COALESCE(SUM(CASE WHEN q.reward_claimed = 1 THEN 1 ELSE 0 END), 0) AS claimed,
				COUNT(DISTINCT q.member_id) AS participants
			FROM server_member_discord_quests q INNER JOIN server_members sm ON sm.id = q.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) AS placed,
				COALESCE(SUM(CASE WHEN b.collected = 1 THEN 1 ELSE 0 END), 0) AS collected,
				COALESCE(SUM(b.amount), 0) AS pooled
			FROM server_member_item_bounties b INNER JOIN server_members sm ON sm.id = b.placed_by_member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT
				COUNT(*) AS reviews,
				COALESCE(AVG(r.rating), 0) AS avg_rating
			FROM server_member_staff_rating_reviews r INNER JOIN server_members sm ON sm.id = r.reporter_member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT COUNT(*) AS submissions
			FROM server_member_feedbacks f INNER JOIN server_members sm ON sm.id = f.member_id
			WHERE sm.server_id = ${sid}
		`),
		db.execute(sql`
			SELECT COUNT(*) AS active
			FROM server_member_afks a INNER JOIN server_members sm ON sm.id = a.member_id
			WHERE sm.server_id = ${sid}
		`)
	]);

	const gv = (giveawayRows[0] as unknown as any[])[0] || {};
	const en = (entryRows[0] as unknown as any[])[0] || {};
	const st = (streamRows[0] as unknown as any[])[0] || {};
	const qs = (questRows[0] as unknown as any[])[0] || {};
	const bn = (bountyRows[0] as unknown as any[])[0] || {};
	const sr = (staffReviewRows[0] as unknown as any[])[0] || {};
	const fb = (feedbackRows[0] as unknown as any[])[0] || {};
	const af = (afkRows[0] as unknown as any[])[0] || {};

	return {
		giveaways_total: Number(gv.total) || 0,
		giveaways_active: Number(gv.active) || 0,
		giveaways_winners: Number(gv.winners) || 0,
		giveaways_entrants: Number(en.unique_entrants) || 0,
		giveaways_entries: Number(en.total_entries) || 0,
		streams_total: Number(st.total_streams) || 0,
		streams_creators: Number(st.creators) || 0,
		streams_live_now: Number(st.live_now) || 0,
		streams_peak_viewers: Number(st.peak_viewers) || 0,
		streams_likes: Number(st.likes) || 0,
		streams_chat_messages: Number(st.chat_messages) || 0,
		streams_gifts: Number(st.gifts) || 0,
		streams_follows: Number(st.follows) || 0,
		streams_shares: Number(st.shares) || 0,
		streams_unique_chatters: Number(st.unique_chatters) || 0,
		quests_enrolled: Number(qs.enrolled) || 0,
		quests_claimed: Number(qs.claimed) || 0,
		quests_participants: Number(qs.participants) || 0,
		bounties_placed: Number(bn.placed) || 0,
		bounties_collected: Number(bn.collected) || 0,
		bounties_pooled: Number(bn.pooled) || 0,
		staff_reviews: Number(sr.reviews) || 0,
		staff_avg_rating: Math.round((Number(sr.avg_rating) || 0) * 10) / 10,
		feedback_submissions: Number(fb.submissions) || 0,
		afk_active: Number(af.active) || 0
	};
}

export async function getMemberDashboard(memberId: any, priceMap: Record<string, { price: number }> = {}) {
	await initializeDatabase();
	const mid = Number(memberId);

	const [posRows, assetLogRows, minigameRows, outgoingRows, incomingRows, giveawayRows, questRows, streamRows, feedbackRows, bountyOnRows] = await Promise.all([
		db.execute(sql`SELECT asset_type, asset_id, xp_invested, buy_price FROM server_member_assets WHERE member_id = ${mid}`),
		db.execute(sql`
				SELECT
					COALESCE(SUM(CASE WHEN action = 'buy' THEN xp_amount ELSE 0 END), 0) AS buy_volume,
					COALESCE(SUM(CASE WHEN action = 'sell' THEN xp_amount ELSE 0 END), 0) AS sell_volume,
					COALESCE(SUM(CASE WHEN action = 'sell' THEN net ELSE 0 END), 0) AS realized_net,
					COUNT(*) AS trade_count
				FROM server_member_asset_logs WHERE member_id = ${mid}
			`),
		db.execute(sql`
				SELECT
					COALESCE(SUM(wager), 0) AS wagered,
					COALESCE(SUM(xp_amount), 0) AS net,
					COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END), 0) AS wins,
					COUNT(*) AS plays,
					COALESCE(MAX(CASE WHEN outcome = 'win' THEN payout ELSE 0 END), 0) AS biggest_win
				FROM server_member_minigame_logs WHERE member_id = ${mid}
			`),
		db.execute(sql`
				SELECT
					COALESCE(SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END), 0) AS buys,
					COALESCE(SUM(CASE WHEN action = 'buy' THEN xp_amount ELSE 0 END), 0) AS buy_spend,
					COALESCE(SUM(CASE WHEN action NOT IN ('buy','discard','steal','bomb','gift','spy','bounty') THEN 1 ELSE 0 END), 0) AS activations,
					COALESCE(SUM(CASE WHEN action = 'steal' AND outcome = 'success' THEN xp_amount ELSE 0 END), 0) AS stolen,
					COALESCE(SUM(CASE WHEN action = 'steal' AND outcome = 'success' THEN 1 ELSE 0 END), 0) AS steals_landed,
					COALESCE(SUM(CASE WHEN action = 'steal' AND outcome = 'caught' THEN 1 ELSE 0 END), 0) AS steals_caught,
					COALESCE(SUM(CASE WHEN action = 'bomb' AND outcome = 'success' THEN xp_amount ELSE 0 END), 0) AS bombed,
					COALESCE(SUM(CASE WHEN action = 'gift' THEN xp_amount ELSE 0 END), 0) AS gifted,
					COALESCE(SUM(CASE WHEN action = 'spy' THEN 1 ELSE 0 END), 0) AS spies,
					COALESCE(SUM(CASE WHEN action = 'bounty' THEN 1 ELSE 0 END), 0) AS bounties_placed
				FROM server_member_item_logs WHERE member_id = ${mid}
			`),
		db.execute(sql`
				SELECT
					COALESCE(SUM(CASE WHEN action = 'steal' AND outcome = 'success' THEN xp_amount ELSE 0 END), 0) AS stolen_from,
					COALESCE(SUM(CASE WHEN action = 'bomb' AND outcome = 'success' THEN xp_amount ELSE 0 END), 0) AS bombed_by,
					COALESCE(SUM(CASE WHEN action = 'gift' THEN xp_amount ELSE 0 END), 0) AS gifts_received
				FROM server_member_item_logs WHERE target_member_id = ${mid}
			`),
		db.execute(sql`
				SELECT
					(SELECT COUNT(*) FROM server_member_giveaways WHERE member_id = ${mid}) AS hosted,
					(SELECT COUNT(*) FROM server_member_giveaway_entries WHERE member_id = ${mid}) AS entered,
					(SELECT COUNT(*) FROM server_member_giveaway_entries WHERE member_id = ${mid} AND is_winner = 1) AS won
			`),
		db.execute(sql`
				SELECT COUNT(*) AS enrolled, COALESCE(SUM(CASE WHEN reward_claimed = 1 THEN 1 ELSE 0 END), 0) AS claimed
				FROM server_member_discord_quests WHERE member_id = ${mid}
			`),
		db.execute(sql`
				SELECT
					COUNT(*) AS streams,
					COALESCE(MAX(peak_viewers), 0) AS peak_viewers,
					COALESCE(SUM(total_likes), 0) AS likes,
					COALESCE(SUM(total_gifts), 0) AS gifts
				FROM server_member_content_creator_streams WHERE member_id = ${mid}
			`),
		db.execute(sql`SELECT COUNT(*) AS submitted FROM server_member_feedbacks WHERE member_id = ${mid}`),
		db.execute(
			sql`SELECT COALESCE(SUM(amount), 0) AS pooled, COUNT(*) AS count FROM server_member_item_bounties WHERE target_member_id = ${mid} AND collected = 0`
		)
	]);

	const positions = (posRows[0] as unknown as any[]) || [];
	let invested = 0;
	let marketValue = 0;
	for (const p of positions) {
		const xpInv = Number(p.xp_invested) || 0;
		const buy = Number(p.buy_price) || 0;
		const live = priceMap[`${p.asset_type}:${p.asset_id}`];
		const price = Number(live?.price) > 0 ? Number(live.price) : buy;
		invested += xpInv;
		marketValue += buy > 0 ? Math.round(xpInv * (price / buy)) : xpInv;
	}

	const al = (assetLogRows[0] as unknown as any[])[0] || {};
	const mg = (minigameRows[0] as unknown as any[])[0] || {};
	const out = (outgoingRows[0] as unknown as any[])[0] || {};
	const inc = (incomingRows[0] as unknown as any[])[0] || {};
	const gv = (giveawayRows[0] as unknown as any[])[0] || {};
	const qs = (questRows[0] as unknown as any[])[0] || {};
	const st = (streamRows[0] as unknown as any[])[0] || {};
	const fb = (feedbackRows[0] as unknown as any[])[0] || {};
	const bn = (bountyOnRows[0] as unknown as any[])[0] || {};

	return {
		assets_invested: invested,
		assets_market_value: marketValue,
		assets_open_positions: positions.length,
		assets_pnl: marketValue - invested,
		assets_realized_net: Number(al.realized_net) || 0,
		assets_trade_count: Number(al.trade_count) || 0,
		minigames_wagered: Number(mg.wagered) || 0,
		minigames_net: Number(mg.net) || 0,
		minigames_wins: Number(mg.wins) || 0,
		minigames_plays: Number(mg.plays) || 0,
		minigames_biggest_win: Number(mg.biggest_win) || 0,
		items_buys: Number(out.buys) || 0,
		items_buy_spend: Number(out.buy_spend) || 0,
		items_activations: Number(out.activations) || 0,
		items_stolen: Number(out.stolen) || 0,
		items_steals_landed: Number(out.steals_landed) || 0,
		items_steals_caught: Number(out.steals_caught) || 0,
		items_bombed: Number(out.bombed) || 0,
		items_gifted: Number(out.gifted) || 0,
		items_spies: Number(out.spies) || 0,
		items_bounties_placed: Number(out.bounties_placed) || 0,
		items_stolen_from: Number(inc.stolen_from) || 0,
		items_bombed_by: Number(inc.bombed_by) || 0,
		items_gifts_received: Number(inc.gifts_received) || 0,
		giveaways_hosted: Number(gv.hosted) || 0,
		giveaways_entered: Number(gv.entered) || 0,
		giveaways_won: Number(gv.won) || 0,
		quests_enrolled: Number(qs.enrolled) || 0,
		quests_claimed: Number(qs.claimed) || 0,
		streams_total: Number(st.streams) || 0,
		streams_peak_viewers: Number(st.peak_viewers) || 0,
		streams_likes: Number(st.likes) || 0,
		streams_gifts: Number(st.gifts) || 0,
		feedback_submitted: Number(fb.submitted) || 0,
		bounty_on_me: Number(bn.pooled) || 0,
		bounty_on_me_count: Number(bn.count) || 0
	};
}

export async function getMemberInsights(memberId: any, serverId: any = null) {
	await initializeDatabase();
	const mid = Number(memberId);
	const disguisedIds = serverId ? await getDisguisedMemberIds(serverId) : [];
	const hideDisguised = disguisedIds.length > 0 ? sql`AND m.id NOT IN (${sql.join(disguisedIds, sql`, `)})` : sql``;

	const nameExpr = sql`COALESCE(NULLIF(m.server_display_name, ''), NULLIF(m.display_name, ''), m.username)`;
	const q = (query: any) => db.execute(query).catch(() => [[]] as any);
	const mapName = (rows: any) =>
		((rows[0] as unknown as any[]) || []).map((r) => ({ name: r.name || 'a member', hits: Number(r.hits) || 0, xp: Number(r.xp) || 0 }));

	const outgoing = (action: string, successOnly: boolean) =>
		q(sql`
			SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(il.xp_amount), 0) AS xp
			FROM server_member_item_logs il
			INNER JOIN server_members m ON m.id = il.target_member_id
			WHERE il.member_id = ${mid} AND il.action = ${action} ${successOnly ? sql`AND il.outcome = 'success'` : sql``} ${hideDisguised}
			GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY xp DESC, hits DESC LIMIT 3
		`);
	const incoming = (action: string, successOnly: boolean) =>
		q(sql`
			SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(il.xp_amount), 0) AS xp
			FROM server_member_item_logs il
			INNER JOIN server_members m ON m.id = il.member_id
			WHERE il.target_member_id = ${mid} AND il.action = ${action} ${successOnly ? sql`AND il.outcome = 'success'` : sql``} ${hideDisguised}
			GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY xp DESC, hits DESC LIMIT 3
		`);
	const defendedFrom = (actions: string[], outcomes: string[]) =>
		q(sql`
			SELECT ${nameExpr} AS name, COUNT(*) AS hits, 0 AS xp
			FROM server_member_item_logs il
			INNER JOIN server_members m ON m.id = il.member_id
			WHERE il.target_member_id = ${mid} AND il.action IN (${sql.join(actions, sql`, `)})
				AND il.outcome IN (${sql.join(outcomes, sql`, `)}) ${hideDisguised}
			GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY hits DESC LIMIT 3
		`);

	const INTERACTIONS = [
		{ key: 'steal', out: true, in: true, success: true },
		{ key: 'bomb', out: true, in: true, success: true },
		{ key: 'leech', out: true, in: true, success: false },
		{ key: 'gift', out: true, in: true, success: false },
		{ key: 'spy', out: true, in: false, success: false }
	];

	const interactionQueries = INTERACTIONS.flatMap((it) => [
		...(it.out ? [{ key: it.key, dir: 'out', p: outgoing(it.key, it.success) }] : []),
		...(it.in ? [{ key: it.key, dir: 'in', p: incoming(it.key, it.success) }] : [])
	]);

	const bountyOut = q(sql`
		SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(b.amount), 0) AS xp
		FROM server_member_item_bounties b
		INNER JOIN server_members m ON m.id = b.target_member_id
		WHERE b.placed_by_member_id = ${mid} ${hideDisguised}
		GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY xp DESC, hits DESC LIMIT 3
	`);
	const bountyIn = q(sql`
		SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(b.amount), 0) AS xp
		FROM server_member_item_bounties b
		INNER JOIN server_members m ON m.id = b.placed_by_member_id
		WHERE b.target_member_id = ${mid} ${hideDisguised}
		GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY xp DESC, hits DESC LIMIT 3
	`);

	const nemesis = q(sql`
		SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(il.xp_amount), 0) AS xp
		FROM server_member_item_logs il
		INNER JOIN server_members m ON m.id = il.member_id
		WHERE il.target_member_id = ${mid} AND il.action IN ('steal','bomb','leech') AND il.outcome = 'success' ${hideDisguised}
		GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY hits DESC, xp DESC LIMIT 1
	`);
	const favoriteTarget = q(sql`
		SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(il.xp_amount), 0) AS xp
		FROM server_member_item_logs il
		INNER JOIN server_members m ON m.id = il.target_member_id
		WHERE il.member_id = ${mid} AND il.action IN ('steal','bomb','leech') AND il.outcome = 'success' ${hideDisguised}
		GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY hits DESC, xp DESC LIMIT 1
	`);
	const bestAlly = q(sql`
		SELECT ${nameExpr} AS name, COUNT(*) AS hits, COALESCE(SUM(il.xp_amount), 0) AS xp
		FROM server_member_item_logs il
		INNER JOIN server_members m
			ON m.id = CASE WHEN il.member_id = ${mid} THEN il.target_member_id ELSE il.member_id END
		WHERE il.action = 'gift' AND (
			(il.member_id = ${mid} AND il.target_member_id IS NOT NULL)
			OR (il.target_member_id = ${mid})
		) ${hideDisguised}
		GROUP BY m.id, m.server_display_name, m.display_name, m.username ORDER BY xp DESC, hits DESC LIMIT 1
	`);

	const spyCaught = defendedFrom(['spy'], ['caught']);
	const blocked = defendedFrom(['steal', 'bomb'], ['immune']);
	const reflected = defendedFrom(['steal', 'bomb'], ['reflected']);
	const defenseSummary = q(sql`
		SELECT
			COALESCE(SUM(CASE WHEN target_member_id = ${mid} AND action = 'spy' AND outcome = 'caught' THEN 1 ELSE 0 END), 0) AS spies_caught,
			COALESCE(SUM(CASE WHEN target_member_id = ${mid} AND action IN ('steal','bomb') AND outcome = 'immune' THEN 1 ELSE 0 END), 0) AS blocked,
			COALESCE(SUM(CASE WHEN target_member_id = ${mid} AND action IN ('steal','bomb') AND outcome = 'reflected' THEN 1 ELSE 0 END), 0) AS reflected,
			COALESCE(SUM(CASE WHEN member_id = ${mid} AND action = 'steal' AND outcome = 'caught' THEN 1 ELSE 0 END), 0) AS my_steals_caught,
			COALESCE(SUM(CASE WHEN member_id = ${mid} AND action = 'insurance' AND outcome = 'refunded' THEN 1 ELSE 0 END), 0) AS insurance_covers,
			COALESCE(SUM(CASE WHEN member_id = ${mid} AND action = 'insurance' AND outcome = 'refunded' THEN il.xp_amount ELSE 0 END), 0) AS insurance_xp
		FROM server_member_item_logs il
		WHERE target_member_id = ${mid} OR member_id = ${mid}
	`);

	const [
		topItems,
		effectUsage,
		xpFlow,
		holdings,
		bountyOutRows,
		bountyInRows,
		spyCaughtRows,
		blockedRows,
		reflectedRows,
		defenseRows,
		nemesisRows,
		favoriteTargetRows,
		bestAllyRows,
		...interactionResults
	] = await Promise.all([
		q(sql`
			SELECT bi.name AS name, bi.effect_type AS effect_type, COUNT(*) AS uses
			FROM server_member_item_logs il
			LEFT JOIN items bi ON bi.id = il.item_id
			WHERE il.member_id = ${mid} AND il.item_id IS NOT NULL AND il.action NOT IN ('buy', 'discard', 'bounty_collected', 'insurance')
			GROUP BY bi.id, bi.name, bi.effect_type
			ORDER BY uses DESC LIMIT 1
		`),
		q(sql`
			SELECT COALESCE(bi.effect_type, il.action) AS effect_type, COUNT(*) AS uses
			FROM server_member_item_logs il
			LEFT JOIN items bi ON bi.id = il.item_id
			WHERE il.member_id = ${mid} AND il.action NOT IN ('buy', 'discard', 'bounty_collected', 'insurance')
			GROUP BY COALESCE(bi.effect_type, il.action)
			ORDER BY uses DESC
		`),
		q(sql`
			SELECT d AS day, SUM(net) AS net FROM (
				SELECT DATE(created_at) AS d, SUM(xp_amount) AS net FROM server_member_minigame_logs
					WHERE member_id = ${mid} AND created_at >= UTC_TIMESTAMP() - INTERVAL 14 DAY GROUP BY DATE(created_at)
				UNION ALL
				SELECT DATE(created_at) AS d, SUM(net) AS net FROM server_member_asset_logs
					WHERE member_id = ${mid} AND action = 'sell' AND created_at >= UTC_TIMESTAMP() - INTERVAL 14 DAY GROUP BY DATE(created_at)
				UNION ALL
				SELECT DATE(created_at) AS d,
					SUM(CASE WHEN action IN ('steal','bomb') AND outcome = 'success' THEN xp_amount
						WHEN action = 'gift' THEN -xp_amount WHEN action = 'buy' THEN -xp_amount ELSE 0 END) AS net
					FROM server_member_item_logs WHERE member_id = ${mid} AND created_at >= UTC_TIMESTAMP() - INTERVAL 14 DAY GROUP BY DATE(created_at)
			) t GROUP BY d ORDER BY d ASC
		`),
		q(sql`
			SELECT asset_type, asset_id, symbol, asset_name, asset_image, SUM(xp_invested) AS invested
			FROM server_member_assets WHERE member_id = ${mid}
			GROUP BY asset_type, asset_id, symbol, asset_name, asset_image
			ORDER BY invested DESC
		`),
		bountyOut,
		bountyIn,
		spyCaught,
		blocked,
		reflected,
		defenseSummary,
		nemesis,
		favoriteTarget,
		bestAlly,
		...interactionQueries.map((iq) => iq.p)
	]);

	const interactions: Record<string, { out: any[]; in: any[] }> = {};
	interactionQueries.forEach((iq, i) => {
		if (!interactions[iq.key]) interactions[iq.key] = { out: [], in: [] };
		interactions[iq.key][iq.dir as 'out' | 'in'] = mapName(interactionResults[i]);
	});
	interactions.bounty = { out: mapName(bountyOutRows), in: mapName(bountyInRows) };
	interactions.spy_caught = { out: mapName(spyCaughtRows), in: [] };
	interactions.blocked = { out: mapName(blockedRows), in: [] };
	interactions.reflected = { out: mapName(reflectedRows), in: [] };

	const defRow = (defenseRows[0] as unknown as any[])[0] || {};
	const defense = {
		spies_caught: Number(defRow.spies_caught) || 0,
		blocked: Number(defRow.blocked) || 0,
		reflected: Number(defRow.reflected) || 0,
		my_steals_caught: Number(defRow.my_steals_caught) || 0,
		insurance_covers: Number(defRow.insurance_covers) || 0,
		insurance_xp: Number(defRow.insurance_xp) || 0
	};

	const one = (rows: any) => mapName(rows)[0] ?? null;
	const relationships = {
		nemesis: one(nemesisRows),
		favorite_target: one(favoriteTargetRows),
		best_ally: one(bestAllyRows)
	};

	const flowRows = ((xpFlow[0] as unknown as any[]) || []).map((r) => ({
		day: r.day instanceof Date ? r.day.toISOString().split('T')[0] : String(r.day),
		net: Number(r.net) || 0
	}));

	const assetHoldings = ((holdings[0] as unknown as any[]) || [])
		.map((r) => ({
			asset_type: r.asset_type,
			asset_id: r.asset_id,
			symbol: r.symbol || r.asset_name || 'Asset',
			name: r.asset_name || r.symbol || 'Asset',
			image: r.asset_image ?? null,
			invested: Number(r.invested) || 0
		}))
		.filter((r) => r.invested > 0);

	return {
		favorite_items: ((topItems[0] as unknown as any[]) || []).map((r) => ({
			name: r.name || 'Item',
			effect_type: r.effect_type || null,
			uses: Number(r.uses) || 0
		})),
		interactions,
		defense,
		relationships,
		effect_usage: ((effectUsage[0] as unknown as any[]) || [])
			.map((r) => ({ effect_type: r.effect_type || 'unknown', uses: Number(r.uses) || 0 }))
			.filter((r) => r.uses > 0),
		xp_flow: flowRows,
		asset_holdings: assetHoldings
	};
}

export async function closeAssetPosition(positionId: any) {
	await initializeDatabase();
	await db.execute(sql`DELETE FROM server_member_assets WHERE id = ${Number(positionId)}`);
	return true;
}

export async function reduceAssetPosition(positionId: any, data: { sold_invested: number }) {
	await initializeDatabase();
	const position = await getAssetPosition(positionId);
	if (!position) return false;
	const now = toMySQLDateTime();
	const sold = Math.max(0, Math.floor(Number(data.sold_invested) || 0));
	const remaining = Math.max(0, (Number(position.xp_invested) || 0) - sold);
	if (remaining <= 0) {
		await db.execute(sql`DELETE FROM server_member_assets WHERE id = ${Number(positionId)}`);
	} else {
		await db.execute(sql`
			UPDATE server_member_assets
			SET xp_invested = ${remaining}, updated_at = ${now}
			WHERE id = ${Number(positionId)}
		`);
	}
	return true;
}

export async function getDisguisedMemberIds(serverId: any): Promise<number[]> {
	await initializeDatabase();
	if (!serverId) return [];
	const rows = await db.execute(sql`
		SELECT DISTINCT smi.member_id
		FROM server_member_item_actives sma
		INNER JOIN server_member_items smi ON smi.id = sma.member_item_id
		INNER JOIN items bi ON bi.id = smi.item_id
		INNER JOIN server_members sm ON sm.id = smi.member_id
		WHERE bi.effect_type = 'disguise'
		  AND sma.expires_at > UTC_TIMESTAMP()
		  AND sm.server_id = ${Number(serverId)}
	`);
	return ((rows[0] as unknown as any[]) || []).map((r) => Number(r.member_id)).filter((n) => Number.isFinite(n));
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
		video: [desc(schema.serverMemberLevels.voice_minutes_video), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
		streaming: [desc(schema.serverMemberLevels.voice_minutes_streaming), asc(schema.serverMemberLevels.updated_at), asc(schema.serverMemberLevels.created_at)],
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

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const hideDisguised = disguisedIds.length > 0 ? notInArray(schema.serverMemberLevels.member_id, disguisedIds) : undefined;

	const whereClause = and(
		eq(schema.serverMembers.server_id, Number(serverId)),
		...(whereRange ? [whereRange as any] : []),
		...(hideDisguised ? [hideDisguised] : [])
	);

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
			voice_minutes_video: schema.serverMemberLevels.voice_minutes_video,
			voice_minutes_streaming: schema.serverMemberLevels.voice_minutes_streaming,
			rank: schema.serverMemberLevels.rank
		})
		.from(schema.serverMemberLevels)
		.innerJoin(schema.serverMembers, eq(schema.serverMembers.id, schema.serverMemberLevels.member_id))
		.where(whereClause)
		.orderBy(...orderBy)
		.limit(safeLimit);
}

export async function getLeaderboardPeriodCounts(serverId: any, since: Date) {
	await initializeDatabase();
	if (!serverId) return [] as any[];

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const hideDisguised = disguisedIds.length > 0 ? notInArray(schema.serverMembers.id, disguisedIds) : undefined;

	const rows = await db
		.select({
			discord_member_id: schema.serverMembers.discord_member_id,
			username: schema.serverMembers.username,
			display_name: schema.serverMembers.display_name,
			server_display_name: schema.serverMembers.server_display_name,
			avatar: schema.serverMembers.avatar,
			level: schema.serverMemberLevels.level,
			xp_amount: sql<number>`COALESCE(SUM(${schema.serverMemberLevelLogs.amount}), 0)`,
			chat_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberLevelLogs.source} = 'chat' THEN 1 ELSE 0 END), 0)`,
			voice_active_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberLevelLogs.source} = 'voice' THEN 1 ELSE 0 END), 0)`,
			voice_afk_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberLevelLogs.source} = 'voice_afk' THEN 1 ELSE 0 END), 0)`,
			video_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberLevelLogs.source} = 'video' THEN 1 ELSE 0 END), 0)`,
			stream_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberLevelLogs.source} = 'stream' THEN 1 ELSE 0 END), 0)`
		})
		.from(schema.serverMembers)
		.leftJoin(
			schema.serverMemberLevelLogs,
			and(eq(schema.serverMemberLevelLogs.member_id, schema.serverMembers.id), sql`${schema.serverMemberLevelLogs.created_at} >= ${toMySQLDateTime(since)}`)
		)
		.leftJoin(schema.serverMemberLevels, eq(schema.serverMemberLevels.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), ...(hideDisguised ? [hideDisguised] : [])))
		.groupBy(
			schema.serverMembers.id,
			schema.serverMembers.discord_member_id,
			schema.serverMembers.username,
			schema.serverMembers.display_name,
			schema.serverMembers.server_display_name,
			schema.serverMembers.avatar,
			schema.serverMemberLevels.level
		);

	return rows as any[];
}

export async function getItemsAttackLeaderboard(serverId: any, action: 'steal' | 'bomb', since: Date | null) {
	await initializeDatabase();
	if (!serverId) return [] as any[];

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const hideDisguised = disguisedIds.length > 0 ? notInArray(schema.serverMembers.id, disguisedIds) : undefined;

	const rows = await db
		.select({
			discord_member_id: schema.serverMembers.discord_member_id,
			username: schema.serverMembers.username,
			display_name: schema.serverMembers.display_name,
			server_display_name: schema.serverMembers.server_display_name,
			avatar: schema.serverMembers.avatar,
			level: schema.serverMemberLevels.level,
			attack_total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberItemLogs.outcome} = 'success' THEN ${schema.serverMemberItemLogs.xp_amount} ELSE 0 END), 0)`,
			attack_success: sql<number>`COALESCE(SUM(CASE WHEN ${schema.serverMemberItemLogs.outcome} = 'success' THEN 1 ELSE 0 END), 0)`,
			attack_attempts: sql<number>`COUNT(${schema.serverMemberItemLogs.id})`,
			attack_big: sql<number>`COALESCE(MAX(CASE WHEN ${schema.serverMemberItemLogs.outcome} = 'success' THEN ${schema.serverMemberItemLogs.xp_amount} ELSE 0 END), 0)`
		})
		.from(schema.serverMembers)
		.leftJoin(
			schema.serverMemberItemLogs,
			and(
				eq(schema.serverMemberItemLogs.member_id, schema.serverMembers.id),
				eq(schema.serverMemberItemLogs.action, action),
				...(since ? [sql`${schema.serverMemberItemLogs.created_at} >= ${toMySQLDateTime(since)}`] : [])
			)
		)
		.leftJoin(schema.serverMemberLevels, eq(schema.serverMemberLevels.member_id, schema.serverMembers.id))
		.where(and(eq(schema.serverMembers.server_id, Number(serverId)), ...(hideDisguised ? [hideDisguised] : [])))
		.groupBy(
			schema.serverMembers.id,
			schema.serverMembers.discord_member_id,
			schema.serverMembers.username,
			schema.serverMembers.display_name,
			schema.serverMembers.server_display_name,
			schema.serverMembers.avatar,
			schema.serverMemberLevels.level
		);

	return rows as any[];
}

export async function getItemsBountyLeaderboard(serverId: any, since: Date | null) {
	await initializeDatabase();
	if (!serverId) return [] as any[];

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const sinceClause = since ? sql`AND b.created_at >= ${toMySQLDateTime(since)}` : sql``;
	const sinceLogClause = since ? sql`AND l.created_at >= ${toMySQLDateTime(since)}` : sql``;
	const hideClause = disguisedIds.length > 0 ? sql`AND sm.id NOT IN (${sql.join(disguisedIds, sql`, `)})` : sql``;

	const rows = await db.execute(sql`
		SELECT
			sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name, sm.avatar,
			sml.level,
			COALESCE(SUM(agg.bounty_on_them), 0) AS bounty_on_them,
			COALESCE(SUM(agg.bounty_collected), 0) AS bounty_collected,
			COALESCE(SUM(agg.bounty_given), 0) AS bounty_given
		FROM server_members sm
		LEFT JOIN (
			SELECT b.target_member_id AS member_id,
				COALESCE(SUM(b.amount), 0) AS bounty_on_them, 0 AS bounty_collected, 0 AS bounty_given
			FROM server_member_item_bounties b
			WHERE 1=1 ${sinceClause}
			GROUP BY b.target_member_id
			UNION ALL
			SELECT b.placed_by_member_id AS member_id,
				0 AS bounty_on_them, 0 AS bounty_collected, COALESCE(SUM(b.amount), 0) AS bounty_given
			FROM server_member_item_bounties b
			WHERE b.placed_by_member_id IS NOT NULL ${sinceClause}
			GROUP BY b.placed_by_member_id
			UNION ALL
			SELECT l.member_id AS member_id,
				0 AS bounty_on_them, COALESCE(SUM(l.xp_amount), 0) AS bounty_collected, 0 AS bounty_given
			FROM server_member_item_logs l
			WHERE l.action = 'bounty_collected' ${sinceLogClause}
			GROUP BY l.member_id
		) agg ON agg.member_id = sm.id
		LEFT JOIN server_member_levels sml ON sml.member_id = sm.id
		WHERE sm.server_id = ${Number(serverId)} ${hideClause}
		GROUP BY sm.id, sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name, sm.avatar, sml.level
	`);

	return rows[0] as unknown as any[];
}

export async function getItemsGiftLeaderboard(serverId: any, since: Date | null) {
	await initializeDatabase();
	if (!serverId) return [] as any[];

	const disguisedIds = await getDisguisedMemberIds(serverId);
	const sinceClause = since ? sql`AND l.created_at >= ${toMySQLDateTime(since)}` : sql``;
	const hideClause = disguisedIds.length > 0 ? sql`AND sm.id NOT IN (${sql.join(disguisedIds, sql`, `)})` : sql``;

	const rows = await db.execute(sql`
		SELECT
			sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name, sm.avatar,
			sml.level,
			COALESCE(SUM(agg.gift_given), 0) AS gift_given,
			COALESCE(SUM(agg.gift_received), 0) AS gift_received
		FROM server_members sm
		LEFT JOIN (
			SELECT l.member_id AS member_id,
				COALESCE(SUM(l.xp_amount), 0) AS gift_given, 0 AS gift_received
			FROM server_member_item_logs l
			WHERE l.action = 'gift' ${sinceClause}
			GROUP BY l.member_id
			UNION ALL
			SELECT l.target_member_id AS member_id,
				0 AS gift_given, COALESCE(SUM(l.xp_amount), 0) AS gift_received
			FROM server_member_item_logs l
			WHERE l.action = 'gift' AND l.target_member_id IS NOT NULL ${sinceClause}
			GROUP BY l.target_member_id
		) agg ON agg.member_id = sm.id
		LEFT JOIN server_member_levels sml ON sml.member_id = sm.id
		WHERE sm.server_id = ${Number(serverId)} ${hideClause}
		GROUP BY sm.id, sm.discord_member_id, sm.username, sm.display_name, sm.server_display_name, sm.avatar, sml.level
	`);

	return rows[0] as unknown as any[];
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

export async function getPanelOverview(panelId: number) {
	await initializeDatabase();
	if (!panelId) return { total_servers: 0, total_selfbots: 0, running_selfbots: 0, selfbot_uptime_ms: 0 };

	let total_servers = 0;
	let total_selfbots = 0;
	let running_selfbots = 0;
	let selfbot_uptime_ms = 0;

	try {
		const serversResult = await db.execute(sql`
            SELECT COUNT(*) as count 
            FROM servers s
            JOIN bots b ON s.bot_id = b.id
            WHERE b.panel_id = ${Number(panelId)}
        `);
		const sRows = serversResult[0] as any[];
		if (sRows && sRows.length > 0) {
			total_servers = Number(sRows[0].count) || 0;
		}

		const selfbotsResult = await db.execute(sql`
            SELECT 
                COUNT(*) as count, 
                SUM(CASE WHEN sb.status = 'running' THEN 1 ELSE 0 END) as running_count
            FROM server_bots sb
            JOIN servers s ON sb.server_id = s.id
            JOIN bots b ON s.bot_id = b.id
            WHERE b.panel_id = ${Number(panelId)}
        `);
		const sbRows = selfbotsResult[0] as any[];
		if (sbRows && sbRows.length > 0) {
			total_selfbots = Number(sbRows[0].count) || 0;
			running_selfbots = Number(sbRows[0].running_count) || 0;
		}

		const uptimeResult = await db.execute(sql`
            SELECT SUM(TIMESTAMPDIFF(SECOND, sb.uptime_started_at, UTC_TIMESTAMP())) * 1000 as uptime_ms
            FROM server_bots sb
            JOIN servers s ON sb.server_id = s.id
            JOIN bots b ON s.bot_id = b.id
            WHERE b.panel_id = ${Number(panelId)} AND sb.status = 'running' AND sb.uptime_started_at IS NOT NULL
        `);
		const upRows = uptimeResult[0] as any[];
		if (upRows && upRows.length > 0) {
			selfbot_uptime_ms = Number(upRows[0].uptime_ms) || 0;
		}
	} catch (e) {
		console.error('Error fetching panel overview', e);
	}

	return {
		total_servers,
		total_selfbots,
		running_selfbots,
		selfbot_uptime_ms
	};
}

export async function getServerOverview(serverId: any, opts?: { forPublicPage?: boolean; priceMap?: Record<string, { price: number }> }) {
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
			sql`SELECT COALESCE(SUM(experience),0) AS total_experience, COALESCE(AVG(level),0) AS avg_level, COALESCE(MAX(level),0) AS max_level, COALESCE(SUM(chat_total),0) AS total_chat, COALESCE(SUM(voice_minutes_total),0) AS total_voice_minutes, COALESCE(SUM(voice_minutes_active),0) AS total_voice_active, COALESCE(SUM(voice_minutes_afk),0) AS total_voice_afk, COALESCE(SUM(voice_minutes_video),0) AS total_voice_video, COALESCE(SUM(voice_minutes_streaming),0) AS total_voice_streaming FROM server_member_levels sml INNER JOIN server_members sm ON sm.id = sml.member_id WHERE sm.server_id = ${Number(serverId)}`
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

	const [economy, features] = await Promise.all([
		getServerEconomyStats(serverId, opts?.priceMap ?? {}).catch(() => null),
		getServerFeatureStats(serverId).catch(() => null)
	]);

	const r = (raw: any, idx = 0) => (raw[0] as unknown as any[])[idx] || {};

	const walletXp = Math.round(r(levelingStats).total_experience || 0);

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
		leveling_wallet_experience: walletXp,
		leveling_assets_value: economy?.assets_market_value || 0,
		leveling_total_experience: walletXp + (economy?.assets_market_value || 0),
		leveling_avg_level: Math.round((r(levelingStats).avg_level || 0) * 100) / 100,
		leveling_max_level: r(levelingStats).max_level || 0,
		leveling_total_chat: r(levelingStats).total_chat || 0,
		leveling_total_voice_minutes: r(levelingStats).total_voice_minutes || 0,
		leveling_total_voice_active: r(levelingStats).total_voice_active || 0,
		leveling_total_voice_afk: r(levelingStats).total_voice_afk || 0,
		leveling_total_voice_video: r(levelingStats).total_voice_video || 0,
		leveling_total_voice_streaming: r(levelingStats).total_voice_streaming || 0,
		...(economy ?? {}),
		...(features ?? {})
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

type ServerSettingsRow = {
	id: number;
	server_id: number;
	component_name: string;
	settings: unknown;
	created_at: Date;
	updated_at: Date;
};

function isServerSettingsRowArray(x: unknown): x is ServerSettingsRow[] {
	return Array.isArray(x);
}

async function getServerSettings(serverId: any, componentName: string): Promise<ServerSettingsRow | null>;
async function getServerSettings(serverId: any, componentName?: null): Promise<ServerSettingsRow[]>;
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
	const mapped = rows.map((row) => {
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
	return isServerSettingsRowArray(mapped) ? mapped : [];
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

export type RobloxCatalogItemSnapshot = {
	assetId: number | bigint;
	assetType?: number | null;
	category?: string | null;
	name?: string | null;
	description?: string | null;
	creatorName?: string | null;
	price?: bigint | number | null;
	lowestResalePrice?: bigint | number | null;
	totalQuantity?: bigint | number | null;
	unitsAvailable?: bigint | number | null;
	favoriteCount?: number | null;
	thumbnailUrl?: string | null;
	itemCreatedUtc?: string | null;
};

export function snapshotBigIntOrNull(v: bigint | number | null | undefined): bigint | null {
	if (v == null) return null;
	if (typeof v === 'bigint') return v;
	if (typeof v === 'number') {
		if (!Number.isFinite(v)) return null;
		return BigInt(Math.trunc(v));
	}
	return null;
}

function snapshotAssetIdBigInt(assetId: number | bigint): bigint {
	if (typeof assetId === 'bigint') return assetId;
	if (typeof assetId === 'number' && Number.isFinite(assetId)) return BigInt(Math.trunc(assetId));
	throw new Error('invalid asset id');
}

async function syncServerRobloxItemsFromApi(botId: number, serverId: number, items: RobloxCatalogItemSnapshot[]): Promise<void> {
	await initializeDatabase();
	if (!items || items.length === 0) return;
	const now = toMySQLDateTime();

	for (const it of items) {
		if (!it) continue;
		let assetIdBi: bigint;
		try {
			assetIdBi = snapshotAssetIdBigInt(it.assetId);
		} catch {
			continue;
		}

		const itemCreatedAt = it.itemCreatedUtc && typeof it.itemCreatedUtc === 'string' ? toMySQLDateTime(it.itemCreatedUtc) : null;

		await db
			.insert(schema.botRobloxItems)
			.values({
				bot_id: botId,
				asset_id: assetIdBi,
				asset_type: it.assetType == null ? null : Number(it.assetType),
				category: it.category ?? null,
				name: it.name ?? null,
				description: it.description ?? null,
				creator_name: it.creatorName ?? null,
				price: snapshotBigIntOrNull(it.price),
				lowest_resale_price: snapshotBigIntOrNull(it.lowestResalePrice),
				total_quantity: snapshotBigIntOrNull(it.totalQuantity),
				favorite_count: it.favoriteCount == null ? null : Number(it.favoriteCount),
				units_available: snapshotBigIntOrNull(it.unitsAvailable),
				thumbnail_url: it.thumbnailUrl ?? null,
				item_created_at: itemCreatedAt as any,
				created_at: now as any
			})
			.onDuplicateKeyUpdate({
				set: {
					bot_id: botId,
					asset_type: it.assetType == null ? null : Number(it.assetType),
					category: it.category ?? null,
					name: it.name ?? null,
					description: it.description ?? null,
					creator_name: it.creatorName ?? null,
					price: snapshotBigIntOrNull(it.price),
					lowest_resale_price: snapshotBigIntOrNull(it.lowestResalePrice),
					total_quantity: snapshotBigIntOrNull(it.totalQuantity),
					favorite_count: it.favoriteCount == null ? null : Number(it.favoriteCount),
					units_available: snapshotBigIntOrNull(it.unitsAvailable),
					thumbnail_url: it.thumbnailUrl ?? null,
					item_created_at: itemCreatedAt as any,
					created_at: now as any
				} as any
			});

		const [row] = await db.select({ id: schema.botRobloxItems.id }).from(schema.botRobloxItems).where(eq(schema.botRobloxItems.asset_id, assetIdBi)).limit(1);
		if (!row) continue;

		await db
			.insert(schema.serverRobloxItems)
			.values({ server_id: serverId, item_id: row.id, message_posted_at: null })
			.onDuplicateKeyUpdate({ set: { server_id: serverId } as any });
	}
}

async function listServerRobloxUnpostedAssetIds(serverId: number, activeAssetIds: readonly (number | bigint)[]): Promise<bigint[]> {
	if (!activeAssetIds || activeAssetIds.length === 0) return [];
	await initializeDatabase();
	const idList = activeAssetIds.map((id) => snapshotAssetIdBigInt(id));
	const rows = await db
		.select({ asset_id: schema.botRobloxItems.asset_id })
		.from(schema.serverRobloxItems)
		.innerJoin(schema.botRobloxItems, eq(schema.serverRobloxItems.item_id, schema.botRobloxItems.id))
		.where(
			and(
				eq(schema.serverRobloxItems.server_id, serverId),
				inArray(schema.botRobloxItems.asset_id, idList as any),
				isNull(schema.serverRobloxItems.message_posted_at)
			)
		);
	return rows.map((r) => r.asset_id);
}

async function markServerRobloxItemMessagePosted(serverId: number, assetId: number | bigint): Promise<void> {
	await initializeDatabase();
	const posted = toMySQLDateTime();
	const [item] = await db
		.select({
			id: schema.botRobloxItems.id,
			price: schema.botRobloxItems.price,
			lowest_resale_price: schema.botRobloxItems.lowest_resale_price,
			total_quantity: schema.botRobloxItems.total_quantity,
			units_available: schema.botRobloxItems.units_available
		})
		.from(schema.botRobloxItems)
		.where(eq(schema.botRobloxItems.asset_id, snapshotAssetIdBigInt(assetId)))
		.limit(1);
	if (!item) return;
	await db
		.update(schema.botRobloxItems)
		.set({
			last_price: item.price ?? null,
			last_lowest_resale_price: item.lowest_resale_price ?? null,
			last_total_quantity: item.total_quantity ?? null,
			last_units_available: item.units_available ?? null
		} as any)
		.where(eq(schema.botRobloxItems.id, item.id));
	await db
		.update(schema.serverRobloxItems)
		.set({ message_posted_at: posted as any })
		.where(and(eq(schema.serverRobloxItems.server_id, serverId), eq(schema.serverRobloxItems.item_id, item.id)));
}

export type RobloxItemChange = {
	assetId: bigint;
	field: 'price' | 'lowest_resale_price' | 'units_available' | 'total_quantity';
	oldValue: bigint | null;
	newValue: bigint | null;
};

async function isBotRobloxItemsEmpty(botId: number): Promise<boolean> {
	await initializeDatabase();
	const [row] = await db.select({ id: schema.botRobloxItems.id }).from(schema.botRobloxItems).where(eq(schema.botRobloxItems.bot_id, botId)).limit(1);
	return !row;
}

async function detectAndUpdateServerRobloxItemChanges(serverId: number, items: RobloxCatalogItemSnapshot[]): Promise<Map<bigint, RobloxItemChange[]>> {
	await initializeDatabase();
	const result = new Map<bigint, RobloxItemChange[]>();
	if (!items || items.length === 0) return result;

	const assetIds = items.map((x) => snapshotAssetIdBigInt(x.assetId));

	const rows = await db
		.select({
			asset_id: schema.botRobloxItems.asset_id,
			bot_item_id: schema.botRobloxItems.id,
			last_price: schema.botRobloxItems.last_price,
			last_lowest_resale_price: schema.botRobloxItems.last_lowest_resale_price,
			last_total_quantity: schema.botRobloxItems.last_total_quantity,
			last_units_available: schema.botRobloxItems.last_units_available
		})
		.from(schema.serverRobloxItems)
		.innerJoin(schema.botRobloxItems, eq(schema.serverRobloxItems.item_id, schema.botRobloxItems.id))
		.where(and(eq(schema.serverRobloxItems.server_id, serverId), inArray(schema.botRobloxItems.asset_id, assetIds as any)));

	const rowMap = new Map(rows.map((r) => [r.asset_id, r]));

	for (const it of items) {
		const assetIdBi = snapshotAssetIdBigInt(it.assetId);
		const row = rowMap.get(assetIdBi);
		if (!row) continue;

		const nextPrice = snapshotBigIntOrNull(it.price);
		const nextLowest = snapshotBigIntOrNull(it.lowestResalePrice);
		const nextUnits = snapshotBigIntOrNull(it.unitsAvailable);
		const nextTotal = snapshotBigIntOrNull(it.totalQuantity);

		const changes: RobloxItemChange[] = [];

		if (row.last_price !== null && nextPrice !== null && row.last_price !== nextPrice) {
			changes.push({ assetId: assetIdBi, field: 'price', oldValue: row.last_price, newValue: nextPrice });
		}
		if (row.last_lowest_resale_price !== null && nextLowest !== null && row.last_lowest_resale_price !== nextLowest) {
			changes.push({ assetId: assetIdBi, field: 'lowest_resale_price', oldValue: row.last_lowest_resale_price, newValue: nextLowest });
		}
		if (row.last_units_available !== null && nextUnits !== null && row.last_units_available !== nextUnits) {
			changes.push({ assetId: assetIdBi, field: 'units_available', oldValue: row.last_units_available, newValue: nextUnits });
		}
		if (row.last_total_quantity !== null && nextTotal !== null && row.last_total_quantity !== nextTotal) {
			changes.push({ assetId: assetIdBi, field: 'total_quantity', oldValue: row.last_total_quantity, newValue: nextTotal });
		}

		if (changes.length > 0) result.set(assetIdBi, changes);
	}

	return result;
}

async function updateBotRobloxItemLastValues(items: RobloxCatalogItemSnapshot[]): Promise<void> {
	await initializeDatabase();
	if (!items || items.length === 0) return;
	const assetIds = items.map((x) => snapshotAssetIdBigInt(x.assetId));
	const rows = await db
		.select({ id: schema.botRobloxItems.id, asset_id: schema.botRobloxItems.asset_id })
		.from(schema.botRobloxItems)
		.where(inArray(schema.botRobloxItems.asset_id, assetIds as any));
	const rowMap = new Map(rows.map((r) => [r.asset_id, r.id]));
	for (const it of items) {
		const botItemId = rowMap.get(snapshotAssetIdBigInt(it.assetId));
		if (!botItemId) continue;
		await db
			.update(schema.botRobloxItems)
			.set({
				last_price: snapshotBigIntOrNull(it.price),
				last_lowest_resale_price: snapshotBigIntOrNull(it.lowestResalePrice),
				last_total_quantity: snapshotBigIntOrNull(it.totalQuantity),
				last_units_available: snapshotBigIntOrNull(it.unitsAvailable)
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
	getBotStatusByBotId,
	upsertBotStatus,
	getServerBotStatusByServerBotId,
	upsertServerBotStatus,
	getServer,
	getServersForBot,
	getServersForSelfbot,
	getServerBotServerForSelfbot,
	getOfficialServerByDiscordId,
	getSelfbotServerByDiscordId,
	getServerByDiscordId,
	getOfficialBotServerIdForServer,
	getNotificationChannels,
	getMemberNotificationChannelIds,
	getNotifiedMemberDiscordIds,
	updateMemberNotificationChannels,
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
	getServerMemberById,
	searchServerMembers,
	searchPanelMembersForGift,
	memberServerHasItemsEnabled,
	syncMembers,
	syncMemberRoles,
	getMemberLevel,
	ensureMemberLevel,
	updateMemberLevelStats,
	getMemberStreak,
	ensureMemberStreak,
	applyStreakClaim,
	getMemberTasks,
	persistMemberTasks,
	claimMemberTask,
	getMemberClaim,
	ensureMemberClaim,
	applyMemberClaim,
	countMemberEventsSince,
	claimVoiceRewardWindow,
	setMemberLanguage,
	getMemberLanguage,
	recalculateServerMemberRanks,
	getMemberLevelByDiscordId,
	getMembersWithInVoiceFlag,
	listItems,
	getItem,
	setItemEnabled,
	createItem,
	updateItem,
	deleteItem,
	getMemberInventory,
	getMemberItem,
	grantMemberItem,
	consumeMemberItem,
	backfillItemLogItemIds,
	purgeDepletedMemberItems,
	addMemberItemActive,
	getActiveEffectsForMember,
	getActiveLeechByBeneficiary,
	clearExpiredMemberItemActives,
	getNewlyExpiredEffects,
	markEffectExpiryNotified,
	recordItemNotification,
	getRecentVictimHits,
	getRecentAttackerActions,
	getRecentInsuranceActivations,
	expireMemberItemActive,
	endMemberItemActiveNow,
	logMemberItemAction,
	logMinigameAction,
	getMemberMinigameHistory,
	getMinigamesLeaderboard,
	getMemberItemHistory,
	logMemberLevelGain,
	getMemberLevelHistory,
	getLastActionByActor,
	getLastAttackActionByActor,
	getLastActionAgainstTarget,
	clearImmunityForMember,
	placeBounty,
	getActiveBountyTotal,
	collectBounties,
	getDistinctHeldAssetIds,
	openAssetPosition,
	getAssetPosition,
	getOpenAssetPositions,
	getOpenAssetPosition,
	mergeAssetPosition,
	getMemberAssetHistory,
	logAssetEvent,
	closeAssetPosition,
	reduceAssetPosition,
	getServerLeaderboard,
	getLeaderboardPeriodCounts,
	getItemsAttackLeaderboard,
	getItemsBountyLeaderboard,
	getItemsGiftLeaderboard,
	getDisguisedMemberIds,
	getServerMembersList,
	getPanelOverview,
	getServerOverview,
	getServerEconomyStats,
	getServerFeatureStats,
	getMemberDashboard,
	getMemberInsights,
	recordLevelFriends,
	getMemberLevelFriends,
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
