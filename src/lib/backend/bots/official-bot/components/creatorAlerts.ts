import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	EmbedBuilder,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	type ModalActionRowComponentBuilder
} from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import db from '../../../../database.js';
import {
	creatorAlertsEmbedColors,
	creatorRefKey,
	fetchCreatorSnapshots,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	parseCreatorInput,
	resolveCreator,
	serverSettingsComponent,
	CREATOR_ALERTS_HISTORY_LIMIT,
	CREATOR_ALERTS_POLL_MS,
	CREATOR_PLATFORM_TYPES,
	NOTIFICATIONS,
	type CreatorContent,
	type CreatorContentType,
	type CreatorPlatform,
	type CreatorProfile,
	type CreatorRef
} from '../../../config.js';
import { serverTranslator, translate, type Translator } from '../i18n.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';

export const CREATOR_NOTIFICATIONS_MENU_BUTTON_ID = 'notifications_creators';
export const CREATOR_NOTIFICATIONS_SELECT_ID = 'creator_notifications_select';
export const CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID = 'creator_notifications_disable_all';
export const CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID = 'creator_notifications_follow';
export const CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID = 'creator_notifications_recent';
export const CREATOR_FOLLOW_PLATFORM_BUTTON_PREFIX = 'creator_follow_platform:';
export const CREATOR_FOLLOW_MODAL_PREFIX = 'creator_follow_modal:';
export const CREATOR_FOLLOW_BUTTON_PREFIX = 'creator_follow:';
export const CREATOR_NOTIFICATION_TYPES_SELECT_PREFIX = 'creator_notification_types:';
export const CREATOR_CONTENT_HUB_SUFFIX = ':cc';

const CREATOR_FOLLOW_INPUT_ID = 'creator_follow_input';

const PLATFORMS: CreatorPlatform[] = ['youtube', 'twitch', 'tiktok'];

const PLATFORM_EMOJI: Record<CreatorPlatform, string> = {
	youtube: '📺',
	twitch: '🟣',
	tiktok: '🎵'
};

const PLATFORM_EXAMPLE: Record<CreatorPlatform, string> = {
	youtube: 'https://www.youtube.com/@handle',
	twitch: 'https://www.twitch.tv/login',
	tiktok: 'https://www.tiktok.com/@handle'
};

const TYPE_EMOJI: Record<CreatorContentType, string> = {
	video: '🎬',
	live: '🔴',
	post: '📝'
};

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;

type CreatorRow = Awaited<ReturnType<typeof db.listNotifiedCreatorsForBot>>[number];

type ServerTarget = {
	serverId: number;
	guildId: string;
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>;
	tr: Translator;
	channel: any | null;
};

function mentionChunks(discordIds: string[]): string[] {
	const chunks: string[] = [];
	let current = '';
	for (const id of discordIds) {
		const mention = `<@${id}> `;
		if (current.length + mention.length > 1950) {
			chunks.push(current.trim());
			current = mention;
		} else {
			current += mention;
		}
	}
	if (current.trim()) chunks.push(current.trim());
	return chunks;
}

