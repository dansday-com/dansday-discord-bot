import type { ActivityType, Client } from 'discord.js-selfbot-v13';
import db, { presenceFromDbRow } from '../../../database.js';
import { applyPresenceFromFields, type PresenceSetter } from '../presenceApply.js';

const SELFBOT_ACTIVITY_TYPES: ActivityType[] = ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'CUSTOM', 'COMPETING'];

export async function applySelfbotDiscordPresenceFromDb(client: Client, selfbotId: number): Promise<void> {
	const { user } = client;
	if (!user) {
		return;
	}

	const row = await db.getSelfbotStatus(selfbotId);
	const setter: PresenceSetter = {
		setPresence: ({ status, activities }) =>
			user.setPresence({ status, activities: activities.map((activity) => ({ ...activity, type: SELFBOT_ACTIVITY_TYPES[activity.type] })) })
	};
	await applyPresenceFromFields(setter, presenceFromDbRow(row), `for selfbot ${selfbotId}`);
}
