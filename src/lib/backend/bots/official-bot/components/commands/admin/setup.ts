import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { sendInterfaceToChannel } from '../../interface.js';
import { randomBytes } from 'crypto';
import db from '../../../../../../database.js';
import {
	DEFAULT_BOOSTER_MESSAGES,
	DEFAULT_LEVELING_SETTINGS,
	DEFAULT_WELCOMER_MESSAGES,
	getBotConfig,
	SERVER_SETTINGS,
	SETUP_MENU_CATEGORY_NAME,
	SETUP_INFO_CATEGORY_NAME,
	SETUP_CHANNEL_DEFS
} from '../../../../../config.js';
import { publicSiteOrigin } from '../../../../../../url.js';
import { translate } from '../../../i18n.js';
import { isUtcSqlExpired } from '../../../../../../utils/index.js';
export const commandDefinition = {
	name: 'setup',
	description: 'Set up the bot: creates a </DANSDAY> category with all required channels. Administrator only.',
	options: []
};

const COLOR_OK = 0x57f287;
const COLOR_WARN = 0xfee75c;
const COLOR_ERR = 0xed4245;
const EPHEMERAL = 64;

async function replySetupEphemeral(interaction: any, opts: { color: number; title?: string; description: string; linkUrl?: string; linkLabel?: string }) {
	const embed = new EmbedBuilder().setColor(opts.color).setDescription(opts.description.slice(0, 4096));
	if (opts.title) embed.setTitle(opts.title.slice(0, 256));
	const components: ActionRowBuilder<ButtonBuilder>[] = [];
	if (opts.linkUrl && /^https?:\/\//i.test(opts.linkUrl.trim()) && opts.linkLabel) {
		components.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(opts.linkUrl.trim()).setLabel(opts.linkLabel.slice(0, 80))
			)
		);
	}
	await interaction.reply({
		embeds: [embed],
		...(components.length ? { components } : {}),
		flags: EPHEMERAL
	});
}

function findActiveOwnerInvite(invites: { account_type: string; used_by: unknown; used_at: unknown; expires_at: unknown; token: string }[]) {
	for (const inv of invites) {
		if (inv.account_type !== 'owner') continue;
		if (inv.used_by || inv.used_at) continue;
		if (inv.expires_at && isUtcSqlExpired(inv.expires_at as string | Date)) continue;
		return inv;
	}
	return null;
}

