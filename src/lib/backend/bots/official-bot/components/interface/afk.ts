import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getEmbedConfig, getBotConfig, AFK_CONFIG } from '../../../../config.js';
import { logger } from '../../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import db from '../../../../../database.js';
import { memberTranslator, translate, translateServer, errorReason, type Translator } from '../../i18n.js';
import { textField, checkboxField, checkboxValue } from './formFields.js';
import { menuBackButton } from './menuBack.js';
import type {
	ButtonInteraction,
	Client,
	GuildMember,
	GuildTextBasedChannel,
	VoiceState,
	Message,
	ModalSubmitInteraction,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction
} from 'discord.js';
import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE, SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';

const DEFAULT_AFK_MESSAGE = 'Away';
const AFK_MESSAGE_MAX_LENGTH = 100;
const MENTION_PREVIEW_LENGTH = 200;
const AFK_NOTICE_TTL_SECONDS = 10;
const WELCOME_BACK_TTL_SECONDS = 5;

async function afkMessageLabel(message: string, guildId: string, userId: string) {
	return message === DEFAULT_AFK_MESSAGE ? await translate('afk.messages.away', { guildId, userId }) : message;
}

function stripAfkPrefix(name: string) {
	if (!name || typeof name !== 'string') {
		return '';
	}
	return name.replace(/^\s*(\[AFK\]\s*)+/gi, '').trim();
}

async function getAFKStatus(userId: string, guildId: string) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			return null;
		}

		const serverData = await db.getServerByDiscordId(botConfig.id, guildId);
		if (!serverData) {
			return null;
		}

		return await db.getAFKStatus(serverData.id, userId);
	} catch (error) {
		return null;
	}
}

async function setAFK(member: GuildMember, message: string, shouldDeafen = true) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			return;
		}

		const serverData = await db.getServerByDiscordId(botConfig.id, member.guild.id);
		if (!serverData) {
			return;
		}

		const userId = member.id;
		await db.upsertMember(serverData.id, member);
		const memberData = await db.getMemberByDiscordId(serverData.id, userId);
		const existingName =
			member.nickname ||
			memberData?.server_display_name ||
			memberData?.display_name ||
			member.user.globalName ||
			member.user.displayName ||
			member.user.username;
		const baseName = stripAfkPrefix(existingName) || member.user.globalName || member.user.displayName || member.user.username;
		const nameToUse = baseName || member.user.username;

		if (member.voice.channel) {
			try {
				await member.voice.setMute(true);
				await logger.log(`🔇 Muted ${member.id} in voice channel (AFK)`);
			} catch (err) {
				await logger.log(`⚠️ Could not mute ${member.id} in voice channel: ${(err as Error).message}`);
			}

			if (shouldDeafen) {
				try {
					await member.voice.setDeaf(true);
					await logger.log(`🔇 Deafened ${member.id} in voice channel (AFK)`);
				} catch (err) {
					await logger.log(`⚠️ Could not deafen ${member.id} in voice channel: ${(err as Error).message}`);
				}
			}
		}

		await db.setAFKStatus(serverData.id, userId, {
			message: message || DEFAULT_AFK_MESSAGE
		});

		try {
			const newNickname = `[AFK] ${nameToUse}`;
			if (newNickname.length <= DISCORD_LIMITS.NICKNAME) {
				await member.setNickname(newNickname);
			}
			await db.upsertMember(serverData.id, member);
		} catch (err) {
			await logger.log(`⚠️ Could not update nickname for ${member.id}: ${(err as Error).message}`);
		}
	} catch (error) {
		await logger.log(`❌ Error setting AFK: ${(error as Error).message}`);
	}
}

