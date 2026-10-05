import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import { refreshInterfaceInChannel } from '../../interface.js';
import { randomBytes } from 'crypto';
import db from '../../../../../../database.js';
import {
	DEFAULT_LEVELING_SETTINGS,
	getBotConfig,
	getEmbedConfig,
	DEFAULT_BOT_NICKNAME,
	SERVER_SETTINGS,
	SETUP_MENU_CATEGORY_NAME,
	SETUP_CHANNEL_DEFS
} from '../../../../../config.js';
import { publicSiteOrigin } from '../../../../../../url.js';
import { getServerLanguage, rememberServerLanguage, t, translate } from '../../../i18n.js';
import { isUtcSqlExpired, logger } from '../../../../../../utils/index.js';
import {
	SERVER_LANGUAGES,
	SERVER_LANGUAGE_CODES,
	isServerLanguage,
	serverLanguageFromDiscordLocale,
	serverLanguageLabel,
	type ServerLanguage
} from '../../../../../../languages.js';
import { defaultGreetingMessages } from '../../../../../../localizedDefaults.js';
export const commandDefinition = {
	name: 'setup',
	description: t('setup.commandDescription', 'en').slice(0, 100),
	description_localizations: Object.fromEntries(
		SERVER_LANGUAGES.flatMap((l) => l.discordLocales.filter((loc) => loc !== 'en-US').map((loc) => [loc, t('setup.commandDescription', l.code).slice(0, 100)]))
	),
	options: []
};

export const SETUP_LANGUAGE_SELECT_ID = 'setup_language';

const COLOR_OK = 0x57f287;
const COLOR_WARN = 0xfee75c;
const COLOR_ERR = 0xed4245;
const EPHEMERAL = 64;

async function replySetupEphemeral(interaction: any, opts: { color: number; title?: string; description: string; linkUrl?: string; linkLabel?: string }) {
	const embed = new EmbedBuilder().setColor(opts.color).setDescription(opts.description.slice(0, 4096));
	if (opts.title) embed.setTitle(opts.title.slice(0, 256));
	const components: ActionRowBuilder<ButtonBuilder>[] = [];
	if (opts.linkUrl && /^https?:\/\//i.test(opts.linkUrl.trim()) && opts.linkLabel) {
		components.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(opts.linkUrl.trim()).setLabel(opts.linkLabel.slice(0, 80))
			)
		);
	}
	await interaction.reply({
		embeds: [embed],
		...(components.length ? { components } : {}),
		flags: EPHEMERAL
	});
}

function findActiveOwnerInvite(invites: { account_type: string; used_by: unknown; used_at: unknown; expires_at: unknown; token: string }[]) {
	for (const inv of invites) {
		if (inv.account_type !== 'owner') continue;
		if (inv.used_by || inv.used_at) continue;
		if (inv.expires_at && isUtcSqlExpired(inv.expires_at as string | Date)) continue;
		return inv;
	}
	return null;
}

function isSetupAllowed(interaction: any) {
	const isOwner = interaction.member?.id === interaction.guild?.ownerId;
	const hasAdministrator =
		interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator) ||
		interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
		false;
	return isOwner || hasAdministrator;
}

async function hasSavedServerLanguage(serverId: number) {
	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	const settings = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
	return isServerLanguage(settings.language);
}

async function suggestedSetupLanguage(guild: any): Promise<ServerLanguage> {
	const botConfig = getBotConfig();
	const server = botConfig ? await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null) : null;
	if (server && (await hasSavedServerLanguage(server.id))) return getServerLanguage(guild.id);
	return serverLanguageFromDiscordLocale(guild.preferredLocale) ?? (await getServerLanguage(guild.id));
}

function setupCategoryNames(botName: string) {
	return new Set([SETUP_MENU_CATEGORY_NAME.replace('{botName}', botName), ...SERVER_LANGUAGE_CODES.map((l) => t('setup.categoryName', l, { botName }))]);
}

function channelNameKey(name: unknown) {
	return String(name ?? '')
		.toLowerCase()
		.replace(/\s+/g, '-');
}

function setupChannelNames(def: (typeof SETUP_CHANNEL_DEFS)[number]) {
	return new Set([def.name, ...SERVER_LANGUAGE_CODES.map((l) => t(`setup.channels.${def.settingsKey}`, l))].map(channelNameKey));
}

const pendingRenames = new Map<string, string>();

