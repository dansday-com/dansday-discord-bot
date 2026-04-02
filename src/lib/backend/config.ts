import db from '../database.js';

interface BotConfig {
	id: number;
	token: string;
	application_id: string | null;
	isSelfbot: boolean;
	port: number | null;
	secret_key: string | null;
	is_testing: boolean;
}

let botConfig: BotConfig | null = null;

async function loadBotConfig() {
	const botId = process.env.BOT_ID;

	if (!botId) {
		throw new Error('BOT_ID not set in environment. Bot cannot start without database configuration.');
	}

	const numericId = Number(botId);
	const selfbot = await db.getServerBotById(numericId);

	if (selfbot) {
		const officialBot = await db.getOfficialBotForSelfbot(selfbot.id);
		botConfig = {
			id: selfbot.id,
			token: selfbot.token,
			application_id: null,
			isSelfbot: true,
			port: officialBot?.port ?? null,
			secret_key: officialBot?.secret_key ?? null,
			is_testing: officialBot?.is_testing || selfbot.is_testing || false
		};
		return botConfig;
	}

	const bot = await db.getBot(numericId);
	if (!bot) {
		throw new Error(`Bot not found in database with ID: ${botId}`);
	}

	botConfig = {
		id: bot.id,
		token: bot.token,
		application_id: bot.application_id,
		isSelfbot: false,
		port: bot.port,
		secret_key: bot.secret_key,
		is_testing: bot.is_testing || false
	};

	return botConfig;
}

export async function initializeConfig() {
	await loadBotConfig();
}

export function getBotConfig() {
	return botConfig;
}

function requireBotConfig() {
	if (!botConfig) {
		throw new Error('Bot config not loaded. Call initializeConfig() first.');
	}
}

function requireGuildId(guildId: any, action = 'operation') {
	if (!guildId) {
		throw new Error(`Guild ID is required for ${action}.`);
	}
}

async function getOfficialBotId() {
	requireBotConfig();
	if (botConfig!.isSelfbot) {
		const officialBot = await db.getOfficialBotForSelfbot(botConfig!.id);
		if (officialBot) return officialBot.id as number;
	}
	return botConfig!.id;
}

export async function getServerForCurrentBot(guildId: string) {
	requireBotConfig();
	requireGuildId(guildId, 'getting server');

	const server = await db.getServerByDiscordId(botConfig!.id, guildId);
	if (!server) {
		throw new Error(`Server not found for guild ${guildId}`);
	}

	return server;
}

async function getOfficialBotServer(guildId: string) {
	requireBotConfig();
	requireGuildId(guildId, 'getting server');

	const officialBotId = await getOfficialBotId();
	const officialBotServer = await db.getServerByDiscordId(officialBotId, guildId);

	if (!officialBotServer) {
		throw new Error(`Server not found for guild ${guildId} in official bot ${officialBotId}`);
	}

	return officialBotServer;
}

async function getServerSettingsForComponent(guildId: string, componentName: string) {
	const officialBotServer = await getOfficialBotServer(guildId);
	const settings = await db.getServerSettings(officialBotServer.id, componentName);

	if (!settings || !settings.settings) {
		throw new Error(`Server settings not found for guild ${guildId} (component: ${componentName})`);
	}

	return settings;
}

export function getBotToken(botType: string) {
	if (!botConfig) {
		throw new Error('Bot config not loaded. Call initializeConfig() first.');
	}
	if (botConfig.isSelfbot !== (botType === 'selfbot')) {
		throw new Error(`Bot type mismatch. Expected ${botType}, got ${botConfig.isSelfbot ? 'selfbot' : 'official'}`);
	}
	if (!botConfig.token) {
		throw new Error('Bot token not found in database configuration.');
	}
	return botConfig.token;
}

export function getApplicationId() {
	if (!botConfig) {
		throw new Error('Bot config not loaded. Call initializeConfig() first.');
	}
	if (!botConfig.application_id) {
		throw new Error('Application ID not found in database configuration.');
	}
	return botConfig.application_id;
}

export async function getMainChannel(guildId: string) {
	requireBotConfig();
	requireGuildId(guildId, 'getting main channel');

	const settings = await getServerSettingsForComponent(guildId, 'main_config');
	const channelId = botConfig!.is_testing ? settings.settings.testing_channel : settings.settings.production_channel;

	if (!channelId) {
		throw new Error(`Channel not configured for ${botConfig!.is_testing ? 'testing' : 'production'} mode in guild ${guildId}`);
	}

	return channelId;
}