export async function execute(interaction: any, client: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		const isOwner = interaction.member?.id === interaction.guild?.ownerId;
		const hasAdministrator =
			interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator) ||
			interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
			false;

		if (!isOwner && !hasAdministrator) {
			await replySetupEphemeral(interaction, {
				color: COLOR_ERR,
				title: await translate('interface.panel.setupNotOwnerTitle', gid, uid),
				description: await translate('interface.panel.setupNotOwnerBody', gid, uid)
			});
			return;
		}

		await interaction.deferReply({ flags: EPHEMERAL });

		const guild = interaction.guild;

		const menuCategory = await guild.channels.create({
			name: SETUP_MENU_CATEGORY_NAME,
			type: ChannelType.GuildCategory,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.SendMessages]
				}
			]
		});

		const infoCategory = await guild.channels.create({
			name: SETUP_INFO_CATEGORY_NAME,
			type: ChannelType.GuildCategory,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.SendMessages]
				}
			]
		});

		const channelMap: Record<string, string> = {};

		for (const def of SETUP_CHANNEL_DEFS) {
			const parentId = def.settingsKey === 'menu' ? menuCategory.id : infoCategory.id;
			const ch = await guild.channels.create({
				name: def.name,
				type: ChannelType.GuildText,
				parent: parentId
			});
			channelMap[def.settingsKey] = ch.id;
		}

		const menuChannel = await guild.channels.fetch(channelMap['menu']);
		await sendInterfaceToChannel(menuChannel, interaction, client);

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.panel.setupWarnNoBotConfig', gid, uid))]
			});
			return;
		}

		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
		if (!server) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.panel.setupWarnNoServer', gid, uid))]
			});
			return;
		}

		const getSettings = async (comp: string) => {
			const row = await db.getServerSettings(server.id, comp);
			return row?.settings && typeof row.settings === 'object' ? row.settings : null;
		};

		const mainSettings = (await getSettings(SERVER_SETTINGS.component.main)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.main, {
			...mainSettings,
			bot_updates_channel_id: channelMap['bot_updates']
		});

		const lvlRaw = (await getSettings(SERVER_SETTINGS.component.leveling)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.leveling, {
			enabled: true,
			...DEFAULT_LEVELING_SETTINGS,
			...lvlRaw,
			PROGRESS_CHANNEL_ID: channelMap['leveling']
		});

		const welcRaw = (await getSettings(SERVER_SETTINGS.component.welcomer)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.welcomer, {
			enabled: true,
			messages: DEFAULT_WELCOMER_MESSAGES,
			...welcRaw,
			channels: [channelMap['welcomer']]
		});

		const boostRaw = (await getSettings(SERVER_SETTINGS.component.booster)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.booster, {
			enabled: true,
			messages: DEFAULT_BOOSTER_MESSAGES,
			...boostRaw,
			channels: [channelMap['booster']]
		});

		const modRaw = (await getSettings(SERVER_SETTINGS.component.moderation)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.moderation, {
			enabled: true,
			...modRaw,
			log_channel_id: channelMap['moderation']
		});

		const giveRaw = (await getSettings(SERVER_SETTINGS.component.giveaway)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.giveaway, {
			enabled: true,
			...giveRaw,
			giveaway_channel: channelMap['giveaway']
		});

		const rblxRaw = (await getSettings(SERVER_SETTINGS.component.roblox_catalog_notifier)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.roblox_catalog_notifier, {
			enabled: true,
			...rblxRaw,
			channel_id: channelMap['roblox_catalog_notifier']
		});

		const staffRaw = (await getSettings(SERVER_SETTINGS.component.staff_rating)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.staff_rating, {
			enabled: false,
			...staffRaw,
			rating_channel_id: channelMap['staff_rating']
		});

		const questRaw = (await getSettings(SERVER_SETTINGS.component.discord_quest_notifier)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.discord_quest_notifier, {
			enabled: false,
			...questRaw,
			channel_id: channelMap['discord_quest_notifier']
		});

		const ccRaw = (await getSettings(SERVER_SETTINGS.component.content_creator)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.content_creator, {
			enabled: false,
			...ccRaw,
			target_channel_id: channelMap['content_creator']
		});

		const notifRaw = (await getSettings(SERVER_SETTINGS.component.notifications)) || {};
		await db.upsertServerSettings(server.id, SERVER_SETTINGS.component.notifications, {
			enabled: true,
			...notifRaw,
			category_ids: [infoCategory.id]
		});

		const accounts = await db.getServerAccountsByServer(server.id);
		const hasOwner = accounts.some((a: { account_type: string }) => a.account_type === 'owner');
		if (hasOwner) {
			let description = await translate('interface.panel.setupHasOwnerAccount', gid, uid, {
				channel: menuChannel.toString()
			});
			const origin = publicSiteOrigin();
			let linkUrl: string | undefined;
			let linkLabel: string | undefined;
			if (origin) {
				const loginUrl = `${origin}/login`;
				description += '\n\n' + (await translate('interface.panel.setupSignInLinkLine', gid, uid, { url: loginUrl }));
				linkUrl = loginUrl;
				linkLabel = await translate('interface.panel.setupOpenPanelButton', gid, uid);
			}
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_OK).setDescription(description)],
				...(linkUrl && linkLabel
					? {
							components: [
								new ActionRowBuilder<ButtonBuilder>().addComponents(
									new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(linkUrl).setLabel(linkLabel.slice(0, 80))
								)
							]
						}
					: {})
			});
			return;
		}

		const origin = publicSiteOrigin();
		if (!origin) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.panel.setupWarnNoBaseUrl', gid, uid))]
			});
			return;
		}

		const invites = await db.getServerAccountInvitesByServer(server.id);
		const activeInvite = findActiveOwnerInvite(invites);

		let token: string;
		if (activeInvite) {
			token = activeInvite.token;
		} else {
			token = randomBytes(32).toString('hex');
			await db.createServerAccountInvite({ token, server_id: server.id, account_type: 'owner' });
		}

		const inviteUrl = `${origin}/register?token=${token}`;
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(COLOR_OK)
					.setTitle(await translate('interface.panel.setupOwnerInviteEmbedTitle', gid, uid))
					.setDescription(
						await translate('interface.panel.setupOwnerInviteReady', gid, uid, {
							channel: menuChannel.toString(),
							url: inviteUrl
						})
					)
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setURL(inviteUrl)
						.setLabel((await translate('interface.panel.setupOwnerInviteButton', gid, uid)).slice(0, 80))
				)
			]
		});
	} catch (error: any) {
		const errorMsg = await translate('interface.panel.error', gid, uid, { error: error.message });
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_ERR).setDescription(errorMsg)]
			});
		} else {
			await replySetupEphemeral(interaction, { color: COLOR_ERR, description: errorMsg });
		}
	}
}
