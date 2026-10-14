import {
	computePublicServerSlugForServerId,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	isPublicSubFeatureEnabled,
	publicServerSubdomainOrigin,
	publicServerUrl,
	publicSiteOrigin,
	serverSettingsComponent
} from '../../../config.js';
import { domainToUnicode } from 'node:url';
import { inviteJoinPath } from '../../../../invites.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../../../utils/index.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';
import { MINUTES_PER_HOUR } from '../../../../utils/time.js';
import { hasPermission, getPermissionDeniedMessage } from './permissions.js';
import {
	handleCustomSupporterRoleButton,
	handleCustomSupporterRoleModal,
	handleCustomSupporterRoleEditModal,
	handleEditCustomSupporterRole,
	handleDeleteCustomSupporterRole
} from './interface/customsupporterrole.js';
import { handleFeedbackButton, handleFeedbackModal } from './interface/feedback.js';
import { featureAvailable } from './interface/availability.js';
import { handleAFKButton, handleAFKModal, handleRemoveAFKButton } from './interface/afk.js';
import { handleModerationButton, handleModerationUserSelect, handleModerationActionSelect, handleModerationModal } from './interface/moderation.js';
import {
	handleGiveawayButton,
	handleGiveawayModal,
	handleGiveawayEnterButton,
	handleGiveawayRoleSelect,
	handleGiveawaySkipRolesContinue,
	handleGiveawayFinish,
	handleGiveawayMultipleToggle
} from './interface/giveaway.js';
import { handleLanguageButton, handleLanguageSelect } from './interface/settings.js';
import { handleInvitesButton, handleInviteSlugButton, handleInviteSlugModal, INVITE_SLUG_BUTTON_ID, INVITE_SLUG_MODAL_ID } from './interface/invites.js';
import {
	handleStaffRatingButton,
	handleStaffRatingModal,
	handleStaffRatingApprove,
	handleStaffRatingReject,
	handleStaffRatingDecisionModal
} from './interface/staffrating.js';
import { handleNotificationsButton, handleNotificationChannelsButton, handleNotificationsSelect } from './interface/notifications.js';
import {
	handleContentCreatorButton,
	handleContentCreatorHubButton,
	handleContentCreatorApplyButton,
	handleContentCreatorDismissRequest,
	handleContentCreatorDismissYes,
	handleContentCreatorDismissNo,
	handleContentCreatorModal,
	handleContentCreatorApprove,
	handleContentCreatorReject,
	handleContentCreatorDecisionModal
} from './interface/contentcreator.js';
import {
	isQuestEnrollButtonId,
	isQuestEnrollModalId,
	handleQuestEnrollButton,
	handleQuestEnrollModalSubmit,
	handleDiscordQuestButton,
	handleQuestClaimAllButton,
	handleQuestClaimAllModalSubmit,
	DISCORD_QUEST_BUTTON_ID,
	QUEST_CLAIM_ALL_BUTTON_ID,
	QUEST_CLAIM_ALL_MODAL_ID
} from './questEnroll.js';
import {
	handleRobloxItemNotificationButton,
	handleRobloxItemNotificationTypesSelect,
	handleRobloxNotificationsDisableAll,
	handleRobloxNotificationsMenuButton,
	handleRobloxNotificationsSelect,
	isRobloxItemNotificationButtonId,
	isRobloxItemNotificationTypesSelectId,
	ROBLOX_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID,
	ROBLOX_NOTIFICATIONS_MENU_BUTTON_ID,
	ROBLOX_NOTIFICATIONS_SELECT_ID
} from './robloxCatalogNotifier.js';
import {
	handleCreatorFollowButton,
	handleCreatorFollowModalSubmit,
	handleCreatorFollowPlatformButton,
	handleCreatorNotificationTypesSelect,
	handleCreatorNotificationsDisableAll,
	handleCreatorNotificationsFollowButton,
	handleCreatorNotificationsMenuButton,
	handleCreatorNotificationsRecentButton,
	handleCreatorNotificationsSelect,
	isCreatorFollowButtonId,
	isCreatorFollowModalId,
	isCreatorFollowPlatformButtonId,
	isCreatorNotificationTypesSelectId,
	CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID,
	CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID,
	CREATOR_NOTIFICATIONS_MENU_BUTTON_ID,
	CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID,
	CREATOR_NOTIFICATIONS_SELECT_ID,
	CREATOR_CONTENT_HUB_SUFFIX,
	isCreatorMenuId
} from './creatorAlerts.js';
import { handleMessageComponent, isMessageComponentId } from './messages.js';
import { memberTranslator, translate, translateServer, type Translator } from '../i18n.js';
import { levelProgressField } from './leveling.js';
import { SETUP_LANGUAGE_SELECT_ID, handleSetupLanguageSelect } from './commands/admin/setup.js';
import db from '../../../../database.js';
import { computeCardToken } from '../../../public/items/index.js';
import { resolvePublicStatisticsSnapshot } from '../../../public/statistics/stream.js';
import type { PublicPageStats } from '../../../public/statistics/shape.js';
import type {
	ActionRow,
	ButtonComponent,
	ComponentType,
	GuildMember,
	GuildTextBasedChannel,
	Message,
	MessageActionRowComponent,
	RoleSelectMenuInteraction,
	UserSelectMenuInteraction,
	MessageComponentInteraction,
	ModalSubmitInteraction,
	RepliableInteraction,
	ButtonInteraction,
	Client,
	Interaction,
	StringSelectMenuInteraction,
	MessageActionRowComponentBuilder
} from 'discord.js';

