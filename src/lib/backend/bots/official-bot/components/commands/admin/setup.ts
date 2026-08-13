import { runSetupCommand } from '../../setupFlow.js';

export const commandDefinition = {
	name: 'setup',
	description: 'Set up the bot, or check and repair an existing setup. Owner or Administrator only.',
	options: []
};

export async function execute(interaction: any, client: any) {
	await runSetupCommand(interaction, client);
}
