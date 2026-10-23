import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	MessageFlags
} from 'discord.js';
import { publishInterfaceInChannel, refreshInterfaceInChannel } from '../../interface.js';
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
import { getServerLanguage, memberTranslator, rememberServerLanguage, t, translate, errorReason, type Translator } from '../../../i18n.js';
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
import { DISCORD_LIMITS } from '../../../../../../discordLimits.js';
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Client,
	Guild,
	GuildBasedChannel,
	GuildTextBasedChannel,
	RepliableInteraction,
	StringSelectMenuInteraction
} from 'discord.js';
import { EMBED_COLORS } from '../../embedColors.js';
import { INVITE_TOKEN_BYTES } from '../../../../../../accounts.js';

export const commandDefinition = {
	name: 'setup',
	description: t('setup.commandDescription', 'en').slice(0, DISCORD_LIMITS.COMMAND_DESCRIPTION),
	description_localizations: Object.fromEntries(
		SERVER_LANGUAGES.flatMap((l) =>
			l.discordLocales.filter((loc) => loc !== 'en-US').map((loc) => [loc, t('setup.commandDescription', l.code).slice(0, DISCORD_LIMITS.COMMAND_DESCRIPTION)])
		)
	),
	options: []
};

export const SETUP_LANGUAGE_SELECT_ID = 'setup_language';
const SETUP_CONTINUE_PREFIX = 'setup_continue|';

export function isSetupContinueButtonId(customId: string) {
	return customId.startsWith(SETUP_CONTINUE_PREFIX);
}

const COLOR_WARN = 0xfee75c;

async function replySetupEphemeral(
	interaction: RepliableInteraction,
	opts: { color: number; title?: string; description: string; linkUrl?: string; linkLabel?: string }
) {
	const embed = new EmbedBuilder().setColor(opts.color).setDescription(opts.description.slice(0, DISCORD_LIMITS.EMBED_DESCRIPTION));
	if (opts.title) {
		embed.setTitle(opts.title.slice(0, DISCORD_LIMITS.EMBED_TITLE));
	}
	const components: ActionRowBuilder<ButtonBuilder>[] = [];
	if (opts.linkUrl && /^https?:\/\//i.test(opts.linkUrl.trim()) && opts.linkLabel) {
		components.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(opts.linkUrl.trim()).setLabel(opts.linkLabel.slice(0, DISCORD_LIMITS.BUTTON_LABEL))
			)
		);
	}
	await interaction.reply({
		embeds: [embed],
		...(components.length ? { components } : {}),
		flags: MessageFlags.Ephemeral
	});
}

function findActiveOwnerInvite(invites: { account_type: string; used_by: unknown; used_at: unknown; expires_at: unknown; token: string }[]) {
	for (const inv of invites) {
		if (inv.account_type !== 'owner') {
			continue;
		}
		if (inv.used_by || inv.used_at) {
			continue;
		}
		if (inv.expires_at && isUtcSqlExpired(inv.expires_at as string | Date)) {
			continue;
		}
		return inv;
	}
	return null;
}

function isSetupAllowed(interaction: RepliableInteraction<'cached'>) {
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

async function suggestedSetupLanguage(guild: Guild): Promise<ServerLanguage> {
	const botConfig = getBotConfig();
	const server = botConfig ? await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null) : null;
	if (server && (await hasSavedServerLanguage(server.id))) {
		return getServerLanguage(guild.id);
	}
	return serverLanguageFromDiscordLocale(guild.preferredLocale) ?? (await getServerLanguage(guild.id));
}

function setupCategoryNames(botName: string) {
	return new Set([SETUP_MENU_CATEGORY_NAME.replace('{botName}', botName), ...SERVER_LANGUAGE_CODES.map((l) => t('setup.categoryName', l, { botName }))]);
}

function channelNameKey(name: string) {
	return String(name ?? '')
		.toLowerCase()
		.replace(/\s+/g, '-');
}

function setupChannelNames(def: (typeof SETUP_CHANNEL_DEFS)[number]) {
	return new Set([def.name, ...SERVER_LANGUAGE_CODES.map((l) => t(`setup.channels.${def.settingsKey}`, l))].map(channelNameKey));
}

const pendingRenames = new Map<string, string>();

