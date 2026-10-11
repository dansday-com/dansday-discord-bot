import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getEmbedConfig, NOTIFICATIONS, serverSettingsComponent } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { logger } from '../../../../../utils/index.js';
import { translate } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { featureAvailable } from './availability.js';
import type { ButtonInteraction, GuildBasedChannel, StringSelectMenuInteraction } from 'discord.js';
import type { MessageActionRowComponentBuilder } from 'discord.js';
import type { MessageComponentInteraction } from 'discord.js';

export async function handleNotificationsButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		const [channelsEnabled, robloxEnabled, creatorsEnabled] = await Promise.all([
			featureAvailable(guildId, serverSettingsComponent.notifications),
			featureAvailable(guildId, serverSettingsComponent.roblox_catalog_notifier),
			featureAvailable(guildId, serverSettingsComponent.creator_alerts)
		]);

		if (!channelsEnabled && !robloxEnabled && !creatorsEnabled) {
			const errorMsg = await translate('notifications.errors.noneEnabled', guildId, userId);
			await interaction.reply({ content: errorMsg, flags: 64 }).catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(await translate('notifications.hub.title', guildId, userId))
			.setDescription(await translate('notifications.hub.description', guildId, userId))
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		const buttons = [];
		if (channelsEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_channels')
					.setLabel(await translate('notifications.hub.channels', guildId, userId))
					.setStyle(ButtonStyle.Secondary)
			);
		}
		if (robloxEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_roblox')
					.setLabel(await translate('notifications.hub.roblox', guildId, userId))
					.setStyle(ButtonStyle.Secondary)
			);
		}
		if (creatorsEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_creators')
					.setLabel(await translate('notifications.hub.creators', guildId, userId))
					.setStyle(ButtonStyle.Secondary)
			);
		}

		const rows = [
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(await menuBackButton(guildId, userId, 'me'))
		];

		const payload = { embeds: [embed], components: rows };
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload).catch(() => null);
		} else {
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }).catch(() => null));
		}
	} catch (error) {
		logger.log(`❌ Notifications hub error: ${(error as Error).message}`);
		await interaction.reply({ content: `❌ ${(error as Error).message}`, flags: 64 }).catch(() => null);
	}
}

export async function handleNotificationChannelsButton(interaction: ButtonInteraction<'cached'>) {
	try {
		const member = interaction.member;

		if (!(await hasPermission(member, 'notifications'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'notifications', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const config = await NOTIFICATIONS.getConfig(interaction.guild.id);
		if (!config) {
			const errorMsg = await translate('notifications.errors.notConfigured', interaction.guild.id, interaction.user.id);
			await interaction
				.reply({
					content: errorMsg,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const channelsWithCategory = await NOTIFICATIONS.getNotificationChannels(interaction.guild.id);
		if (channelsWithCategory.length === 0) {
			const errorMsg = await translate('notifications.errors.noRoles', interaction.guild.id, interaction.user.id);
			await interaction
				.reply({
					content: errorMsg,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(interaction.guild.id);
		const title = await translate('notifications.title', interaction.guild.id, interaction.user.id);
		const description = await translate('notifications.description', interaction.guild.id, interaction.user.id);

		const validChannels = channelsWithCategory
			.map(({ discord_channel_id }) => interaction.guild.channels.cache.get(discord_channel_id))
			.filter(Boolean) as GuildBasedChannel[];

		if (validChannels.length === 0) {
			const errorMsg = await translate('notifications.errors.noRoles', interaction.guild.id, interaction.user.id);
			await interaction
				.reply({
					content: errorMsg,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const memberCurrentNotificationChannelIds = await NOTIFICATIONS.getMemberNotificationChannelIds(interaction.guild.id, interaction.user.id);

		const channelIdToCategory = new Map(channelsWithCategory.map((r) => [r.discord_channel_id, r.category_name || '']));
		const options = validChannels.slice(0, 25).map((channel) => {
			const label = channel.name;
			return {
				label: label.slice(0, 100),
				value: channel.id,
				description: (channelIdToCategory.get(channel.id) || '').slice(0, 100),
				default: memberCurrentNotificationChannelIds.includes(channel.id)
			};
		});

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('notifications_select')
			.setPlaceholder(await translate('notifications.selectPlaceholder', interaction.guild.id, interaction.user.id))
			.setMinValues(0)
			.setMaxValues(options.length)
			.addOptions(options);

		const selectRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);

		const backButton = new ButtonBuilder()
			.setCustomId('bot_notifications')
			.setLabel(await translate('menu.back', interaction.guild.id, interaction.user.id))
			.setStyle(ButtonStyle.Secondary);

		const backRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(backButton);

		const activeMentions = validChannels.filter((channel) => memberCurrentNotificationChannelIds.includes(channel.id)).map((channel) => `<#${channel.id}>`);
		const activeLine =
			activeMentions.length > 0
				? await translate('notifications.active', interaction.guild.id, interaction.user.id, { channels: activeMentions.join(', ') })
				: await translate('notifications.none', interaction.guild.id, interaction.user.id);

		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(title)
			.setDescription(`${description}\n\n${activeLine}`.slice(0, 4096))
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		const payload = { embeds: [embed], components: [selectRow, backRow] };
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload).catch(() => null);
		} else {
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }).catch(() => null));
		}
	} catch (error) {
		logger.log(`❌ Notification channels button error: ${(error as Error).message}`);
		await interaction
			.reply({
				content: `❌ ${(error as Error).message}`,
				flags: 64
			})
			.catch(() => null);
	}
}

export async function handleNotificationsSelect(interaction: StringSelectMenuInteraction<'cached'>) {
	try {
		const member = interaction.member;

		if (!(await hasPermission(member, 'notifications'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'notifications', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const config = await NOTIFICATIONS.getConfig(interaction.guild.id);
		if (!config) {
			const errorMsg = await translate('notifications.errors.notConfigured', interaction.guild.id, interaction.user.id);
			await interaction
				.reply({
					content: errorMsg,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		const channelsWithCategory = await NOTIFICATIONS.getNotificationChannels(interaction.guild.id);
		const notificationChannelIds = new Set(channelsWithCategory.map((r) => r.discord_channel_id));
		const selectedIds = new Set((interaction.values || []).filter((id) => notificationChannelIds.has(id)));

		await NOTIFICATIONS.updateMemberNotificationChannels(interaction.guild.id, interaction.user.id, Array.from(selectedIds));

		const successMsg = await translate('notifications.updated', interaction.guild.id, interaction.user.id);
		await interaction
			.reply({
				content: successMsg,
				flags: 64
			})
			.catch(() => null);

		await logger.log(`🔔 Notifications updated for ${member.user.tag}: ${selectedIds.size} channels`);
	} catch (error) {
		logger.log(`❌ Notifications select error: ${(error as Error).message}`);
		await interaction
			.reply({
				content: `❌ ${(error as Error).message}`,
				flags: 64
			})
			.catch(() => null);
	}
}
