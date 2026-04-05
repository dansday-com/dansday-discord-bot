import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ModalActionRowComponentBuilder } from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import db from '../../../../database.js';
import { getServerForCurrentBot, serverSettingsComponent } from '../../../config.js';
import { queueOrbEnrollJob } from './orbEnrollWorker.js';

export const ORB_ENROLL_BUTTON_PREFIX = 'orb_enroll:';
export const ORB_ENROLL_MODAL_PREFIX = 'orb_enroll_submit:';
const TOKEN_FIELD_ID = 'orb_enroll_token';

export async function handleOrbEnrollButton(interaction: ButtonInteraction): Promise<void> {
	const questId = interaction.customId.slice(ORB_ENROLL_BUTTON_PREFIX.length).trim();
	if (!questId) {
		await interaction.reply({ content: 'Invalid quest id.', flags: 64 }).catch(() => null);
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

	const modal = new ModalBuilder().setCustomId(`${ORB_ENROLL_MODAL_PREFIX}${questId}`.slice(0, 100)).setTitle('Enroll (token — high risk)');

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

export async function handleOrbEnrollModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const questId = interaction.customId.slice(ORB_ENROLL_MODAL_PREFIX.length).trim();
	const token = interaction.fields.getTextInputValue(TOKEN_FIELD_ID)?.trim() ?? '';

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

	await interaction.deferReply({ flags: 64 });
	await interaction.editReply({
		content:
			'⏳ **Running in the background.** A result embed will be posted in this channel shortly.\n\nYour token is **not** saved in our database. **Risk:** Discord may restrict or ban the **user account** tied to that token; in some cases the **bot or server** could also be affected. This is not official Discord behaviour — you chose to proceed.'
	});

	const httpProxyUrl = typeof s.http_proxy_url === 'string' && s.http_proxy_url.trim() ? s.http_proxy_url.trim() : null;

	queueOrbEnrollJob({
		client: interaction.client,
		channelId: interaction.channelId,
		guildId: interaction.guild!.id,
		questId,
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		httpProxyUrl
	});
}