export const PERMISSIONS = {
	async getPermissions(guildId: string) {
		requireGuildId(guildId, 'permissions');
		requireBotConfig();
		const server = await db.getServerByDiscordId(botConfig!.id, guildId);
		if (!server) {
			throw new Error(`Server not found for guild ${guildId}`);
		}
		const settings = await db.getServerSettings(server.id, 'permissions');
		if (!settings || !settings.settings) {
			throw new Error(`Permissions not configured for guild ${guildId}`);
		}
		return {
			ADMIN_ROLES: settings.settings.admin_roles || [],
			STAFF_ROLES: settings.settings.staff_roles || [],
			SUPPORTER_ROLES: settings.settings.supporter_roles || [],
			MEMBER_ROLES: settings.settings.member_roles || []
		};
	},

	async hasAnyRole(member: any, roleIds: string[]) {
		if (!roleIds || roleIds.length === 0) return false;
		try {
			requireBotConfig();
			const server = await db.getServerByDiscordId(botConfig!.id, member.guild.id);
			if (!server) return false;
			const user = member.user || member;
			const discordMemberId = user?.id || member.id;
			return await db.memberHasAnyRole(discordMemberId, roleIds, server.id);
		} catch (_) {
			return false;
		}
	}
};

export async function getLevelingSettings(guildId: string) {
	const officialBotServer = await getOfficialBotServer(guildId);
	const settings = await db.getServerSettings(officialBotServer.id, 'leveling');

	if (!settings || !settings.settings) {
		throw new Error(`Leveling settings not configured for guild ${guildId}. Please configure in the panel.`);
	}

	const config = settings.settings;

	let progressChannelId = config.PROGRESS_CHANNEL_ID;
	if (!progressChannelId) {
		try {
			progressChannelId = await getMainChannel(guildId);
		} catch (_) {
			progressChannelId = null;
		}
	}

	return {
		MESSAGE: {
			XP: config.MESSAGE.XP,
			COOLDOWN_SECONDS: config.MESSAGE.COOLDOWN_SECONDS
		},
		VOICE: {
			XP_PER_MINUTE: config.VOICE.XP_PER_MINUTE,
			AFK_XP_PER_MINUTE: config.VOICE.AFK_XP_PER_MINUTE,
			COOLDOWN_SECONDS: config.VOICE.COOLDOWN_SECONDS
		},
		REQUIREMENTS: {
			BASE_XP: config.REQUIREMENTS.BASE_XP,
			MULTIPLIER: config.REQUIREMENTS.MULTIPLIER
		},
		PROGRESS_CHANNEL_ID: progressChannelId
	};
}

export const COMMUNICATION = {
	get WEBHOOK_URL() {
		if (!botConfig) throw new Error('Bot config not loaded. Call initializeConfig() first.');
		if (!botConfig.port) throw new Error('Port not found in database configuration.');
		return `http://localhost:${botConfig.port}`;
	},
	get SECRET_KEY() {
		if (!botConfig) throw new Error('Bot config not loaded. Call initializeConfig() first.');
		if (!botConfig.secret_key) throw new Error('Secret key not found in database configuration.');
		return botConfig.secret_key;
	},
	get PORT() {
		if (!botConfig) throw new Error('Bot config not loaded. Call initializeConfig() first.');
		if (!botConfig.port) throw new Error('Port not found in database configuration.');
		return botConfig.port;
	}
};

export async function getEmbedConfig(guildId: string) {
	requireBotConfig();
	requireGuildId(guildId, 'getting embed config');

	const officialBotServer = await getOfficialBotServer(guildId);
	const settings = await getServerSettingsForComponent(guildId, 'main_config');
	const config = settings.settings;

	if (!config.color) {
		throw new Error(`Default color not configured for guild ${guildId}`);
	}

	const hex = config.color.replace('#', '');
	const color = parseInt(hex, 16);

	if (!config.footer) {
		throw new Error(`Default footer not configured for guild ${guildId}`);
	}

	const now = new Date();
	const footerText = config.footer.replace(/{server}/g, officialBotServer.name).replace(/{year}/g, now.getFullYear().toString());

	return { COLOR: color, FOOTER: footerText };
}

export const WELCOMER = {
	async getChannels(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting welcomer channels');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'welcomer');
		if (settings?.settings?.channels?.length > 0) return settings.settings.channels;
		const mainChannel = await getMainChannel(guildId);
		return mainChannel ? [mainChannel] : [];
	},

	async getMessages(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting welcomer messages');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'welcomer');
		if (settings?.settings?.messages?.length > 0) return settings.settings.messages;
		return [];
	}
};

