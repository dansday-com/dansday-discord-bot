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
	try {
		if (interaction.member.id !== interaction.guild.ownerId) {
			await interaction.reply({ content: '❌ Only the server owner can use this command.', flags: 64 });
			return;
		}

		const targetChannel = interaction.options.getChannel('channel');

		if (!targetChannel.isTextBased()) {
			await interaction.reply({ content: '❌ Please select a text channel.', flags: 64 });
			return;
		}

		const gid = interaction.guild.id;
		const uid = interaction.user.id;

		await sendInterfaceToChannel(targetChannel, interaction, client);

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.reply({
				content: await translate('interface.panel.setupWarnNoBotConfig', gid, uid),
				flags: 64
			});
			return;
		}

		const server = await db.getServerByDiscordId(botConfig.id, interaction.guild.id);
		if (!server) {
			await interaction.reply({
				content: await translate('interface.panel.setupWarnNoServer', gid, uid),
				flags: 64
			});
			return;
		}

		const accounts = await db.getServerAccountsByServer(server.id);
		const hasOwner = accounts.some((a: { account_type: string }) => a.account_type === 'owner');
		if (hasOwner) {
			await interaction.reply({
				content: await translate('interface.panel.setupHasOwnerAccount', gid, uid, {
					channel: targetChannel.toString()
				}),
				flags: 64
			});
			return;
		}

		const origin = publicSiteOrigin();
		if (!origin) {
			await interaction.reply({
				content: await translate('interface.panel.setupWarnNoBaseUrl', gid, uid),
				flags: 64
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
		await interaction.reply({
			content: await translate('interface.panel.setupOwnerInviteReady', gid, uid, {
				channel: targetChannel.toString(),
				url: inviteUrl
			}),
			flags: 64
		});
	} catch (error: any) {
		await interaction.reply({ content: `❌ Failed to send interface: ${error.message}`, flags: 64 });
	}
}
