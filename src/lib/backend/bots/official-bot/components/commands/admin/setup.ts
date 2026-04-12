import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { sendInterfaceToChannel } from '../../interface.js';
import { randomBytes } from 'crypto';
import db from '../../../../../../database.js';
import { getBotConfig } from '../../../../../config.js';
import { publicSiteOrigin } from '../../../../../../url.js';
import { translate } from '../../../i18n.js';
import { isUtcSqlExpired } from '../../../../../../utils/index.js';

export const commandDefinition = {
	name: 'setup',
	description: 'Send the web panel to a channel. Server owner only; owner invite if no owner yet.',
	options: [
		{
			name: 'channel',
			description: 'Target channel to send the interface to',
			type: 7,
			required: true
		}
	]
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
		if (interaction.member.id !== interaction.guild.ownerId) {
			await replySetupEphemeral(interaction, {
				color: COLOR_ERR,
				title: await translate('interface.panel.setupNotOwnerTitle', gid, uid),
				description: await translate('interface.panel.setupNotOwnerBody', gid, uid)
			});
			return;
		}

		const targetChannel = interaction.options.getChannel('channel');

		if (!targetChannel.isTextBased()) {
			await replySetupEphemeral(interaction, {
				color: COLOR_ERR,
				title: await translate('interface.panel.setupNotTextChannelTitle', gid, uid),
				description: await translate('interface.panel.setupNotTextChannelBody', gid, uid)
			});
			return;
		}

		await sendInterfaceToChannel(targetChannel, interaction, client);

		const botConfig = getBotConfig();
		if (!botConfig) {
			await replySetupEphemeral(interaction, {
				color: COLOR_WARN,
				description: await translate('interface.panel.setupWarnNoBotConfig', gid, uid)
			});
			return;
		}

		const server = await db.getServerByDiscordId(botConfig.id, interaction.guild.id);
		if (!server) {
			await replySetupEphemeral(interaction, {
				color: COLOR_WARN,
				description: await translate('interface.panel.setupWarnNoServer', gid, uid)
			});
			return;
		}

		const accounts = await db.getServerAccountsByServer(server.id);
		const hasOwner = accounts.some((a: { account_type: string }) => a.account_type === 'owner');
		if (hasOwner) {
			let description = await translate('interface.panel.setupHasOwnerAccount', gid, uid, {
				channel: targetChannel.toString()
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
			await replySetupEphemeral(interaction, { color: COLOR_OK, description, linkUrl, linkLabel });
			return;
		}

		const origin = publicSiteOrigin();
		if (!origin) {
			await replySetupEphemeral(interaction, {
				color: COLOR_WARN,
				description: await translate('interface.panel.setupWarnNoBaseUrl', gid, uid)
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
		await replySetupEphemeral(interaction, {
			color: COLOR_OK,
			title: await translate('interface.panel.setupOwnerInviteEmbedTitle', gid, uid),
			description: await translate('interface.panel.setupOwnerInviteReady', gid, uid, {
				channel: targetChannel.toString(),
				url: inviteUrl
			}),
			linkUrl: inviteUrl,
			linkLabel: await translate('interface.panel.setupOwnerInviteButton', gid, uid)
		});
	} catch (error: any) {
		await replySetupEphemeral(interaction, {
			color: COLOR_ERR,
			description: await translate('interface.panel.error', gid, uid, { error: error.message })
		});
	}
}
