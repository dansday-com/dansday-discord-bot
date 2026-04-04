import { sendInterfaceToChannel } from '../../interface.js';
import { hasPermission } from '../../permissions.js';

export const commandDefinition = {
	name: 'setup',
	description: 'Send bot interface with buttons to target channel (Admin only)',
	options: [
		{
			name: 'channel',
			description: 'Target channel to send the interface to',
			type: 7,
			required: true
		}
	]
};

export async function execute(interaction: any, client: any) {
	try {
		if (!(await hasPermission(interaction.member, 'setup'))) {
			await interaction.reply({ content: '❌ You need Admin role to use this command.', flags: 64 });
			return;
		}

		const targetChannel = interaction.options.getChannel('channel');

		if (!targetChannel.isTextBased()) {
			await interaction.reply({ content: '❌ Please select a text channel.', flags: 64 });
			return;
		}

		await sendInterfaceToChannel(targetChannel, interaction, client);
	} catch (error: any) {
		await interaction.reply({ content: `❌ Failed to send interface: ${error.message}`, flags: 64 });
	}
}