function renameIfNeeded(channel: GuildBasedChannel, name: string) {
	if (!channel) {
		return;
	}
	const current = pendingRenames.get(channel.id) ?? channel.name;
	const isSame = channel.type === ChannelType.GuildText ? channelNameKey(current) === channelNameKey(name) : current === name;
	if (isSame) {
		return;
	}
	pendingRenames.set(channel.id, name);
	channel
		.setName(name)
		.catch((err) => logger.log(`⚠️ Could not rename #${channel.name} to ${name}: ${err.message}`))
		.finally(() => {
			if (pendingRenames.get(channel.id) === name) {
				pendingRenames.delete(channel.id);
			}
		});
}

type SetupChannels<M> = { channelMap: Record<string, string>; createdKeys: string[]; menuChannel: M };

type SetupTarget = { serverId: number; lang: ServerLanguage; botName: string };

type SetupCreator = {
	category: (guild: Guild, name: string) => Promise<GuildBasedChannel | null>;
	channel: (guild: Guild, name: string, parentId: string) => Promise<GuildBasedChannel | null>;
};

const CREATE_MISSING: SetupCreator = {
	category: (guild, name) =>
		guild.channels.create({
			name,
			type: ChannelType.GuildCategory,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.SendMessages]
				}
			]
		}),
	channel: (guild, name, parentId) => guild.channels.create({ name, type: ChannelType.GuildText, parent: parentId })
};

const KEEP_EXISTING: SetupCreator = {
	category: async () => null,
	channel: async () => null
};

function findSetupChannels(guild: Guild, target: SetupTarget): Promise<SetupChannels<GuildTextBasedChannel | null> | null> {
	return syncSetupChannels(guild, target, KEEP_EXISTING);
}

function ensureSetupChannels(guild: Guild, target: SetupTarget): Promise<SetupChannels<GuildTextBasedChannel>> {
	return syncSetupChannels(guild, target, CREATE_MISSING) as Promise<SetupChannels<GuildTextBasedChannel>>;
}

async function syncSetupChannels(
	guild: Guild,
	{ serverId, lang, botName }: SetupTarget,
	creator: SetupCreator
): Promise<SetupChannels<GuildTextBasedChannel | null> | null> {
	const categoryNames = setupCategoryNames(botName);
	const categoryName = t('setup.categoryName', lang, { botName });
	const storedCategories = await db.getCategoriesForServer(serverId).catch(() => []);
	const storedChannels = await db.getChannelsForServer(serverId).catch(() => []);

	const liveChannel = async (discordId: string) => {
		if (!discordId) {
			return null;
		}
		return guild.channels.fetch(discordId).catch(() => null);
	};

	const storedCategory = storedCategories.find((c: { name: string | null }) => c.name != null && categoryNames.has(c.name));
	let menuCategory = storedCategory ? await liveChannel(storedCategory.discord_category_id) : null;
	if (!menuCategory) {
		menuCategory = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && categoryNames.has(c.name)) ?? null;
	}
	if (!menuCategory) {
		const menuNames = setupChannelNames(SETUP_CHANNEL_DEFS.find((d) => d.settingsKey === 'menu')!);
		const existingMenu = guild.channels.cache.find(
			(c) => c.type === ChannelType.GuildText && c.parent?.type === ChannelType.GuildCategory && menuNames.has(channelNameKey(c.name))
		);
		menuCategory = existingMenu?.parent ?? null;
	}

	if (menuCategory) {
		renameIfNeeded(menuCategory, categoryName);
	} else {
		menuCategory = await creator.category(guild, categoryName);
	}
	if (!menuCategory) {
		return null;
	}
	const menuCategoryId = menuCategory.id;

	const storedCategoryRowId = storedCategories.find((c: { discord_category_id: string }) => c.discord_category_id === menuCategoryId)?.id;

	const channelMap: Record<string, string> = {};
	const createdKeys: string[] = [];
	let menuChannel: GuildTextBasedChannel | null = null;

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
			ch = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && names.has(channelNameKey(c.name)) && c.parentId === menuCategoryId) ?? null;
		}

		if (ch) {
			renameIfNeeded(ch, name);
		} else {
			ch = await creator.channel(guild, name, menuCategoryId);
			if (!ch) {
				continue;
			}
			createdKeys.push(def.settingsKey);
		}

		channelMap[def.settingsKey] = ch.id;
		if (def.settingsKey === 'menu') {
			menuChannel = ch as GuildTextBasedChannel;
		}
	}

	return { channelMap, createdKeys, menuChannel };
}

