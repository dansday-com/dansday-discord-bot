import db from '../database.js';
import { TASK_BY_ID, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY, streakMilestone, periodOpen, type TaskMetric } from '../tasks.js';
import { MINUTE_MS } from '../utils/time.js';

type StreakAnnouncer = (
	member: { guildId: string; discordMemberId: string },
	news: { streakResult: NonNullable<Awaited<ReturnType<typeof db.applyStreakDay>>>; milestone: ReturnType<typeof streakMilestone> }
) => Promise<unknown>;

let announcer: StreakAnnouncer | null = null;

export function initStreakWatch(fn: StreakAnnouncer) {
	announcer = fn;
}

const COUNTER_METRICS = new Set<TaskMetric>([
	'chat_total',
	'reactions_given',
	'voice_minutes_active',
	'voice_minutes_afk',
	'voice_minutes_video',
	'voice_minutes_streaming'
]);

const inFlight = new Set<string>();

type PeriodWindow = { periodKey: number; period: 'daily' | 'weekly'; windowStartMs: number };

async function anyComplete(memberId: number, { periodKey, period, windowStartMs }: PeriodWindow) {
	const rows = await db.getMemberTasks(memberId, periodKey, period).catch(() => []);
	for (const row of rows) {
		if (row.claimed_at) {
			return true;
		}

		const def = TASK_BY_ID.get(row.task_type);
		if (!def) {
			continue;
		}

		const goal = Number(row.goal) || 1;
		let progress = 0;

		if (COUNTER_METRICS.has(def.metric)) {
			const levels = await db.getMemberLevel(memberId).catch(() => null);
			progress = Math.max(0, (Number((levels as Record<string, unknown>)?.[def.metric]) || 0) - (Number(row.baseline) || 0));
		} else {
			progress = await db
				.countMemberEventsSince(memberId, { metric: def.metric, sinceMs: windowStartMs, targetItemId: row.target_item_id ?? null })
				.catch(() => 0);
		}

		if (progress >= goal) {
			return true;
		}
	}
	return false;
}

export async function bankStreakIfEarned(memberId: number | string) {
	const id = Number(memberId);
	if (!id) {
		return null;
	}

	const streakRow = await db.getMemberStreak(id).catch(() => null);
	if (!streakRow) {
		return null;
	}

	const nowMs = Date.now();
	const [dayKey, weekKey] = await Promise.all([db.getLatestTaskKey(id, 'daily').catch(() => null), db.getLatestTaskKey(id, 'weekly').catch(() => null)]);
	if (!periodOpen(dayKey, 'daily', nowMs)) {
		return null;
	}
	if (Number(streakRow.last_claim_day_key) === dayKey) {
		return null;
	}

	const key = `${id}:${dayKey}`;
	if (inFlight.has(key)) {
		return null;
	}
	inFlight.add(key);

	try {
		const isEarned =
			(await anyComplete(id, { periodKey: dayKey, period: 'daily', windowStartMs: dayKey * MINUTE_MS })) ||
			(periodOpen(weekKey, 'weekly', nowMs) && (await anyComplete(id, { periodKey: weekKey, period: 'weekly', windowStartMs: weekKey * MINUTE_MS })));
		if (!isEarned) {
			return null;
		}

		const result = await db.applyStreakDay(id, { dayKey, freezeMax: STREAK_FREEZE_MAX, earnEvery: STREAK_FREEZE_EARN_EVERY }).catch(() => null);
		if (!result?.changed) {
			return null;
		}

		const milestone = streakMilestone(Number(result.streak) || 0);
		if (announcer) {
			const member = await db.getServerMemberById(id).catch(() => null);
			const server = member ? await db.getServer(member.server_id).catch(() => null) : null;
			if (server?.discord_server_id) {
				await announcer(
					{ guildId: String(server.discord_server_id), discordMemberId: String(member!.discord_member_id) },
					{ streakResult: result, milestone }
				).catch(() => null);
			}
		}

		return result;
	} finally {
		inFlight.delete(key);
	}
}

export default { initStreakWatch, bankStreakIfEarned };
