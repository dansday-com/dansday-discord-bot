import { sendInterfaceToChannel } from '../../interface.js';
import { randomBytes } from 'crypto';
import db from '../../../../../../database.js';
import { getBotConfig } from '../../../../../config.js';
import { sendServerOwnerInviteEmail } from '../../../../../../frontend/email.js';
import { publicSiteOrigin } from '$lib/url.js';

export const commandDefinition = {
	name: 'setup',
	description: 'Send bot interface to a channel and receive your owner invite link via email (Server Owner only)',
	options: [
		{
			name: 'channel',
			description: 'Target channel to send the interface to',
			type: 7,
			required: true
		},
		{
			name: 'email',
			description: 'Email address to receive your owner account invite link',
			type: 3,
			required: true
		}
	]
};

export async function execute(interaction: any, client: any) {
	try {
		if (interaction.member.id !== interaction.guild.ownerId) {
			await interaction.reply({ content: '❌ Only the server owner can use this command.', flags: 64 });
			return;
		}

		const targetChannel = interaction.options.getChannel('channel');
		const email: string = interaction.options.getString('email')?.trim() ?? '';

		if (!targetChannel.isTextBased()) {
			await interaction.reply({ content: '❌ Please select a text channel.', flags: 64 });
			return;
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			await interaction.reply({ content: '❌ Please provide a valid email address.', flags: 64 });
			return;
		}

		await sendInterfaceToChannel(targetChannel, interaction, client);

		try {
			const botConfig = getBotConfig();
			if (!botConfig) {
				await interaction.followUp({ content: '⚠️ Interface sent, but bot config is not available.', flags: 64 });
				return;
			}
			const server = await db.getServerByDiscordId(botConfig.id, interaction.guild.id);
			if (!server) {
				await interaction.followUp({ content: '⚠️ Interface sent, but could not find server record to generate invite.', flags: 64 });
				return;
			}

			const origin = publicSiteOrigin();
			if (!origin) {
				await interaction.followUp({ content: '⚠️ Interface sent, but BASE_URL is not configured — cannot generate invite link.', flags: 64 });
				return;
			}

			const token = randomBytes(32).toString('hex');
			await db.createServerAccountInvite({ token, server_id: server.id, account_type: 'owner' });

			const inviteUrl = `${origin}/register?token=${token}`;
			await sendServerOwnerInviteEmail(email, interaction.guild.name, inviteUrl);

			await interaction.followUp({
				content: `✅ Interface sent to ${targetChannel}! An owner invite link has been sent to **${email}**. The link expires in 10 minutes.`,
				flags: 64
			});
		} catch (emailError: any) {
			await interaction.followUp({
				content: `⚠️ Interface sent, but failed to send invite email: ${emailError.message}`,
				flags: 64
			});
		}
	} catch (error: any) {
		await interaction.reply({ content: `❌ Failed to send interface: ${error.message}`, flags: 64 });
	}
}