export function creatorProfileUrl(platform: CreatorPlatform, accountId: string, handle: string | null): string {
	if (platform === 'twitch') return `https://www.twitch.tv/${handle ?? accountId}`;
	if (platform === 'tiktok') return `https://www.tiktok.com/@${handle ?? accountId}`;
	return handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${accountId}`;
}

async function readTargetChannelId(serverId: number): Promise<string> {
	const row = await db.getServerSettings(serverId, serverSettingsComponent.creator_alerts).catch(() => null);
	const s = row && !Array.isArray(row) && row.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
	return typeof s.target_channel_id === 'string' ? s.target_channel_id : '';
}

async function resolveServerTarget(client: Client, server: { id: number; discord_server_id: string | null }): Promise<ServerTarget | null> {
	const guildId = server.discord_server_id;
	if (!guildId) return null;
	if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.creator_alerts))) return null;

	const channelId = await readTargetChannelId(server.id);

	const embedConfig = await getEmbedConfig(guildId);
	const tr = await serverTranslator(guildId);
	if (!channelId) return { serverId: server.id, guildId, embedConfig, tr, channel: null };

	const guild = await client.guilds.fetch(guildId).catch(() => null);
	const channel = guild ? await guild.channels.fetch(channelId).catch(() => null) : null;
	return { serverId: server.id, guildId, embedConfig, tr, channel: channel && channel.isTextBased() ? channel : null };
}

async function sendContentEmbed(
	target: ServerTarget,
	creator: CreatorRow & { name: string | null; thumbnailUrl: string | null },
	content: CreatorContent & { id: number }
) {
	const profileUrl = creatorProfileUrl(creator.platform, creator.accountId, creator.handle);
	const creatorName = creator.name?.trim() || creator.handle || creator.accountId;
	const watcherDiscordIds = await db.listServerCreatorNotificationDiscordIds(target.serverId, creator.id).catch(() => [] as string[]);
	const notificationDiscordIds = await db.listServerCreatorNotificationDiscordIds(target.serverId, creator.id, [content.type]).catch(() => [] as string[]);
	const { tr } = target;
	const platformName = tr(`creatorAlerts.platforms.${creator.platform}`);
	const typeLabel = `${TYPE_EMOJI[content.type]} ${tr(`creatorAlerts.types.${content.type}.label`)}`;

	const embed = new EmbedBuilder()
		.setColor(creatorAlertsEmbedColors[creator.platform])
		.setAuthor({ name: creatorName.slice(0, 256), url: profileUrl, ...(creator.thumbnailUrl ? { iconURL: creator.thumbnailUrl } : {}) })
		.setTitle((content.title?.split('\n')[0]?.trim() || typeLabel).slice(0, 256))
		.setURL(content.url)
		.addFields(
			{ name: tr('creatorAlerts.post.platform'), value: platformName, inline: true },
			{ name: tr('creatorAlerts.post.type'), value: typeLabel, inline: true },
			...(watcherDiscordIds.length > 0 ? [{ name: tr('creatorAlerts.post.notifications'), value: `🔔 ${watcherDiscordIds.length}`, inline: true }] : [])
		)
		.setFooter({ text: target.embedConfig.FOOTER });

	if (content.title && content.title.includes('\n')) embed.setDescription(content.title.slice(0, 4096));
	if (content.thumbnailUrl) embed.setImage(content.thumbnailUrl);
	if (content.publishedAt) embed.setTimestamp(new Date(content.publishedAt));

	const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setURL(content.url)
			.setLabel(tr('creatorAlerts.post.openOn', { platform: platformName }).slice(0, 80)),
		new ButtonBuilder()
			.setStyle(ButtonStyle.Secondary)
			.setCustomId(`${CREATOR_FOLLOW_BUTTON_PREFIX}${creator.id}`)
			.setLabel(tr('creatorAlerts.post.notifyMe').slice(0, 80))
			.setEmoji('🔔')
	);

	const channelMentions = (await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(target.guildId, target.channel.id).catch(() => null)) ?? [];
	const alreadyMentioned = channelMentions.join(' ');
	const notificationDirectMentions = mentionChunks(notificationDiscordIds.filter((id) => !alreadyMentioned.includes(`<@${id}>`)));
	const mentionParts = [...channelMentions, ...notificationDirectMentions];

	await target.channel.send({ content: mentionParts[0], embeds: [embed], components: [btnRow] });

	for (let i = 1; i < mentionParts.length; i++) {
		await target.channel.send({ content: mentionParts[i] }).catch(() => null);
	}
}

async function runTick(client: Client, officialBotId: number) {
	if (tickRunning) return;
	tickRunning = true;
	try {
		const creators = await db.listNotifiedCreatorsForBot(officialBotId);
		if (creators.length === 0) return;

		const refs: CreatorRef[] = creators.map((c) => ({ platform: c.platform, accountId: c.accountId, handle: c.handle }));
		const snapshots = await fetchCreatorSnapshots(refs);

		const servers = new Map((await db.getServersForBot(officialBotId)).map((s: any) => [Number(s.id), s]));
		const targets = new Map<number, ServerTarget | null>();
		const targetFor = async (serverId: number) => {
			if (!targets.has(serverId)) {
				const server = servers.get(serverId);
				targets.set(serverId, server ? await resolveServerTarget(client, server).catch(() => null) : null);
			}
			return targets.get(serverId) ?? null;
		};

		for (const creator of creators) {
			const snap = snapshots.get(creatorRefKey(creator));
			if (!snap) continue;

			const baseline = creator.checkedAt == null;
			const fresh = await db.recordBotCreatorContents(creator.id, snap.feeds.flat()).catch(() => null);
			if (!fresh) continue;
			await db.markBotCreatorChecked(creator.id, snap.profile).catch(() => null);

			const freshIds = new Set(fresh.map((c) => c.contentId));
			const newerIds = new Set<string>();
			if (!baseline) {
				for (const feed of snap.feeds) {
					const newestKnown = feed.findIndex((c) => !freshIds.has(c.contentId));
					const newer = newestKnown === -1 ? (feed.length === 1 ? feed : []) : feed.slice(0, newestKnown);
					for (const c of newer) newerIds.add(c.contentId);
				}
			}
			const announce = fresh.filter((c) => c.type === 'live' || newerIds.has(c.contentId));
			if (fresh.length > announce.length) {
				await logger.log(`📡 Creator alerts: baselined ${fresh.length - announce.length} ${creator.platform} items for ${creator.handle ?? creator.accountId}`);
			}
			if (announce.length === 0) continue;

			const stored = await db.getBotCreatorById(creator.id).catch(() => null);
			const creatorInfo = { ...creator, name: stored?.name ?? null, thumbnailUrl: stored?.thumbnail_url ?? null };

			for (const content of [...announce].reverse()) {
				const serverIds = await db.listCreatorFollowerServerIds(officialBotId, creator.id, content.type).catch(() => [] as number[]);
				for (const serverId of serverIds) {
					const target = await targetFor(serverId);
					if (!target) continue;
					try {
						await db.addServerCreatorContent(serverId, content.id);
						if (!target.channel) continue;
						await sendContentEmbed(target, creatorInfo, content);
						await db.markServerCreatorContentMessagePosted(serverId, content.id);
						await logger.log(`📡 Creator alerts: ${creator.platform} ${content.type} ${content.contentId} → server ${serverId}`);
					} catch (err: any) {
						await logger.log(`❌ Creator alerts: failed ${creator.platform} ${content.contentId} for server ${serverId}: ${err?.message || err}`);
					}
				}
			}
		}
	} finally {
		tickRunning = false;
	}
}

function scheduleNextTick(client: Client, officialBotId: number) {
	tickTimeoutRef = setTimeout(() => {
		runTick(client, officialBotId)
			.catch((err) => logger.log(`❌ Creator alerts tick error: ${err?.message || err}`))
			.finally(() => scheduleNextTick(client, officialBotId));
	}, CREATOR_ALERTS_POLL_MS);
}

export function initCreatorAlerts(client: Client, officialBotId: number | null) {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
	if (!officialBotId) {
		logger.log('Creator alerts: no official bot id, skipping');
		return;
	}
	runTick(client, officialBotId).catch((err) => logger.log(`❌ Creator alerts tick error: ${err?.message || err}`));
	scheduleNextTick(client, officialBotId);
}

export function stopCreatorAlerts() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

type CreatorIdentity = { id: number; platform: CreatorPlatform; account_id: string; handle: string | null; name: string | null };

function formatCount(n: number): string {
	return new Intl.NumberFormat('id-ID').format(n);
}

function creatorDisplayName(creator: { name: string | null; handle: string | null }, fallback: string): string {
	return creator.name?.trim() || creator.handle || fallback;
}

export function isCreatorFollowPlatformButtonId(customId: string): boolean {
	return customId.startsWith(CREATOR_FOLLOW_PLATFORM_BUTTON_PREFIX);
}

export function isCreatorFollowModalId(customId: string): boolean {
	return customId.startsWith(CREATOR_FOLLOW_MODAL_PREFIX);
}

export function isCreatorFollowButtonId(customId: string): boolean {
	return customId.startsWith(CREATOR_FOLLOW_BUTTON_PREFIX);
}

export function isCreatorNotificationTypesSelectId(customId: string): boolean {
	return customId.startsWith(CREATOR_NOTIFICATION_TYPES_SELECT_PREFIX);
}

export function isCreatorMenuId(customId: string, id: string): boolean {
	return customId === id || customId === `${id}${CREATOR_CONTENT_HUB_SUFFIX}`;
}

function menuOrigin(customId: string): string {
	return customId.endsWith(CREATOR_CONTENT_HUB_SUFFIX) ? CREATOR_CONTENT_HUB_SUFFIX : '';
}

function creatorIdFromCustomId(customId: string, prefix: string): number | null {
	const raw = customId.slice(prefix.length).split(':')[0].trim();
	if (!/^\d+$/.test(raw)) return null;
	const id = Number(raw);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function platformFromCustomId(customId: string, prefix: string): CreatorPlatform | null {
	const raw = customId.slice(prefix.length).split(':')[0].trim();
	return (PLATFORMS as string[]).includes(raw) ? (raw as CreatorPlatform) : null;
}

function sanitizeCreatorTypes(platform: CreatorPlatform, values: string[]): CreatorContentType[] {
	const allowed = new Set<string>(CREATOR_PLATFORM_TYPES[platform]);
	return Array.from(new Set(values.filter((v) => allowed.has(v)))) as CreatorContentType[];
}

async function formatActiveTypes(platform: CreatorPlatform, types: string[], guildId: string, userId: string): Promise<string> {
	const valid = sanitizeCreatorTypes(platform, types);
	if (valid.length === 0) return await translate('creatorAlerts.noTypes', guildId, userId);
	const labels = await Promise.all(valid.map(async (t) => `${TYPE_EMOJI[t]} ${await translate(`creatorAlerts.types.${t}.label`, guildId, userId)}`));
	return labels.join(', ');
}

async function platformLabel(platform: CreatorPlatform, guildId: string, userId: string): Promise<string> {
	return `${PLATFORM_EMOJI[platform]} ${await translate(`creatorAlerts.platforms.${platform}`, guildId, userId)}`;
}

async function resolveMemberContext(guildId: string, discordUserId: string) {
	const server = await getServerForCurrentBot(guildId).catch(() => null);
	if (!server) return null;
	const member = await db.getMemberByDiscordId(server.id, discordUserId).catch(() => null);
	if (!member) return null;
	return { server, member };
}

async function replyError(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, key: string, guildId: string) {
	const content = await translate(key, guildId, interaction.user.id);
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content, embeds: [], components: [] }).catch(() => null);
		return;
	}
	await interaction.reply({ content, flags: 64 }).catch(() => null);
}

async function respondEphemeral(interaction: ButtonInteraction | StringSelectMenuInteraction, payload: any, preferUpdate: boolean) {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
		return;
	}
	if (preferUpdate) {
		await (interaction as any).update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }).catch(() => null));
		return;
	}
	await interaction.reply({ ...payload, flags: 64 }).catch(() => null);
}

function backToMenuButton(label: string, origin: string) {
	return new ButtonBuilder().setCustomId(`${CREATOR_NOTIFICATIONS_MENU_BUTTON_ID}${origin}`).setLabel(label).setStyle(ButtonStyle.Secondary);
}

async function buildCreatorTypesPayload(
	guildId: string,
	userId: string,
	creator: CreatorIdentity,
	selectedTypes: string[],
	origin: string | null,
	statusLine?: string
) {
	const embedConfig = await getEmbedConfig(guildId);
	const selected = sanitizeCreatorTypes(creator.platform, selectedTypes);
	const name = creatorDisplayName(creator, creator.account_id);

	const description = await translate('creatorAlerts.creator.description', guildId, userId, {
		creator: name,
		url: creatorProfileUrl(creator.platform, creator.account_id, creator.handle),
		platform: await platformLabel(creator.platform, guildId, userId)
	});
	const activeLabel = await translate('creatorAlerts.creator.active', guildId, userId, {
		types: await formatActiveTypes(creator.platform, selected, guildId, userId)
	});

	const embed = new EmbedBuilder()
		.setColor(creatorAlertsEmbedColors[creator.platform])
		.setTitle(await translate('creatorAlerts.creator.title', guildId, userId))
		.setDescription([description, activeLabel, statusLine].filter(Boolean).join('\n\n').slice(0, 4096))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const options = await Promise.all(
		CREATOR_PLATFORM_TYPES[creator.platform].map(async (type) => ({
			label: (await translate(`creatorAlerts.types.${type}.label`, guildId, userId)).slice(0, 100),
			value: type,
			description: (await translate(`creatorAlerts.types.${type}.description`, guildId, userId)).slice(0, 100),
			emoji: TYPE_EMOJI[type],
			default: selected.includes(type)
		}))
	);

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`${CREATOR_NOTIFICATION_TYPES_SELECT_PREFIX}${creator.id}${origin == null ? '' : `:menu${origin}`}`)
		.setPlaceholder((await translate('creatorAlerts.creator.placeholder', guildId, userId)).slice(0, 150))
		.setMinValues(0)
		.setMaxValues(options.length)
		.addOptions(options);

	const rows: ActionRowBuilder<any>[] = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];

	if (origin != null) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(backToMenuButton(await translate('menu.back', guildId, userId), origin)));
	}

	return { embeds: [embed], components: rows };
}

async function buildCreatorNotificationsMenuPayload(guildId: string, userId: string, memberId: number, origin: string, statusLine?: string) {
	const embedConfig = await getEmbedConfig(guildId);
	const subscriptions = await db.listServerMemberCreatorNotifications(memberId).catch(() => []);

	const description =
		subscriptions.length === 0
			? await translate('creatorAlerts.menu.empty', guildId, userId)
			: await translate('creatorAlerts.menu.description', guildId, userId, { count: formatCount(subscriptions.length) });

	const lines = await Promise.all(
		subscriptions.slice(0, 25).map(async (sub) => {
			const name = creatorDisplayName(sub, `#${sub.creatorId}`);
			return `**${name}** · ${await platformLabel(sub.platform, guildId, userId)}\n${await formatActiveTypes(sub.platform, sub.types, guildId, userId)}`;
		})
	);

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('creatorAlerts.menu.title', guildId, userId))
		.setDescription([description, lines.join('\n'), statusLine].filter(Boolean).join('\n\n').slice(0, 4096))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const rows: ActionRowBuilder<any>[] = [];

	if (subscriptions.length > 0) {
		const options = await Promise.all(
			subscriptions.slice(0, 25).map(async (sub) => ({
				label: creatorDisplayName(sub, `#${sub.creatorId}`).slice(0, 100),
				value: String(sub.creatorId),
				description: (await formatActiveTypes(sub.platform, sub.types, guildId, userId)).slice(0, 100),
				emoji: PLATFORM_EMOJI[sub.platform]
			}))
		);

		rows.push(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(`${CREATOR_NOTIFICATIONS_SELECT_ID}${origin}`)
					.setPlaceholder((await translate('creatorAlerts.menu.placeholder', guildId, userId)).slice(0, 150))
					.setMinValues(1)
					.setMaxValues(1)
					.addOptions(options)
			)
		);
	}

	const buttons = [
		new ButtonBuilder()
			.setCustomId(`${CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID}${origin}`)
			.setLabel(await translate('creatorAlerts.menu.follow', guildId, userId))
			.setStyle(ButtonStyle.Primary)
	];

	if (subscriptions.length > 0) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(`${CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID}${origin}`)
				.setLabel(await translate('creatorAlerts.menu.recent', guildId, userId))
				.setStyle(ButtonStyle.Secondary)
		);
		buttons.push(
			new ButtonBuilder()
				.setCustomId(`${CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID}${origin}`)
				.setLabel(await translate('creatorAlerts.menu.disableAll', guildId, userId))
				.setStyle(ButtonStyle.Danger)
		);
	}

	buttons.push(
		new ButtonBuilder()
			.setCustomId(origin ? 'bot_content_creator' : 'bot_notifications')
			.setLabel(await translate('menu.back', guildId, userId))
			.setStyle(ButtonStyle.Secondary)
	);

	rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));

	return { embeds: [embed], components: rows };
}

export async function handleCreatorNotificationsMenuButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const payload = await buildCreatorNotificationsMenuPayload(guildId, interaction.user.id, context.member.id, menuOrigin(interaction.customId));
	await respondEphemeral(interaction, payload, true);
}

export async function handleCreatorNotificationsSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;

	const raw = (interaction.values || [])[0] || '';
	const creatorId = /^\d+$/.test(raw) ? Number(raw) : null;
	if (!creatorId) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const creator = await db.getBotCreatorById(creatorId).catch(() => null);
	if (!creator) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const currentTypes = await db.getServerMemberCreatorNotificationTypes(context.member.id, creator.id).catch(() => [] as string[]);
	const payload = await buildCreatorTypesPayload(guildId, interaction.user.id, creator, currentTypes, menuOrigin(interaction.customId));
	await respondEphemeral(interaction, payload, true);
}

export async function handleCreatorNotificationsDisableAll(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const cleared = await db.clearServerMemberCreatorNotifications(context.member.id).catch(() => 0);
	const statusLine = await translate('creatorAlerts.menu.disabledAll', guildId, interaction.user.id, { count: formatCount(cleared) });
	const payload = await buildCreatorNotificationsMenuPayload(guildId, interaction.user.id, context.member.id, menuOrigin(interaction.customId), statusLine);
	await respondEphemeral(interaction, payload, true);

	await logger.log(`🔕 Creator alerts: ${interaction.user.tag} disabled all ${cleared} creator notifications`);
}

export async function handleCreatorNotificationsFollowButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;
	const userId = interaction.user.id;
	const origin = menuOrigin(interaction.customId);

	const embedConfig = await getEmbedConfig(guildId);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('creatorAlerts.follow.title', guildId, userId))
		.setDescription(await translate('creatorAlerts.follow.description', guildId, userId))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const platformButtons = await Promise.all(
		PLATFORMS.map(async (platform) =>
			new ButtonBuilder()
				.setCustomId(`${CREATOR_FOLLOW_PLATFORM_BUTTON_PREFIX}${platform}${origin}`)
				.setLabel(await translate(`creatorAlerts.platforms.${platform}`, guildId, userId))
				.setEmoji(PLATFORM_EMOJI[platform])
				.setStyle(ButtonStyle.Secondary)
		)
	);

	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(...platformButtons),
		new ActionRowBuilder<ButtonBuilder>().addComponents(backToMenuButton(await translate('menu.back', guildId, userId), origin))
	];

	await respondEphemeral(interaction, { embeds: [embed], components: rows }, true);
}

export async function handleCreatorFollowPlatformButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;
	const userId = interaction.user.id;

	const platform = platformFromCustomId(interaction.customId, CREATOR_FOLLOW_PLATFORM_BUTTON_PREFIX);
	if (!platform) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const platformName = await translate(`creatorAlerts.platforms.${platform}`, guildId, userId);
	const modal = new ModalBuilder()
		.setCustomId(`${CREATOR_FOLLOW_MODAL_PREFIX}${platform}${menuOrigin(interaction.customId)}`)
		.setTitle((await translate('creatorAlerts.follow.modalTitle', guildId, userId, { platform: platformName })).slice(0, 45));

	const input = new TextInputBuilder()
		.setCustomId(CREATOR_FOLLOW_INPUT_ID)
		.setLabel((await translate('creatorAlerts.follow.inputLabel', guildId, userId, { platform: platformName })).slice(0, 45))
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(PLATFORM_EXAMPLE[platform])
		.setRequired(true)
		.setMaxLength(200);

	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
	await interaction.showModal(modal);
}

