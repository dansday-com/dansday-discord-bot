import { ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ModalActionRowComponentBuilder } from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import db from '../../../../database.js';
import { fetchQuestsMe, getEmbedConfig, getServerForCurrentBot, precheckQuestPayloadForEnrollment, serverSettingsComponent } from '../../../config.js';
import { translate } from '../i18n.js';
import { hasPermission, getPermissionDeniedMessage } from './permissions.js';
import { queueQuestEnrollJob, isUserEnrollRunning } from './questEnrollWorker.js';

export const QUEST_ENROLL_BUTTON_PREFIX = 'quest_enroll:';
export const LEGACY_ENROLL_BUTTON_PREFIX = '\u006f\u0072\u0062_enroll:';

export const QUEST_ENROLL_MODAL_PREFIX = 'quest_enroll_submit:';
export const LEGACY_ENROLL_MODAL_PREFIX = '\u006f\u0072\u0062_enroll_submit:';

const TOKEN_FIELD_ID = 'quest_enroll_token';
const LEGACY_TOKEN_FIELD_ID = '\u006f\u0072\u0062_enroll_token';

export function isQuestEnrollButtonId(customId: string): boolean {
	return customId.startsWith(QUEST_ENROLL_BUTTON_PREFIX) || customId.startsWith(LEGACY_ENROLL_BUTTON_PREFIX);
}

export function isQuestEnrollModalId(customId: string): boolean {
	return customId.startsWith(QUEST_ENROLL_MODAL_PREFIX) || customId.startsWith(LEGACY_ENROLL_MODAL_PREFIX);
}

function questIdFromButtonCustomId(customId: string): string | null {
	if (customId.startsWith(QUEST_ENROLL_BUTTON_PREFIX)) {
		const id = customId.slice(QUEST_ENROLL_BUTTON_PREFIX.length).trim();
		return id || null;
	}
	if (customId.startsWith(LEGACY_ENROLL_BUTTON_PREFIX)) {
		const id = customId.slice(LEGACY_ENROLL_BUTTON_PREFIX.length).trim();
		return id || null;
	}
	return null;
}

function questIdFromModalCustomId(customId: string): string {
	if (customId.startsWith(QUEST_ENROLL_MODAL_PREFIX)) return customId.slice(QUEST_ENROLL_MODAL_PREFIX.length).trim();
	if (customId.startsWith(LEGACY_ENROLL_MODAL_PREFIX)) return customId.slice(LEGACY_ENROLL_MODAL_PREFIX.length).trim();
	return '';
}

function tokenFromModal(interaction: ModalSubmitInteraction): string {
	return interaction.fields.getTextInputValue(TOKEN_FIELD_ID)?.trim() || interaction.fields.getTextInputValue(LEGACY_TOKEN_FIELD_ID)?.trim() || '';
}

export async function handleQuestEnrollButton(interaction: ButtonInteraction): Promise<void> {
	const questId = questIdFromButtonCustomId(interaction.customId);
	if (!questId) {
		await interaction.reply({ content: 'Invalid quest id.', flags: 64 }).catch(() => null);
		return;
	}

	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(interaction.guild!.id);
	const row = await db.getServerSettings(server.id, serverSettingsComponent.discord_quest_notifier).catch(() => null);
	const rawSettings = row && !Array.isArray(row) ? row.settings : null;
	const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
	const autoQuestEnabled = s.auto_quest !== false;

	if (!autoQuestEnabled) {
		await interaction.reply({ content: 'Auto quest enrollment is currently disabled. Please contact a server administrator.', flags: 64 }).catch(() => null);
		return;
	}

	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	if (dbMember) {
		const alreadyClaimed = await db.hasServerMemberClaimedDiscordQuest(server.id, dbMember.id, questId).catch(() => false);
		if (alreadyClaimed) {
			const embedConfig = await getEmbedConfig(interaction.guild!.id);
			const botDiscordQuest = await db.getBotDiscordQuestByQuestId(questId).catch(() => null);
			const questName = botDiscordQuest?.quest_name || questId;
			const embed = new EmbedBuilder()
				.setColor(embedConfig.COLOR)
				.setTitle(`🔮 ${await translate('questEnroll.alreadyClaimed', interaction.guild!.id, interaction.user.id)}`)
				.setDescription(await translate('questEnroll.alreadyClaimedDescription', interaction.guild!.id, interaction.user.id, { questName }))
				.setFooter({ text: embedConfig.FOOTER })
				.setTimestamp();
			await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => null);
			return;
		}
	}

	const modal = new ModalBuilder().setCustomId(`${QUEST_ENROLL_MODAL_PREFIX}${questId}`.slice(0, 100)).setTitle('Enroll (token — high risk)');

	const tokenInput = new TextInputBuilder()
		.setCustomId(TOKEN_FIELD_ID)
		.setLabel('Discord user token (not saved)')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('ToS risk: your account may be banned; bot/server possible. Paste once; never in public.')
		.setRequired(true)
		.setMinLength(20)
		.setMaxLength(4000);

	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(tokenInput));
	await interaction.showModal(modal);
}

