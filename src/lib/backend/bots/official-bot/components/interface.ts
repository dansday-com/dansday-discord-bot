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
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	EmbedBuilder,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder
} from 'discord.js';
import { logger } from '../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from './permissions.js';
import {
	handleCustomSupporterRoleButton,
	handleCustomSupporterRoleModal,
	handleCustomSupporterRoleEditModal,
	handleEditCustomSupporterRole,
	handleDeleteCustomSupporterRole
} from './interface/customsupporterrole.js';
import { handleFeedbackButton, handleFeedbackModal } from './interface/feedback.js';
import { keepComponentsV2, v2Message } from './interface/componentsV2.js';
import { handleAFKButton, handleAFKModal, handleRemoveAFKButton } from './interface/afk.js';
import { handleModerationButton, handleModerationUserSelect, handleModerationActionSelect, handleModerationModal } from './interface/moderation.js';
import {
	handleGiveawayButton,
	handleGiveawayModal,
	handleGiveawayEnterButton,
	handleGiveawayRoleSelect,
	handleGiveawaySkipRolesContinue,
	handleGiveawayFinish,
	handleGiveawayMultipleSelect
} from './interface/giveaway.js';
import { handleLanguageButton, handleLanguageSelect } from './interface/settings.js';
import { handleInvitesButton, handleInviteSlugButton, handleInviteSlugModal, INVITE_SLUG_BUTTON_ID, INVITE_SLUG_MODAL_ID } from './interface/invites.js';
import {
	handleStaffRatingButton,
	handleStaffRatingUserSelect,
	handleStaffRatingModal,
	handleStaffRatingScoreSelect,
	handleStaffRatingCategorySelect,
	handleStaffRatingContinue,
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
import { memberTranslator, translate, translateServer } from '../i18n.js';
import { getLevelRequirement } from './leveling.js';
import { SETUP_LANGUAGE_SELECT_ID, handleSetupLanguageSelect } from './commands/admin/setup.js';
import db from '../../../../database.js';
import { computeCardToken } from '../../../../frontend/public/items/index.js';
import { resolvePublicStatisticsSnapshot } from '../../../../frontend/public/statistics/stream.js';
import type { PublicPageStats } from '../../../../frontend/public/statistics/shape.js';

async function replyIfFeatureDisabled(interaction: any, component: string): Promise<boolean> {
	if (!interaction.guild) return false;
	if (await isComponentFeatureEnabled(interaction.guild.id, component)) return false;
	const msg = await translate('common.errors.featureDisabled', interaction.guild.id, interaction.user.id);
	await interaction.reply({ content: msg, flags: 64 }).catch(() => null);
	return true;
}

const MENU_CATEGORIES: {
	id: string;
	style: ButtonStyle;
	permission?: string;
	items: { customId: string; label: string; desc: string; style?: ButtonStyle }[];
}[] = [
	{
		id: 'me',
		style: ButtonStyle.Primary,
		items: [
			{ customId: 'bot_afk', label: 'afk.title', desc: 'afk' },
			{ customId: 'bot_notifications', label: 'notifications.button', desc: 'notifications' },
			{ customId: 'bot_invites', label: 'invites.button', desc: 'invites' },
			{ customId: DISCORD_QUEST_BUTTON_ID, label: 'questEnroll.menuButton', desc: 'quest' }
		]
	},
	{
		id: 'community',
		style: ButtonStyle.Primary,
		items: [
			{ customId: 'bot_giveaway', label: 'giveaway.create.title', desc: 'giveaway' },
			{ customId: 'bot_feedback', label: 'feedback.modal.title', desc: 'feedback' },
			{ customId: 'bot_staff_rating', label: 'staffRating.button', desc: 'staffRating' }
		]
	},
	{
		id: 'perks',
		style: ButtonStyle.Primary,
		items: [
			{ customId: 'bot_custom_supporter_role', label: 'customSupporterRole.existing.title', desc: 'customSupporterRole' },
			{ customId: 'bot_content_creator', label: 'contentCreator.button', desc: 'contentCreator' }
		]
	},
	{
		id: 'staff',
		style: ButtonStyle.Danger,
		permission: 'staff_only',
		items: [{ customId: 'bot_moderation', label: 'moderation.button', desc: 'moderation', style: ButtonStyle.Danger }]
	}
];

async function handleMenuCategory(interaction, categoryId: string) {
	const category = MENU_CATEGORIES.find((c) => c.id === categoryId);
	if (!category) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;

	if (category.permission && !(await hasPermission(interaction.member, category.permission))) {
		const content = await getPermissionDeniedMessage(interaction.guild, category.permission, u);
		await interaction.reply({ content, flags: 64 }).catch(() => null);
		return;
	}

	const embedConfig = await getEmbedConfig(g);
	const container = new ContainerBuilder()
		.setAccentColor(embedConfig.COLOR)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## ${await translate(`menu.categories.${category.id}.button`, g, u)}\n${await translate(`menu.categories.${category.id}.description`, g, u)}`
			)
		)
		.addSeparatorComponents(new SeparatorBuilder());

	for (const item of category.items) {
		container.addSectionComponents(
			menuRow(
				await translate(`menu.items.${item.desc}`, g, u),
				new ButtonBuilder()
					.setCustomId(item.customId)
					.setLabel(await translate(item.label, g, u))
					.setStyle(item.style ?? ButtonStyle.Success)
			)
		);
	}

	container
		.addSeparatorComponents(new SeparatorBuilder())
		.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId('bot_menu')
					.setLabel(await translate('menu.back', g, u))
					.setStyle(ButtonStyle.Secondary)
			)
		)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${embedConfig.FOOTER}`));

	await showMenuScreen(interaction, container);
}

function menuRow(text: string, button: ButtonBuilder) {
	return new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text)).setButtonAccessory(button);
}

async function showMenuScreen(interaction, container: ContainerBuilder) {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(v2Message([container], interaction.message));
	} else if (interaction.message?.flags?.has(MessageFlags.Ephemeral)) {
		await interaction.update(v2Message([container], interaction.message));
	} else {
		await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
	}
}

function linkLabel(url: string): string {
	const u = new URL(url);
	const host = domainToUnicode(u.hostname) || u.hostname;
	return `${host}${u.port ? `:${u.port}` : ''}${decodeURI(u.pathname).replace(/\/$/, '')}`;
}

async function handleMenuButton(interaction) {
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
	if (!member) {
		const errorMsg = await translate('common.errors.memberNotFound', interaction.guild.id, interaction.user.id);
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({
				content: errorMsg,
				embeds: [],
				components: []
			});
		} else {
			await interaction.reply({
				content: errorMsg,
				flags: 64
			});
		}
		return;
	}

	if (!(await hasPermission(member, 'menu'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'menu', interaction.user.id);
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({
				content: errorMessage,
				embeds: [],
				components: []
			});
		} else {
			await interaction
				.reply({
					content: errorMessage,
					flags: 64
				})
				.catch(() => null);
		}
		return;
	}

	const categories = [];
	for (const category of MENU_CATEGORIES) {
		if (category.permission && !(await hasPermission(member, category.permission))) continue;
		categories.push(category);
	}

	if (categories.length === 0) {
		const noAccessMsg = await translate('menu.noAccess', interaction.guild.id, interaction.user.id);
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({
				content: noAccessMsg,
				embeds: [],
				components: []
			});
		} else {
			await interaction.reply({
				content: noAccessMsg,
				flags: 64
			});
		}
		return;
	}

	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const menuTitle = await translate('menu.title', interaction.guild.id, interaction.user.id, { botName: embedConfig.NICKNAME });
	const menuDesc = await translate('menu.description', interaction.guild.id, interaction.user.id);

	let publicServer: { serverId: number; base: string; subdomain: string | null; stats: PublicPageStats | null; joinUrl: string | null } | null = null;
	try {
		const server = await getServerForCurrentBot(interaction.guild.id);
		const slug = await computePublicServerSlugForServerId(Number(server.id));
		const base = slug ? publicServerUrl(slug) : null;
		if (base) {
			const [snapshot, serverRow] = await Promise.all([
				resolvePublicStatisticsSnapshot(Number(server.id)).catch(() => null),
				db.getServer(server.id).catch(() => null)
			]);
			const inviteOn = await isPublicSubFeatureEnabled(interaction.guild.id, 'invite').catch(() => false);
			const joinUrl = inviteOn && (serverRow?.vanity_url_code || serverRow?.invite_code) ? `${publicSiteOrigin()}${inviteJoinPath(slug)}` : null;
			publicServer = { serverId: Number(server.id), base, subdomain: publicServerSubdomainOrigin(slug), stats: snapshot?.stats ?? null, joinUrl };
		}
	} catch (_) {}

	let description = menuDesc;
	const siteUrl = publicServer ? (publicServer.subdomain ?? publicServer.base) : null;
	if (siteUrl) {
		let siteLink = siteUrl;
		try {
			siteLink = `[${linkLabel(siteUrl)}](${siteUrl})`;
		} catch (_) {}
		description = `${menuDesc}\n\n${await translate('menu.website', interaction.guild.id, interaction.user.id, { url: siteLink })}`;
		if (publicServer?.joinUrl) {
			let joinLink = publicServer.joinUrl;
			try {
				joinLink = `[${linkLabel(publicServer.joinUrl)}](${publicServer.joinUrl})`;
			} catch (_) {}
			description += `\n${await translate('menu.join', interaction.guild.id, interaction.user.id, { url: joinLink })}`;
		}
	}

	const header = new TextDisplayBuilder().setContent(`## ${menuTitle}\n${description}`);
	const icon = interaction.guild.iconURL({ extension: 'png', size: 128 });
	const container = new ContainerBuilder().setAccentColor(embedConfig.COLOR);
	if (icon) {
		container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(header).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)));
	} else {
		container.addTextDisplayComponents(header);
	}

	if (publicServer?.stats) {
		const stats = publicServer.stats;
		const stat = async (key: string, value: number) =>
			`${await translate(`menu.stats.${key}`, interaction.guild.id, interaction.user.id)} **${value.toLocaleString()}**`;
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				[await stat('members', stats.members_total), await stat('totalXp', stats.leveling_total_xp), await stat('topLevel', stats.leveling_max_level)].join(
					' · '
				)
			)
		);
	}

	container.addSeparatorComponents(new SeparatorBuilder());
	for (const category of categories) {
		container.addSectionComponents(
			menuRow(
				await translate(`menu.categories.${category.id}.description`, interaction.guild.id, interaction.user.id),
				new ButtonBuilder()
					.setCustomId(`menu_cat|${category.id}`)
					.setLabel(await translate(`menu.categories.${category.id}.button`, interaction.guild.id, interaction.user.id))
					.setStyle(category.style)
			)
		);
	}

	const footerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('settings_language')
			.setLabel(await translate('settings.language.select', interaction.guild.id, interaction.user.id))
			.setStyle(ButtonStyle.Secondary)
	);

	if (publicServer) {
		const cardHash = computeCardToken(publicServer.serverId, String(interaction.user.id));
		const accountLabel = await translate('menu.account', interaction.guild.id, interaction.user.id);
		footerRow.addComponents(
			new ButtonBuilder().setLabel(accountLabel).setURL(`${publicServer.base}/account/profile/stats/${cardHash}`).setStyle(ButtonStyle.Link)
		);
	}

	container
		.addSeparatorComponents(new SeparatorBuilder())
		.addActionRowComponents(footerRow)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${embedConfig.FOOTER}`));

	await showMenuScreen(interaction, container);
}

async function handleMyAccountLinkButton(interaction) {
	const guildId = interaction.guild.id;
	const userId = interaction.user.id;

	const embedConfig = await getEmbedConfig(guildId).catch(() => null);
	const accountLabel = await translate('menu.account', guildId, userId).catch(() => '👤 Account');

	const replyEmbed = async (
		description: string | null,
		components: ActionRowBuilder<ButtonBuilder>[] = [],
		fields: { name: string; value: string; inline?: boolean }[] = []
	) => {
		const embed = new EmbedBuilder().setTitle(accountLabel).setTimestamp();
		if (description) embed.setDescription(description);
		if (fields.length > 0) embed.addFields(fields);
		if (embedConfig) embed.setColor(embedConfig.COLOR);
		if (embedConfig?.FOOTER) embed.setFooter({ text: embedConfig.FOOTER });
		const avatar = interaction.user.displayAvatarURL?.({ size: 128 });
		if (avatar) embed.setThumbnail(avatar);
		await interaction.reply({ embeds: [embed], components, flags: 64 }).catch(() => null);
	};

	const server = await getServerForCurrentBot(guildId);
	const slug = await computePublicServerSlugForServerId(Number(server.id));
	const base = slug ? publicServerUrl(slug) : null;
	if (!base) {
		await replyEmbed(await translate('leveling.account.unavailable', guildId, userId));
		return;
	}

	const dbMember = await db.getMemberByDiscordId(server.id, userId).catch(() => null);
	if (!dbMember?.discord_member_id) {
		await replyEmbed(await translate('leveling.account.noMember', guildId, userId));
		return;
	}

	const hash = computeCardToken(server.id, String(dbMember.discord_member_id));
	const url = `${base}/account/profile/stats/${hash}`;
	let linkText = url;
	try {
		linkText = `[${new URL(url).host}](${url})`;
	} catch (_) {}
	const description = await translate('leveling.account.link', guildId, userId, { url: linkText });
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel(accountLabel).setURL(url).setStyle(ButtonStyle.Link));

	const fields: { name: string; value: string; inline?: boolean }[] = [];
	const stats = await db.getMemberLevelByDiscordId(server.id, userId).catch(() => null);
	if (stats) {
		const tr = await memberTranslator(guildId, userId);
		const level = Number(stats.level) || 1;
		const xp = Number(stats.xp) || 0;
		const rank = Number(stats.rank) || 0;

		fields.push({ name: tr('leveling.fields.level'), value: level.toLocaleString(), inline: true });
		fields.push({ name: tr('leveling.fields.totalXp'), value: xp.toLocaleString(), inline: true });
		fields.push({ name: tr('leveling.fields.rank'), value: rank > 0 ? `#${rank}` : tr('leveling.unranked'), inline: true });

		try {
			const floorXp = await getLevelRequirement(level, guildId);
			const nextXp = await getLevelRequirement(level + 1, guildId);
			const span = Math.max(1, nextXp - floorXp);
			const ratio = Math.max(0, Math.min(1, (xp - floorXp) / span));
			const filled = Math.round(ratio * 10);
			fields.push({
				name: tr('leveling.fields.progress', { level: level + 1 }),
				value: `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(ratio * 100)}%\n${tr('leveling.xpToGo', { xp: Math.max(0, Math.ceil(nextXp - xp)).toLocaleString() })}`,
				inline: false
			});
		} catch (_) {}

		const messages = Number(stats.chat_total) || 0;
		const voiceHours = Math.round((Number(stats.voice_minutes_total) || 0) / 60);
		const streamHours = Math.round((Number(stats.voice_minutes_streaming) || 0) / 60);
		const activity = [
			tr('leveling.activity.messages', { count: messages.toLocaleString() }),
			tr('leveling.activity.voice', { hours: voiceHours.toLocaleString() })
		];
		if (streamHours > 0) activity.push(tr('leveling.activity.streaming', { hours: streamHours.toLocaleString() }));
		fields.push({ name: tr('leveling.fields.activity'), value: activity.join(' · '), inline: false });
	}

	await replyEmbed(fields.length > 0 ? null : description, [row], fields);
}

