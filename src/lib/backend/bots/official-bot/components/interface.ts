import {
	computePublicServerSlugForServerId,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	publicServerSubdomainOrigin,
	publicServerUrl,
	serverSettingsComponent
} from '../../../config.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
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
import { handleAFKButton, handleAFKModal, handleRemoveAFKButton } from './interface/afk.js';
import { handleModerationButton, handleModerationUserSelect, handleModerationActionSelect, handleModerationModal } from './interface/moderation.js';
import {
	handleGiveawayButton,
	handleGiveawayModal,
	handleGiveawayEnterButton,
	handleGiveawayRoleSelect,
	handleGiveawaySkipRolesContinue,
	handleGiveawayFinish
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
import { translate } from '../i18n.js';
import { getLevelRequirement } from './leveling.js';
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

const MENU_CATEGORIES: { id: string; style: ButtonStyle; items: { customId: string; label: string; desc: string; style?: ButtonStyle }[] }[] = [
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
		items: [{ customId: 'bot_moderation', label: 'moderation.button', desc: 'moderation', style: ButtonStyle.Danger }]
	}
];

async function handleMenuCategory(interaction, categoryId: string) {
	const category = MENU_CATEGORIES.find((c) => c.id === categoryId);
	if (!category) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;

	const lines: string[] = [];
	const buttons = [];
	for (const item of category.items) {
		const label = await translate(item.label, g, u);
		lines.push(`**${label}**\n${await translate(`menu.items.${item.desc}`, g, u)}`);
		buttons.push(
			new ButtonBuilder()
				.setCustomId(item.customId)
				.setLabel(label)
				.setStyle(item.style ?? ButtonStyle.Success)
		);
	}

	const rows = [];
	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
	}
	rows.push(
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('bot_menu')
				.setLabel(await translate('menu.back', g, u))
				.setStyle(ButtonStyle.Secondary)
		)
	);

	const embedConfig = await getEmbedConfig(g);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate(`menu.categories.${category.id}.button`, g, u))
		.setDescription(`${await translate(`menu.categories.${category.id}.description`, g, u)}\n\n${lines.join('\n\n')}`)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ embeds: [embed], components: rows });
	} else if (interaction.message?.flags?.has(64)) {
		await interaction.update({ embeds: [embed], components: rows });
	} else {
		await interaction.reply({ embeds: [embed], components: rows, flags: 64 });
	}
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

	const buttons = [];
	for (const category of MENU_CATEGORIES) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(`menu_cat|${category.id}`)
				.setLabel(await translate(`menu.categories.${category.id}.button`, interaction.guild.id, interaction.user.id))
				.setStyle(category.style)
		);
	}

	if (buttons.length === 0) {
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

	let publicServer: { base: string; subdomain: string | null; stats: PublicPageStats | null } | null = null;
	try {
		const server = await getServerForCurrentBot(interaction.guild.id);
		const slug = await computePublicServerSlugForServerId(Number(server.id));
		const base = slug ? publicServerUrl(slug) : null;
		if (base) {
			const snapshot = await resolvePublicStatisticsSnapshot(Number(server.id)).catch(() => null);
			publicServer = { base, subdomain: publicServerSubdomainOrigin(slug), stats: snapshot?.stats ?? null };
		}
	} catch (_) {}

	let description = menuDesc;
	const siteUrl = publicServer ? (publicServer.subdomain ?? publicServer.base) : null;
	if (siteUrl) {
		let siteLink = siteUrl;
		try {
			siteLink = `[${new URL(siteUrl).host}${new URL(siteUrl).pathname.replace(/\/$/, '')}](${siteUrl})`;
		} catch (_) {}
		description = `${menuDesc}\n\n${await translate('menu.website', interaction.guild.id, interaction.user.id, { url: siteLink })}`;
	}

	const menuEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(menuTitle)
		.setDescription(description)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	if (publicServer?.stats) {
		const stats = publicServer.stats;
		menuEmbed.addFields(
			{
				name: await translate('menu.stats.members', interaction.guild.id, interaction.user.id),
				value: stats.members_total.toLocaleString(),
				inline: true
			},
			{
				name: await translate('menu.stats.totalXp', interaction.guild.id, interaction.user.id),
				value: stats.leveling_total_xp.toLocaleString(),
				inline: true
			},
			{
				name: await translate('menu.stats.topLevel', interaction.guild.id, interaction.user.id),
				value: stats.leveling_max_level.toLocaleString(),
				inline: true
			}
		);
	}

	const rows = [];
	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
	}

	const settingsButton = new ButtonBuilder()
		.setCustomId('settings_language')
		.setLabel(await translate('settings.language.select', interaction.guild.id, interaction.user.id))
		.setStyle(ButtonStyle.Secondary);

	rows.push(new ActionRowBuilder().addComponents(settingsButton));

	if (publicServer) {
		const base = publicServer.base;
		const addLinkButton = (btn: ButtonBuilder) => {
			const targetRow = rows[rows.length - 1];
			if (targetRow.components.length < 5) {
				targetRow.addComponents(btn);
			} else if (rows.length < 5) {
				rows.push(new ActionRowBuilder().addComponents(btn));
			}
		};

		const cardHash = computeCardToken(String(interaction.user.id));
		const accountLabel = await translate('menu.account', interaction.guild.id, interaction.user.id);
		addLinkButton(new ButtonBuilder().setLabel(accountLabel).setURL(`${base}/account/overview/${cardHash}`).setStyle(ButtonStyle.Link));
	}

	const isFromEphemeral = interaction.message?.flags?.has(64) || interaction.replied || interaction.deferred;

	if (isFromEphemeral) {
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({
				embeds: [menuEmbed],
				components: rows
			});
		} else {
			await interaction.update({
				embeds: [menuEmbed],
				components: rows
			});
		}
	} else {
		await interaction.reply({
			embeds: [menuEmbed],
			components: rows,
			flags: 64
		});
	}
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

	const hash = computeCardToken(String(dbMember.discord_member_id));
	const url = `${base}/account/overview/${hash}`;
	let linkText = url;
	try {
		linkText = `[${new URL(url).host}](${url})`;
	} catch (_) {}
	const description = await translate('leveling.account.link', guildId, userId, { url: linkText });
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel(accountLabel).setURL(url).setStyle(ButtonStyle.Link));

	const fields: { name: string; value: string; inline?: boolean }[] = [];
	const stats = await db.getMemberLevelByDiscordId(server.id, userId).catch(() => null);
	if (stats) {
		const level = Number(stats.level) || 1;
		const xp = Number(stats.xp) || 0;
		const rank = Number(stats.rank) || 0;

		fields.push({ name: '⭐ Level', value: level.toLocaleString(), inline: true });
		fields.push({ name: '📊 Total XP', value: xp.toLocaleString(), inline: true });
		fields.push({ name: '🏆 Rank', value: rank > 0 ? `#${rank}` : 'Unranked', inline: true });

		try {
			const floorXp = await getLevelRequirement(level, guildId);
			const nextXp = await getLevelRequirement(level + 1, guildId);
			const span = Math.max(1, nextXp - floorXp);
			const ratio = Math.max(0, Math.min(1, (xp - floorXp) / span));
			const filled = Math.round(ratio * 10);
			fields.push({
				name: `⚡ Progress to Level ${level + 1}`,
				value: `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(ratio * 100)}%\n**${Math.max(0, nextXp - xp).toLocaleString()}** XP to go`,
				inline: false
			});
		} catch (_) {}

		const messages = Number(stats.chat_total) || 0;
		const voiceHours = Math.round((Number(stats.voice_minutes_total) || 0) / 60);
		const streamHours = Math.round((Number(stats.voice_minutes_streaming) || 0) / 60);
		const activity = [`${messages.toLocaleString()} messages`, `${voiceHours.toLocaleString()}h voice`];
		if (streamHours > 0) activity.push(`${streamHours.toLocaleString()}h streaming`);
		fields.push({ name: '💬 Activity', value: activity.join(' · '), inline: false });
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

export async function createInterfaceEmbed(client, guildId, userId = null) {
	if (!guildId) {
		throw new Error('Guild ID is required to create interface embed');
	}

	const embedConfig = await getEmbedConfig(guildId);
	const langUserId = userId || '0';
	const title = await translate('interface.panel.title', guildId, langUserId, { botName: embedConfig.NICKNAME });
	const description = await translate('interface.panel.description', guildId, langUserId);

	const interfaceEmbed = {
		color: embedConfig.COLOR,
		title,
		description,
		thumbnail: {
			url: client.user.displayAvatarURL()
		},
		footer: {
			text: embedConfig.FOOTER
		},
		timestamp: new Date().toISOString()
	};

	return interfaceEmbed;
}

export async function createInterfaceButtons(guildId: string | null = null, userId: string | null = null) {
	const menuLabel = await translate('menu.button', guildId || '', userId || '0');
	const menuButton = new ButtonBuilder().setCustomId('bot_menu').setLabel(menuLabel).setStyle(ButtonStyle.Primary);

	return [new ActionRowBuilder().addComponents(menuButton)];
}

export async function sendInterfaceToChannel(targetChannel, interaction, client) {
	try {
		const interfaceEmbed = await createInterfaceEmbed(client, interaction.guild.id, interaction.user.id);
		const buttonRow = await createInterfaceButtons(interaction.guild.id, interaction.user.id);

		await targetChannel.send({
			embeds: [interfaceEmbed],
			components: Array.isArray(buttonRow) ? buttonRow : [buttonRow]
		});

		await logger.log(`🎮 Bot interface sent to ${targetChannel.name} by ${interaction.user.tag} (${interaction.user.id})`);
	} catch (error) {
		const errorMsg = await translate('interface.panel.error', interaction.guild.id, interaction.user.id, {
			error: error.message
		});

		await interaction.reply({
			content: errorMsg,
			flags: 64
		});
		await logger.log(`❌ Interface send failed: ${error.message}`);
	}
}

async function createMenuRow(guildId = null, userId = null) {
	const menuLabel = await translate('menu.button', guildId, userId);
	const menuButton = new ButtonBuilder().setCustomId('bot_menu').setLabel(menuLabel).setStyle(ButtonStyle.Secondary);

	return new ActionRowBuilder().addComponents(menuButton);
}

function init(client) {
	client.on('interactionCreate', async (interaction) => {
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
				} else if (customId === 'settings_language_select') {
					await handleLanguageSelect(interaction);
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