export async function syncServerMenu(client: Client<true>, guildId: string) {
	const lang = await getServerLanguage(guildId);
	const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
	const botConfig = getBotConfig();
	if (!guild || !botConfig) {
		return;
	}
	const server = await db.getServerByDiscordId(botConfig.id, guildId);
	if (!server) {
		return;
	}

	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }));
	const synced = await findSetupChannels(guild, { serverId: server.id, lang, botName: embedConfig.NICKNAME });
	if (synced?.menuChannel) {
		await refreshInterfaceInChannel(synced.menuChannel, client);
	}
}

export async function syncAllServerMenus(client: Client<true>) {
	for (const guild of client.guilds.cache.values()) {
		await syncServerMenu(client, guild.id).catch((err) => logger.log(`⚠️ Menu sync failed for ${guild.name}: ${err.message}`));
	}
}

export async function execute(interaction: ChatInputCommandInteraction, _client: unknown) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!interaction.inCachedGuild() || !isSetupAllowed(interaction)) {
			await replySetupEphemeral(interaction, {
				color: EMBED_COLORS.danger,
				title: await translate('interface.panel.setupNotOwnerTitle', { guildId: gid, userId: uid }),
				description: await translate('interface.panel.setupNotOwnerBody', { guildId: gid, userId: uid })
			});
			return;
		}

		const suggested = await suggestedSetupLanguage(interaction.guild);
		await interaction.reply({ ...(await setupLanguagePicker(interaction.guild.id, { userId: uid, selected: suggested })), flags: MessageFlags.Ephemeral });
	} catch (error) {
		const errorMsg = await translate('interface.panel.error', { guildId: gid, userId: uid }, { error: await errorReason(error, gid, uid) });
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.danger).setDescription(errorMsg)], components: [] }).catch(() => null);
		} else {
			await replySetupEphemeral(interaction, { color: EMBED_COLORS.danger, description: errorMsg });
		}
	}
}

async function setupLanguagePicker(guildId: string, { userId, selected }: { userId: string; selected: ServerLanguage }) {
	const tr = await memberTranslator(guildId, userId);
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: EMBED_COLORS.success, FOOTER: '' }));
	const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(tr('setup.language.title')).setDescription(tr('setup.language.description'));
	if (embedConfig.FOOTER) {
		embed.setFooter({ text: embedConfig.FOOTER });
	}

	const select = new StringSelectMenuBuilder()
		.setCustomId(SETUP_LANGUAGE_SELECT_ID)
		.setPlaceholder(tr('setup.language.placeholder'))
		.addOptions(
			SERVER_LANGUAGES.map((l) => ({
				label: serverLanguageLabel(l.code),
				value: l.code,
				default: l.code === selected
			}))
		);
	const continueButton = new ButtonBuilder()
		.setCustomId(`${SETUP_CONTINUE_PREFIX}${selected}`)
		.setStyle(ButtonStyle.Primary)
		.setLabel(tr('setup.language.continue'));

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), new ActionRowBuilder<ButtonBuilder>().addComponents(continueButton)]
	};
}

type ChannelMap = Record<string, string>;
type SetupComponentDefaults = {
	component: string;
	defaults?: (lang: ServerLanguage) => Record<string, unknown>;
	channels: (channelMap: ChannelMap) => Record<string, unknown>;
};
type SetupResult = { serverId: number; menuChannel: GuildTextBasedChannel; summary: string };