function renameIfNeeded(channel: any, name: string) {
	if (!channel) return;
	const current = pendingRenames.get(channel.id) ?? channel.name;
	const same = channel.type === ChannelType.GuildText ? channelNameKey(current) === channelNameKey(name) : current === name;
	if (same) return;
	pendingRenames.set(channel.id, name);
	channel
		.setName(name)
		.catch((err: any) => logger.log(`⚠️ Could not rename #${channel.name} to ${name}: ${err.message}`))
		.finally(() => {
			if (pendingRenames.get(channel.id) === name) pendingRenames.delete(channel.id);
		});
}

async function syncSetupChannels(guild: any, serverId: number, lang: ServerLanguage, botName: string, create: boolean) {
	const categoryNames = setupCategoryNames(botName);
	const categoryName = t('setup.categoryName', lang, { botName });
	const storedCategories = await db.getCategoriesForServer(serverId).catch(() => []);
	const storedChannels = await db.getChannelsForServer(serverId).catch(() => []);

	const liveChannel = async (discordId: string) => {
		if (!discordId) return null;
		return guild.channels.fetch(discordId).catch(() => null);
	};

	const storedCategory = storedCategories.find((c: { name: string | null }) => c.name != null && categoryNames.has(c.name));
	let menuCategory = storedCategory ? await liveChannel(storedCategory.discord_category_id) : null;
	if (!menuCategory) {
		menuCategory = guild.channels.cache.find((c: any) => c.type === ChannelType.GuildCategory && categoryNames.has(c.name)) ?? null;
	}
	if (!menuCategory) {
		const menuNames = setupChannelNames(SETUP_CHANNEL_DEFS.find((d) => d.settingsKey === 'menu')!);
		const existingMenu = guild.channels.cache.find(
			(c: any) => c.type === ChannelType.GuildText && c.parent?.type === ChannelType.GuildCategory && menuNames.has(channelNameKey(c.name))
		);
		menuCategory = existingMenu?.parent ?? null;
	}

	if (!menuCategory && !create) return null;

	if (!menuCategory) {
		menuCategory = await guild.channels.create({
			name: categoryName,
			type: ChannelType.GuildCategory,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.SendMessages]
				}
			]
		});
	} else {
		renameIfNeeded(menuCategory, categoryName);
	}

	const storedCategoryRowId = storedCategories.find((c: { discord_category_id: string }) => c.discord_category_id === menuCategory.id)?.id;

	const channelMap: Record<string, string> = {};
	const createdKeys: string[] = [];
	let menuChannel: any = null;

	for (const def of SETUP_CHANNEL_DEFS) {
		const names = setupChannelNames(def);
		const name = t(`setup.channels.${def.settingsKey}`, lang);
		const storedRow =
			storedCategoryRowId == null
				? null
				: storedChannels.find(
						(c: { name: string | null; category_id: number | null }) =>
							c.name != null && names.has(channelNameKey(c.name)) && c.category_id === storedCategoryRowId
					);

		let ch = storedRow ? await liveChannel(storedRow.discord_channel_id) : null;
		if (!ch) {
			ch =
				guild.channels.cache.find((c: any) => c.type === ChannelType.GuildText && names.has(channelNameKey(c.name)) && c.parentId === menuCategory.id) ?? null;
		}

		if (ch) {
			renameIfNeeded(ch, name);
		} else if (create) {
			ch = await guild.channels.create({
				name,
				type: ChannelType.GuildText,
				parent: menuCategory.id
			});
			createdKeys.push(def.settingsKey);
		} else {
			continue;
		}

		channelMap[def.settingsKey] = ch.id;
		if (def.settingsKey === 'menu') menuChannel = ch;
	}

	return { channelMap, createdKeys, menuChannel };
}

export async function syncServerMenu(client: any, guildId: string) {
	const lang = await getServerLanguage(guildId);
	const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
	const botConfig = getBotConfig();
	if (!guild || !botConfig) return;
	const server = await db.getServerByDiscordId(botConfig.id, guildId);
	if (!server) return;

	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }));
	const synced = await syncSetupChannels(guild, server.id, lang, embedConfig.NICKNAME, false);
	if (synced?.menuChannel) await refreshInterfaceInChannel(synced.menuChannel, client, { sendIfMissing: false });
}

export async function syncAllServerMenus(client: any) {
	for (const guild of client.guilds.cache.values()) {
		await syncServerMenu(client, guild.id).catch((err: any) => logger.log(`⚠️ Menu sync failed for ${guild.name}: ${err.message}`));
	}
}

