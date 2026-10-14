import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getEmbedConfig, NOTIFICATIONS, serverSettingsComponent } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { logger } from '../../../../../utils/index.js';
import { translate, errorReason } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { featureAvailable } from './availability.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';
import type {
	ButtonInteraction,
	GuildBasedChannel,
	StringSelectMenuInteraction,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction
} from 'discord.js';

export async function handleNotificationsButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		const [isChannelsEnabled, isRobloxEnabled, isCreatorsEnabled] = await Promise.all([
			featureAvailable(guildId, serverSettingsComponent.notifications),
			featureAvailable(guildId, serverSettingsComponent.roblox_catalog_notifier),
			featureAvailable(guildId, serverSettingsComponent.creator_alerts)
		]);

		if (!isChannelsEnabled && !isRobloxEnabled && !isCreatorsEnabled) {
			const errorMsg = await translate('notifications.errors.noneEnabled', { guildId, userId });
			await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(await translate('notifications.hub.title', { guildId, userId }))
			.setDescription(await translate('notifications.hub.description', { guildId, userId }))
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		const buttons = [];
		if (isChannelsEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_channels')
					.setLabel(await translate('notifications.hub.channels', { guildId, userId }))
					.setStyle(ButtonStyle.Secondary)
			);
		}
		if (isRobloxEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_roblox')
					.setLabel(await translate('notifications.hub.roblox', { guildId, userId }))
					.setStyle(ButtonStyle.Secondary)
			);
		}
		if (isCreatorsEnabled) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId('notifications_creators')
					.setLabel(await translate('notifications.hub.creators', { guildId, userId }))
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
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
		}
	} catch (error) {
		logger.log(`❌ Notifications hub error: ${(error as Error).message}`);
		await interaction
			.reply({ content: `❌ ${await errorReason(error, interaction.guild.id, interaction.user.id)}`, flags: MessageFlags.Ephemeral })
			.catch(() => null);
	}
}

type NotificationChoices = { channels: GuildBasedChannel[]; categoryOf: Map<string, string> };
type PanelPayload = { embeds: EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] };

async function notificationChoices(interaction: ButtonInteraction<'cached'>): Promise<NotificationChoices | { errorKey: string }> {
	const config = await NOTIFICATIONS.getConfig(interaction.guild.id);
	if (!config) {
		return { errorKey: 'notifications.errors.notConfigured' };
	}
	const channelsWithCategory = await NOTIFICATIONS.getNotificationChannels(interaction.guild.id);
	const channels = channelsWithCategory
		.map(({ discord_channel_id }) => interaction.guild.channels.cache.get(discord_channel_id))
		.filter(Boolean) as GuildBasedChannel[];
	if (channels.length === 0) {
		return { errorKey: 'notifications.errors.noRoles' };
	}
	return { channels, categoryOf: new Map(channelsWithCategory.map((r) => [r.discord_channel_id, r.category_name || ''])) };
}

async function notificationChannelsPanel(interaction: ButtonInteraction<'cached'>, { channels, categoryOf }: NotificationChoices): Promise<PanelPayload> {
	const scope = { guildId: interaction.guild.id, userId: interaction.user.id };
	const activeIds = await NOTIFICATIONS.getMemberNotificationChannelIds(interaction.guild.id, interaction.user.id);
	const options = channels.slice(0, DISCORD_LIMITS.SELECT_OPTIONS).map((channel) => ({
		label: channel.name.slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
		value: channel.id,
		description: (categoryOf.get(channel.id) || '').slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
		default: activeIds.includes(channel.id)
	}));
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('notifications_select')
		.setPlaceholder(await translate('notifications.selectPlaceholder', scope))
		.setMinValues(0)
		.setMaxValues(options.length)
		.addOptions(options);
	const backButton = new ButtonBuilder()
		.setCustomId('bot_notifications')
		.setLabel(await translate('menu.back', scope))
		.setStyle(ButtonStyle.Secondary);

	const activeMentions = channels.filter((channel) => activeIds.includes(channel.id)).map((channel) => `<#${channel.id}>`);
	const activeLine =
		activeMentions.length > 0
			? await translate('notifications.active', scope, { channels: activeMentions.join(', ') })
			: await translate('notifications.none', scope);
	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('notifications.title', scope))
		.setDescription(`${await translate('notifications.description', scope)}\n\n${activeLine}`.slice(0, DISCORD_LIMITS.EMBED_DESCRIPTION))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(backButton)
		]
	};
}

export async function handleNotificationChannelsButton(interaction: ButtonInteraction<'cached'>) {
	try {
		if (!(await hasPermission(interaction.member, 'notifications'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'notifications', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const choices = await notificationChoices(interaction);
		if ('errorKey' in choices) {
			const errorMsg = await translate(choices.errorKey, { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const payload = await notificationChannelsPanel(interaction, choices);
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload).catch(() => null);
		} else {
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
		}
	} catch (error) {
		logger.log(`❌ Notification channels button error: ${(error as Error).message}`);
		await interaction
			.reply({ content: `❌ ${await errorReason(error, interaction.guild.id, interaction.user.id)}`, flags: MessageFlags.Ephemeral })
			.catch(() => null);
	}
}

export async function handleNotificationsSelect(interaction: StringSelectMenuInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'notifications'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'notifications', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		const config = await NOTIFICATIONS.getConfig(interaction.guild.id);
		if (!config) {
			const errorMsg = await translate('notifications.errors.notConfigured', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction
				.reply({
					content: errorMsg,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		const channelsWithCategory = await NOTIFICATIONS.getNotificationChannels(interaction.guild.id);
		const notificationChannelIds = new Set(channelsWithCategory.map((r) => r.discord_channel_id));
		const selectedIds = new Set((interaction.values || []).filter((id) => notificationChannelIds.has(id)));

		await NOTIFICATIONS.updateMemberNotificationChannels(interaction.guild.id, interaction.user.id, Array.from(selectedIds));

		const successMsg = await translate('notifications.updated', { guildId: interaction.guild.id, userId: interaction.user.id });
		await interaction
			.reply({
				content: successMsg,
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);

		await logger.log(`🔔 Notifications updated for ${member.user.tag}: ${selectedIds.size} channels`);
	} catch (error) {
		logger.log(`❌ Notifications select error: ${(error as Error).message}`);
		await interaction
			.reply({
				content: `❌ ${await errorReason(error, interaction.guild.id, interaction.user.id)}`,
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
	}
}