async function removeAFK(member: GuildMember, reason = '') {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			return false;
		}

		const serverData = await db.getServerByDiscordId(botConfig.id, member.guild.id);
		if (!serverData) {
			return false;
		}

		const userId = member.id;
		const afkData = await db.getAFKStatus(serverData.id, userId);

		if (!afkData) {
			return false;
		}

		if (member.voice.channel) {
			try {
				await member.voice.setMute(false);
				await logger.log(`🔊 Unmuted ${member.id} in voice channel (AFK removed)`);
			} catch (err) {
				await logger.log(`⚠️ Could not unmute ${member.id} in voice channel: ${(err as Error).message}`);
			}

			try {
				await member.voice.setDeaf(false);
				await logger.log(`🔊 Undeafened ${member.id} in voice channel (AFK removed)`);
			} catch (err) {
				await logger.log(`⚠️ Could not undeafen ${member.id} in voice channel: ${(err as Error).message}`);
			}
		}

		try {
			const memberData = await db.getMemberByDiscordId(serverData.id, userId);
			const storedName =
				memberData?.server_display_name || memberData?.display_name || member.user.globalName || member.user.displayName || member.user.username;
			const restoredName = stripAfkPrefix(storedName);

			if (restoredName && restoredName.length <= DISCORD_LIMITS.NICKNAME) {
				await member.setNickname(restoredName);
			} else {
				await member.setNickname(null);
			}
			await db.upsertMember(serverData.id, member);
		} catch (err) {
			try {
				await member.setNickname(null);
				await db.upsertMember(serverData.id, member);
			} catch (err2) {
				await logger.log(`⚠️ Could not restore nickname for ${member.id}: ${(err2 as Error).message}`);
			}
		}

		await db.removeAFKStatus(serverData.id, userId);

		const durationText = afkDurationText(afkData.timestamp);

		await logger.log(`✅ Removed AFK status for ${member.id} - Was AFK for ${durationText}${reason ? ` - ${reason}` : ''}`);

		return true;
	} catch (error) {
		await logger.log(`❌ Error removing AFK: ${(error as Error).message}`);
		return false;
	}
}

async function currentAfkPanel(interaction: MessageComponentInteraction<'cached'>, afkData: AfkStatus) {
	const scope = { guildId: interaction.guild.id, userId: interaction.user.id };
	const removeButton = new ButtonBuilder()
		.setCustomId('afk_remove')
		.setLabel(await translate('afk.buttons.remove', scope))
		.setStyle(ButtonStyle.Primary);
	const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		removeButton,
		await menuBackButton(scope.guildId, scope.userId, 'me')
	);
	const embedConfig = await getEmbedConfig(scope.guildId);
	const description = await translate('afk.current.description', scope, {
		message: await afkMessageLabel(afkData.message, scope.guildId, scope.userId),
		duration: afkDurationText(afkData.timestamp)
	});
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('afk.current.title', scope))
		.setDescription(description)
		.addFields({ name: await translate('afk.current.howToRemove', scope), value: await translate('afk.current.howToRemoveValue', scope), inline: false })
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
	return { embeds: [embed], components: [buttonRow] };
}

function afkModal(tr: Translator) {
	const messageInput = new TextInputBuilder()
		.setCustomId('afk_message')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(tr('afk.modal.messagePlaceholder'))
		.setRequired(false)
		.setMaxLength(AFK_MESSAGE_MAX_LENGTH);
	return new ModalBuilder()
		.setCustomId('afk_set')
		.setTitle(tr('afk.title'))
		.addLabelComponents(textField(tr('afk.modal.messageLabel'), messageInput), checkboxField(tr('afk.modal.deafenLabel'), 'afk_deafen', true));
}