export async function execute(interaction: any, _client: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!isSetupAllowed(interaction)) {
			await replySetupEphemeral(interaction, {
				color: COLOR_ERR,
				title: await translate('interface.panel.setupNotOwnerTitle', gid, uid),
				description: await translate('interface.panel.setupNotOwnerBody', gid, uid)
			});
			return;
		}

		const suggested = await suggestedSetupLanguage(interaction.guild);
		const embedConfig = await getEmbedConfig(gid).catch(() => ({ COLOR: COLOR_OK, FOOTER: '' }));
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(await translate('setup.language.title', gid, uid))
			.setDescription(await translate('setup.language.description', gid, uid));
		if (embedConfig.FOOTER) embed.setFooter({ text: embedConfig.FOOTER });

		const select = new StringSelectMenuBuilder()
			.setCustomId(SETUP_LANGUAGE_SELECT_ID)
			.setPlaceholder(await translate('setup.language.placeholder', gid, uid))
			.addOptions(
				SERVER_LANGUAGES.map((l) => ({
					label: serverLanguageLabel(l.code),
					value: l.code,
					default: l.code === suggested
				}))
			);

		await interaction.reply({
			embeds: [embed],
			components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
			flags: EPHEMERAL
		});
	} catch (error: any) {
		const errorMsg = await translate('interface.panel.error', gid, uid, { error: error.message });
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR).setDescription(errorMsg)], components: [] }).catch(() => null);
		} else {
			await replySetupEphemeral(interaction, { color: COLOR_ERR, description: errorMsg });
		}
	}
}

