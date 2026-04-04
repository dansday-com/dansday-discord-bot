/**
 * Canonical values for `server_settings.component_name`.
 * Use these for API payloads, `getServerSettings` / `upsertServerSettings`, and bot reads.
 */
export const serverSettingsComponent = {
	main: 'main',
	permissions: 'permissions',
	notifications: 'notifications',
	leveling: 'leveling',
	leaderboard: 'leaderboard',
	custom_supporter_role: 'custom_supporter_role',
	giveaway: 'giveaway',
	welcomer: 'welcomer',
	booster: 'booster',
	feedback: 'feedback',
	forwarder: 'forwarder',
	discord_quest_notifier: 'discord_quest_notifier',
	content_creator: 'content_creator',
	moderation: 'moderation',
	afk: 'afk',
	staff_rating: 'staff_rating'
} as const;

export type ServerSettingsComponentName = (typeof serverSettingsComponent)[keyof typeof serverSettingsComponent];