export async function handleAFKButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'afk'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'afk', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		if (!(await AFK_CONFIG.isEnabled(interaction.guild.id))) {
			const errorMsg = await translate('afk.errors.disabledOnServer', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const afkData = await getAFKStatus(member.id, member.guild.id);
		if (afkData) {
			await interaction.update(await currentAfkPanel(interaction, afkData));
			await logger.log(`⏸️ AFK status shown to ${member.id}`);
			return;
		}

		const modal = afkModal(await memberTranslator(interaction.guild.id, interaction.user.id));
		await interaction.showModal(modal);
		await logger.log(`⏸️ AFK modal shown to ${member.id}`);
	} catch (error) {
		await logger.log(`❌ Error showing AFK modal: ${(error as Error).message}`);
		const errorMsg = await translate(
			'afk.errors.failed',
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

export async function handleAFKModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const { member } = interaction;

		if (!(await hasPermission(member, 'afk'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'afk', interaction.user.id);
			await interaction
				.editReply({
					content: errorMessage
				})
				.catch(() => null);
			return;
		}

		if (!(await AFK_CONFIG.isEnabled(interaction.guild.id))) {
			const errorMsg = await translate('afk.errors.disabledOnServer', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.editReply({ content: errorMsg }).catch(() => null);
			return;
		}

		const afkMessage = interaction.fields.getTextInputValue('afk_message')?.trim() || DEFAULT_AFK_MESSAGE;

		const shouldDeafen = checkboxValue(interaction.fields, 'afk_deafen', true);

		await setAFK(member, afkMessage, shouldDeafen);

		let voiceInfo = '';
		if (member.voice.channel) {
			if (shouldDeafen) {
				voiceInfo = await translate('afk.set.voiceMutedDeafened', { guildId: interaction.guild.id, userId: interaction.user.id });
			} else {
				voiceInfo = await translate('afk.set.voiceMutedOnly', { guildId: interaction.guild.id, userId: interaction.user.id });
			}
		}

		const embedConfig = await getEmbedConfig(interaction.guild.id);
		const setTitle = await translate('afk.set.title', { guildId: interaction.guild.id, userId: interaction.user.id });
		const setDescription = await translate(
			'afk.set.description',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{
				message: await afkMessageLabel(afkMessage, interaction.guild.id, interaction.user.id),
				voiceInfo
			}
		);
		const howToRemoveName = await translate('afk.set.howToRemove', { guildId: interaction.guild.id, userId: interaction.user.id });
		const howToRemoveValue = await translate('afk.set.howToRemoveValue', { guildId: interaction.guild.id, userId: interaction.user.id });
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(setTitle)
			.setDescription(setDescription)
			.addFields({
				name: howToRemoveName,
				value: howToRemoveValue,
				inline: false
			})
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		await interaction.editReply({
			embeds: [embed]
		});

		await logger.log(`✅ AFK status set for ${member.id}: "${afkMessage}"${shouldDeafen ? ' (will be deafened)' : ' (not deafened)'}`);
	} catch (error) {
		await logger.log(`❌ Error setting AFK: ${(error as Error).message}`);
		const errorMsg = await translate(
			'afk.errors.setFailed',
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

export async function handleRemoveAFKButton(interaction: ButtonInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'afk'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'afk', interaction.user.id);
			await interaction
				.update({
					content: errorMessage,
					components: [],
					embeds: []
				})
				.catch(() =>
					interaction
						.reply({
							content: errorMessage,
							flags: MessageFlags.Ephemeral
						})
						.catch(() => null)
				);
			return;
		}

		const wasAFK = await removeAFK(member, 'Manually removed');

		if (!wasAFK) {
			const errorMsg = await translate('afk.errors.notAFK', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.reply({
				content: errorMsg,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const embedConfig = await getEmbedConfig(interaction.guild.id);
		const removedTitle = await translate('afk.removed.title', { guildId: interaction.guild.id, userId: interaction.user.id });
		const removedDescription = await translate('afk.removed.description', { guildId: interaction.guild.id, userId: interaction.user.id });
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(removedTitle)
			.setDescription(removedDescription)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		const payload = {
			embeds: [embed],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(await menuBackButton(interaction.guild.id, interaction.user.id, 'me'))
			]
		};
		await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));

		await logger.log(`✅ AFK manually removed by ${member.id}`);
	} catch (error) {
		await logger.log(`❌ Error removing AFK: ${(error as Error).message}`);
		const errorMsg = await translate(
			'afk.errors.removeFailed',
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

type AfkStatus = NonNullable<Awaited<ReturnType<typeof getAFKStatus>>>;
type AfkMention = { message: Message; senderDisplayName: string };

function afkDurationText(since: number): string {
	const duration = Math.floor((Date.now() - since) / SECOND_MS);
	const minutes = Math.floor(duration / SECONDS_PER_MINUTE);
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	if (hours > 0) {
		return `${hours}h ${minutes % MINUTES_PER_HOUR}m`;
	}
	if (minutes > 0) {
		return `${minutes}m`;
	}
	return `${duration}s`;
}

async function dmMentionedAfkMember(mentionedMember: GuildMember, { message, senderDisplayName }: AfkMention) {
	try {
		const scope = { guildId: mentionedMember.guild.id, userId: mentionedMember.id };
		const dmTitle = await translate('afk.messages.dmEmbedTitle', scope, {});
		const dmMessageText = await translate('afk.messages.dmMentioned', scope, {
			sender: senderDisplayName,
			server: mentionedMember.guild.name,
			channel: (message.channel as GuildTextBasedChannel).name,
			message: message.content.substring(0, MENTION_PREVIEW_LENGTH) + (message.content.length > MENTION_PREVIEW_LENGTH ? '...' : '')
		});
		const embedConfig = await getEmbedConfig(mentionedMember.guild.id);
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(dmTitle)
			.setDescription(dmMessageText)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });
		await mentionedMember.send({ embeds: [embed] });
	} catch (dmErr) {
		await logger.log(`⚠️ Could not DM ${mentionedMember.id} about mention: ${(dmErr as Error).message}`);
	}
}

async function noticeAfkMention(mentionedMember: GuildMember, afk: AfkStatus, mention: AfkMention) {
	try {
		const guildId = mentionedMember.guild.id;
		const durationText = afkDurationText(afk.timestamp);
		const afkMessage =
			afk.message && afk.message !== DEFAULT_AFK_MESSAGE
				? await translateServer('afk.messages.isAfkWithMessage', guildId, { member: mentionedMember.toString(), message: afk.message, duration: durationText })
				: await translateServer('afk.messages.isAfk', guildId, { member: mentionedMember.toString(), duration: durationText });

		const afkNotice = await mention.message.reply(afkMessage);
		setTimeout(() => afkNotice.delete().catch(() => {}), AFK_NOTICE_TTL_SECONDS * SECOND_MS);

		await dmMentionedAfkMember(mentionedMember, mention);
	} catch (err) {
		await logger.log(`⚠️ Could not send AFK notice for ${mentionedMember.id}: ${(err as Error).message}`);
	}
}

export function init(client: Client) {
	client.on('messageCreate', async (message: Message) => {
		if (message.author.bot || !message.guild) {
			return;
		}

		try {
			if (!(await AFK_CONFIG.isEnabled(message.guild.id))) {
				return;
			}

			const { member } = message;
			if (!member) {
				return;
			}

			const botConfig = getBotConfig();
			if (!botConfig?.id) {
				return;
			}

			const serverData = await db.getServerByDiscordId(botConfig.id, message.guild.id);
			if (!serverData) {
				return;
			}

			const senderData = await db.getMemberByDiscordId(serverData.id, member.id);
			if (!senderData) {
				await logger.log(`⚠️ Unable to notify mention for ${member.id}: sender not found in database`);
				return;
			}

			const senderDisplayName = senderData.server_display_name || senderData.display_name;
			if (!senderDisplayName) {
				await logger.log(`⚠️ Sender display name missing in database for ${member.id}, skipping AFK DM`);
				return;
			}

			const afkData = await getAFKStatus(member.id, member.guild.id);
			if (afkData) {
				await removeAFK(member, 'Sent a message');

				try {
					const welcomeMsgText = await translateServer('afk.messages.welcomeBack', member.guild.id, { member: member.toString() });
					const welcomeMsg = await (message.channel as GuildTextBasedChannel).send(welcomeMsgText);
					setTimeout(() => welcomeMsg.delete().catch(() => {}), WELCOME_BACK_TTL_SECONDS * SECOND_MS);
				} catch (err) {}
			}

			for (const [mentionedId, mentionedMember] of message.mentions.members ?? []) {
				if (mentionedId === member.id) {
					continue;
				}
				const mentionedAFKData = await getAFKStatus(mentionedId, member.guild.id);
				if (mentionedAFKData) {
					await noticeAfkMention(mentionedMember, mentionedAFKData, { message, senderDisplayName });
				}
			}
		} catch (err) {
			await logger.log(`❌ Error checking AFK in messageCreate: ${(err as Error).message}`);
		}
	});

	client.on('voiceStateUpdate', async (oldState: VoiceState, newState) => {
		if (!newState.guild || newState.member?.user.bot) {
			return;
		}

		try {
			if (!(await AFK_CONFIG.isEnabled(newState.guild.id))) {
				return;
			}

			const wasSelfMuted = oldState.mute && !oldState.serverMute;
			const isSelfUnmuted = !newState.mute && !newState.serverMute;

			const wasSelfDeafened = oldState.deaf && !oldState.serverDeaf;
			const isSelfUndeafened = !newState.deaf && !newState.serverDeaf;

			if ((wasSelfMuted && isSelfUnmuted) || (wasSelfDeafened && isSelfUndeafened)) {
				const afkData = await getAFKStatus(newState.member!.id, newState.guild.id);
				if (afkData) {
					await removeAFK(newState.member!, 'Self-unmuted/undeafened in voice channel');
				}
			}
		} catch (err) {
			await logger.log(`❌ Error checking AFK in voiceStateUpdate: ${(err as Error).message}`);
		}
	});
}

export default { init };
