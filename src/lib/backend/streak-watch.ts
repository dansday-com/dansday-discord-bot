import db from '../database.js';
import { TASK_BY_ID, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY, streakMilestone, dayKeyFor, weekKeyFor, weekStartDayKey, type TaskMetric } from '../tasks.js';

type StreakAnnouncer = (guildId: string, discordMemberId: string, streakResult: any, milestone: any) => Promise<any>;

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

async function anyComplete(memberId: number, periodKey: number, period: 'daily' | 'weekly', windowStartMs: number) {
	const rows = (await db.getMemberTasks(memberId, periodKey, period).catch(() => [])) as any[];
	for (const row of rows) {
		if (row.claimed_at) return true;

		const def = TASK_BY_ID.get(row.task_type);
		if (!def) continue;

		const goal = Number(row.goal) || 1;
		let progress = 0;

		if (COUNTER_METRICS.has(def.metric)) {
			const levels = await db.getMemberLevel(memberId).catch(() => null);
			progress = Math.max(0, (Number((levels as any)?.[def.metric]) || 0) - (Number(row.baseline) || 0));
		} else {
			progress = await db.countMemberEventsSince(memberId, def.metric, windowStartMs, row.target_item_id ?? null).catch(() => 0);
		}

		if (progress >= goal) return true;
	}
	return false;
}

export async function bankStreakIfEarned(memberId: any, opts: { tzOffsetMin?: number } = {}) {
	const id = Number(memberId);
	if (!id) return null;

	const streakRow = (await db.getMemberStreak(id).catch(() => null)) as any;
	if (!streakRow) return null;

	const tzOffsetMin = Number.isFinite(Number(opts.tzOffsetMin)) ? Number(opts.tzOffsetMin) : Number(streakRow.tz_offset_min) || 0;

	const nowMs = Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	if (Number(streakRow.last_claim_day_key) === dayKey) return null;

	const key = `${id}:${dayKey}`;
	if (inFlight.has(key)) return null;
	inFlight.add(key);

	try {
		const weekKey = weekKeyFor(nowMs, tzOffsetMin);
		const dayStartMs = dayKey * 86400000 + tzOffsetMin * 60000;
		const weekStartMs = weekStartDayKey(weekKey) * 86400000 + tzOffsetMin * 60000;

		const earned = (await anyComplete(id, dayKey, 'daily', dayStartMs)) || (await anyComplete(id, weekKey, 'weekly', weekStartMs));
		if (!earned) return null;

		const result = await db.applyStreakDay(id, dayKey, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY).catch(() => null);
		if (!result?.changed) return null;

		const milestone = streakMilestone(Number(result.streak) || 0);
		if (announcer) {
			const member = await db.getServerMemberById(id).catch(() => null);
			const server = member ? await db.getServer(member.server_id).catch(() => null) : null;
			if (server?.discord_server_id) {
				await announcer(String(server.discord_server_id), String(member.discord_member_id), result, milestone).catch(() => null);
			}
		}

		return result;
	} finally {
		inFlight.delete(key);
	}
}

export default { initStreakWatch, bankStreakIfEarned };