export const BOOSTER = {
	async getChannels(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting booster channels');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'booster');
		if (settings?.settings?.channels?.length > 0) return settings.settings.channels;
		const mainChannel = await getMainChannel(guildId);
		return mainChannel ? [mainChannel] : [];
	},

	async getChannel(guildId: string) {
		const channels = await BOOSTER.getChannels(guildId);
		return channels.length > 0 ? channels[0] : await getMainChannel(guildId);
	},

	async getMessages(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting booster messages');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'booster');
		if (settings?.settings?.messages?.length > 0) return settings.settings.messages;
		return [];
	}
};

export const CUSTOM_SUPPORTER_ROLE = {
	async getRoleConstraints(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting custom role constraints');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'custom_supporter_role');
		if (settings?.settings) {
			return {
				ROLE_START: settings.settings.role_start || null,
				ROLE_END: settings.settings.role_end || null
			};
		}
		return { ROLE_START: null, ROLE_END: null };
	}
};

export const NOTIFICATIONS = {
	async getConfig(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting notifications config');
		const server = await getOfficialBotServer(guildId).catch(() => null);
		if (!server) return null;
		const settings = await db.getServerSettings(server.id, 'notifications');
		return settings?.settings || null;
	},

	async getConfigByServerId(serverId: number) {
		const settings = await db.getServerSettings(serverId, 'notifications');
		return settings?.settings || null;
	},

	async getRoleConstraints(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting notifications role constraints');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'notifications');
		if (settings?.settings) {
			return {
				ROLE_START: settings.settings.role_start || null,
				ROLE_END: settings.settings.role_end || null
			};
		}
		return { ROLE_START: null, ROLE_END: null };
	},

	async getNotificationRoleIds(guildId: string) {
		const server = await getOfficialBotServer(guildId).catch(() => null);
		if (!server) return [];
		const rows = await db.getNotificationRolesForServer(server.id);
		return (rows || []).map((r: any) => r.discord_role_id).filter(Boolean);
	},

	async getNotificationRolesWithCategory(guildId: string) {
		const server = await getOfficialBotServer(guildId).catch(() => null);
		if (!server) return [];
		return await db.getNotificationRolesWithCategory(server.id);
	},

	async getNotificationRoleIdForChannel(guildId: string, channelId: string) {
		const server = await getOfficialBotServer(guildId).catch(() => null);
		if (!server || !channelId) return null;
		return (await db.getNotificationRoleByChannel(server.id, channelId)) || null;
	}
};

export const FEEDBACK = {
	async getChannel(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting feedback channel');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'feedback');
		if (settings?.settings?.feedback_channel) return settings.settings.feedback_channel;
		return await getMainChannel(guildId);
	},

	async getRole(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting feedback role');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'feedback');
		return settings?.settings?.feedback_role || null;
	}
};

export const GIVEAWAY = {
	async getChannel(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting giveaway channel');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'giveaway');
		if (settings?.settings?.giveaway_channel) return settings.settings.giveaway_channel;
		return await getMainChannel(guildId);
	},

	async getCreatorCanParticipate(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting giveaway creator can participate setting');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'giveaway');
		return settings?.settings?.giveaway_creator_can_participate ?? false;
	}
};

export const STAFF_RATING = {
	async getConfig(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff rating config');
		const settings = await db.getServerSettings((await getOfficialBotServer(guildId)).id, 'staff_report_rating');
		return settings?.settings || null;
	},

	async getRatingChannel(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff rating channel');
		const config = await STAFF_RATING.getConfig(guildId);
		if (config?.rating_channel_id) return config.rating_channel_id;
		if (!config?.report_channel_id) return await getMainChannel(guildId);
		return null;
	},

	async getReportChannel(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff report channel');
		const config = await STAFF_RATING.getConfig(guildId);
		if (config?.report_channel_id) return config.report_channel_id;
		if (!config?.rating_channel_id) return await getMainChannel(guildId);
		return null;
	},

	async getRoleConstraints(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff rating role constraints');
		const config = await STAFF_RATING.getConfig(guildId);
		if (config?.role_start && config?.role_end) {
			return { ROLE_START: config.role_start, ROLE_END: config.role_end };
		}
		return { ROLE_START: null, ROLE_END: null };
	},

	async getCooldownDays(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff rating cooldown');
		const config = await STAFF_RATING.getConfig(guildId);
		const rawDays = Number(config?.cooldown_days);
		return Number.isFinite(rawDays) ? rawDays : null;
	},

	async getPendingRole(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting staff rating pending role');
		const config = await STAFF_RATING.getConfig(guildId);
		return config?.pending_role || null;
	}
};