async function replyIfFeatureDisabled(interaction: RepliableInteraction, component: string): Promise<boolean> {
	if (!interaction.guild) {
		return false;
	}
	if (await isComponentFeatureEnabled(interaction.guild.id, component)) {
		return false;
	}
	const msg = await translate('common.errors.featureDisabled', { guildId: interaction.guild.id, userId: interaction.user.id });
	await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => null);
	return true;
}

const MENU_CATEGORIES: {
	id: string;
	permission?: string;
	items: { customId: string; label: string; desc: string; features?: string[]; permission?: string }[];
}[] = [
	{
		id: 'me',
		items: [
			{ customId: 'bot_afk', label: 'afk.title', desc: 'afk', features: [serverSettingsComponent.afk] },
			{
				customId: 'bot_notifications',
				label: 'notifications.button',
				desc: 'notifications',
				features: [serverSettingsComponent.notifications, serverSettingsComponent.roblox_catalog_notifier, serverSettingsComponent.creator_alerts]
			},
			{ customId: 'bot_invites', label: 'invites.button', desc: 'invites', features: [serverSettingsComponent.leveling] },
			{ customId: DISCORD_QUEST_BUTTON_ID, label: 'questEnroll.menuButton', desc: 'quest', features: [serverSettingsComponent.discord_quest_notifier] }
		]
	},
	{
		id: 'community',
		items: [
			{ customId: 'bot_giveaway', label: 'giveaway.create.title', desc: 'giveaway', features: [serverSettingsComponent.giveaway] },
			{ customId: 'bot_feedback', label: 'feedback.modal.title', desc: 'feedback', features: [serverSettingsComponent.feedback] },
			{ customId: 'bot_staff_rating', label: 'staffRating.button', desc: 'staffRating', features: [serverSettingsComponent.staff_rating] }
		]
	},
	{
		id: 'perks',
		items: [
			{
				customId: 'bot_custom_supporter_role',
				label: 'customSupporterRole.existing.title',
				desc: 'customSupporterRole',
				features: [serverSettingsComponent.custom_supporter_role],
				permission: 'custom_supporter_role'
			},
			{
				customId: 'bot_content_creator',
				label: 'contentCreator.button',
				desc: 'contentCreator',
				features: [serverSettingsComponent.content_creator]
			}
		]
	},
	{
		id: 'staff',
		permission: 'staff_only',
		items: [{ customId: 'bot_moderation', label: 'moderation.button', desc: 'moderation' }]
	}
];

async function availableMenuItems(category: (typeof MENU_CATEGORIES)[number], member: GuildMember) {
	const usable = await Promise.all(
		category.items.map(async (item) => {
			if (item.permission && !(await hasPermission(member, item.permission))) {
				return false;
			}
			if (!item.features) {
				return true;
			}
			return (await Promise.all(item.features.map((f) => featureAvailable(member.guild.id, f)))).some(Boolean);
		})
	);
	return category.items.filter((_, i) => usable[i]);
}

async function handleMenuCategory(interaction: MessageComponentInteraction<'cached'>, categoryId: string) {
	const category = MENU_CATEGORIES.find((c) => c.id === categoryId);
	if (!category) {
		return;
	}
	const g = interaction.guild.id;
	const u = interaction.user.id;

	if (category.permission && !(await hasPermission(interaction.member, category.permission))) {
		const content = await getPermissionDeniedMessage(interaction.guild, category.permission, u);
		await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const items = await availableMenuItems(category, interaction.member);
	if (items.length === 0) {
		await interaction
			.reply({ content: await translate('common.errors.featureDisabled', { guildId: g, userId: u }), flags: MessageFlags.Ephemeral })
			.catch(() => null);
		return;
	}

	const lines: string[] = [];
	const buttons = [];
	for (const item of items) {
		const label = await translate(item.label, { guildId: g, userId: u });
		lines.push(`**${label}**\n${await translate(`menu.items.${item.desc}`, { guildId: g, userId: u })}`);
		buttons.push(new ButtonBuilder().setCustomId(item.customId).setLabel(label).setStyle(ButtonStyle.Secondary));
	}

	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	for (let i = 0; i < buttons.length; i += DISCORD_LIMITS.ROW_BUTTONS) {
		rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons.slice(i, i + DISCORD_LIMITS.ROW_BUTTONS)));
	}
	rows.push(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('bot_menu')
				.setLabel(await translate('menu.back', { guildId: g, userId: u }))
				.setStyle(ButtonStyle.Secondary)
		)
	);

	const embedConfig = await getEmbedConfig(g);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate(`menu.categories.${category.id}.button`, { guildId: g, userId: u }))
		.setDescription(`${await translate(`menu.categories.${category.id}.description`, { guildId: g, userId: u })}\n\n${lines.join('\n\n')}`)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content: '', embeds: [embed], components: rows });
	} else if (interaction.message?.flags?.has(MessageFlags.Ephemeral)) {
		await interaction.update({ content: '', embeds: [embed], components: rows });
	} else {
		await interaction.reply({ embeds: [embed], components: rows, flags: MessageFlags.Ephemeral });
	}
}

