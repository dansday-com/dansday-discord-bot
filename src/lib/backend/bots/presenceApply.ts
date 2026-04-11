import { ActivityType, type PresenceStatusData } from 'discord.js';
import { logger } from '../../utils/index.js';

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

export type PresenceFields = {
	discord_status?: string | null;
	activity_type?: string | null;
	activity_name?: string | null;
	activity_url?: string | null;
	activity_state?: string | null;
};

export type PresenceSetter = {
	setPresence: (data: { status: PresenceStatusData; activities: any[] }) => any;
};

export async function applyPresenceFromFields(user: PresenceSetter | null, row: PresenceFields | null | undefined, logContext: string): Promise<void> {
	if (!user) return;

	try {
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
				await user.setPresence({ status, activities: [] });
				return;
			}
			await user.setPresence({
				status,
				activities: [{ type: ActivityType.Custom, name: 'Custom Status', state: text }]
			});
			return;
		}

		if (!activity_name) {
			await user.setPresence({ status, activities: [] });
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
				logger.log(`⚠️  Streaming presence ${logContext} has no URL; skipping activity`);
				await user.setPresence({ status, activities: [] });
				return;
			}
			activity.url = activity_url;
		}
		if (activity_state) {
			activity.state = activity_state;
		}

		await user.setPresence({ status, activities: [activity] });
	} catch (err: any) {
		logger.log(`⚠️  Could not apply Discord presence ${logContext}: ${err?.message ?? err}`);
	}
}
