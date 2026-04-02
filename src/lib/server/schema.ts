import { mysqlTable, int, varchar, text, boolean, datetime, mysqlEnum, json, decimal, tinyint, uniqueIndex, index } from 'drizzle-orm/mysql-core';

export const migrations = mysqlTable('migrations', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 255 }).notNull().unique(),
	ran_at: datetime('ran_at').notNull()
});

export const panel = mysqlTable('panel', {
	id: int('id').primaryKey().autoincrement(),
	created_at: datetime('created_at').notNull(),
	updated_at: datetime('updated_at').notNull()
});

export const accounts = mysqlTable(
	'accounts',
	{
		id: int('id').primaryKey().autoincrement(),
		username: varchar('username', { length: 255 }).notNull().unique(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		password_hash: text('password_hash').notNull(),
		account_type: mysqlEnum('account_type', ['superadmin']).notNull().default('superadmin'),
		email_verified: boolean('email_verified').default(false),
		otp_code: varchar('otp_code', { length: 6 }),
		otp_expires_at: datetime('otp_expires_at'),
		panel_id: int('panel_id').references(() => panel.id, { onDelete: 'set null' }),
		ip_address: text('ip_address'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_accounts_email').on(t.email), index('idx_accounts_username').on(t.username), index('idx_accounts_panel_id').on(t.panel_id)]
);

export const bots = mysqlTable('bots', {
	id: int('id').primaryKey().autoincrement(),
	name: text('name').notNull(),
	token: text('token').notNull(),
	application_id: text('application_id'),
	bot_icon: text('bot_icon'),
	port: int('port'),
	secret_key: text('secret_key'),
	account_id: int('account_id').references(() => accounts.id, { onDelete: 'set null' }),
	is_testing: boolean('is_testing').default(false),
	status: mysqlEnum('status', ['running', 'stopped', 'starting', 'stopping']).default('stopped'),
	process_id: int('process_id'),
	uptime_started_at: datetime('uptime_started_at'),
	created_at: datetime('created_at').notNull(),
	updated_at: datetime('updated_at').notNull()
});

export const servers = mysqlTable(
	'servers',
	{
		id: int('id').primaryKey().autoincrement(),
		bot_id: int('bot_id')
			.notNull()
			.references(() => bots.id, { onDelete: 'cascade' }),
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
		uniqueIndex('unique_bot_server').on(t.bot_id, t.discord_server_id),
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
		account_type: mysqlEnum('account_type', ['owner', 'moderator']).notNull(),
		email_verified: boolean('email_verified').default(false),
		otp_code: varchar('otp_code', { length: 6 }),
		otp_expires_at: datetime('otp_expires_at'),
		ip_address: text('ip_address'),
		is_frozen: boolean('is_frozen').default(false),
		invited_by: int('invited_by'),
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
		account_type: mysqlEnum('account_type', ['owner', 'moderator']).notNull(),
		created_by: int('created_by')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
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
		status: mysqlEnum('status', ['running', 'stopped', 'starting', 'stopping']).default('stopped'),
		process_id: int('process_id'),
		is_testing: boolean('is_testing').default(false),
		uptime_started_at: datetime('uptime_started_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at')
	},
	(t) => [index('idx_server_bots_server_id').on(t.server_id)]
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
		notification_role_id: int('notification_role_id').references(() => serverRoles.id, { onDelete: 'set null' }),
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
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_server_member').on(t.server_id, t.discord_member_id),
		index('idx_server_members_server_id').on(t.server_id),
		index('idx_server_members_discord_id').on(t.discord_member_id),
		index('idx_server_members_language').on(t.language)
	]
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
		voice_minutes_total: int('voice_minutes_total').default(0),
		voice_minutes_active: int('voice_minutes_active').default(0),
		voice_minutes_afk: int('voice_minutes_afk').default(0),
		experience: int('experience').default(0),
		level: int('level').default(1),
		dm_notifications_enabled: boolean('dm_notifications_enabled').default(true),
		is_in_voice: boolean('is_in_voice').default(false),
		rank: int('rank'),
		chat_rewarded_at: datetime('chat_rewarded_at'),
		voice_rewarded_at: datetime('voice_rewarded_at'),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_member_levels_member_id').on(t.member_id), index('idx_server_member_levels_rank').on(t.rank)]
);

export const serverMemberRoles = mysqlTable(
	'server_member_roles',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		role_id: int('role_id')
			.notNull()
			.references(() => serverRoles.id, { onDelete: 'cascade' }),
		is_custom: boolean('is_custom').default(false),
		is_rating: boolean('is_rating').default(false),
		is_notification: boolean('is_notification').default(false),
		created_at: datetime('created_at').notNull()
	},
	(t) => [
		uniqueIndex('unique_member_role').on(t.member_id, t.role_id),
		index('idx_server_member_roles_member_id').on(t.member_id),
		index('idx_server_member_roles_role_id').on(t.role_id)
	]
);

export const serverMembersAfk = mysqlTable(
	'server_members_afk',
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
	(t) => [index('idx_server_members_afk_member_id').on(t.member_id)]
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

export const serverGiveaways = mysqlTable(
	'server_giveaways',
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
		index('idx_server_giveaways_member_id').on(t.member_id),
		index('idx_server_giveaways_status').on(t.status),
		index('idx_server_giveaways_ends_at').on(t.ends_at)
	]
);

export const serverGiveawayEntries = mysqlTable(
	'server_giveaway_entries',
	{
		id: int('id').primaryKey().autoincrement(),
		giveaway_id: int('giveaway_id')
			.notNull()
			.references(() => serverGiveaways.id, { onDelete: 'cascade' }),
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
		index('idx_server_giveaway_entries_giveaway_id').on(t.giveaway_id),
		index('idx_server_giveaway_entries_member_id').on(t.member_id)
	]
);

export const serverStaffRatings = mysqlTable(
	'server_staff_ratings',
	{
		id: int('id').primaryKey().autoincrement(),
		staff_member_id: int('staff_member_id')
			.notNull()
			.unique()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		current_rating: decimal('current_rating', { precision: 3, scale: 2 }).default('0'),
		total_reports: int('total_reports').default(0),
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [index('idx_server_staff_ratings_member').on(t.staff_member_id)]
);

export const serverStaffReports = mysqlTable(
	'server_staff_reports',
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
		reported_at: datetime('reported_at').notNull()
	},
	(t) => [
		index('idx_server_staff_reports_staff').on(t.reported_staff_id),
		index('idx_server_staff_reports_pair').on(t.reporter_member_id, t.reported_staff_id),
		index('idx_server_staff_reports_status').on(t.status)
	]
);

export const serverFeedback = mysqlTable(
	'server_feedback',
	{
		id: int('id').primaryKey().autoincrement(),
		member_id: int('member_id')
			.notNull()
			.references(() => serverMembers.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		is_anonymous: boolean('is_anonymous').default(false),
		submitted_at: datetime('submitted_at').notNull()
	},
	(t) => [index('idx_server_feedback_member').on(t.member_id)]
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
	role: mysqlEnum('role', ['owner', 'moderator']).notNull(),
	invited_by: int('invited_by'),
	created_at: datetime('created_at').notNull()
});
