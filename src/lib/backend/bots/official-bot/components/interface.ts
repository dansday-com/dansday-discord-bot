import {
	AFK_CONFIG,
	computePublicServerSlugForServerId,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
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
import { handleLevelingButton, handleLeaderboardButton } from './interface/leveling.js';
import {
	handleGiveawayButton,
	handleGiveawayModal,
	handleGiveawayEnterButton,
	handleGiveawayRoleSelect,
	handleGiveawaySkipRolesContinue,
	handleGiveawayFinish
} from './interface/giveaway.js';
import { handleSettingsButton, handleLanguageButton, handleLanguageSelect, handleDMToggleButton } from './interface/settings.js';
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
import { handleNotificationsButton, handleNotificationsSelect } from './interface/notifications.js';
import {
	handleContentCreatorButton,
	handleContentCreatorApplyButton,
	handleContentCreatorDismissRequest,
	handleContentCreatorDismissYes,
	handleContentCreatorDismissNo,
	handleContentCreatorModal,
	handleContentCreatorApprove,
	handleContentCreatorReject,
	handleContentCreatorDecisionModal
} from './interface/contentcreator.js';
import { isQuestEnrollButtonId, isQuestEnrollModalId, handleQuestEnrollButton, handleQuestEnrollModalSubmit } from './questEnroll.js';
import { translate } from '../i18n.js';
import { createHash } from 'crypto';

async function replyIfFeatureDisabled(interaction: any, component: string): Promise<boolean> {
	if (!interaction.guild) return false;
	if (await isComponentFeatureEnabled(interaction.guild.id, component)) return false;
	const msg = await translate('common.errors.featureDisabled', interaction.guild.id, interaction.user.id);
	await interaction.reply({ content: msg, flags: 64 }).catch(() => null);
	return true;
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

	if (!(await hasPermission(member, 'leveling'))) {
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

	if (
		(await hasPermission(member, 'custom_supporter_role')) &&
		(await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.custom_supporter_role))
	) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_custom_supporter_role')
				.setLabel(await translate('customSupporterRole.existing.title', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'leveling')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.leveling))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_leveling')
				.setLabel(await translate('leveling.profile.title', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'giveaway')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.giveaway))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_giveaway')
				.setLabel(await translate('giveaway.create.title', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'afk')) && (await AFK_CONFIG.isEnabled(interaction.guild.id))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_afk')
				.setLabel(await translate('afk.title', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'feedback')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.feedback))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_feedback')
				.setLabel(await translate('feedback.modal.title', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'staff_rating')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.staff_rating))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_staff_rating')
				.setLabel(await translate('staffRating.button', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'content_creator')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.content_creator))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_content_creator')
				.setLabel(await translate('contentCreator.button', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
		);
	}

	if ((await hasPermission(member, 'notifications')) && (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.notifications))) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId('bot_notifications')
				.setLabel(await translate('notifications.button', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Success)
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
	const menuTitle = await translate('menu.title', interaction.guild.id, interaction.user.id);
	const menuDesc = await translate('menu.description', interaction.guild.id, interaction.user.id);

	const menuEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(menuTitle)
		.setDescription(menuDesc)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const rows = [];
	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
	}

	const settingsButton = new ButtonBuilder()
		.setCustomId('bot_settings')
		.setLabel(await translate('settings.title', interaction.guild.id, interaction.user.id))
		.setStyle(ButtonStyle.Secondary);

	if (rows.length === 0) {
		rows.push(new ActionRowBuilder().addComponents(settingsButton));
	} else {
		const lastRow = rows[rows.length - 1];
		if (lastRow.components.length < 5) {
			lastRow.addComponents(settingsButton);
		} else {
			rows.push(new ActionRowBuilder().addComponents(settingsButton));
		}
	}

	if (await isComponentFeatureEnabled(interaction.guild.id, serverSettingsComponent.public_statistics)) {
		try {
			const server = await getServerForCurrentBot(interaction.guild.id);
			const slug = await computePublicServerSlugForServerId(Number(server.id));
			const url = slug ? publicServerUrl(slug) : null;

			let memberUrl: string | null = null;
			if (slug) {
				const joinedDate = member.joinedAt ? member.joinedAt.toISOString().split('T')[0] : '';
				const cardHash = createHash('sha256').update(`${interaction.user.id}_${joinedDate}`).digest('hex').substring(0, 16);
				memberUrl = `${publicServerUrl(slug, 'members')}?card=${cardHash}`;
			}

			if (url) {
				const statisticsLabel = await translate('menu.statistics', interaction.guild.id, interaction.user.id);
				const statisticsBtn = new ButtonBuilder().setLabel(statisticsLabel).setURL(url).setStyle(ButtonStyle.Link);
				const settingsRow = rows[rows.length - 1];
				if (settingsRow.components.length < 5) {
					settingsRow.addComponents(statisticsBtn);
				} else if (rows.length < 5) {
					rows.push(new ActionRowBuilder().addComponents(statisticsBtn));
				}
			}

			if (memberUrl) {
				const memberCardLabel = await translate('menu.memberCard', interaction.guild.id, interaction.user.id);
				const memberCardBtn = new ButtonBuilder().setLabel(memberCardLabel).setURL(memberUrl).setStyle(ButtonStyle.Link);
				const targetRow = rows[rows.length - 1];
				if (targetRow.components.length < 5) {
					targetRow.addComponents(memberCardBtn);
				} else if (rows.length < 5) {
					rows.push(new ActionRowBuilder().addComponents(memberCardBtn));
				}
			}
		} catch (_) {}
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
		case 'bot_leveling':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.leveling)) break;
			await handleLevelingButton(interaction);
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
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.notifications)) break;
			await handleNotificationsButton(interaction);
			break;
		case 'bot_content_creator':
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
		case 'bot_afk':
			await handleAFKButton(interaction);
			break;
		case 'afk_remove':
			await handleRemoveAFKButton(interaction);
			break;
		case 'leaderboard_xp':
		case 'leaderboard_voice_total':
		case 'leaderboard_voice_active':
		case 'leaderboard_voice_afk':
		case 'leaderboard_video':
		case 'leaderboard_streaming':
		case 'leaderboard_chat':
			if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.public_statistics)) break;
			await handleLeaderboardButton(interaction);
			break;
		case 'settings_dm_toggle':
			await handleDMToggleButton(interaction);
			break;
		case 'bot_settings':
			await handleSettingsButton(interaction);
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
			if (customId.startsWith('staff_rating_continue') || customId.startsWith('staff_report_continue')) {
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
			} else if (isQuestEnrollButtonId(customId)) {
				if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) break;
				await handleQuestEnrollButton(interaction);
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
	const title = await translate('interface.panel.title', guildId, langUserId);
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

				if (interaction.customId === 'custom_supporter_role_create') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) return;
					await handleCustomSupporterRoleModal(interaction);
				} else if (interaction.customId === 'custom_supporter_role_edit') {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.custom_supporter_role)) return;
					await handleCustomSupporterRoleEditModal(interaction);
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
				} else if (isQuestEnrollModalId(interaction.customId)) {
					if (await replyIfFeatureDisabled(interaction, serverSettingsComponent.discord_quest_notifier)) return;
					await handleQuestEnrollModalSubmit(interaction);
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
				} else if (customId === 'settings_language_select') {
					await handleLanguageSelect(interaction);
				} else if (customId === 'notifications_select') {
					await handleNotificationsSelect(interaction);
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