function setupComponentDefaults(): SetupComponentDefaults[] {
	const C = SERVER_SETTINGS.component;
	const greeting = (kind: 'welcomer' | 'leaver' | 'booster') => (lang: ServerLanguage) => ({ enabled: true, messages: defaultGreetingMessages(kind, lang) });
	const enabled = () => ({ enabled: true });
	const disabled = () => ({ enabled: false });
	return [
		{ component: C.main, channels: (m) => ({ bot_updates_channel_id: m['bot_updates'], moderation_log_channel_id: m['moderation'] }) },
		{ component: C.leveling, defaults: () => ({ enabled: true, ...DEFAULT_LEVELING_SETTINGS }), channels: (m) => ({ PROGRESS_CHANNEL_ID: m['leveling'] }) },
		{
			component: C.public,
			defaults: () => ({ items_enabled: true, minigames_enabled: true, market_enabled: true, tasks_enabled: true, invite_enabled: true }),
			channels: (m) => ({ ITEMS_CHANNEL_ID: m['items'], MINIGAMES_CHANNEL_ID: m['minigames'] })
		},
		{ component: C.welcomer, defaults: greeting('welcomer'), channels: (m) => ({ channels: [m['welcomer']] }) },
		{ component: C.leaver, defaults: greeting('leaver'), channels: (m) => ({ channels: [m['leaver']] }) },
		{ component: C.booster, defaults: greeting('booster'), channels: (m) => ({ channels: [m['booster']] }) },
		{ component: C.giveaway, defaults: enabled, channels: (m) => ({ giveaway_channel: m['giveaway'] }) },
		{ component: C.roblox_catalog_notifier, defaults: enabled, channels: (m) => ({ channel_id: m['roblox_catalog_notifier'] }) },
		{ component: C.staff_rating, defaults: disabled, channels: (m) => ({ rating_channel_id: m['staff_rating'] }) },
		{ component: C.discord_quest_notifier, defaults: enabled, channels: (m) => ({ channel_id: m['discord_quest_notifier'] }) },
		{ component: C.content_creator, defaults: disabled, channels: (m) => ({ target_channel_id: m['content_creator'] }) },
		{ component: C.creator_alerts, defaults: enabled, channels: (m) => ({ target_channel_id: m['content_creator'] }) },
		{
			component: C.notifications,
			defaults: enabled,
			channels: (m) => ({
				channel_ids: Object.entries(m)
					.filter(([key]) => key !== 'menu')
					.map(([, id]) => id)
			})
		}
	];
}

async function storedSettings(serverId: number, component: string) {
	const row = await db.getServerSettings(serverId, component);
	return row?.settings && typeof row.settings === 'object' ? row.settings : {};
}

async function applySetupDefaults(serverId: number, { channelMap, lang }: { channelMap: ChannelMap; lang: ServerLanguage }) {
	for (const entry of setupComponentDefaults()) {
		const raw = await storedSettings(serverId, entry.component);
		await db.upsertServerSettings(serverId, entry.component, { ...entry.defaults?.(lang), ...raw, ...entry.channels(channelMap) });
	}
}

async function saveServerLanguage(serverId: number, { guildId, lang }: { guildId: string; lang: ServerLanguage }) {
	const mainBefore = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	const mainBeforeSettings = mainBefore?.settings && typeof mainBefore.settings === 'object' ? mainBefore.settings : {};
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.main, { ...mainBeforeSettings, language: lang });
	rememberServerLanguage(guildId, lang);
}

function linkButtonRow(url: string, label: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label.slice(0, DISCORD_LIMITS.BUTTON_LABEL))
	);
}

async function ownerInviteToken(serverId: number) {
	const activeInvite = findActiveOwnerInvite(await db.getAccountInvitesByServer(serverId));
	if (activeInvite) {
		return activeInvite.token;
	}
	const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
	await db.createAccountInvite({ token, server_id: serverId, account_type: 'owner' });
	return token;
}

async function setupCompletionReply(tr: Translator, { serverId, menuChannel, summary }: SetupResult) {
	const accounts = await db.getAccountServersByServer(serverId);
	if (accounts.some((a: { account_type: string }) => a.account_type === 'owner')) {
		const loginUrl = `${publicSiteOrigin()}/login`;
		const description = `${summary}\n\n${tr('interface.panel.setupHasOwnerAccount', { channel: menuChannel.toString() })}\n\n${tr('interface.panel.setupSignInLinkLine', { url: loginUrl })}`;
		return {
			embeds: [new EmbedBuilder().setColor(EMBED_COLORS.success).setDescription(description)],
			components: [linkButtonRow(loginUrl, tr('interface.panel.setupOpenPanelButton'))]
		};
	}

	const inviteUrl = `${publicSiteOrigin()}/register?token=${await ownerInviteToken(serverId)}`;
	const inviteLine = tr('interface.panel.setupOwnerInviteReady', { channel: menuChannel.toString(), url: inviteUrl });
	return {
		embeds: [
			new EmbedBuilder().setColor(EMBED_COLORS.success).setTitle(tr('interface.panel.setupOwnerInviteEmbedTitle')).setDescription(`${summary}\n\n${inviteLine}`)
		],
		components: [linkButtonRow(inviteUrl, tr('interface.panel.setupOwnerInviteButton'))]
	};
}