export async function handleQuestEnrollModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const questId = questIdFromModalCustomId(interaction.customId);
	const token = tokenFromModal(interaction);

	if (!questId || token.length < 20) {
		await interaction.reply({ content: 'Missing quest id or token too short.', flags: 64 }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(interaction.guild!.id);
	const row = await db.getServerSettings(server.id, serverSettingsComponent.discord_quest_notifier).catch(() => null);
	const rawSettings = row && !Array.isArray(row) ? row.settings : null;
	const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
	const autoQuestEnabled = s.auto_quest !== false;

	if (!autoQuestEnabled) {
		await interaction.reply({ content: 'Auto quest enrollment is currently disabled. Please contact a server administrator.', flags: 64 }).catch(() => null);
		return;
	}

	if (!interaction.channelId) {
		await interaction.reply({ content: 'Unable to determine the channel. Please try again.', flags: 64 }).catch(() => null);
		return;
	}

	if (isUserEnrollRunning(interaction.user.id)) {
		await interaction
			.reply({ content: 'You already have an auto quest running. Please wait for it to finish before starting another.', flags: 64 })
			.catch(() => null);
		return;
	}

	await interaction.deferReply({ flags: 64 });

	const httpProxyUrlEarly = typeof s.http_proxy_url === 'string' && s.http_proxy_url.trim() ? s.http_proxy_url.trim() : null;
	let questsPayload: unknown;
	try {
		questsPayload = await fetchQuestsMe(token, { httpProxyUrl: httpProxyUrlEarly });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const embedConfig = await getEmbedConfig(interaction.guild!.id);
		const invalidEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle('Invalid token')
			.setDescription(`The token you provided appears to be invalid or expired.\n\`${msg.slice(0, 500)}\``)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [invalidEmbed] }).catch(() => null);
		return;
	}

	const pre = precheckQuestPayloadForEnrollment(questsPayload, questId);
	if (!pre.ok) {
		const embedConfig = await getEmbedConfig(interaction.guild!.id);
		const keyBase =
			pre.code === 'not_found'
				? 'precheckNotFound'
				: pre.code === 'expired'
					? 'precheckExpired'
					: pre.code === 'reward_claimed'
						? 'precheckRewardClaimed'
						: 'precheckCompleted';
		const title = await translate(`questEnroll.${keyBase}Title`, interaction.guild!.id, interaction.user.id);
		const description = await translate(`questEnroll.${keyBase}Description`, interaction.guild!.id, interaction.user.id);
		const blockEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(title)
			.setDescription(description)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [blockEmbed] }).catch(() => null);
		return;
	}
	const embedConfig = await getEmbedConfig(interaction.guild!.id);
	const pendingEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('questEnroll.pendingTitle', interaction.guild!.id, interaction.user.id))
		.setDescription(await translate('questEnroll.pendingDescription', interaction.guild!.id, interaction.user.id))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	await interaction.editReply({ embeds: [pendingEmbed] });

	const member = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);

	queueQuestEnrollJob({
		client: interaction.client,
		channelId: interaction.channelId,
		guildId: interaction.guild!.id,
		questId,
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		httpProxyUrl: httpProxyUrlEarly,
		serverId: server.id,
		memberId: member?.id ?? 0
	});
}
