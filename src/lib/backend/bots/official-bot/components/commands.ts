import { ApplicationCommandType, REST, Routes } from 'discord.js';
import type { APIApplicationCommand } from 'discord-api-types/v10';
import { getBotToken, getApplicationId } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { commandDefinition as setupCommand, execute as setupExecute } from './commands/admin/setup.js';
import { errorReason, translate } from '../i18n.js';

const commandDefinitions = [setupCommand];

function primaryEntryPointToPutBody(cmd: APIApplicationCommand) {
	const o: Record<string, unknown> = {
		type: ApplicationCommandType.PrimaryEntryPoint,
		name: cmd.name
	};
	if (cmd.handler !== undefined) o.handler = cmd.handler;
	if (cmd.name_localizations) o.name_localizations = cmd.name_localizations;
	if (cmd.nsfw !== undefined) o.nsfw = cmd.nsfw;
	if (cmd.default_member_permissions != null) o.default_member_permissions = cmd.default_member_permissions;
	if (cmd.contexts !== undefined) o.contexts = cmd.contexts;
	if (cmd.integration_types !== undefined) o.integration_types = cmd.integration_types;
	return o;
}

async function executeSlashCommand(interaction: any, client: any) {
	const commandName = interaction.commandName;

	if (commandName === 'setup') {
		try {
			await setupExecute(interaction, client);
			return { success: true, reason: 'executed' };
		} catch (error: any) {
			await logger.log(`❌ Error executing slash command ${commandName}: ${error.message}`);
			return { success: false, reason: 'execution_error', error };
		}
	}

	return { success: false, reason: 'unknown_command' };
}

async function deployCommands(_clearFirst = false) {
	const token = getBotToken('official');
	if (!token) throw new Error('Bot token not available for command deployment.');
	const rest = new REST({ version: '10' }).setToken(token);
	const appId = getApplicationId();

	try {
		const existing = (await rest.get(Routes.applicationCommands(appId))) as APIApplicationCommand[];
		const entryPoints = existing.filter((c) => c.type === ApplicationCommandType.PrimaryEntryPoint).map(primaryEntryPointToPutBody);
		await rest.put(Routes.applicationCommands(appId), {
			body: [...commandDefinitions, ...entryPoints] as unknown[]
		});
	} catch (error) {
		throw error;
	}
}

function init(client: any) {
	client.on('interactionCreate', async (interaction: any) => {
		if (interaction.isChatInputCommand()) {
			const guildId = interaction.guild?.id ?? '';
			const userId = interaction.user?.id ?? '';
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
							errorMessage = await translate('commands.errors.unknown', guildId, userId, { command: interaction.commandName });
							await logger.log(`❌ Unknown command attempted: /${interaction.commandName} by ${interaction.user.tag}`);
							break;
						case 'execution_error':
							errorMessage = await translate('commands.errors.failed', guildId, userId, {
								command: interaction.commandName,
								error: await errorReason(result.error, guildId, userId)
							});
							await logger.log(`❌ Command execution error: /${interaction.commandName} by ${interaction.user.tag} - ${result.error?.message}`);
							break;
						default:
							errorMessage = await translate('commands.errors.unexpected', guildId, userId, { command: interaction.commandName });
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
						content: await translate('commands.errors.critical', guildId, userId),
						flags: 64
					});
				} catch (replyError: any) {
					await logger.log(`❌ Failed to send error response: ${replyError.message}`);
				}
			}
		}
	});
}

export default { init, deployCommands };