function linkLabel(url: string): string {
	const u = new URL(url);
	const host = domainToUnicode(u.hostname) || u.hostname;
	return `${host}${u.port ? `:${u.port}` : ''}${decodeURI(u.pathname).replace(/\/$/, '')}`;
}

type PublicServerLinks = { serverId: number; base: string; subdomain: string | null; stats: PublicPageStats | null; joinUrl: string | null };
type MenuView = { embeds: EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] };

async function replyMenuNotice(interaction: MessageComponentInteraction<'cached'>, content: string) {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content, embeds: [], components: [] });
		return;
	}
	await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
}

async function menuCategoryButtons(member: GuildMember, tr: Translator) {
	const buttons: ButtonBuilder[] = [];
	for (const category of MENU_CATEGORIES) {
		if (category.permission && !(await hasPermission(member, category.permission))) {
			continue;
		}
		if ((await availableMenuItems(category, member)).length === 0) {
			continue;
		}
		buttons.push(
			new ButtonBuilder()
				.setCustomId(`menu_cat|${category.id}`)
				.setLabel(tr(`menu.categories.${category.id}.button`))
				.setStyle(ButtonStyle.Secondary)
		);
	}
	return buttons;
}

async function resolvePublicServerLinks(guildId: string): Promise<PublicServerLinks | null> {
	try {
		const server = await getServerForCurrentBot(guildId);
		const slug = await computePublicServerSlugForServerId(Number(server.id));
		const base = slug ? publicServerUrl(slug) : null;
		if (!slug || !base) {
			return null;
		}
		const [snapshot, serverRow] = await Promise.all([
			resolvePublicStatisticsSnapshot(Number(server.id)).catch(() => null),
			db.getServer(server.id).catch(() => null)
		]);
		const isInviteOn = await isPublicSubFeatureEnabled(guildId, 'invite').catch(() => false);
		const joinUrl = isInviteOn && (serverRow?.vanity_url_code || serverRow?.invite_code) ? `${publicSiteOrigin()}${inviteJoinPath(slug)}` : null;
		return { serverId: Number(server.id), base, subdomain: publicServerSubdomainOrigin(slug), stats: snapshot?.stats ?? null, joinUrl };
	} catch (_) {
		return null;
	}
}

function markdownLink(url: string) {
	try {
		return `[${linkLabel(url)}](${url})`;
	} catch (_) {
		return url;
	}
}

function menuDescription(tr: Translator, publicServer: PublicServerLinks | null) {
	const menuDesc = tr('menu.description');
	const siteUrl = publicServer ? (publicServer.subdomain ?? publicServer.base) : null;
	if (!siteUrl) {
		return menuDesc;
	}
	const website = `${menuDesc}\n\n${tr('menu.website', { url: markdownLink(siteUrl) })}`;
	return publicServer?.joinUrl ? `${website}\n${tr('menu.join', { url: markdownLink(publicServer.joinUrl) })}` : website;
}

function addMenuStats(embed: EmbedBuilder, stats: PublicPageStats, tr: Translator) {
	embed.addFields(
		{ name: tr('menu.stats.members'), value: stats.members_total.toLocaleString(), inline: true },
		{ name: tr('menu.stats.totalXp'), value: stats.leveling_total_xp.toLocaleString(), inline: true },
		{ name: tr('menu.stats.topLevel'), value: stats.leveling_max_level.toLocaleString(), inline: true }
	);
}

function menuRows(buttons: ButtonBuilder[], { tr, accountUrl }: { tr: Translator; accountUrl: string | null }) {
	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	for (let i = 0; i < buttons.length; i += DISCORD_LIMITS.ROW_BUTTONS) {
		rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons.slice(i, i + DISCORD_LIMITS.ROW_BUTTONS)));
	}
	const settingsButton = new ButtonBuilder().setCustomId('settings_language').setLabel(tr('settings.language.select')).setStyle(ButtonStyle.Secondary);
	rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(settingsButton));

	if (accountUrl) {
		const accountButton = new ButtonBuilder().setLabel(tr('menu.account')).setURL(accountUrl).setStyle(ButtonStyle.Link);
		const targetRow = rows[rows.length - 1];
		if (targetRow.components.length < DISCORD_LIMITS.ROW_BUTTONS) {
			targetRow.addComponents(accountButton);
		} else if (rows.length < DISCORD_LIMITS.ACTION_ROWS) {
			rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(accountButton));
		}
	}
	return rows;
}

async function showMenu(interaction: MessageComponentInteraction<'cached'>, view: MenuView) {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content: '', ...view });
	} else if (interaction.message?.flags?.has(MessageFlags.Ephemeral)) {
		await interaction.update({ content: '', ...view });
	} else {
		await interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
	}
}

