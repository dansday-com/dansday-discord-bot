import type { Client } from 'discord.js-selfbot-v13';
import db, { DEFAULT_BOT_PRESENCE } from '../../../database.js';
import { applyPresenceFromFields, type PresenceSetter } from '../presenceApply.js';

export async function applySelfbotDiscordPresenceFromDb(client: Client, serverBotId: number): Promise<void> {
	if (!client.user) return;

	const row = await db.getServerBotStatusByServerBotId(serverBotId);
	const fields = row ?? DEFAULT_BOT_PRESENCE;
	await applyPresenceFromFields(client.user as PresenceSetter, fields, `for selfbot ${serverBotId}`);
}
