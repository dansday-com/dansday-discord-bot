import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getEmbedConfig, getBotConfig } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import db from '../../../../../database.js';
import { logger } from '../../../../../utils/index.js';
import { translate, getAvailableLanguages, getUserLanguage } from '../../i18n.js';

const languageNames = {
	en: 'English',
	id: 'Bahasa Indonesia'
};

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

		const currentLang = await getUserLanguage(interaction.guild.id, interaction.user.id);
		const availableLangs = getAvailableLanguages();

		const embedConfig = await getEmbedConfig(interaction.guild.id);
		const langTitle = await translate('settings.language.title', interaction.guild.id, interaction.user.id);
		const langDesc = await translate('settings.language.description', interaction.guild.id, interaction.user.id);
		const currentLangText = await translate('settings.language.current', interaction.guild.id, interaction.user.id);

		const languageEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(langTitle)
			.setDescription(`${langDesc}\n\n**${currentLangText}:** ${languageNames[currentLang] || currentLang}`)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		const options = availableLangs.map((lang) => ({
			label: languageNames[lang] || lang,
			value: lang,
			description: lang === currentLang ? 'Current language' : undefined,
			default: lang === currentLang
		}));

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('settings_language_select')
			.setPlaceholder(await translate('settings.language.select', interaction.guild.id, interaction.user.id))
			.addOptions(options);

		const selectRow = new ActionRowBuilder().addComponents(selectMenu);

		const backButton = new ButtonBuilder()
			.setCustomId('bot_menu')
			.setLabel(await translate('menu.button', interaction.guild.id, interaction.user.id))
			.setStyle(ButtonStyle.Secondary);

		const backRow = new ActionRowBuilder().addComponents(backButton);

		await interaction.update({
			embeds: [languageEmbed],
			components: [selectRow, backRow],
			flags: 64
		});
	} catch (error) {
		await logger.log(`❌ Language button error: ${error.message}`);
		await interaction
			.update({
				content: `❌ Failed to load language settings: ${error.message}`,
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
		if (!selectedLang) {
			await interaction
				.editReply({
					content: '❌ No language selected.',
					components: [],
					embeds: []
				})
				.catch(() => null);
			return;
		}

		await db.setMemberLanguage(server.id, interaction.user.id, selectedLang);

		const successMsg = await translate('settings.language.updated', interaction.guild.id, interaction.user.id);
		const langName = languageNames[selectedLang] || selectedLang;

		const serverForUpdate = await getServerForInteraction(interaction);
		if (serverForUpdate) {
			const currentLang = await getUserLanguage(interaction.guild.id, interaction.user.id);
			const availableLangs = getAvailableLanguages();

			const embedConfig = await getEmbedConfig(interaction.guild.id);
			const langTitle = await translate('settings.language.title', interaction.guild.id, interaction.user.id);
			const langDesc = await translate('settings.language.description', interaction.guild.id, interaction.user.id);
			const currentLangText = await translate('settings.language.current', interaction.guild.id, interaction.user.id);

			const languageEmbed = new EmbedBuilder()
				.setColor(embedConfig.COLOR)
				.setTitle(langTitle)
				.setDescription(`${langDesc}\n\n**${currentLangText}:** ${languageNames[currentLang] || currentLang}`)
				.setFooter({ text: embedConfig.FOOTER })
				.setTimestamp();

			const options = availableLangs.map((lang) => ({
				label: languageNames[lang] || lang,
				value: lang,
				description: lang === currentLang ? 'Current language' : undefined,
				default: lang === currentLang
			}));

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('settings_language_select')
				.setPlaceholder(await translate('settings.language.select', interaction.guild.id, interaction.user.id))
				.addOptions(options);

			const selectRow = new ActionRowBuilder().addComponents(selectMenu);

			const backButton = new ButtonBuilder()
				.setCustomId('bot_menu')
				.setLabel(await translate('menu.button', interaction.guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Secondary);

			const backRow = new ActionRowBuilder().addComponents(backButton);

			await interaction
				.editReply({
					embeds: [languageEmbed],
					components: [selectRow, backRow]
				})
				.catch(() => null);
		}

		await interaction
			.followUp({
				content: `${successMsg}\n**${langName}**`,
				flags: 64
			})
			.catch(() => null);
	} catch (error) {
		await logger.log(`❌ Language select error: ${error.message}`);
		const errorMsg = await translate('settings.language.failed', interaction.guild.id, interaction.user.id, { error: error.message });
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