async function handleMenuButton(interaction: MessageComponentInteraction<'cached'>) {
	const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
	if (!member) {
		await replyMenuNotice(interaction, tr('common.errors.memberNotFound'));
		return;
	}

	if (!(await hasPermission(member, 'menu'))) {
		await replyMenuNotice(interaction, await getPermissionDeniedMessage(interaction.guild, 'menu', interaction.user.id));
		return;
	}

	const buttons = await menuCategoryButtons(member, tr);
	if (buttons.length === 0) {
		await replyMenuNotice(interaction, tr('menu.noAccess'));
		return;
	}

	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const publicServer = await resolvePublicServerLinks(interaction.guild.id);

	const menuEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('menu.title', { botName: embedConfig.NICKNAME }))
		.setDescription(menuDescription(tr, publicServer))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	if (publicServer?.stats) {
		addMenuStats(menuEmbed, publicServer.stats, tr);
	}

	const accountUrl = publicServer ? `${publicServer.base}/account/profile/stats/${computeCardToken(publicServer.serverId, String(interaction.user.id))}` : null;
	await showMenu(interaction, { embeds: [menuEmbed], components: menuRows(buttons, { tr, accountUrl }) });
}

type EmbedField = { name: string; value: string; inline?: boolean };
type MemberLevelStats = NonNullable<Awaited<ReturnType<typeof db.getMemberLevelByDiscordId>>>;

function activityField(stats: MemberLevelStats, tr: Translator): EmbedField {
	const messages = Number(stats.chat_total) || 0;
	const voiceHours = Math.round((Number(stats.voice_minutes_total) || 0) / MINUTES_PER_HOUR);
	const streamHours = Math.round((Number(stats.voice_minutes_streaming) || 0) / MINUTES_PER_HOUR);
	const activity = [
		tr('leveling.activity.messages', { count: messages.toLocaleString() }),
		tr('leveling.activity.voice', { hours: voiceHours.toLocaleString() })
	];
	if (streamHours > 0) {
		activity.push(tr('leveling.activity.streaming', { hours: streamHours.toLocaleString() }));
	}
	return { name: tr('leveling.fields.activity'), value: activity.join(' · '), inline: false };
}

async function accountStatsFields(stats: MemberLevelStats, { guildId, tr }: { guildId: string; tr: Translator }): Promise<EmbedField[]> {
	const level = Number(stats.level) || 1;
	const xp = Number(stats.xp) || 0;
	const rank = Number(stats.rank) || 0;
	const progress = await levelProgressField(xp, { level, guildId, tr });
	return [
		{ name: tr('leveling.fields.level'), value: level.toLocaleString(), inline: true },
		{ name: tr('leveling.fields.totalXp'), value: xp.toLocaleString(), inline: true },
		{ name: tr('leveling.fields.rank'), value: rank > 0 ? `#${rank}` : tr('leveling.unranked'), inline: true },
		...(progress ? [progress] : []),
		activityField(stats, tr)
	];
}

async function handleMyAccountLinkButton(interaction: RepliableInteraction<'cached'>) {
	const guildId = interaction.guild.id;
	const userId = interaction.user.id;

	const embedConfig = await getEmbedConfig(guildId).catch(() => null);
	const accountLabel = await translate('menu.account', { guildId, userId }).catch(() => '👤 Account');

	const replyEmbed = async (description: string | null, components: ActionRowBuilder<ButtonBuilder>[] = [], fields: EmbedField[] = []) => {
		const embed = new EmbedBuilder().setTitle(accountLabel).setTimestamp();
		if (description) {
			embed.setDescription(description);
		}
		if (fields.length > 0) {
			embed.addFields(fields);
		}
		if (embedConfig) {
			embed.setColor(embedConfig.COLOR);
		}
		if (embedConfig?.FOOTER) {
			embed.setFooter({ text: embedConfig.FOOTER });
		}
		const avatar = interaction.user.displayAvatarURL?.({ size: 128 });
		if (avatar) {
			embed.setThumbnail(avatar);
		}
		await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral }).catch(() => null);
	};

	const server = await getServerForCurrentBot(guildId);
	const slug = await computePublicServerSlugForServerId(Number(server.id));
	const base = slug ? publicServerUrl(slug) : null;
	if (!base) {
		await replyEmbed(await translate('leveling.account.unavailable', { guildId, userId }));
		return;
	}

	const dbMember = await db.getMemberByDiscordId(server.id, userId).catch(() => null);
	if (!dbMember?.discord_member_id) {
		await replyEmbed(await translate('leveling.account.noMember', { guildId, userId }));
		return;
	}

	const hash = computeCardToken(server.id, String(dbMember.discord_member_id));
	const url = `${base}/account/profile/stats/${hash}`;
	let linkText = url;
	try {
		linkText = `[${new URL(url).host}](${url})`;
	} catch (_) {}
	const description = await translate('leveling.account.link', { guildId, userId }, { url: linkText });
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel(accountLabel).setURL(url).setStyle(ButtonStyle.Link));

	const stats = await db.getMemberLevelByDiscordId(server.id, userId).catch(() => null);
	const fields = stats ? await accountStatsFields(stats, { guildId, tr: await memberTranslator(guildId, userId) }) : [];

	await replyEmbed(fields.length > 0 ? null : description, [row], fields);
}