async function setupServerRow(guildId: string): Promise<{ serverId: number } | { warningKey: string }> {
	const botConfig = getBotConfig();
	if (!botConfig) {
		return { warningKey: 'interface.panel.setupWarnNoBotConfig' };
	}
	const server = await db.getServerByDiscordId(botConfig.id, guildId);
	return server ? { serverId: server.id } : { warningKey: 'interface.panel.setupWarnNoServer' };
}

async function runServerSetup(
	interaction: ButtonInteraction<'cached'>,
	{ serverId, lang, client }: { serverId: number; lang: ServerLanguage; client: Client<true> }
) {
	const { guild } = interaction;
	const embedConfig = await getEmbedConfig(guild.id).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }));
	await saveServerLanguage(serverId, { guildId: guild.id, lang });

	const { channelMap, createdKeys, menuChannel } = await ensureSetupChannels(guild, { serverId, lang, botName: embedConfig.NICKNAME });
	await publishInterfaceInChannel(menuChannel, client);
	await applySetupDefaults(serverId, { channelMap, lang });

	const tr = await memberTranslator(guild.id, interaction.user.id);
	const channelsLine = createdKeys.length
		? tr('interface.panel.setupChannelsCreated', { count: createdKeys.length })
		: tr('interface.panel.setupChannelsAllPresent');
	const summary = `${tr('setup.language.applied', { language: serverLanguageLabel(lang) })}\n${channelsLine}`;
	await interaction.editReply(await setupCompletionReply(tr, { serverId, menuChannel, summary }));
}

async function guardSetupInteraction(interaction: StringSelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>, run: () => Promise<void>) {
	const gid = interaction.guild.id;
	const uid = interaction.user.id;

	try {
		if (!isSetupAllowed(interaction)) {
			await replySetupEphemeral(interaction, {
				color: EMBED_COLORS.danger,
				title: await translate('interface.panel.setupNotOwnerTitle', { guildId: gid, userId: uid }),
				description: await translate('interface.panel.setupNotOwnerBody', { guildId: gid, userId: uid })
			});
			return;
		}
		await run();
	} catch (error) {
		const errorMsg = await translate('interface.panel.error', { guildId: gid, userId: uid }, { error: await errorReason(error, gid, uid) });
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.danger).setDescription(errorMsg)] });
		} else {
			await replySetupEphemeral(interaction, { color: EMBED_COLORS.danger, description: errorMsg });
		}
	}
}

export async function handleSetupLanguageSelect(interaction: StringSelectMenuInteraction<'cached'>) {
	await guardSetupInteraction(interaction, async () => {
		const lang = interaction.values[0];
		if (!isServerLanguage(lang)) {
			return;
		}
		await interaction.update(await setupLanguagePicker(interaction.guild.id, { userId: interaction.user.id, selected: lang }));
	});
}

export async function handleSetupContinueButton(interaction: ButtonInteraction<'cached'>) {
	await guardSetupInteraction(interaction, async () => {
		const lang = interaction.customId.slice(SETUP_CONTINUE_PREFIX.length);
		if (!isServerLanguage(lang)) {
			return;
		}

		await interaction.update({
			embeds: [new EmbedBuilder().setColor(EMBED_COLORS.success).setDescription(t('setup.language.working', lang, { language: serverLanguageLabel(lang) }))],
			components: []
		});

		const server = await setupServerRow(interaction.guild.id);
		if ('warningKey' in server) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLOR_WARN)
						.setDescription(await translate(server.warningKey, { guildId: interaction.guild.id, userId: interaction.user.id }))
				]
			});
			return;
		}

		await runServerSetup(interaction, { serverId: server.serverId, lang, client: interaction.client });
	});
}
