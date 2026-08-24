import { mysqlTable, int, varchar, text, boolean, datetime, mysqlEnum, json, decimal, tinyint, uniqueIndex, index, bigint } from 'drizzle-orm/mysql-core';

export const migrations = mysqlTable('migrations', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 255 }).notNull().unique(),
	ran_at: datetime('ran_at').notNull()
});

export const accounts = mysqlTable(
	'accounts',
	{
		id: int('id').primaryKey().autoincrement(),
		username: varchar('username', { length: 255 }).notNull().unique(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		password_hash: text('password_hash').notNull(),
		account_type: mysqlEnum('account_type', ['superadmin']).notNull().default('superadmin'),
		ip_address: text('ip_address'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_accounts_email').on(t.email), index('idx_accounts_username').on(t.username)]
);

export const panel = mysqlTable(
	'panels',
	{
		id: int('id').primaryKey().autoincrement(),
		account_id: int('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('uq_panels_account_id').on(t.account_id)]
);

export const bots = mysqlTable('bots', {
	id: int('id').primaryKey().autoincrement(),
	name: text('name').notNull(),
	token: text('token').notNull(),
	application_id: text('application_id'),
	bot_icon: text('bot_icon'),
	port: int('port'),
	secret_key: text('secret_key'),
	panel_id: int('panel_id')
		.notNull()
		.references(() => panel.id, { onDelete: 'cascade' }),
	status: mysqlEnum('status', ['running', 'stopped', 'starting', 'stopping']).default('stopped'),
	process_id: int('process_id'),
	uptime_started_at: datetime('uptime_started_at'),
	created_at: datetime('created_at').notNull(),
	updated_at: datetime('updated_at').notNull()
});

export const botStatus = mysqlTable(
	'bot_status',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
		discord_status: mysqlEnum('discord_status', ['online', 'idle', 'dnd', 'invisible']).notNull().default('online'),
		activity_type: mysqlEnum('activity_type', ['playing', 'streaming', 'listening', 'watching', 'custom', 'competing']).notNull().default('playing'),
		activity_name: varchar('activity_name', { length: 128 }).notNull().default(''),
		activity_url: text('activity_url'),
		activity_state: varchar('activity_state', { length: 128 }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('uq_bot_status_bot_id').on(t.bot_id)]
);

export const botAi = mysqlTable(
	'bot_ai',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
		enabled: boolean('enabled').notNull().default(false),
		api_url: text('api_url'),
		api_key: text('api_key'),
		model: varchar('model', { length: 191 }),
		system_prompt: text('system_prompt'),
		reasoning: mysqlEnum('reasoning', ['none', 'low', 'medium', 'high', 'xhigh']).notNull().default('none'),
		voice_enabled: boolean('voice_enabled').notNull().default(false),
		voice_model: varchar('voice_model', { length: 191 }),
		voice_name: varchar('voice_name', { length: 64 }),
		voice_api_key: text('voice_api_key'),
		voice_system_prompt: text('voice_system_prompt'),
		search_api_url: text('search_api_url'),
		search_api_key: text('search_api_key'),
		search_model: varchar('search_model', { length: 191 }),
		fetch_api_url: text('fetch_api_url'),
		fetch_api_key: text('fetch_api_key'),
		fetch_model: varchar('fetch_model', { length: 191 }),
		image_api_url: text('image_api_url'),
		image_api_key: text('image_api_key'),
		image_model: varchar('image_model', { length: 191 }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('uq_bot_ai_bot_id').on(t.bot_id)]
);

export const botWikis = mysqlTable(
	'bot_wikis',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
		enabled: boolean('enabled').notNull().default(true),
		name: varchar('name', { length: 64 }).notNull(),
		api_url: varchar('api_url', { length: 512 }).notNull(),
		site_url: varchar('site_url', { length: 512 }),
		relay_url: varchar('relay_url', { length: 512 }),
		relay_key: varchar('relay_key', { length: 191 }),
		description: varchar('description', { length: 255 }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('uq_bot_wikis_bot_name').on(t.bot_id, t.name), index('idx_bot_wikis_bot').on(t.bot_id)]
);

export const servers = mysqlTable(
	'servers',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id').references(() => bots.id, { onDelete: 'cascade' }),
		discord_server_id: varchar('discord_server_id', { length: 150 }).notNull(),
		name: text('name'),
		total_members: int('total_members').default(0),
		total_channels: int('total_channels').default(0),
		total_boosters: int('total_boosters').default(0),
		boost_level: int('boost_level').default(0),
		server_icon: text('server_icon'),
		discord_created_at: datetime('discord_created_at'),
		vanity_url_code: varchar('vanity_url_code', { length: 255 }),
		invite_code: varchar('invite_code', { length: 255 }),
		greeted_at: datetime('greeted_at'),
		deleted_at: datetime('deleted_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		index('idx_servers_deleted_at').on(t.deleted_at),
		index('idx_servers_bot_id').on(t.bot_id),
		index('idx_servers_discord_id').on(t.discord_server_id),
		index('idx_servers_discord_created_at').on(t.discord_created_at),
		index('idx_servers_invite_code').on(t.invite_code)
	]
);

export const serverAccounts = mysqlTable(
	'server_accounts',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		username: varchar('username', { length: 255 }).notNull(),
		email: varchar('email', { length: 255 }).notNull(),
		password_hash: text('password_hash').notNull(),
		account_type: mysqlEnum('account_type', ['owner', 'staff']).notNull(),
		ip_address: text('ip_address'),
		is_frozen: boolean('is_frozen').default(false),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_email_server').on(t.email, t.server_id),
		uniqueIndex('unique_username_server').on(t.username, t.server_id),
		index('idx_server_accounts_server_id').on(t.server_id),
		index('idx_server_accounts_email').on(t.email)
	]
);

export const serverAccountInvites = mysqlTable(
	'server_account_invites',
	{
		id: int('id').primaryKey().autoincrement(),
		token: varchar('token', { length: 255 }).notNull().unique(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		account_type: mysqlEnum('account_type', ['owner', 'staff']).notNull(),
		used_by: int('used_by').references(() => serverAccounts.id, { onDelete: 'set null' }),
		expires_at: datetime('expires_at'),
		created_at: datetime('created_at').notNull(),
		used_at: datetime('used_at')
	},
	(t) => [index('idx_server_account_invites_token').on(t.token), index('idx_server_account_invites_server_id').on(t.server_id)]
);

export const serverBots = mysqlTable(
	'server_bots',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		name: text('name'),
		token: text('token'),
		bot_icon: text('bot_icon'),
		status: mysqlEnum('status', ['running', 'stopped', 'starting', 'stopping']).default('stopped'),
		process_id: int('process_id'),
		uptime_started_at: datetime('uptime_started_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at')
	},
	(t) => [index('idx_server_bots_server_id').on(t.server_id)]
);

export const serverBotStatus = mysqlTable(
	'server_bot_status',
	{
		id: int('id').primaryKey().autoincrement(),
		server_bot_id: int('server_bot_id')
			.notNull()
			.references(() => serverBots.id, { onDelete: 'cascade' }),
		discord_status: mysqlEnum('discord_status', ['online', 'idle', 'dnd', 'invisible']).notNull().default('online'),
		activity_type: mysqlEnum('activity_type', ['playing', 'streaming', 'listening', 'watching', 'custom', 'competing']).notNull().default('playing'),
		activity_name: varchar('activity_name', { length: 128 }).notNull().default(''),
		activity_url: text('activity_url'),
		activity_state: varchar('activity_state', { length: 128 }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('uq_server_bot_status_server_bot_id').on(t.server_bot_id)]
);

export const serverCategories = mysqlTable(
	'server_categories',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		discord_category_id: varchar('discord_category_id', { length: 150 }).notNull(),
		name: text('name'),
		position: int('position'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_category').on(t.server_id, t.discord_category_id),
		index('idx_server_categories_server_id').on(t.server_id),
		index('idx_server_categories_discord_id').on(t.discord_category_id)
	]
);

export const serverRoles = mysqlTable(
	'server_roles',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		discord_role_id: varchar('discord_role_id', { length: 150 }).notNull(),
		name: text('name'),
		position: int('position'),
		color: text('color'),
		permissions: text('permissions'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_role').on(t.server_id, t.discord_role_id),
		index('idx_server_roles_server_id').on(t.server_id),
		index('idx_server_roles_discord_id').on(t.discord_role_id)
	]
);

export const serverChannels = mysqlTable(
	'server_channels',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		discord_channel_id: varchar('discord_channel_id', { length: 150 }).notNull(),
		name: text('name'),
		type: text('type'),
		category_id: int('category_id').references(() => serverCategories.id, { onDelete: 'set null' }),
		position: int('position'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_channel').on(t.server_id, t.discord_channel_id),
		index('idx_server_channels_server_id').on(t.server_id),
		index('idx_server_channels_discord_id').on(t.discord_channel_id),
		index('idx_server_channels_category_id').on(t.category_id)
	]
);

export const serverBotServers = mysqlTable(
	'server_bot_servers',
	{
		id: int('id').primaryKey().autoincrement(),
		server_bot_id: int('server_bot_id')
			.notNull()
			.references(() => serverBots.id, { onDelete: 'cascade' }),
		discord_server_id: varchar('discord_server_id', { length: 150 }).notNull(),
		name: text('name'),
		total_members: int('total_members').default(0),
		total_channels: int('total_channels').default(0),
		total_boosters: int('total_boosters').default(0),
		boost_level: int('boost_level').default(0),
		server_icon: text('server_icon'),
		discord_created_at: datetime('discord_created_at'),
		vanity_url_code: varchar('vanity_url_code', { length: 255 }),
		invite_code: varchar('invite_code', { length: 255 }),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('uq_server_bot_server').on(t.server_bot_id, t.discord_server_id),
		index('idx_server_bot_servers_bot_id').on(t.server_bot_id),
		index('idx_server_bot_servers_discord_id').on(t.discord_server_id)
	]
);

export const serverBotServerCategories = mysqlTable(
	'server_bot_server_categories',
	{
		id: int('id').primaryKey().autoincrement(),
		server_bot_server_id: int('server_bot_server_id')
			.notNull()
			.references(() => serverBotServers.id, { onDelete: 'cascade' }),
		discord_category_id: varchar('discord_category_id', { length: 150 }).notNull(),
		name: text('name'),
		position: int('position'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('uq_server_bot_category').on(t.server_bot_server_id, t.discord_category_id),
		index('idx_server_bot_server_categories_server_id').on(t.server_bot_server_id),
		index('idx_server_bot_server_categories_discord_id').on(t.discord_category_id)
	]
);

export const serverBotServerChannels = mysqlTable(
	'server_bot_server_channels',
	{
		id: int('id').primaryKey().autoincrement(),
		server_bot_server_id: int('server_bot_server_id')
			.notNull()
			.references(() => serverBotServers.id, { onDelete: 'cascade' }),
		discord_channel_id: varchar('discord_channel_id', { length: 150 }).notNull(),
		name: text('name'),
		type: text('type'),
		discord_parent_category_id: varchar('discord_parent_category_id', { length: 150 }),
		position: int('position'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('uq_server_bot_channel').on(t.server_bot_server_id, t.discord_channel_id),
		index('idx_server_bot_server_channels_server_id').on(t.server_bot_server_id),
		index('idx_server_bot_server_channels_discord_id').on(t.discord_channel_id),
		index('idx_server_bot_server_channels_parent_discord').on(t.discord_parent_category_id)
	]
);

export const serverMembers = mysqlTable(
	'server_members',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		discord_member_id: varchar('discord_member_id', { length: 150 }).notNull(),
		username: text('username'),
		display_name: text('display_name'),
		server_display_name: text('server_display_name'),
		avatar: text('avatar'),
		profile_created_at: datetime('profile_created_at'),
		member_since: datetime('member_since'),
		is_booster: boolean('is_booster').default(false),
		booster_since: datetime('booster_since'),
		language: varchar('language', { length: 10 }).default('en'),
		deleted_at: datetime('deleted_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		index('idx_server_members_deleted_at').on(t.deleted_at),
		uniqueIndex('unique_server_member').on(t.server_id, t.discord_member_id),
		index('idx_server_members_server_id').on(t.server_id),
		index('idx_server_members_discord_id').on(t.discord_member_id),
		index('idx_server_members_language').on(t.language)
	]
);

export const serverMemberContentCreators = mysqlTable(
	'server_member_content_creators',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_member_content_creator').on(t.member_id), index('idx_server_member_content_creators_created').on(t.created_at)]
);

export const serverMemberLevels = mysqlTable(
	'server_member_levels',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		chat_total: int('chat_total').default(0),
		reactions_given: int('reactions_given').default(0),
		voice_minutes_total: int('voice_minutes_total').default(0),
		voice_minutes_active: int('voice_minutes_active').default(0),
		voice_minutes_afk: int('voice_minutes_afk').default(0),
		voice_minutes_video: int('voice_minutes_video').default(0),
		voice_minutes_streaming: int('voice_minutes_streaming').default(0),
		xp: int('xp').default(0),
		level: int('level').default(1),
		is_in_voice: boolean('is_in_voice').default(false),
		is_in_video: boolean('is_in_video').default(false),
		is_in_stream: boolean('is_in_stream').default(false),
		rank: int('rank'),
		chat_rewarded_at: datetime('chat_rewarded_at'),
		voice_rewarded_at: datetime('voice_rewarded_at'),
		video_rewarded_at: datetime('video_rewarded_at'),
		stream_rewarded_at: datetime('stream_rewarded_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_levels_member_id').on(t.member_id), index('idx_server_member_levels_rank').on(t.rank)]
);

export const serverMemberNotifications = mysqlTable(
	'server_member_notifications',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		channel_id: int('channel_id')
			.notNull()
			.references(() => serverChannels.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_member_notification_channel').on(t.member_id, t.channel_id), index('idx_server_member_notifications_channel').on(t.channel_id)]
);

export const serverMemberRoles = mysqlTable(
	'server_member_roles',
	{
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		role_id: int('role_id')
			.notNull()
			.references(() => serverRoles.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_server_member_role').on(t.member_id, t.role_id), index('idx_server_member_roles_member').on(t.member_id)]
);

export const serverMemberCustomSupporterRoles = mysqlTable(
	'server_member_custom_supporter_roles',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		role_id: int('role_id')
			.notNull()
			.references(() => serverRoles.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_member_custom_supporter_role').on(t.member_id, t.role_id), index('idx_server_member_custom_supporter_roles_role').on(t.role_id)]
);

export const serverMemberAfks = mysqlTable(
	'server_member_afks',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		message: text('message'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_afks_member_id').on(t.member_id)]
);

export const serverSettings = mysqlTable(
	'server_settings',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		component_name: varchar('component_name', { length: 150 }).notNull(),
		settings: json('settings').notNull().default({}),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_component').on(t.server_id, t.component_name),
		index('idx_server_settings_server_id').on(t.server_id),
		index('idx_server_settings_component').on(t.server_id, t.component_name)
	]
);

export const botDiscordQuest = mysqlTable(
	'bot_discord_quests',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
		quest_id: varchar('quest_id', { length: 64 }).notNull(),
		quest_task_type: varchar('quest_task_type', { length: 64 }).notNull().default(''),
		quest_task_label: varchar('quest_task_label', { length: 128 }).notNull().default(''),
		quest_name: text('quest_name'),
		game_title: text('game_title'),
		quest_url: varchar('quest_url', { length: 512 }),
		quest_description: text('quest_description'),
		reward: text('reward'),
		thumbnail_url: varchar('thumbnail_url', { length: 512 }),
		banner_url: varchar('banner_url', { length: 512 }),
		starts_at: datetime('starts_at'),
		expires_at: datetime('expires_at'),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_bot_discord_quests_quest').on(t.quest_id), index('idx_bot_discord_quests_bot_id').on(t.bot_id)]
);

export const serverDiscordQuest = mysqlTable(
	'server_discord_quests',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		quest_id: int('quest_id')
			.notNull()
			.references(() => botDiscordQuest.id, { onDelete: 'cascade' }),
		message_posted_at: datetime('message_posted_at')
	},
	(t) => [uniqueIndex('unique_server_discord_quests').on(t.server_id, t.quest_id), index('idx_server_discord_quests_server_id').on(t.server_id)]
);

export const serverMemberDiscordQuest = mysqlTable(
	'server_member_discord_quests',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		quest_id: int('quest_id')
			.notNull()
			.references(() => serverDiscordQuest.id, { onDelete: 'cascade' }),
		reward_claimed: boolean('reward_claimed').notNull().default(false),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_server_member_discord_quests').on(t.member_id, t.quest_id), index('idx_server_member_discord_quests_member').on(t.member_id)]
);

export const botRobloxItems = mysqlTable(
	'bot_roblox_items',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
		asset_id: bigint('asset_id', { mode: 'bigint' }).notNull(),
		asset_type: int('asset_type'),
		category: varchar('category', { length: 512 }),
		name: text('name'),
		description: text('description'),
		creator_name: text('creator_name'),
		price: bigint('price', { mode: 'bigint' }),
		lowest_resale_price: bigint('lowest_resale_price', { mode: 'bigint' }),
		total_quantity: bigint('total_quantity', { mode: 'bigint' }),
		favorite_count: int('favorite_count'),
		units_available: bigint('units_available', { mode: 'bigint' }),
		thumbnail_url: varchar('thumbnail_url', { length: 512 }),
		item_created_at: datetime('item_created_at'),
		last_price: bigint('last_price', { mode: 'bigint' }),
		last_lowest_resale_price: bigint('last_lowest_resale_price', { mode: 'bigint' }),
		last_total_quantity: bigint('last_total_quantity', { mode: 'bigint' }),
		last_units_available: bigint('last_units_available', { mode: 'bigint' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_bot_roblox_items_asset').on(t.asset_id), index('idx_bot_roblox_items_bot_id').on(t.bot_id)]
);

export const serverRobloxItems = mysqlTable(
	'server_roblox_items',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		item_id: int('item_id')
			.notNull()
			.references(() => botRobloxItems.id, { onDelete: 'cascade' }),
		message_posted_at: datetime('message_posted_at')
	},
	(t) => [uniqueIndex('unique_server_roblox_items').on(t.server_id, t.item_id), index('idx_server_roblox_items_server_id').on(t.server_id)]
);

export const serverMemberGiveaways = mysqlTable(
	'server_member_giveaways',
	{
		id: int('id').primaryKey().autoincrement(),
		discord_message_id: varchar('discord_message_id', { length: 150 }),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		prize: text('prize').notNull(),
		duration_minutes: int('duration_minutes').notNull(),
		allowed_roles: json('allowed_roles'),
		multiple_entries_allowed: boolean('multiple_entries_allowed').default(false),
		winner_count: int('winner_count').notNull().default(1),
		status: mysqlEnum('status', ['active', 'ended', 'ended_force']).default('active'),
		ends_at: datetime('ends_at').notNull(),
		winners_announced: boolean('winners_announced').default(false),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		index('idx_server_member_giveaways_member_id').on(t.member_id),
		index('idx_server_member_giveaways_status').on(t.status),
		index('idx_server_member_giveaways_ends_at').on(t.ends_at)
	]
);

export const serverMemberGiveawayEntries = mysqlTable(
	'server_member_giveaway_entries',
	{
		id: int('id').primaryKey().autoincrement(),
		giveaway_id: int('giveaway_id')
			.notNull()
			.references(() => serverMemberGiveaways.id, { onDelete: 'cascade' }),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		entry_count: int('entry_count').default(1),
		is_winner: boolean('is_winner').default(false),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_giveaway_member').on(t.giveaway_id, t.member_id),
		index('idx_server_member_giveaway_entries_giveaway_id').on(t.giveaway_id),
		index('idx_server_member_giveaway_entries_member_id').on(t.member_id)
	]
);

export const serverMemberStaffRatings = mysqlTable(
	'server_member_staff_ratings',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		role_id: int('role_id').references(() => serverRoles.id, { onDelete: 'set null' }),
		current_rating: decimal('current_rating', { precision: 3, scale: 2 }).default('0'),
		total_reports: int('total_reports').default(0),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_staff_ratings_member').on(t.member_id), index('idx_server_member_staff_ratings_role').on(t.role_id)]
);

export const serverMemberStaffRatingReviews = mysqlTable(
	'server_member_staff_rating_reviews',
	{
		id: int('id').primaryKey().autoincrement(),
		reporter_member_id: int('reporter_member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		reported_staff_id: int('reported_staff_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		rating: tinyint('rating').notNull(),
		category: varchar('category', { length: 50 }).notNull(),
		description: text('description'),
		is_anonymous: boolean('is_anonymous').default(false),
		status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
		reviewed_by_member_id: int('reviewed_by_member_id').references(() => serverMembers.id, { onDelete: 'set null' }),
		reviewed_at: datetime('reviewed_at'),
		review_reason: text('review_reason'),
		reported_at: datetime('reported_at').notNull()
	},
	(t) => [
		index('idx_server_member_staff_rating_reviews_staff').on(t.reported_staff_id),
		index('idx_server_member_staff_rating_reviews_pair').on(t.reporter_member_id, t.reported_staff_id),
		index('idx_server_member_staff_rating_reviews_status').on(t.status),
		index('idx_server_member_staff_rating_reviews_reviewer').on(t.reviewed_by_member_id)
	]
);

export const serverFeedback = mysqlTable(
	'server_member_feedbacks',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		is_anonymous: boolean('is_anonymous').default(false),
		submitted_at: datetime('submitted_at').notNull()
	},
	(t) => [index('idx_server_member_feedbacks_member').on(t.member_id)]
);

export const serverMemberContentCreatorReviews = mysqlTable(
	'server_member_content_creator_reviews',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		tiktok_username: varchar('tiktok_username', { length: 100 }).notNull(),
		reason: text('reason').notNull(),
		status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
		reviewed_by_member_id: int('reviewed_by_member_id').references(() => serverMembers.id, { onDelete: 'set null' }),
		reviewed_at: datetime('reviewed_at'),
		review_reason: text('review_reason'),
		submitted_at: datetime('submitted_at').notNull()
	},
	(t) => [
		index('idx_server_member_content_creator_reviews_member').on(t.member_id),
		index('idx_server_member_content_creator_reviews_status').on(t.status),
		index('idx_server_member_content_creator_reviews_submitted_at').on(t.submitted_at)
	]
);

export const serverMemberContentCreatorStreams = mysqlTable(
	'server_member_content_creator_streams',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		room_id: varchar('room_id', { length: 64 }),
		status: mysqlEnum('status', ['active', 'ended', 'error']).notNull().default('active'),
		started_at: datetime('started_at').notNull(),
		ended_at: datetime('ended_at'),
		peak_viewers: int('peak_viewers'),
		total_likes: int('total_likes').notNull().default(0),
		total_chat_messages: int('total_chat_messages').notNull().default(0),
		total_gifts: int('total_gifts').notNull().default(0),
		total_follows: int('total_follows').notNull().default(0),
		total_shares: int('total_shares').notNull().default(0),
		unique_chatters: int('unique_chatters'),
		discord_channel_id: varchar('discord_channel_id', { length: 32 }),
		discord_thread_id: varchar('discord_thread_id', { length: 32 }),
		error_message: text('error_message'),
		updated_at: datetime('updated_at')
	},
	(t) => [index('idx_cc_streams_member_started').on(t.member_id, t.started_at), index('idx_cc_streams_status').on(t.status)]
);

export const serverMemberContentCreatorStreamLogs = mysqlTable(
	'server_member_content_creator_stream_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		stream_id: int('stream_id')
			.notNull()
			.references(() => serverMemberContentCreatorStreams.id, { onDelete: 'cascade' }),
		event_type: varchar('event_type', { length: 64 }).notNull(),
		occurred_at: datetime('occurred_at').notNull(),
		payload: json('payload')
	},
	(t) => [index('idx_cc_stream_logs_stream_time').on(t.stream_id, t.occurred_at), index('idx_cc_stream_logs_event').on(t.stream_id, t.event_type)]
);

export const accountInvites = mysqlTable('account_invites', {
	id: int('id').primaryKey().autoincrement(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	account_type: text('account_type').notNull(),
	server_id: int('server_id').references(() => servers.id, { onDelete: 'set null' }),
	created_by: int('created_by')
		.notNull()
		.references(() => accounts.id, { onDelete: 'cascade' }),
	used_by: int('used_by').references(() => accounts.id, { onDelete: 'set null' }),
	expires_at: datetime('expires_at'),
	created_at: datetime('created_at').notNull(),
	used_at: datetime('used_at')
});

export const accountServerAccess = mysqlTable('account_server_access', {
	id: int('id').primaryKey().autoincrement(),
	account_id: int('account_id')
		.notNull()
		.references(() => accounts.id, { onDelete: 'cascade' }),
	server_id: int('server_id')
		.notNull()
		.references(() => servers.id, { onDelete: 'cascade' }),
	role: mysqlEnum('role', ['owner', 'staff']).notNull(),
	created_at: datetime('created_at').notNull()
});

export const items = mysqlTable(
	'items',
	{
		id: int('id').primaryKey().autoincrement(),
		panel_id: int('panel_id')
			.notNull()
			.references(() => panel.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 150 }).notNull(),
		effect_type: varchar('effect_type', { length: 32 }).notNull(),
		description: text('description'),
		cost: int('cost').notNull().default(0),
		config: json('config').notNull().default({}),
		enabled: boolean('enabled').notNull().default(true),
		usable: boolean('usable').notNull().default(true),
		available_from: datetime('available_from', { mode: 'string' }),
		available_to: datetime('available_to', { mode: 'string' }),
		recurring_schedule: json('recurring_schedule'),
		sort_order: int('sort_order').notNull().default(0),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_items_panel_id').on(t.panel_id), index('idx_items_enabled').on(t.panel_id, t.enabled)]
);

export const serverMemberItems = mysqlTable(
	'server_member_items',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		item_id: int('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		quantity: int('quantity').notNull().default(1),
		acquired_at: datetime('acquired_at').notNull(),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [uniqueIndex('unique_server_member_item').on(t.member_id, t.item_id), index('idx_server_member_items_member').on(t.member_id)]
);

export const serverMemberItemActives = mysqlTable(
	'server_member_item_actives',
	{
		id: int('id').primaryKey().autoincrement(),
		member_item_id: int('member_item_id')
			.notNull()
			.references(() => serverMemberItems.id, { onDelete: 'cascade' }),
		effect_value: decimal('effect_value', { precision: 6, scale: 2 }).notNull().default('0'),
		beneficiary_member_id: int('beneficiary_member_id').references(() => serverMembers.id, { onDelete: 'set null' }),
		target_member_id: int('target_member_id').references(() => serverMembers.id, { onDelete: 'cascade' }),
		expires_at: datetime('expires_at').notNull(),
		expiry_notified: boolean('expiry_notified').notNull().default(false),
		elapsed_minutes: int('elapsed_minutes').notNull().default(0),
		created_at: datetime('created_at').notNull()
	},
	(t) => [
		index('idx_server_member_item_actives_active').on(t.member_item_id, t.expires_at),
		index('idx_server_member_item_actives_beneficiary').on(t.beneficiary_member_id, t.expires_at),
		index('idx_server_member_item_actives_target').on(t.target_member_id, t.expires_at),
		index('idx_server_member_item_actives_sweep').on(t.expiry_notified, t.expires_at)
	]
);

export const serverMemberItemLogs = mysqlTable(
	'server_member_item_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		member_item_id: int('member_item_id').references(() => serverMemberItems.id, { onDelete: 'set null' }),
		target_member_id: int('target_member_id').references(() => serverMembers.id, { onDelete: 'set null' }),
		item_id: int('item_id').references(() => items.id, { onDelete: 'set null' }),
		action: varchar('action', { length: 32 }).notNull(),
		xp: int('xp').notNull().default(0),
		outcome: varchar('outcome', { length: 16 }).notNull(),
		rate_percent: decimal('rate_percent', { precision: 6, scale: 2 }),
		luck_percent: decimal('luck_percent', { precision: 6, scale: 2 }),
		actor_disguised: tinyint('actor_disguised').notNull().default(0),
		immunity_cleared: tinyint('immunity_cleared').notNull().default(0),
		created_at: datetime('created_at').notNull()
	},
	(t) => [
		index('idx_server_member_item_logs_member').on(t.member_id, t.created_at),
		index('idx_server_member_item_logs_target').on(t.target_member_id, t.created_at)
	]
);

export const serverMemberTasks = mysqlTable(
	'server_member_tasks',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		period: varchar('period', { length: 8 }).notNull().default('daily'),
		day_key: int('day_key').notNull(),
		slot: tinyint('slot').notNull(),
		task_type: varchar('task_type', { length: 32 }).notNull(),
		difficulty: varchar('difficulty', { length: 8 }).notNull(),
		goal: int('goal').notNull().default(1),
		baseline: int('baseline').notNull().default(0),
		target_item_id: int('target_item_id').references(() => items.id, { onDelete: 'set null' }),
		reward_kind: varchar('reward_kind', { length: 8 }).notNull(),
		xp_reward: int('xp_reward').notNull().default(0),
		reward_item_id: int('reward_item_id').references(() => items.id, { onDelete: 'set null' }),
		claimed_at: datetime('claimed_at'),
		created_at: datetime('created_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_member_task').on(t.member_id, t.period, t.day_key, t.slot),
		index('idx_server_member_tasks_member').on(t.member_id, t.period, t.day_key)
	]
);

export const serverMemberClaims = mysqlTable(
	'server_member_claims',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		cycle_day: tinyint('cycle_day').notNull().default(0),
		last_claim_day_key: int('last_claim_day_key'),
		cycles_completed: int('cycles_completed').notNull().default(0),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_claims_member').on(t.member_id)]
);

export const serverMemberStreaks = mysqlTable(
	'server_member_streaks',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		current_streak: int('current_streak').notNull().default(0),
		longest_streak: int('longest_streak').notNull().default(0),
		last_claim_day_key: int('last_claim_day_key'),
		freezes_available: int('freezes_available').notNull().default(2),
		total_claims: int('total_claims').notNull().default(0),
		tz_offset_min: int('tz_offset_min'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_streaks_member').on(t.member_id)]
);

export const serverMemberMinigameLogs = mysqlTable(
	'server_member_minigame_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		game: varchar('game', { length: 24 }).notNull().default('gamble'),
		multiplier: decimal('multiplier', { precision: 6, scale: 2 }).notNull().default('2'),
		wager: int('wager').notNull().default(0),
		payout: int('payout').notNull().default(0),
		xp: int('xp').notNull().default(0),
		outcome: varchar('outcome', { length: 16 }).notNull(),
		chance: decimal('chance', { precision: 6, scale: 2 }),
		luck_percent: decimal('luck_percent', { precision: 6, scale: 2 }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [index('idx_server_member_minigame_logs_member').on(t.member_id, t.created_at), index('idx_server_member_minigame_logs_created').on(t.created_at)]
);

export const serverMemberLevelFriends = mysqlTable(
	'server_member_level_friends',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_a_id: int('member_a_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		member_b_id: int('member_b_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		ticks: int('ticks').notNull().default(0),
		minutes: int('minutes').notNull().default(0),
		xp: bigint('xp', { mode: 'number' }).notNull().default(0),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('uniq_level_friends_pair').on(t.member_a_id, t.member_b_id),
		index('idx_level_friends_a').on(t.member_a_id, t.ticks),
		index('idx_level_friends_b').on(t.member_b_id, t.ticks)
	]
);

export const serverMemberLevelLogs = mysqlTable(
	'server_member_level_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		source: varchar('source', { length: 24 }).notNull(),
		xp: int('xp').notNull().default(0),
		xp_total: bigint('xp_total', { mode: 'number' }),
		level: int('level'),
		rank: int('rank'),
		multiplier: decimal('multiplier', { precision: 6, scale: 2 }),
		skim_percent: int('skim_percent'),
		friend_percent: int('friend_percent'),
		luck_percent: int('luck_percent'),
		created_at: datetime('created_at').notNull()
	},
	(t) => [index('idx_server_member_level_logs_member').on(t.member_id, t.created_at)]
);

export const serverMemberItemBounties = mysqlTable(
	'server_member_item_bounties',
	{
		id: int('id').primaryKey().autoincrement(),
		target_member_id: int('target_member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		placed_by_member_id: int('placed_by_member_id').references(() => serverMembers.id, { onDelete: 'set null' }),
		xp: int('xp').notNull().default(0),
		collected: boolean('collected').notNull().default(false),
		created_at: datetime('created_at').notNull()
	},
	(t) => [index('idx_server_member_item_bounties_target').on(t.target_member_id, t.collected)]
);

export const serverMemberItemNotifications = mysqlTable(
	'server_member_item_notifications',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		notification_type: varchar('notification_type', { length: 24 }).notNull(),
		notified_for_at: datetime('notified_for_at').notNull(),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_member_item_notification').on(t.member_id, t.notification_type, t.notified_for_at)]
);

export const serverMemberAssets = mysqlTable(
	'server_member_assets',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		asset_type: varchar('asset_type', { length: 24 }).notNull().default('crypto'),
		asset_id: varchar('asset_id', { length: 96 }).notNull(),
		symbol: varchar('symbol', { length: 32 }).notNull(),
		asset_name: varchar('asset_name', { length: 128 }).notNull(),
		asset_image: varchar('asset_image', { length: 255 }),
		xp_invested: int('xp_invested').notNull().default(0),
		buy_price: decimal('buy_price', { precision: 30, scale: 12 }).notNull(),
		opened_at: datetime('opened_at').notNull(),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_assets_member').on(t.member_id), index('idx_server_member_assets_held').on(t.asset_type, t.asset_id)]
);

export const serverMemberAssetLogs = mysqlTable(
	'server_member_asset_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		action: varchar('action', { length: 8 }).notNull(),
		asset_type: varchar('asset_type', { length: 24 }).notNull().default('crypto'),
		asset_id: varchar('asset_id', { length: 96 }).notNull(),
		symbol: varchar('symbol', { length: 32 }).notNull(),
		asset_name: varchar('asset_name', { length: 128 }).notNull(),
		asset_image: varchar('asset_image', { length: 255 }),
		xp: int('xp').notNull().default(0),
		price: decimal('price', { precision: 30, scale: 12 }).notNull().default('0'),
		net: int('net').notNull().default(0),
		created_at: datetime('created_at').notNull()
	},
	(t) => [index('idx_server_member_asset_logs_member').on(t.member_id, t.created_at)]
);