type ButtonHandler = (interaction: ButtonInteraction<'cached'>) => Promise<unknown>;
type ButtonRoute = { handle: ButtonHandler; feature?: string };
type PrefixRoute = ButtonRoute & { matches: (customId: string) => boolean };

const hubVariants = (id: string, route: ButtonRoute): [string, ButtonRoute][] => [
	[id, route],
	[`${id}${CREATOR_CONTENT_HUB_SUFFIX}`, route]
];

const EXACT_BUTTON_ROUTES: Record<string, ButtonRoute> = {
	bot_menu: { handle: handleMenuButton },
	bot_custom_supporter_role: { handle: handleCustomSupporterRoleButton, feature: serverSettingsComponent.custom_supporter_role },
	custom_supporter_role_edit: { handle: handleEditCustomSupporterRole, feature: serverSettingsComponent.custom_supporter_role },
	custom_supporter_role_delete: { handle: handleDeleteCustomSupporterRole, feature: serverSettingsComponent.custom_supporter_role },
	bot_giveaway: { handle: handleGiveawayButton, feature: serverSettingsComponent.giveaway },
	giveaway_multiple_toggle: { handle: handleGiveawayMultipleToggle, feature: serverSettingsComponent.giveaway },
	giveaway_continue_form: { handle: handleGiveawaySkipRolesContinue, feature: serverSettingsComponent.giveaway },
	bot_feedback: { handle: handleFeedbackButton, feature: serverSettingsComponent.feedback },
	bot_staff_report: { handle: handleStaffRatingButton, feature: serverSettingsComponent.staff_rating },
	bot_staff_rating: { handle: handleStaffRatingButton, feature: serverSettingsComponent.staff_rating },
	bot_notifications: { handle: handleNotificationsButton },
	notifications_channels: { handle: handleNotificationChannelsButton, feature: serverSettingsComponent.notifications },
	[ROBLOX_NOTIFICATIONS_MENU_BUTTON_ID]: { handle: handleRobloxNotificationsMenuButton, feature: serverSettingsComponent.roblox_catalog_notifier },
	[ROBLOX_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID]: { handle: handleRobloxNotificationsDisableAll, feature: serverSettingsComponent.roblox_catalog_notifier },
	...Object.fromEntries([
		...hubVariants(CREATOR_NOTIFICATIONS_MENU_BUTTON_ID, { handle: handleCreatorNotificationsMenuButton, feature: serverSettingsComponent.creator_alerts }),
		...hubVariants(CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID, {
			handle: handleCreatorNotificationsDisableAll,
			feature: serverSettingsComponent.creator_alerts
		}),
		...hubVariants(CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID, { handle: handleCreatorNotificationsFollowButton, feature: serverSettingsComponent.creator_alerts }),
		...hubVariants(CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID, { handle: handleCreatorNotificationsRecentButton, feature: serverSettingsComponent.creator_alerts })
	]),
	bot_content_creator: { handle: handleContentCreatorHubButton },
	content_creator_list: { handle: handleContentCreatorButton, feature: serverSettingsComponent.content_creator },
	content_creator_apply_open: { handle: handleContentCreatorApplyButton, feature: serverSettingsComponent.content_creator },
	content_creator_dismiss_request: { handle: handleContentCreatorDismissRequest, feature: serverSettingsComponent.content_creator },
	content_creator_dismiss_yes: { handle: handleContentCreatorDismissYes, feature: serverSettingsComponent.content_creator },
	content_creator_dismiss_no: { handle: handleContentCreatorDismissNo, feature: serverSettingsComponent.content_creator },
	bot_moderation: { handle: handleModerationButton },
	bot_afk: { handle: handleAFKButton, feature: serverSettingsComponent.afk },
	afk_remove: { handle: handleRemoveAFKButton },
	level_my_account: { handle: handleMyAccountLinkButton, feature: serverSettingsComponent.leveling },
	bot_invites: { handle: handleInvitesButton, feature: serverSettingsComponent.leveling },
	[INVITE_SLUG_BUTTON_ID]: { handle: handleInviteSlugButton, feature: serverSettingsComponent.leveling },
	settings_language: { handle: handleLanguageButton },
	[DISCORD_QUEST_BUTTON_ID]: { handle: handleDiscordQuestButton, feature: serverSettingsComponent.discord_quest_notifier },
	[QUEST_CLAIM_ALL_BUTTON_ID]: { handle: handleQuestClaimAllButton, feature: serverSettingsComponent.discord_quest_notifier }
};

const startsWithAny =
	(...prefixes: string[]) =>
	(customId: string) =>
		prefixes.some((prefix) => customId.startsWith(prefix));