function handleFromInput(platform: CreatorPlatform, raw: string): { platform: CreatorPlatform; handle: string } | null {
	const parsed = parseCreatorInput(raw);
	if (parsed) return parsed;
	const bare = raw.trim().replace(/^@/, '');
	if (!/^[\w.\-]{2,100}$/.test(bare)) return null;
	if (platform === 'youtube') return { platform, handle: /^UC[\w-]{22}$/.test(bare) ? bare : `@${bare}` };
	if (platform === 'twitch') return /^[a-z0-9_]{3,25}$/i.test(bare) ? { platform, handle: bare.toLowerCase() } : null;
	return { platform, handle: bare };
}

export async function handleCreatorFollowModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;
	const userId = interaction.user.id;

	const platform = platformFromCustomId(interaction.customId, CREATOR_FOLLOW_MODAL_PREFIX);
	if (!platform) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	if (interaction.isFromMessage()) await interaction.deferUpdate();
	else await interaction.deferReply({ flags: 64 });

	const target = handleFromInput(platform, interaction.fields.getTextInputValue(CREATOR_FOLLOW_INPUT_ID) || '');
	if (!target) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const context = await resolveMemberContext(guildId, userId);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	let profile: CreatorProfile | null;
	try {
		profile = await resolveCreator(target.platform, target.handle);
	} catch (err: any) {
		const message = String(err?.message || err);
		await logger.log(`⚠️ Creator alerts: lookup ${target.platform} ${target.handle} failed: ${message}`);
		return await replyError(interaction, /cooling/i.test(message) ? 'creatorAlerts.errors.tiktokCooling' : 'creatorAlerts.errors.lookupFailed', guildId);
	}
	if (!profile) return await replyError(interaction, 'creatorAlerts.errors.notFound', guildId);

	const creatorId = await db.upsertBotCreator(context.server.bot_id, profile);
	const creator = await db.getBotCreatorById(creatorId);
	if (!creator) return await replyError(interaction, 'creatorAlerts.errors.lookupFailed', guildId);

	let types = await db.getServerMemberCreatorNotificationTypes(context.member.id, creator.id).catch(() => [] as string[]);
	if (types.length === 0) {
		types = [...CREATOR_PLATFORM_TYPES[creator.platform]];
		await db.setServerMemberCreatorNotificationTypes(context.member.id, creator.id, types);
	}

	const watchers = await db.countServerCreatorNotifications(context.server.id, creator.id).catch(() => 0);
	const statusLine = await translate('creatorAlerts.saved', guildId, userId, {
		creator: creatorDisplayName(creator, creator.account_id),
		types: await formatActiveTypes(creator.platform, types, guildId, userId),
		count: formatCount(watchers)
	});

	const payload = await buildCreatorTypesPayload(guildId, userId, creator, types, menuOrigin(interaction.customId), statusLine);
	await interaction.editReply(payload).catch(() => null);

	await logger.log(`🔔 Creator alerts: ${interaction.user.tag} followed ${creator.platform} ${creator.handle ?? creator.account_id} (${watchers} watching)`);
}

