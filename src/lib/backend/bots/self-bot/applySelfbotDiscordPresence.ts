import type { Client } from 'discord.js-selfbot-v13';
import db, { presenceFromDbRow } from '../../../database.js';
import { applyPresenceFromFields, type PresenceSetter } from '../presenceApply.js';

export async function applySelfbotDiscordPresenceFromDb(client: Client, serverBotId: number): Promise<void> {
	if (!client.user) return;

	const row = await db.getServerBotStatusByServerBotId(serverBotId);
	await applyPresenceFromFields(client.user as PresenceSetter, presenceFromDbRow(row), `for selfbot ${serverBotId}`);
}
