import { getAutoQuest, setAutoQuest } from '$lib/frontend/panelSettings.server.js';
import { logger } from '$lib/utils/index.js';
import type { AgentPack, AgentReach, AgentSession } from './runtime.server.js';

export function settingsPack(reach: AgentReach, session: AgentSession): AgentPack {
	return {
		instructions:
			"# Panel settings\nThe admin panel's Settings tab holds one switch for the whole instance: auto quest enrollment. When it is on, members can claim open Discord quests by pasting their own Discord user token, which is against Discord's terms for their own account. Turn it on only when the admin clearly asks for it, and mention that risk in your reply.",
		tools: [
			{
				name: 'get_panel_settings',
				description: "Read the switches on the admin panel's Settings tab.",
				parameters: { type: 'object', properties: {} },
				run: async () => ({ ok: true, auto_quest_enrollment: await getAutoQuest(reach.panelId) })
			},
			{
				name: 'update_panel_settings',
				description: "Change a switch on the admin panel's Settings tab.",
				parameters: {
					type: 'object',
					properties: { auto_quest_enrollment: { type: 'boolean', description: 'Turn auto quest enrollment on or off for every bot and server.' } },
					required: ['auto_quest_enrollment']
				},
				run: async (args) => {
					if (typeof args.auto_quest_enrollment !== 'boolean') return { ok: false, reason: 'auto_quest_enrollment must be true or false' };
					await setAutoQuest(reach.panelId, args.auto_quest_enrollment);
					session.changed.add('settings');
					logger.log(`${session.actor} set auto quest enrollment to ${args.auto_quest_enrollment} for panel ${reach.panelId} through the assistant`);
					return { ok: true, auto_quest_enrollment: args.auto_quest_enrollment };
				}
			}
		]
	};
}
