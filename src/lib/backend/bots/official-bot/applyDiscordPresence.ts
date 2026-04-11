import { ActivityType, type Client, type PresenceStatusData } from 'discord.js';
import db from '../../../database.js';
import { logger } from '../../../utils/index.js';

const ACTIVITY_MAP: Record<string, ActivityType> = {
	playing: ActivityType.Playing,
	streaming: ActivityType.Streaming,
	listening: ActivityType.Listening,
	watching: ActivityType.Watching,
	custom: ActivityType.Custom,
	competing: ActivityType.Competing
};

function normalizePresenceStatus(s: string): PresenceStatusData {
	const allowed: PresenceStatusData[] = ['online', 'idle', 'dnd', 'invisible'];
	return (allowed.includes(s as PresenceStatusData) ? s : 'online') as PresenceStatusData;
}

function normalizeStoredUrl(u: string | undefined): string | undefined {
	if (!u) return undefined;
	const t = u.trim();
	if (!t) return undefined;
	return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function applyDiscordPresenceFromDb(client: Client, botId: number): Promise<void> {
	if (!client.user) return;

	try {
		const row = await db.getBotStatusByBotId(botId);
		const discord_status = row?.discord_status ?? 'online';
		const activity_type = row?.activity_type ?? 'playing';
		const activity_name = (row?.activity_name ?? '').trim();
		const activity_url = normalizeStoredUrl(row?.activity_url ?? undefined);
		const activity_state = row?.activity_state?.trim() || undefined;

		const status = normalizePresenceStatus(discord_status);
		const type = ACTIVITY_MAP[activity_type] ?? ActivityType.Playing;

		if (type === ActivityType.Custom) {
			const text = activity_state ?? activity_name;
			if (!text) {
				await client.user.setPresence({ status, activities: [] });
				return;
			}
			await client.user.setPresence({
				status,
				activities: [{ type: ActivityType.Custom, name: 'Custom Status', state: text }]
			});
			return;
		}

		if (!activity_name) {
			await client.user.setPresence({ status, activities: [] });
			return;
		}

		const activity: {
			name: string;
			type: ActivityType;
			url?: string;
			state?: string;
		} = { name: activity_name, type };

		if (type === ActivityType.Streaming) {
			if (!activity_url) {
				logger.log(`⚠️  Streaming presence for bot ${botId} has no URL; skipping activity`);
				await client.user.setPresence({ status, activities: [] });
				return;
			}
			activity.url = activity_url;
		}
		if (activity_state) {
			activity.state = activity_state;
		}

		await client.user.setPresence({ status, activities: [activity] });
	} catch (err: any) {
		logger.log(`⚠️  Could not apply Discord presence for bot ${botId}: ${err?.message ?? err}`);
	}
}