export async function handleButtonInteraction(interaction) {
	const { customId } = interaction;
	const user = interaction.user;

	await logger.log(`🔘 Button clicked: "${customId}" by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

	switch (customId) {
		case 'bot_menu':
			await handleMenuButton(interaction);
			break;
		case 'bot_custom_supporter_role':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) break;
			await handleCustomSupporterRoleButton(interaction);
			break;
		case 'custom_supporter_role_edit':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) break;
			await handleEditCustomSupporterRole(interaction);
			break;
		case 'custom_supporter_role_delete':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) break;
			await handleDeleteCustomSupporterRole(interaction);
			break;
		case 'bot_giveaway':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) break;
			await handleGiveawayButton(interaction);
			break;
		case 'bot_feedback':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.feedback)) break;
			await handleFeedbackButton(interaction);
			break;
		case 'bot_staff_report':
		case 'bot_staff_rating':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) break;
			await handleStaffRatingButton(interaction);
			break;
		case 'bot_notifications':
			await handleNotificationsButton(interaction);
			break;
		case 'notifications_channels':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.notifications)) break;
			await handleNotificationChannelsButton(interaction);
			break;
		case ROBLOX_NOTIFICATIONS_MENU_BUTTON_ID:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.roblox_catalog_notifier)) break;
			await handleRobloxNotificationsMenuButton(interaction);
			break;
		case ROBLOX_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.roblox_catalog_notifier)) break;
			await handleRobloxNotificationsDisableAll(interaction);
			break;
		case CREATOR_NOTIFICATIONS_MENU_BUTTON_ID:
		case `${CREATOR_NOTIFICATIONS_MENU_BUTTON_ID}${CREATOR_CONTENT_HUB_SUFFIX}`:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
			await handleCreatorNotificationsMenuButton(interaction);
			break;
		case CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID:
		case `${CREATOR_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID}${CREATOR_CONTENT_HUB_SUFFIX}`:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
			await handleCreatorNotificationsDisableAll(interaction);
			break;
		case CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID:
		case `${CREATOR_NOTIFICATIONS_FOLLOW_BUTTON_ID}${CREATOR_CONTENT_HUB_SUFFIX}`:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
			await handleCreatorNotificationsFollowButton(interaction);
			break;
		case CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID:
		case `${CREATOR_NOTIFICATIONS_RECENT_BUTTON_ID}${CREATOR_CONTENT_HUB_SUFFIX}`:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
			await handleCreatorNotificationsRecentButton(interaction);
			break;
		case 'bot_content_creator':
			await handleContentCreatorHubButton(interaction);
			break;
		case 'content_creator_list':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
			await handleContentCreatorButton(interaction);
			break;
		case 'content_creator_apply_open':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
			await handleContentCreatorApplyButton(interaction);
			break;
		case 'content_creator_dismiss_request':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
			await handleContentCreatorDismissRequest(interaction);
			break;
		case 'content_creator_dismiss_yes':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
			await handleContentCreatorDismissYes(interaction);
			break;
		case 'content_creator_dismiss_no':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
			await handleContentCreatorDismissNo(interaction);
			break;
		case 'bot_moderation':
			await handleModerationButton(interaction);
			break;
		case 'bot_afk':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.afk)) break;
			await handleAFKButton(interaction);
			break;
		case 'afk_remove':
			await handleRemoveAFKButton(interaction);
			break;
		case 'level_my_account':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.leveling)) break;
			await handleMyAccountLinkButton(interaction);
			break;
		case 'bot_invites':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.leveling)) break;
			await handleInvitesButton(interaction);
			break;
		case INVITE_SLUG_BUTTON_ID:
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.leveling)) break;
			await handleInviteSlugButton(interaction);
			break;
		case 'settings_language':
			await handleLanguageButton(interaction);
			break;
		case 'staff_report_back_to_staff':
		case 'staff_rating_back_to_staff':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) break;
			await handleStaffRatingButton(interaction);
			break;
		default:
			if (customId.startsWith('menu_cat|')) {
				await handleMenuCategory(interaction, customId.split('|')[1]);
			} else if (customId.startsWith('staff_rating_continue') || customId.startsWith('staff_report_continue')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) break;
				await handleStaffRatingContinue(interaction);
			} else if (customId.startsWith('staff_rating_approve') || customId.startsWith('staff_report_approve')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) break;
				await handleStaffRatingApprove(interaction);
			} else if (customId.startsWith('staff_rating_reject') || customId.startsWith('staff_report_reject')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) break;
				await handleStaffRatingReject(interaction);
			} else if (customId.startsWith('content_creator_approve')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
				await handleContentCreatorApprove(interaction);
			} else if (customId.startsWith('content_creator_reject')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) break;
				await handleContentCreatorReject(interaction);
			} else if (customId.startsWith('giveaway_enter_')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) break;
				await handleGiveawayEnterButton(interaction);
			} else if (customId === 'giveaway_continue_form') {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) break;
				await handleGiveawaySkipRolesContinue(interaction);
			} else if (customId.startsWith('giveaway_finish_')) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) break;
				await handleGiveawayFinish(interaction);
			} else if (customId === DISCORD_QUEST_BUTTON_ID) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) break;
				await handleDiscordQuestButton(interaction);
			} else if (customId === QUEST_CLAIM_ALL_BUTTON_ID) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) break;
				await handleQuestClaimAllButton(interaction);
			} else if (isQuestEnrollButtonId(customId)) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) break;
				await handleQuestEnrollButton(interaction);
			} else if (isRobloxItemNotificationButtonId(customId)) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.roblox_catalog_notifier)) break;
				await handleRobloxItemNotificationButton(interaction);
			} else if (isCreatorFollowPlatformButtonId(customId)) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
				await handleCreatorFollowPlatformButton(interaction);
			} else if (isCreatorFollowButtonId(customId)) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) break;
				await handleCreatorFollowButton(interaction);
			} else {
				await logger.log(`🔍 Unknown button interaction: ${customId}`);
				const errorMsg = await translate('common.errors.unknownButton', interaction.guild?.id, interaction.user?.id);
				await interaction
					.reply({
						content: errorMsg,
						flags: 64
					})
					.catch(() => null);
			}
	}
}

export async function createInterfaceEmbed(client, guildId) {
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

export async function createInterfaceButtons(guildId: string) {
	const menuLabel = await translateServer('menu.button', guildId);
	const menuButton = new ButtonBuilder().setCustomId('bot_menu').setLabel(menuLabel).setStyle(ButtonStyle.Primary);

	return [new ActionRowBuilder().addComponents(menuButton)];
}

function isInterfaceMessage(message, botUserId: string) {
	if (message.author?.id !== botUserId) return false;
	return message.components?.some((row) => row.components?.some((c) => c.customId === 'bot_menu')) ?? false;
}

function interfaceUpToDate(message, payload) {
	const current = message.embeds?.[0];
	const next = payload.embeds[0];
	const currentLabel = message.components?.[0]?.components?.[0]?.label;
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

export async function refreshInterfaceInChannel(targetChannel, client, { sendIfMissing }: { sendIfMissing: boolean }) {
	if (!targetChannel?.guild) return;
	const payload = {
		embeds: [await createInterfaceEmbed(client, targetChannel.guild.id)],
		components: await createInterfaceButtons(targetChannel.guild.id)
	};

	const recent = await targetChannel.messages?.fetch({ limit: 50 }).catch(() => null);
	const existing = recent?.find((m) => isInterfaceMessage(m, client.user.id)) ?? null;
	if (existing) {
		if (interfaceUpToDate(existing, payload)) return;
		await existing.edit(payload);
		await logger.log(`🎮 Bot interface refreshed in ${targetChannel.name}`);
	} else if (sendIfMissing) {
		await targetChannel.send(payload);
		await logger.log(`🎮 Bot interface sent to ${targetChannel.name}`);
	}
}

function init(client) {
	client.on('interactionCreate', async (interaction) => {
		keepComponentsV2(interaction);
		if (interaction.isButton()) {
			if (!interaction.guild) {
				return;
			}

			try {
				await getServerForCurrentBot(interaction.guild.id);
			} catch (error) {
				await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
				return;
			}

			try {
				await handleButtonInteraction(interaction);
			} catch (error) {
				await logger.log(`❌ Button interaction error: ${error.message}`);

				try {
					const errorMsg = await translate('common.errors.buttonError', interaction.guild?.id, interaction.user?.id);
					await interaction.reply({
						content: errorMsg,
						flags: 64
					});
				} catch (replyError) {
					await logger.log(`❌ Failed to send button error response: ${replyError.message}`);
				}
			}
		} else if (interaction.isModalSubmit()) {
			if (!interaction.guild) {
				return;
			}

			try {
				await getServerForCurrentBot(interaction.guild.id);
			} catch (error) {
				await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
				return;
			}

			try {
				const user = interaction.user;
				const customId = interaction.customId;
				await logger.log(`📝 Modal submitted: "${customId}" by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

				if (interaction.customId.startsWith('moderation_modal|')) {
					await handleModerationModal(interaction);
				} else if (interaction.customId === 'custom_supporter_role_create') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) return;
					await handleCustomSupporterRoleModal(interaction);
				} else if (interaction.customId === 'custom_supporter_role_edit') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) return;
					await handleCustomSupporterRoleEditModal(interaction);
				} else if (interaction.customId === INVITE_SLUG_MODAL_ID) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.leveling)) return;
					await handleInviteSlugModal(interaction);
				} else if (interaction.customId === 'feedback_submit') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.feedback)) return;
					await handleFeedbackModal(interaction);
				} else if (interaction.customId === 'afk_set') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.afk)) return;
					await handleAFKModal(interaction);
				} else if (interaction.customId.startsWith('staff_rating_submit') || interaction.customId.startsWith('staff_report_submit')) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) return;
					await handleStaffRatingModal(interaction);
				} else if (interaction.customId === 'content_creator_apply') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) return;
					await handleContentCreatorModal(interaction);
				} else if (interaction.customId.startsWith('sr_rev|')) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.staff_rating)) return;
					await handleStaffRatingDecisionModal(interaction);
				} else if (interaction.customId.startsWith('cc_rev|')) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.content_creator)) return;
					await handleContentCreatorDecisionModal(interaction);
				} else if (interaction.customId.startsWith('giveaway_create')) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) return;
					await handleGiveawayModal(interaction);
				} else if (interaction.customId === QUEST_CLAIM_ALL_MODAL_ID) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) return;
					await handleQuestClaimAllModalSubmit(interaction);
				} else if (isQuestEnrollModalId(interaction.customId)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) return;
					await handleQuestEnrollModalSubmit(interaction);
				} else if (isCreatorFollowModalId(interaction.customId)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) return;
					await handleCreatorFollowModalSubmit(interaction);
				} else {
					await logger.log(`⚠️ Unknown modal: "${customId}" by ${user.tag} (${user.id})`);
				}
			} catch (error) {
				await logger.log(`❌ Modal submission error: ${error.message}`);

				try {
					const errorMsg = await translate('common.errors.modalError', interaction.guild?.id, interaction.user?.id);
					await interaction.reply({
						content: errorMsg,
						flags: 64
					});
				} catch (replyError) {
					await logger.log(`❌ Failed to send modal error response: ${replyError.message}`);
				}
			}
		} else if (interaction.isStringSelectMenu()) {
			if (!interaction.guild) {
				return;
			}

			try {
				await getServerForCurrentBot(interaction.guild.id);
			} catch (error) {
				await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
				return;
			}

			try {
				const user = interaction.user;
				const customId = interaction.customId;
				const selectedValues = interaction.values;
				await logger.log(`📋 String select: "${customId}" → [${selectedValues.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

				if (customId === 'staff_rating_select_user' || customId === 'staff_report_select_user') {
					await handleStaffRatingUserSelect(interaction);
				} else if (customId.startsWith('staff_rating_score') || customId.startsWith('staff_report_rating')) {
					await handleStaffRatingScoreSelect(interaction);
				} else if (customId.startsWith('staff_rating_category') || customId.startsWith('staff_report_category')) {
					await handleStaffRatingCategorySelect(interaction);
				} else if (customId.startsWith('moderation_action|')) {
					await handleModerationActionSelect(interaction);
				} else if (customId === 'giveaway_multiple_select') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) return;
					await handleGiveawayMultipleSelect(interaction);
				} else if (customId === 'settings_language_select') {
					await handleLanguageSelect(interaction);
				} else if (customId === SETUP_LANGUAGE_SELECT_ID) {
					await handleSetupLanguageSelect(interaction, client);
				} else if (customId === 'notifications_select') {
					await handleNotificationsSelect(interaction);
				} else if (customId === ROBLOX_NOTIFICATIONS_SELECT_ID) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.roblox_catalog_notifier)) return;
					await handleRobloxNotificationsSelect(interaction);
				} else if (isRobloxItemNotificationTypesSelectId(customId)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.roblox_catalog_notifier)) return;
					await handleRobloxItemNotificationTypesSelect(interaction);
				} else if (isCreatorMenuId(customId, CREATOR_NOTIFICATIONS_SELECT_ID)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) return;
					await handleCreatorNotificationsSelect(interaction);
				} else if (isCreatorNotificationTypesSelectId(customId)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.creator_alerts)) return;
					await handleCreatorNotificationTypesSelect(interaction);
				} else {
					await logger.log(`⚠️ Unknown string select: "${customId}" by ${user.tag} (${user.id})`);
				}
			} catch (error) {
				await logger.log(`❌ String select error: ${error.message}`);
			}
		} else if (interaction.isRoleSelectMenu()) {
			if (!interaction.guild) {
				return;
			}

			try {
				await getServerForCurrentBot(interaction.guild.id);
			} catch (error) {
				await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
				return;
			}

			try {
				const user = interaction.user;
				const customId = interaction.customId;
				const selectedRoles = interaction.values;
				await logger.log(`👥 Role selected: "${customId}" → [${selectedRoles.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

				if (customId === 'giveaway_role_select') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.giveaway)) return;
					await handleGiveawayRoleSelect(interaction);
				} else {
					await logger.log(`⚠️ Unknown role select: "${customId}" by ${user.tag} (${user.id})`);
				}
			} catch (error) {
				await logger.log(`❌ Role selection error in interface.js: ${error.message}`);
				await logger.log(`❌ Role selection error stack: ${error.stack}`);

				try {
					const errorMsg = await translate('common.errors.selectionError', interaction.guild?.id, interaction.user?.id);
					await interaction.reply({
						content: errorMsg,
						flags: 64
					});
				} catch (replyError) {
					await logger.log(`❌ Failed to send role selection error response: ${replyError.message}`);
				}
			}
		} else if (interaction.isUserSelectMenu()) {
			if (!interaction.guild) {
				return;
			}

			try {
				await getServerForCurrentBot(interaction.guild.id);
			} catch (error) {
				await logger.log(`⚠️  Server ${interaction.guild.name} (${interaction.guild.id}) not found for this bot, ignoring interaction`);
				return;
			}

			try {
				const user = interaction.user;
				const customId = interaction.customId;
				const selectedUsers = interaction.values;
				await logger.log(`👤 User selected: "${customId}" → [${selectedUsers.join(', ')}] by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`);

				if (customId === 'staff_rating_select_user' || customId === 'staff_report_select_user') {
					await handleStaffRatingUserSelect(interaction);
				} else if (customId === 'moderation_select_user') {
					await handleModerationUserSelect(interaction);
				} else {
					await logger.log(`⚠️ Unknown user select: "${customId}" by ${user.tag} (${user.id})`);
				}
			} catch (error) {
				await logger.log(`❌ User selection error in interface.js: ${error.message}`);
				await logger.log(`❌ User selection error stack: ${error.stack}`);

				try {
					const errorMsg = await translate('common.errors.selectionError', interaction.guild?.id, interaction.user?.id);
					await interaction
						.reply({
							content: errorMsg,
							flags: 64
						})
						.catch(() => null);
				} catch (replyError) {
					await logger.log(`❌ Failed to send user selection error response: ${replyError.message}`);
				}
			}
		}
	});
}

export default {
	init
};
