import { mysqlTable, int, varchar, text, boolean, datetime, mysqlEnum, json, decimal, tinyint, uniqueIndex, index, bigint } from 'drizzle-orm/mysql-core';

export const migrations = mysqlTable('migrations', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 255 }).notNull().unique(),
	ran_at: datetime('ran_at').notNull()
});

export const panel = mysqlTable('panels', {
	id: int('id').primaryKey().autoincrement(),
	slug: varchar('slug', { length: 64 }).notNull().default('default'),
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
		panel_id: int('panel_id')
			.notNull()
			.references(() => panel.id, { onDelete: 'cascade' }),
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
	account_id: int('account_id')
		.notNull()
		.references(() => accounts.id, { onDelete: 'cascade' }),
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
		created_at: datetime('created_at').notNull(),
		updated_at: datetime('updated_at').notNull()
	},
	(t) => [
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
		created_by: int('created_by').references(() => serverAccounts.id, { onDelete: 'set null' }),
		created_by_admin: int('created_by_admin').references(() => accounts.id, { onDelete: 'set null' }),
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
		voice_minutes_total: int('voice_minutes_total').default(0),
		voice_minutes_active: int('voice_minutes_active').default(0),
		voice_minutes_afk: int('voice_minutes_afk').default(0),
		voice_minutes_video: int('voice_minutes_video').default(0),
		voice_minutes_streaming: int('voice_minutes_streaming').default(0),
		experience: int('experience').default(0),
		level: int('level').default(1),
		dm_notifications_enabled: boolean('dm_notifications_enabled').default(true),
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
		role_id: int('role_id')
			.notNull()
			.references(() => serverRoles.id, { onDelete: 'cascade' }),
		created_at: datetime('created_at').notNull()
	},
	(t) => [uniqueIndex('unique_member_notification_role').on(t.member_id, t.role_id), index('idx_server_member_notifications_role').on(t.role_id)]
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

export const botDiscordOrb = mysqlTable(
	'bot_discord_orbs',
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
		orb_hint: text('orb_hint'),
		rewards_line: text('rewards_line'),
		task_detail_line: text('task_detail_line'),
		starts_at: datetime('starts_at'),
		expires_at: datetime('expires_at'),
		notified_at: datetime('notified_at').notNull()
	},
	(t) => [uniqueIndex('unique_bot_discord_orbs_quest').on(t.quest_id), index('idx_bot_discord_orbs_bot_id').on(t.bot_id)]
);

export const serverDiscordOrb = mysqlTable(
	'server_discord_orbs',
	{
		id: int('id').primaryKey().autoincrement(),
		server_id: int('server_id')
			.notNull()
			.references(() => servers.id, { onDelete: 'cascade' }),
		quest_id: int('quest_id')
			.notNull()
			.references(() => botDiscordOrb.id, { onDelete: 'cascade' }),
		message_posted_at: datetime('message_posted_at')
	},
	(t) => [uniqueIndex('unique_server_discord_orbs').on(t.server_id, t.quest_id), index('idx_server_discord_orbs_server_id').on(t.server_id)]
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
		id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
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
	role: mysqlEnum('role', ['owner', 'moderator']).notNull(),
	created_at: datetime('created_at').notNull()
});