const PREFIX_BUTTON_ROUTES: PrefixRoute[] = [
	{ matches: startsWithAny('menu_cat|'), handle: (interaction) => handleMenuCategory(interaction, interaction.customId.split('|')[1]) },
	{ matches: startsWithAny('staff_rating_approve', 'staff_report_approve'), handle: handleStaffRatingApprove, feature: serverSettingsComponent.staff_rating },
	{ matches: startsWithAny('staff_rating_reject', 'staff_report_reject'), handle: handleStaffRatingReject, feature: serverSettingsComponent.staff_rating },
	{ matches: startsWithAny('content_creator_approve'), handle: handleContentCreatorApprove, feature: serverSettingsComponent.content_creator },
	{ matches: startsWithAny('content_creator_reject'), handle: handleContentCreatorReject, feature: serverSettingsComponent.content_creator },
	{ matches: startsWithAny('giveaway_enter_'), handle: handleGiveawayEnterButton, feature: serverSettingsComponent.giveaway },
	{ matches: startsWithAny('giveaway_finish_'), handle: handleGiveawayFinish, feature: serverSettingsComponent.giveaway },
	{ matches: isQuestEnrollButtonId, handle: handleQuestEnrollButton, feature: serverSettingsComponent.discord_quest_notifier },
	{ matches: isRobloxItemNotificationButtonId, handle: handleRobloxItemNotificationButton, feature: serverSettingsComponent.roblox_catalog_notifier },
	{ matches: isCreatorFollowPlatformButtonId, handle: handleCreatorFollowPlatformButton, feature: serverSettingsComponent.creator_alerts },
	{ matches: isCreatorFollowButtonId, handle: handleCreatorFollowButton, feature: serverSettingsComponent.creator_alerts }
];

function buttonRoute(customId: string): ButtonRoute | null {
	if (Object.prototype.hasOwnProperty.call(EXACT_BUTTON_ROUTES, customId)) {
		return EXACT_BUTTON_ROUTES[customId];
	}
	return PREFIX_BUTTON_ROUTES.find((route) => route.matches(customId)) ?? null;
}

