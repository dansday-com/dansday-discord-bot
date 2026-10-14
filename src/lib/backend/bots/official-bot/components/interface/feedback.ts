import { ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { getEmbedConfig, FEEDBACK, getBotConfig } from '../../../../config.js';
import { logger, attempt } from '../../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { memberTranslator, translate, serverTranslator, errorReason, type Translator } from '../../i18n.js';
import { textField, checkboxField, checkboxValue, imageUploadField, uploadedFiles } from './formFields.js';
import db from '../../../../../database.js';
import type { Guild, GuildTextBasedChannel, MessageComponentInteraction, ModalSubmitInteraction, User } from 'discord.js';
import { SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS, truncateToLimit } from '../../../../../discordLimits.js';

const FEEDBACK_MAX_LENGTH = 2000;
const MAX_SCREENSHOTS = 3;

export async function handleFeedbackButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'feedback'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'feedback', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		const modalTitle = await translate('feedback.modal.title', { guildId: interaction.guild.id, userId: interaction.user.id });
		const modal = new ModalBuilder().setCustomId('feedback_submit').setTitle(modalTitle);

		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
		const feedbackInput = new TextInputBuilder()
			.setCustomId('feedback_message')
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder(tr('feedback.modal.placeholder'))
			.setRequired(true)
			.setMaxLength(FEEDBACK_MAX_LENGTH);

		modal.addLabelComponents(
			textField(tr('feedback.modal.label'), feedbackInput),
			imageUploadField(tr('feedback.modal.screenshotsLabel'), 'feedback_screenshots', MAX_SCREENSHOTS),
			checkboxField(tr('feedback.modal.anonymousLabel'), 'anonymous', false)
		);

		await interaction.showModal(modal);
		await logger.log(`💬 Feedback modal shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing feedback modal: ${(error as Error).message}`);
		const errorMsg = await translate(
			'feedback.errors.failed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{
				error: await errorReason(error, interaction.guild.id, interaction.user.id)
			}
		);
		await interaction.reply({
			content: errorMsg,
			flags: MessageFlags.Ephemeral
		});
	}
}

type Submission = { feedbackId: number; message: string; isAnonymous: boolean; user: User };

async function findFeedbackChannel(guild: Guild): Promise<{ value: GuildTextBasedChannel } | { errorKey: string }> {
	const channelIdResult = await attempt(() => FEEDBACK.getChannel(guild.id));
	if (!channelIdResult.ok) {
		await logger.log(`❌ Error getting feedback channel: ${(channelIdResult.error as Error).message}`);
		return { errorKey: 'feedback.errors.channelError' };
	}
	const channelId = channelIdResult.value;
	if (!channelId) {
		await logger.log(`❌ Feedback channel not configured for server ${guild.id}`);
		return { errorKey: 'feedback.errors.channelNotConfigured' };
	}
	const channel = guild.channels.cache.get(channelId) as GuildTextBasedChannel | undefined;
	if (!channel) {
		await logger.log(`❌ Feedback channel not found: ${channelId}`);
		return { errorKey: 'feedback.errors.channelNotFound' };
	}
	return { value: channel };
}

function feedbackEmbed(tr: Translator, embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>, submission: Submission) {
	const { message, isAnonymous, user } = submission;
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('feedback.channelEmbed.title'))
		.setDescription(truncateToLimit(message, DISCORD_LIMITS.EMBED_DESCRIPTION))
		.setThumbnail(isAnonymous ? null : user.displayAvatarURL({ size: 256 }))
		.addFields([
			{ name: tr('feedback.channelEmbed.fieldFrom'), value: isAnonymous ? tr('feedback.channelEmbed.anonymous') : `<@${user.id}>`, inline: true },
			{ name: tr('feedback.channelEmbed.fieldSubmitted'), value: `<t:${Math.floor(Date.now() / SECOND_MS)}:R>`, inline: true }
		])
		.setTimestamp()
		.setFooter({ text: `${embedConfig.FOOTER} ${tr('feedback.channelEmbed.footerSuffix', { feedbackId: submission.feedbackId })}` });
}

async function feedbackStaffMention(guildId: string) {
	try {
		const feedbackRoleId = await FEEDBACK.getRole(guildId);
		return feedbackRoleId ? `<@&${feedbackRoleId}>` : '';
	} catch (err) {
		await logger.log(`⚠️  Error getting feedback role: ${(err as Error).message}`);
		return '';
	}
}

async function postFeedback(channel: GuildTextBasedChannel, { embed, screenshots }: { embed: EmbedBuilder; screenshots: ReturnType<typeof uploadedFiles> }) {
	const staffMentions = await feedbackStaffMention(channel.guild.id);
	const feedbackPost = { content: staffMentions || undefined, embeds: [embed] };
	await channel.send({ ...feedbackPost, files: screenshots }).catch(async (err: Record<string, unknown>) => {
		if (screenshots.length === 0) {
			throw err;
		}
		await logger.log(`⚠️  Feedback screenshots could not be attached: ${err.message}`);
		await channel.send(feedbackPost);
	});
}

export async function handleFeedbackModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member, guild, user } = interaction;

		if (!(await hasPermission(member, 'feedback'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'feedback', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const mtr = await memberTranslator(guild.id, user.id);
		const message = interaction.fields.getTextInputValue('feedback_message').trim();
		if (!message) {
			await interaction.editReply({ content: mtr('feedback.errors.invalid') });
			return;
		}

		const isAnonymous = checkboxValue(interaction.fields, 'anonymous', false);
		const screenshots = uploadedFiles(interaction.fields, 'feedback_screenshots');
		const channel = await findFeedbackChannel(guild);
		if ('errorKey' in channel) {
			await interaction.editReply({ content: mtr(channel.errorKey) });
			return;
		}

		const server = await db.getServerByDiscordId(getBotConfig()!.id, guild.id);
		const dbMember = await db.upsertMember(server.id, member);
		const feedbackId = await db.createFeedback(server.id, { memberId: dbMember.id, description: message, isAnonymous });

		const embedConfig = await getEmbedConfig(guild.id);
		const embed = feedbackEmbed(await serverTranslator(guild.id), embedConfig, { feedbackId, message, isAnonymous, user });
		await postFeedback(channel.value, { embed, screenshots });

		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(mtr('feedback.submitted.title'))
			.setDescription(mtr('feedback.submitted.description') + (isAnonymous ? mtr('feedback.submitted.anonymous') : ''))
			.setTimestamp()
			.setFooter({ text: `${embedConfig.FOOTER} ${mtr('feedback.channelEmbed.footerSuffix', { feedbackId })}` });
		await interaction.editReply({ embeds: [successEmbed] });

		await logger.log(`✅ Feedback submitted by ${user.tag} (${user.id})`);
	} catch (error) {
		await logger.log(`❌ Error processing feedback: ${(error as Error).message}`);
		await logger.log(`❌ Stack: ${(error as Error).stack}`);
		const errorMsg = await translate(
			'feedback.errors.submitFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{
				error: await errorReason(error, interaction.guild.id, interaction.user.id)
			}
		);
		await interaction.editReply({
			content: errorMsg
		});
	}
}
