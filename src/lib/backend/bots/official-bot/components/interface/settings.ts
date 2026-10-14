import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getEmbedConfig, getBotConfig } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import db from '../../../../../database.js';
import { logger } from '../../../../../utils/index.js';
import { translate, getAvailableLanguages, getUserLanguage, getServerLanguage, errorReason } from '../../i18n.js';
import { isServerLanguage, serverLanguageLabel, type ServerLanguage } from '../../../../../languages.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';
import type { ButtonInteraction, RepliableInteraction, MessageActionRowComponentBuilder, StringSelectMenuInteraction } from 'discord.js';

const SERVER_DEFAULT_VALUE = 'server';

async function buildLanguagePanel(interaction: RepliableInteraction<'cached'>, server: { id: number }) {
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const member = await db.getMemberByDiscordId(server.id, u).catch(() => null);
	const ownLang = isServerLanguage(member?.language) ? member.language : null;
	const serverLang = await getServerLanguage(g);
	const currentLang = await getUserLanguage(g, u);

	const embedConfig = await getEmbedConfig(g);
	const langTitle = await translate('settings.language.title', { guildId: g, userId: u });
	const langDesc = await translate('settings.language.description', { guildId: g, userId: u });
	const currentLangText = await translate('settings.language.current', { guildId: g, userId: u });
	const serverDefaultLabel = await translate('settings.language.serverDefault', { guildId: g, userId: u }, { language: serverLanguageLabel(serverLang) });
	const currentOptionText = await translate('settings.language.currentOption', { guildId: g, userId: u });
	const currentDisplay = ownLang ? serverLanguageLabel(currentLang) : serverDefaultLabel;

	const languageEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(langTitle)
		.setDescription(`${langDesc}\n\n**${currentLangText}:** ${currentDisplay}`)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const options = [
		{
			label: serverDefaultLabel.slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
			value: SERVER_DEFAULT_VALUE,
			description: (await translate('settings.language.serverDefaultDescription', { guildId: g, userId: u })).slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
			default: !ownLang
		},
		...getAvailableLanguages().map((lang) => ({
			label: serverLanguageLabel(lang),
			value: lang,
			description: lang === ownLang ? currentOptionText.slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT) : undefined,
			default: lang === ownLang
		}))
	];

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('settings_language_select')
		.setPlaceholder(await translate('settings.language.select', { guildId: g, userId: u }))
		.addOptions(options);

	const backButton = new ButtonBuilder()
		.setCustomId('bot_menu')
		.setLabel(await translate('menu.back', { guildId: g, userId: u }))
		.setStyle(ButtonStyle.Secondary);

	return {
		embeds: [languageEmbed],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(backButton)
		]
	};
}

export async function handleLanguageButton(interaction: ButtonInteraction<'cached'>) {
	try {
		if (!(await hasPermission(interaction.member, 'settings'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'settings', interaction.user.id);
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

		const server = await getServerForInteraction(interaction);
		if (!server) {
			const errorMsg = await translate('leveling.errors.notRegistered', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction
				.update({
					content: errorMsg,
					components: []
				})
				.catch(() =>
					interaction.reply({
						content: errorMsg,
						flags: MessageFlags.Ephemeral
					})
				);
			return;
		}

		await interaction.update({
			...(await buildLanguagePanel(interaction, server))
		});
	} catch (error) {
		await logger.log(`❌ Language button error: ${(error as Error).message}`);
		await interaction
			.update({
				content: await translate(
					'settings.language.failed',
					{ guildId: interaction.guild.id, userId: interaction.user.id },
					{
						error: await errorReason(error, interaction.guild.id, interaction.user.id)
					}
				),
				components: []
			})
			.catch(() => null);
	}
}

async function replaceWithNotice(interaction: StringSelectMenuInteraction<'cached'>, content: string) {
	await interaction.editReply({ content, components: [], embeds: [] }).catch(() => null);
}

async function languageConfirmation(interaction: StringSelectMenuInteraction<'cached'>, ownLang: ServerLanguage | null) {
	const scope = { guildId: interaction.guild.id, userId: interaction.user.id };
	const successMsg = await translate('settings.language.updated', scope);
	const langName = ownLang
		? serverLanguageLabel(ownLang)
		: await translate('settings.language.serverDefault', scope, { language: serverLanguageLabel(await getServerLanguage(interaction.guild.id)) });
	return `${successMsg}\n**${langName}**`;
}

async function reportLanguageError(interaction: StringSelectMenuInteraction<'cached'>, error: unknown) {
	await logger.log(`❌ Language select error: ${(error as Error).message}`);
	const scope = { guildId: interaction.guild.id, userId: interaction.user.id };
	const errorMsg = await translate('settings.language.failed', scope, { error: await errorReason(error, scope.guildId, scope.userId) });
	if (interaction.deferred || interaction.replied) {
		await replaceWithNotice(interaction, errorMsg);
	} else {
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
	}
}

export async function handleLanguageSelect(interaction: StringSelectMenuInteraction<'cached'>) {
	try {
		await interaction.deferUpdate();
		const scope = { guildId: interaction.guild.id, userId: interaction.user.id };

		if (!(await hasPermission(interaction.member, 'settings'))) {
			await replaceWithNotice(interaction, await getPermissionDeniedMessage(interaction.guild, 'settings', interaction.user.id));
			return;
		}

		const server = await getServerForInteraction(interaction);
		if (!server) {
			await replaceWithNotice(interaction, await translate('leveling.errors.notRegistered', scope));
			return;
		}

		const selectedLang = interaction.values[0];
		if (selectedLang !== SERVER_DEFAULT_VALUE && !isServerLanguage(selectedLang)) {
			await replaceWithNotice(interaction, await translate('settings.language.failed', scope, { error: selectedLang ?? '' }));
			return;
		}

		const ownLang = selectedLang === SERVER_DEFAULT_VALUE ? null : selectedLang;
		await db.setMemberLanguage(server.id, interaction.user.id, ownLang);
		const confirmation = await languageConfirmation(interaction, ownLang);
		await interaction.editReply(await buildLanguagePanel(interaction, server)).catch(() => null);
		await interaction.followUp({ content: confirmation, flags: MessageFlags.Ephemeral }).catch(() => null);
	} catch (error) {
		await reportLanguageError(interaction, error).catch((err) => logger.log(`❌ Failed to send language select error: ${(err as Error).message}`));
	}
}

async function getServerForInteraction(interaction: RepliableInteraction<'cached'>) {
	const botConfig = getBotConfig();
	if (!botConfig || !botConfig.id) {
		return null;
	}
	return await db.getServerByDiscordId(botConfig.id, interaction.guild.id);
}