export async function handleButtonInteraction(interaction: ButtonInteraction<'cached'>) {
	const { customId } = interaction;
	const { user } = interaction;

	await logger.log(`🔘 Button clicked: "${customId}" by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

	if (isMessageComponentId(customId)) {
		await handleMessageComponent(interaction);
		return;
	}

	const route = buttonRoute(customId);
	if (!route) {
		await logger.log(`🔍 Unknown button interaction: ${customId}`);
		const errorMsg = await translate('common.errors.unknownButton', { guildId: interaction.guild?.id, userId: interaction.user?.id });
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}
	if (route.feature && (await replyIfFeatureDisabled(interaction, route.feature))) {
		return;
	}
	await route.handle(interaction);
}

export async function createInterfaceEmbed(client: Client<true>, guildId: string) {
	if (!guildId) {
		throw new Error('Guild ID is required to create interface embed');
	}

	const embedConfig = await getEmbedConfig(guildId);
	const title = await translateServer('interface.panel.title', guildId, { botName: embedConfig.NICKNAME });
	const description = await translateServer('interface.panel.description', guildId);
	const guild = client.guilds.cache.get(guildId);
	const botMember = guild ? await guild.members.fetchMe().catch(() => guild.members.me) : null;

	const interfaceEmbed = {
		color: embedConfig.COLOR,
		title,
		description,
		thumbnail: {
			url: (botMember ?? client.user).displayAvatarURL()
		},
		footer: {
			text: embedConfig.FOOTER
		},
		timestamp: new Date().toISOString()
	};

	return interfaceEmbed;
}

type InterfacePayload = {
	embeds: Awaited<ReturnType<typeof createInterfaceEmbed>>[];
	components: { components: { data: { type?: ComponentType; label?: string } }[] }[];
};

export async function createInterfaceButtons(guildId: string) {
	const menuLabel = await translateServer('menu.button', guildId);
	const menuButton = new ButtonBuilder().setCustomId('bot_menu').setLabel(menuLabel).setStyle(ButtonStyle.Primary);

	return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menuButton)];
}

function isInterfaceMessage(message: Message, botUserId: string) {
	if (message.author?.id !== botUserId) {
		return false;
	}
	return message.components?.some((row) => (row as ActionRow<MessageActionRowComponent>).components?.some((c) => c.customId === 'bot_menu')) ?? false;
}

function interfaceUpToDate(message: Message, payload: InterfacePayload) {
	const current = message.embeds?.[0];
	const next = payload.embeds[0];
	const currentLabel = (message.components?.[0] as ActionRow<ButtonComponent> | undefined)?.components?.[0]?.label;
	const nextLabel = payload.components[0]?.components?.[0]?.data?.label;
	return (
		!!current &&
		current.title === next.title &&
		current.description === next.description &&
		current.color === next.color &&
		current.footer?.text === next.footer.text &&
		current.thumbnail?.url === next.thumbnail.url &&
		currentLabel === nextLabel
	);
}

async function currentInterface(targetChannel: GuildTextBasedChannel, client: Client<true>) {
	const payload = {
		embeds: [await createInterfaceEmbed(client, targetChannel.guild.id)],
		components: await createInterfaceButtons(targetChannel.guild.id)
	};
	const recent = await targetChannel.messages?.fetch({ limit: 50 }).catch(() => null);
	const existing = recent?.find((m) => isInterfaceMessage(m, client.user.id)) ?? null;
	return { payload, existing };
}

async function editInterface(targetChannel: GuildTextBasedChannel, { payload, existing }: Awaited<ReturnType<typeof currentInterface>>) {
	if (!existing || interfaceUpToDate(existing, payload)) {
		return;
	}
	await existing.edit(payload);
	await logger.log(`🎮 Bot interface refreshed in ${targetChannel.name}`);
}

export async function refreshInterfaceInChannel(targetChannel: GuildTextBasedChannel | null, client: Client<true>) {
	if (!targetChannel?.guild) {
		return;
	}
	await editInterface(targetChannel, await currentInterface(targetChannel, client));
}

export async function publishInterfaceInChannel(targetChannel: GuildTextBasedChannel | null, client: Client<true>) {
	if (!targetChannel?.guild) {
		return;
	}
	const current = await currentInterface(targetChannel, client);
	if (current.existing) {
		await editInterface(targetChannel, current);
		return;
	}
	await targetChannel.send(current.payload);
	await logger.log(`🎮 Bot interface sent to ${targetChannel.name}`);
}

type ComponentRoute<I> = { matches: (customId: string) => boolean; handle: (interaction: I) => Promise<unknown>; feature?: string };
type CachedModal = ModalSubmitInteraction<'cached'>;
type CachedStringSelect = StringSelectMenuInteraction<'cached'>;

const isExactly = (id: string) => (customId: string) => customId === id;

const MODAL_ROUTES: ComponentRoute<CachedModal>[] = [
	{ matches: startsWithAny('moderation_modal|'), handle: handleModerationModal },
	{ matches: isExactly('custom_supporter_role_create'), handle: handleCustomSupporterRoleModal, feature: serverSettingsComponent.custom_supporter_role },
	{ matches: isExactly('custom_supporter_role_edit'), handle: handleCustomSupporterRoleEditModal, feature: serverSettingsComponent.custom_supporter_role },
	{ matches: isExactly(INVITE_SLUG_MODAL_ID), handle: handleInviteSlugModal, feature: serverSettingsComponent.leveling },
	{ matches: isExactly('feedback_submit'), handle: handleFeedbackModal, feature: serverSettingsComponent.feedback },
	{ matches: isExactly('afk_set'), handle: handleAFKModal, feature: serverSettingsComponent.afk },
	{ matches: startsWithAny('staff_rating_submit', 'staff_report_submit'), handle: handleStaffRatingModal, feature: serverSettingsComponent.staff_rating },
	{ matches: isExactly('content_creator_apply'), handle: handleContentCreatorModal, feature: serverSettingsComponent.content_creator },
	{ matches: startsWithAny('sr_rev|'), handle: handleStaffRatingDecisionModal, feature: serverSettingsComponent.staff_rating },
	{ matches: startsWithAny('cc_rev|'), handle: handleContentCreatorDecisionModal, feature: serverSettingsComponent.content_creator },
	{ matches: startsWithAny('giveaway_create'), handle: handleGiveawayModal, feature: serverSettingsComponent.giveaway },
	{ matches: isExactly(QUEST_CLAIM_ALL_MODAL_ID), handle: handleQuestClaimAllModalSubmit, feature: serverSettingsComponent.discord_quest_notifier },
	{ matches: isQuestEnrollModalId, handle: handleQuestEnrollModalSubmit, feature: serverSettingsComponent.discord_quest_notifier },
	{ matches: isCreatorFollowModalId, handle: handleCreatorFollowModalSubmit, feature: serverSettingsComponent.creator_alerts }
];

const STRING_SELECT_ROUTES: ComponentRoute<CachedStringSelect>[] = [
	{ matches: isMessageComponentId, handle: handleMessageComponent },
	{ matches: startsWithAny('moderation_action|'), handle: handleModerationActionSelect },
	{ matches: isExactly('settings_language_select'), handle: handleLanguageSelect },
	{ matches: (customId) => customId === SETUP_LANGUAGE_SELECT_ID, handle: (interaction) => handleSetupLanguageSelect(interaction, interaction.client) },
	{ matches: isExactly('notifications_select'), handle: handleNotificationsSelect },
	{ matches: isExactly(ROBLOX_NOTIFICATIONS_SELECT_ID), handle: handleRobloxNotificationsSelect, feature: serverSettingsComponent.roblox_catalog_notifier },
	{ matches: isRobloxItemNotificationTypesSelectId, handle: handleRobloxItemNotificationTypesSelect, feature: serverSettingsComponent.roblox_catalog_notifier },
	{
		matches: (customId) => isCreatorMenuId(customId, CREATOR_NOTIFICATIONS_SELECT_ID),
		handle: handleCreatorNotificationsSelect,
		feature: serverSettingsComponent.creator_alerts
	},
	{ matches: isCreatorNotificationTypesSelectId, handle: handleCreatorNotificationTypesSelect, feature: serverSettingsComponent.creator_alerts }
];

const ROLE_SELECT_ROUTES: ComponentRoute<RoleSelectMenuInteraction<'cached'>>[] = [
	{ matches: isExactly('giveaway_role_select'), handle: handleGiveawayRoleSelect, feature: serverSettingsComponent.giveaway }
];

const USER_SELECT_ROUTES: ComponentRoute<UserSelectMenuInteraction<'cached'>>[] = [
	{ matches: isExactly('moderation_select_user'), handle: handleModerationUserSelect }
];

async function runComponentRoute<I extends RepliableInteraction & { customId: string }>(interaction: I, routes: ComponentRoute<I>[]): Promise<boolean> {
	const route = routes.find((candidate) => candidate.matches(interaction.customId));
	if (!route) {
		return false;
	}
	if (route.feature && (await replyIfFeatureDisabled(interaction, route.feature))) {
		return true;
	}
	await route.handle(interaction);
	return true;
}

async function replyInteractionError(interaction: RepliableInteraction<'cached'>, { key, label }: { key: string; label: string }) {
	try {
		const errorMsg = await translate(key, { guildId: interaction.guild.id, userId: interaction.user.id });
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
	} catch (replyError) {
		await logger.log(`❌ Failed to send ${label} error response: ${(replyError as Error).message}`);
	}
}

async function onButton(interaction: ButtonInteraction<'cached'>) {
	try {
		await handleButtonInteraction(interaction);
	} catch (error) {
		await logger.log(`❌ Button interaction error: ${(error as Error).message}`);
		await replyInteractionError(interaction, { key: 'common.errors.buttonError', label: 'button' });
	}
}

async function onModal(interaction: CachedModal) {
	const { user, customId } = interaction;
	try {
		await logger.log(`📝 Modal submitted: "${customId}" by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);
		if (!(await runComponentRoute(interaction, MODAL_ROUTES))) {
			await logger.log(`⚠️ Unknown modal: "${customId}" by ${user.tag} (${user.id})`);
		}
	} catch (error) {
		await logger.log(`❌ Modal submission error: ${(error as Error).message}`);
		await replyInteractionError(interaction, { key: 'common.errors.modalError', label: 'modal' });
	}
}