export async function handleCreatorFollowButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;

	const creatorId = creatorIdFromCustomId(interaction.customId, CREATOR_FOLLOW_BUTTON_PREFIX);
	if (creatorId == null) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	await interaction.deferReply({ flags: 64 });

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const creator = await db.getBotCreatorById(creatorId).catch(() => null);
	if (!creator) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const currentTypes = await db.getServerMemberCreatorNotificationTypes(context.member.id, creator.id).catch(() => [] as string[]);
	const payload = await buildCreatorTypesPayload(guildId, interaction.user.id, creator, currentTypes, null);
	await interaction.editReply(payload).catch(() => null);
}

export async function handleCreatorNotificationTypesSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;
	const userId = interaction.user.id;

	const creatorId = creatorIdFromCustomId(interaction.customId, CREATOR_NOTIFICATION_TYPES_SELECT_PREFIX);
	const fromMenu = interaction.customId.slice(CREATOR_NOTIFICATION_TYPES_SELECT_PREFIX.length).split(':')[1] === 'menu';
	if (creatorId == null) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const context = await resolveMemberContext(guildId, userId);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const creator = await db.getBotCreatorById(creatorId).catch(() => null);
	if (!creator) return await replyError(interaction, 'creatorAlerts.errors.invalidCreator', guildId);

	const types = sanitizeCreatorTypes(creator.platform, interaction.values || []);
	const action = await db.setServerMemberCreatorNotificationTypes(context.member.id, creator.id, types);
	const watchers = await db.countServerCreatorNotifications(context.server.id, creator.id).catch(() => 0);
	const name = creatorDisplayName(creator, creator.account_id);

	const statusLine = await translate(action === 'removed' ? 'creatorAlerts.removed' : 'creatorAlerts.saved', guildId, userId, {
		creator: name,
		types: await formatActiveTypes(creator.platform, types, guildId, userId),
		count: formatCount(watchers)
	});

	const payload = await buildCreatorTypesPayload(guildId, userId, creator, types, fromMenu ? menuOrigin(interaction.customId) : null, statusLine);
	await respondEphemeral(interaction, payload, true);

	await logger.log(
		`🔔 Creator alerts: ${interaction.user.tag} ${action} types [${types.join(', ')}] for ${creator.platform} ${creator.handle ?? creator.account_id} (${watchers} watching)`
	);
}

export async function handleCreatorNotificationsRecentButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) return;
	const userId = interaction.user.id;

	const context = await resolveMemberContext(guildId, userId);
	if (!context) return await replyError(interaction, 'creatorAlerts.errors.memberNotFound', guildId);

	const contents = await db.listMemberCreatorContents(context.server.id, context.member.id, CREATOR_ALERTS_HISTORY_LIMIT).catch(() => []);
	const typeLabels = new Map<string, string>();
	for (const type of ['video', 'live', 'post'] as CreatorContentType[]) {
		typeLabels.set(type, `${TYPE_EMOJI[type]} ${await translate(`creatorAlerts.types.${type}.label`, guildId, userId)}`);
	}

	const lines = contents.map((c, index) => {
		const name = creatorDisplayName(c, `#${c.creator_id}`);
		const title = (c.title?.split('\n')[0]?.trim() || typeLabels.get(c.type) || c.type).replace(/[[\]]/g, '').slice(0, 80);
		const when = parseMySQLDateTimeUtc(c.published_at ?? c.created_at);
		const parts = [`${PLATFORM_EMOJI[c.platform]} **${name}**`, c.url ? `[${title}](${c.url})` : title, typeLabels.get(c.type) ?? c.type];
		if (when) parts.push(`<t:${Math.floor(when.getTime() / 1000)}:R>`);
		return `**${index + 1}.** ${parts.join(' · ')}`;
	});

	const embedConfig = await getEmbedConfig(guildId);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('creatorAlerts.recent.title', guildId, userId))
		.setDescription(lines.length > 0 ? lines.join('\n').slice(0, 4000) : await translate('creatorAlerts.recent.empty', guildId, userId))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(backToMenuButton(await translate('menu.back', guildId, userId), menuOrigin(interaction.customId)))
	];
	await respondEphemeral(interaction, { embeds: [embed], components: rows }, true);
}