export async function handleSetupLanguageSelect(interaction: any, client: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!isSetupAllowed(interaction)) {
			await replySetupEphemeral(interaction, {
				color: COLOR_ERR,
				title: await translate('interface.panel.setupNotOwnerTitle', gid, uid),
				description: await translate('interface.panel.setupNotOwnerBody', gid, uid)
			});
			return;
		}

		const lang = interaction.values?.[0];
		if (!isServerLanguage(lang)) return;

		await interaction.update({
			embeds: [new EmbedBuilder().setColor(COLOR_OK).setDescription(t('setup.language.working', lang, { language: serverLanguageLabel(lang) }))],
			components: []
		});

		const guild = interaction.guild;
		const embedConfig = await getEmbedConfig(gid).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }));
		const botName = embedConfig.NICKNAME;

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.panel.setupWarnNoBotConfig', gid, uid))]
			});
			return;
		}

		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
		if (!server) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.panel.setupWarnNoServer', gid, uid))]
			});
			return;
		}

		const mainBefore = await db.getServerSettings(server.id, SERVER_SETTINGS.component.main).catch(() => null);
		const mainBeforeSettings = mainBefore?.settings && typeof mainBefore.settings === 'object' ? mainBefore.settings : {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.main, { ...mainBeforeSettings, language: lang });
		rememberServerLanguage(gid, lang);

		const { channelMap, createdKeys, menuChannel } = await syncSetupChannels(guild, server.id, lang, botName, true);

		await refreshInterfaceInChannel(menuChannel, client, { sendIfMissing: true });

		const getSettings = async (comp: string) => {
			const row = await db.getServerSettings(server.id, comp);
			return row?.settings && typeof row.settings === 'object' ? row.settings : null;
		};

		const mainSettings = (await getSettings(SERVER_SETTINGS.component.main)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.main, {
			...mainSettings,
			bot_updates_channel_id: channelMap['bot_updates'],
			moderation_log_channel_id: channelMap['moderation']
		});

		const lvlRaw = (await getSettings(SERVER_SETTINGS.component.leveling)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.leveling, {
			enabled: true,
			...DEFAULT_LEVELING_SETTINGS,
			...lvlRaw,
			PROGRESS_CHANNEL_ID: channelMap['leveling']
		});

		const psRaw = (await getSettings(SERVER_SETTINGS.component.public)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.public, {
			items_enabled: true,
			minigames_enabled: true,
			assets_enabled: true,
			tasks_enabled: true,
			invite_enabled: true,
			...psRaw,
			ITEMS_CHANNEL_ID: channelMap['items'],
			MINIGAMES_CHANNEL_ID: channelMap['minigames']
		});

		const welcRaw = (await getSettings(SERVER_SETTINGS.component.welcomer)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.welcomer, {
			enabled: true,
			messages: defaultGreetingMessages('welcomer', lang),
			...welcRaw,
			channels: [channelMap['welcomer']]
		});

		const boostRaw = (await getSettings(SERVER_SETTINGS.component.booster)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.booster, {
			enabled: true,
			messages: defaultGreetingMessages('booster', lang),
			...boostRaw,
			channels: [channelMap['booster']]
		});

		const giveRaw = (await getSettings(SERVER_SETTINGS.component.giveaway)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.giveaway, {
			enabled: true,
			...giveRaw,
			giveaway_channel: channelMap['giveaway']
		});

		const rblxRaw = (await getSettings(SERVER_SETTINGS.component.roblox_catalog_notifier)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.roblox_catalog_notifier, {
			enabled: true,
			...rblxRaw,
			channel_id: channelMap['roblox_catalog_notifier']
		});

		const staffRaw = (await getSettings(SERVER_SETTINGS.component.staff_rating)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.staff_rating, {
			enabled: false,
			...staffRaw,
			rating_channel_id: channelMap['staff_rating']
		});

		const questRaw = (await getSettings(SERVER_SETTINGS.component.discord_quest_notifier)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.discord_quest_notifier, {
			enabled: true,
			...questRaw,
			channel_id: channelMap['discord_quest_notifier']
		});

		const ccRaw = (await getSettings(SERVER_SETTINGS.component.content_creator)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.content_creator, {
			enabled: false,
			...ccRaw,
			target_channel_id: channelMap['content_creator']
		});

		const caRaw = (await getSettings(SERVER_SETTINGS.component.creator_alerts)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.creator_alerts, {
			enabled: true,
			...caRaw,
			target_channel_id: channelMap['content_creator']
		});

		const notifRaw = (await getSettings(SERVER_SETTINGS.component.notifications)) || {};
		const notifChannelIds = Object.entries(channelMap)
			.filter(([key]) => key !== 'menu')
			.map(([, id]) => id);

		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.notifications, {
			enabled: true,
			...notifRaw,
			channel_ids: notifChannelIds
		});

		const channelSummary =
			(await translate('setup.language.applied', gid, uid, { language: serverLanguageLabel(lang) })) +
			'\n' +
			(createdKeys.length
				? await translate('interface.panel.setupChannelsCreated', gid, uid, { count: createdKeys.length })
				: await translate('interface.panel.setupChannelsAllPresent', gid, uid));

		const accounts = await db.getServerAccountsByServer(server.id);
		const hasOwner = accounts.some((a: { account_type: string }) => a.account_type === 'owner');
		if (hasOwner) {
			let description =
				channelSummary +
				'\n\n' +
				(await translate('interface.panel.setupHasOwnerAccount', gid, uid, {
					channel: menuChannel.toString()
				}));
			const loginUrl = `${publicSiteOrigin()}/login`;
			description += '\n\n' + (await translate('interface.panel.setupSignInLinkLine', gid, uid, { url: loginUrl }));
			const linkLabel = await translate('interface.panel.setupOpenPanelButton', gid, uid);
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_OK).setDescription(description)],
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(loginUrl).setLabel(linkLabel.slice(0, 80)))
				]
			});
			return;
		}

		const origin = publicSiteOrigin();

		const invites = await db.getServerAccountInvitesByServer(server.id);
		const activeInvite = findActiveOwnerInvite(invites);

		let token: string;
		if (activeInvite) {
			token = activeInvite.token;
		} else {
			token = randomBytes(32).toString('hex');
			await db.createServerAccountInvite({ token, server_id: server.id, account_type: 'owner' });
		}

		const inviteUrl = `${origin}/register?token=${token}`;
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(COLOR_OK)
					.setTitle(await translate('interface.panel.setupOwnerInviteEmbedTitle', gid, uid))
					.setDescription(
						channelSummary +
							'\n\n' +
							(await translate('interface.panel.setupOwnerInviteReady', gid, uid, {
								channel: menuChannel.toString(),
								url: inviteUrl
							}))
					)
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setURL(inviteUrl)
						.setLabel((await translate('interface.panel.setupOwnerInviteButton', gid, uid)).slice(0, 80))
				)
			]
		});
	} catch (error: any) {
		const errorMsg = await translate('interface.panel.error', gid, uid, { error: error.message });
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_ERR).setDescription(errorMsg)]
			});
		} else {
			await replySetupEphemeral(interaction, { color: COLOR_ERR, description: errorMsg });
		}
	}
}
