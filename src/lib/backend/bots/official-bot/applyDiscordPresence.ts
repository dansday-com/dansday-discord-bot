import type { Client } from 'discord.js';
import db from '../../../database.js';
import { applyPresenceFromFields } from '../presenceApply.js';

export async function applyDiscordPresenceFromDb(client: Client, botId: number): Promise<void> {
	if (!client.user) return;

	const row = await db.getBotStatusByBotId(botId);
	await applyPresenceFromFields(client.user, row ?? undefined, `for bot ${botId}`);
}