export const FORWARDER = {
	async getConfig(guildId: string) {
		requireBotConfig();
		requireGuildId(guildId, 'getting forwarder config');
		const botIdToUse = await getOfficialBotId();
		const server = await db.getServerByDiscordId(botIdToUse, guildId);
		if (!server) return { production: [], testing: [] };
		const settings = await db.getServerSettings(server.id, 'forwarder');
		if (!settings || !settings.settings) return { production: [], testing: [] };
		return settings.settings;
	},

	async shouldForwardChannel(channelId: string, guildId: string) {
		requireBotConfig();
		if (!channelId || !guildId) return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };
		if (!botConfig!.isSelfbot) {
			return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };
		}

		try {
			const selfbotServer = await db.getServerByDiscordId(botConfig!.id, guildId);
			if (!selfbotServer) return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };

			const officialBot = await db.getOfficialBotForSelfbot(botConfig!.id);
			if (!officialBot) return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };

			const officialServers = await db.getServersForBot(officialBot.id);
			const environment = botConfig!.is_testing ? 'testing' : 'production';

			for (const officialServer of officialServers) {
				try {
					const forwarders = await FORWARDER.getConfig(officialServer.discord_server_id);
					const envForwarders = forwarders[environment] || [];

					for (const forwarder of envForwarders) {
						if (String(forwarder.selfbot_id) !== String(botConfig!.id)) continue;
						if (String(forwarder.server_id) !== String(selfbotServer.id)) continue;
						if (forwarder.source_channels && Array.isArray(forwarder.source_channels)) {
							const foundChannel = forwarder.source_channels.find((ch: any) => String(ch?.channel_id || '') === String(channelId));
							if (foundChannel) {
								return {
									shouldForward: true,
									onlyForwardWhenMentionsSelfBot: forwarder.only_forward_when_mentions_member === true,
									target_guild_id: officialServer.discord_server_id
								};
							}
						}
					}
				} catch (_) {
					continue;
				}
			}
			return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };
		} catch (_) {
			return { shouldForward: false, onlyForwardWhenMentionsSelfBot: false };
		}
	},

	async getForwarderConfigBySourceChannel(sourceChannelId: string, sourceGuildId: string) {
		requireBotConfig();
		if (!sourceChannelId || !sourceGuildId) {
			throw new Error('Source channel ID and guild ID are required.');
		}

		const allGuilds = await db.getServersForBot(botConfig!.id);
		const environment = botConfig!.is_testing ? 'testing' : 'production';

		const connectedSelfbots = await db.getSelfbotsForOfficialBot(botConfig!.id);

		for (const officialServer of allGuilds) {
			try {
				const forwarders = await FORWARDER.getConfig(officialServer.discord_server_id);
				const envForwarders = forwarders[environment] || [];

				for (const forwarder of envForwarders) {
					if (!forwarder.source_channels || !Array.isArray(forwarder.source_channels)) continue;

					const foundChannel = forwarder.source_channels.find((ch: any) => String(ch?.channel_id || '') === String(sourceChannelId));
					if (!foundChannel) continue;

					const forwarderSelfbotIdNum = typeof forwarder.selfbot_id === 'string' ? parseInt(forwarder.selfbot_id) : forwarder.selfbot_id;
					const forwarderSelfbot = connectedSelfbots.find((bot: any) => {
						const botIdNum = typeof bot.id === 'string' ? parseInt(bot.id) : bot.id;
						return botIdNum === forwarderSelfbotIdNum;
					});
					if (!forwarderSelfbot) continue;

					const selfbotServer = await db.getServerByDiscordId(forwarderSelfbot.id, sourceGuildId);
					if (!selfbotServer) continue;
					if (String(selfbotServer.id) !== String(forwarder.server_id)) continue;

					return {
						target_channel_id: forwarder.target_channel_id,
						roles: forwarder.roles,
						target_guild_id: officialServer.discord_server_id,
						only_forward_when_mentions_member: forwarder.only_forward_when_mentions_member === true
					};
				}
			} catch (_) {
				continue;
			}
		}

		return null;
	}
};
