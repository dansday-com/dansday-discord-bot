import { REST, Routes } from 'discord.js';
import { getBotToken, getApplicationId } from '../../../config.js';
import logger from '../../../logger.js';
import { commandDefinition as setupCommand, execute as setupExecute } from './commands/admin/setup.js';

const commandDefinitions = [setupCommand];

async function executeSlashCommand(interaction: any, client: any) {
	const commandName = interaction.commandName;

	if (commandName === 'setup') {
		try {
			await setupExecute(interaction, client);
			return { success: true, reason: 'executed' };
		} catch (error: any) {
			await logger.log(`❌ Error executing slash command ${commandName}: ${error.message}`);
			return { success: false, reason: 'execution_error', error: error.message };
		}
	}

	return { success: false, reason: 'unknown_command' };
}

async function deployCommands(clearFirst = false) {
	const token = getBotToken('official');
	if (!token) throw new Error('Bot token not available for command deployment.');
	const rest = new REST({ version: '10' }).setToken(token);

	try {
		if (clearFirst) {
			await rest.put(Routes.applicationCommands(getApplicationId()), { body: [] });
		}
		await rest.put(Routes.applicationCommands(getApplicationId()), { body: commandDefinitions });
	} catch (error) {
		throw error;
	}
}

function init(client: any) {
	client.on('interactionCreate', async (interaction: any) => {
		if (interaction.isChatInputCommand()) {
			try {
				const user = interaction.user;
				const commandName = interaction.commandName;
				const options = interaction.options?.data || [];
				const optionsStr = options.map((opt: any) => `${opt.name}:${opt.value}`).join(', ') || 'none';

				await logger.log(
					`⌨️  Command triggered: /${commandName} ${optionsStr ? `(${optionsStr})` : ''} by ${user.tag} (${user.id}) in ${interaction.guild?.name || 'DM'}`
				);

				const result = await executeSlashCommand(interaction, client);

				if (!result.success) {
					let errorMessage: string;
					switch (result.reason) {
						case 'unknown_command':
							errorMessage = `❌ **Unknown Command**: \`/${interaction.commandName}\`\n\nThis command doesn't exist. Only \`/setup\` is available.`;
							await logger.log(`❌ Unknown command attempted: /${interaction.commandName} by ${interaction.user.tag}`);
							break;
						case 'execution_error':
							errorMessage = `❌ **Command Error**: \`/${interaction.commandName}\`\n\nThe command failed to execute properly.\n**Error**: ${result.error}\n\nPlease try again or contact an administrator if the issue persists.`;
							await logger.log(`❌ Command execution error: /${interaction.commandName} by ${interaction.user.tag} - ${result.error}`);
							break;
						default:
							errorMessage = `❌ **Unexpected Error**: \`/${interaction.commandName}\`\n\nAn unexpected error occurred. Please try again.`;
							await logger.log(`❌ Unexpected command error: /${interaction.commandName} by ${interaction.user.tag} - ${result.reason}`);
					}
					await interaction.reply({ content: errorMessage, flags: 64 });
				} else {
					await logger.log(`✅ Command executed successfully: /${commandName} by ${user.tag} (${user.id})`);
				}
			} catch (error: any) {
				await logger.log(`❌ Critical error in interaction handler: ${error.message}`);
				try {
					await interaction.reply({
						content: `❌ **Critical Error**: An unexpected error occurred while processing your command.\n\nPlease try again later or contact an administrator.`,
						flags: 64
					});
				} catch (replyError: any) {
					await logger.log(`❌ Failed to send error response: ${replyError.message}`);
				}
			}
		}
	});

	logger.log('🎮 Slash command system initialized');
}

export default { init, deployCommands };
