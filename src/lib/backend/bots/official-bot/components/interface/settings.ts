import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getEmbedConfig, getBotConfig } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import db from '../../../../../database.js';
import { logger } from '../../../../../utils/index.js';
import { translate, getAvailableLanguages, getUserLanguage, getServerLanguage, errorReason } from '../../i18n.js';
import { isServerLanguage, serverLanguageLabel } from '../../../../../languages.js';

const SERVER_DEFAULT_VALUE = 'server';

async function buildLanguagePanel(interaction, server) {
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const member = await db.getMemberByDiscordId(server.id, u).catch(() => null);
	const ownLang = isServerLanguage(member?.language) ? member.language : null;
	const serverLang = await getServerLanguage(g);
	const currentLang = await getUserLanguage(g, u);

	const embedConfig = await getEmbedConfig(g);
	const langTitle = await translate('settings.language.title', g, u);
	const langDesc = await translate('settings.language.description', g, u);
	const currentLangText = await translate('settings.language.current', g, u);
	const serverDefaultLabel = await translate('settings.language.serverDefault', g, u, { language: serverLanguageLabel(serverLang) });
	const currentOptionText = await translate('settings.language.currentOption', g, u);
	const currentDisplay = ownLang ? serverLanguageLabel(currentLang) : serverDefaultLabel;

	const languageEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(langTitle)
		.setDescription(`${langDesc}\n\n**${currentLangText}:** ${currentDisplay}`)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const options = [
		{
			label: serverDefaultLabel.slice(0, 100),
			value: SERVER_DEFAULT_VALUE,
			description: (await translate('settings.language.serverDefaultDescription', g, u)).slice(0, 100),
			default: !ownLang
		},
		...getAvailableLanguages().map((lang) => ({
			label: serverLanguageLabel(lang),
			value: lang,
			description: lang === ownLang ? currentOptionText.slice(0, 100) : undefined,
			default: lang === ownLang
		}))
	];

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('settings_language_select')
		.setPlaceholder(await translate('settings.language.select', g, u))
		.addOptions(options);

	const backButton = new ButtonBuilder()
		.setCustomId('bot_menu')
		.setLabel(await translate('menu.back', g, u))
		.setStyle(ButtonStyle.Secondary);

	return {
		embeds: [languageEmbed],
		components: [new ActionRowBuilder().addComponents(selectMenu), new ActionRowBuilder().addComponents(backButton)]
	};
}

export async function handleLanguageButton(interaction) {
	try {
		if (!(await hasPermission(interaction.member, 'settings'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'settings', interaction.user.id);
			await interaction
				.update({
					content: errorMessage,
					components: [],
					embeds: [],
					flags: 64
				})
				.catch(() =>
					interaction
						.reply({
							content: errorMessage,
							flags: 64
						})
						.catch(() => null)
				);
			return;
		}

		const server = await getServerForInteraction(interaction);
		if (!server) {
			const errorMsg = await translate('leveling.errors.notRegistered', interaction.guild.id, interaction.user.id);
			await interaction
				.update({
					content: errorMsg,
					components: [],
					flags: 64
				})
				.catch(() =>
					interaction.reply({
						content: errorMsg,
						flags: 64
					})
				);
			return;
		}

		await interaction.update({
			...(await buildLanguagePanel(interaction, server)),
			flags: 64
		});
	} catch (error) {
		await logger.log(`❌ Language button error: ${error.message}`);
		await interaction
			.update({
				content: await translate('settings.language.failed', interaction.guild.id, interaction.user.id, {
					error: await errorReason(error, interaction.guild.id, interaction.user.id)
				}),
				components: [],
				flags: 64
			})
			.catch(() => null);
	}
}

export async function handleLanguageSelect(interaction) {
	try {
		await interaction.deferUpdate();

		if (!(await hasPermission(interaction.member, 'settings'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'settings', interaction.user.id);
			await interaction
				.editReply({
					content: errorMessage,
					components: [],
					embeds: []
				})
				.catch(() => null);
			return;
		}

		const server = await getServerForInteraction(interaction);
		if (!server) {
			const errorMsg = await translate('leveling.errors.notRegistered', interaction.guild.id, interaction.user.id);
			await interaction
				.editReply({
					content: errorMsg,
					components: [],
					embeds: []
				})
				.catch(() => null);
			return;
		}

		const selectedLang = interaction.values[0];
		if (selectedLang !== SERVER_DEFAULT_VALUE && !isServerLanguage(selectedLang)) {
			await interaction
				.editReply({
					content: await translate('settings.language.failed', interaction.guild.id, interaction.user.id, { error: selectedLang ?? '' }),
					components: [],
					embeds: []
				})
				.catch(() => null);
			return;
		}

		const ownLang = selectedLang === SERVER_DEFAULT_VALUE ? null : selectedLang;
		await db.setMemberLanguage(server.id, interaction.user.id, ownLang);

		const successMsg = await translate('settings.language.updated', interaction.guild.id, interaction.user.id);
		const langName = ownLang
			? serverLanguageLabel(ownLang)
			: await translate('settings.language.serverDefault', interaction.guild.id, interaction.user.id, {
					language: serverLanguageLabel(await getServerLanguage(interaction.guild.id))
				});

		await interaction.editReply(await buildLanguagePanel(interaction, server)).catch(() => null);

		await interaction
			.followUp({
				content: `${successMsg}\n**${langName}**`,
				flags: 64
			})
			.catch(() => null);
	} catch (error) {
		await logger.log(`❌ Language select error: ${error.message}`);
		const errorMsg = await translate('settings.language.failed', interaction.guild.id, interaction.user.id, {
			error: await errorReason(error, interaction.guild.id, interaction.user.id)
		});
		try {
			if (interaction.deferred || interaction.replied) {
				await interaction
					.editReply({
						content: errorMsg,
						components: [],
						embeds: []
					})
					.catch(() => null);
			} else {
				await interaction
					.reply({
						content: errorMsg,
						flags: 64
					})
					.catch(() => null);
			}
		} catch (err) {
			await logger.log(`❌ Failed to send language select error: ${err.message}`);
		}
	}
}

async function getServerForInteraction(interaction) {
	const botConfig = getBotConfig();
	if (!botConfig || !botConfig.id) {
		return null;
	}
	return await db.getServerByDiscordId(botConfig.id, interaction.guild.id);
}