async function onStringSelect(interaction: CachedStringSelect) {
	const { user, customId } = interaction;
	try {
		await logger.log(`📋 String select: "${customId}" → [${interaction.values.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);
		if (!(await runComponentRoute(interaction, STRING_SELECT_ROUTES))) {
			await logger.log(`⚠️ Unknown string select: "${customId}" by ${user.tag} (${user.id})`);
		}
	} catch (error) {
		await logger.log(`❌ String select error: ${(error as Error).message}`);
		if (!interaction.replied && !interaction.deferred) {
			await replyInteractionError(interaction, { key: 'common.errors.selectionError', label: 'string selection' });
		}
	}
}

async function onRoleSelect(interaction: RoleSelectMenuInteraction<'cached'>) {
	const { user, customId } = interaction;
	try {
		await logger.log(`👥 Role selected: "${customId}" → [${interaction.values.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);
		if (!(await runComponentRoute(interaction, ROLE_SELECT_ROUTES))) {
			await logger.log(`⚠️ Unknown role select: "${customId}" by ${user.tag} (${user.id})`);
		}
	} catch (error) {
		await logger.log(`❌ Role selection error in interface.js: ${(error as Error).message}`);
		await logger.log(`❌ Role selection error stack: ${(error as Error).stack}`);
		await replyInteractionError(interaction, { key: 'common.errors.selectionError', label: 'role selection' });
	}
}

async function onUserSelect(interaction: UserSelectMenuInteraction<'cached'>) {
	const { user, customId } = interaction;
	try {
		await logger.log(`👤 User selected: "${customId}" → [${interaction.values.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);
		if (!(await runComponentRoute(interaction, USER_SELECT_ROUTES))) {
			await logger.log(`⚠️ Unknown user select: "${customId}" by ${user.tag} (${user.id})`);
		}
	} catch (error) {
		await logger.log(`❌ User selection error in interface.js: ${(error as Error).message}`);
		await logger.log(`❌ User selection error stack: ${(error as Error).stack}`);
		await replyInteractionError(interaction, { key: 'common.errors.selectionError', label: 'user selection' });
	}
}

function interactionHandler(interaction: Interaction): (() => Promise<void>) | null {
	if (interaction.isButton()) {
		return () => onButton(interaction as ButtonInteraction<'cached'>);
	}
	if (interaction.isModalSubmit()) {
		return () => onModal(interaction as CachedModal);
	}
	if (interaction.isStringSelectMenu()) {
		return () => onStringSelect(interaction as CachedStringSelect);
	}
	if (interaction.isRoleSelectMenu()) {
		return () => onRoleSelect(interaction as RoleSelectMenuInteraction<'cached'>);
	}
	if (interaction.isUserSelectMenu()) {
		return () => onUserSelect(interaction as UserSelectMenuInteraction<'cached'>);
	}
	return null;
}

async function belongsToThisBot(interaction: Interaction): Promise<boolean> {
	if (!interaction.guild) {
		return false;
	}
	try {
		await getServerForCurrentBot(interaction.guild.id);
		return true;
	} catch (error) {
		await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
		return false;
	}
}

async function dispatchInteraction(interaction: Interaction) {
	const handler = interactionHandler(interaction);
	if (handler && (await belongsToThisBot(interaction))) {
		await handler();
	}
}

function init(client: Client<true>) {
	client.on('interactionCreate', dispatchInteraction);
}

export default {
	init
};
