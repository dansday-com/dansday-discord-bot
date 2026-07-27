import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	WEEKLY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	LOGIN_CYCLE_DAYS,
	dayKeyFor,
	weekKeyFor,
	weekStartDayKey,
	msUntilNextDay,
	msUntilNextWeek,
	generateDailyTasks,
	pickReward,
	nextMilestone,
	loginCyclePreview,
	type TaskEligibility,
	type TaskMetric,
	type TaskPeriod
} from '$lib/tasks.js';

const COUNTER_METRICS = new Set<TaskMetric>([
	'chat_total',
	'reactions_given',
	'voice_minutes_active',
	'voice_minutes_afk',
	'voice_minutes_video',
	'voice_minutes_streaming'
]);

function daysActive(memberSince: any): number {
	const dt = parseMySQLDateTimeUtc(memberSince);
	if (!dt) return 1;
	const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
	return Math.max(1, days);
}

async function loadCatalog(serverId: any, itemsEnabled: boolean) {
	if (!itemsEnabled) return [];
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) return [];
	const all = (await db.listItems(panelId).catch(() => [])) as any[];
	return all.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0).map((i) => ({ id: Number(i.id), cost: Number(i.cost) || 0 }));
}

async function buildPeriod(opts: {
	member: any;
	serverId: any;
	period: TaskPeriod;
	periodKey: number;
	windowStartMs: number;
	eligibility: TaskEligibility;
	baselines: Partial<Record<TaskMetric, number>>;
	catalog: { id: number; cost: number }[];
	currentStreak: number;
}) {
	const { member, serverId, period, periodKey, windowStartMs, eligibility, baselines, catalog, currentStreak } = opts;

	let rows = (await db.getMemberTasks(member.id, periodKey, period).catch(() => [])) as any[];

	if (!rows || rows.length === 0) {
		const generated = generateDailyTasks(Number(member.id), Number(serverId), periodKey, eligibility, period);
		if (generated.length === 0) return [];

		const payload = generated.map((g) => {
			const reward = pickReward(Number(member.id), periodKey, g.slot, g.difficulty, currentStreak, catalog, period);
			const def = TASK_BY_ID.get(g.taskType);
			const metric = def?.metric as TaskMetric | undefined;
			const baseline = metric && COUNTER_METRICS.has(metric) ? Number(baselines[metric]) || 0 : 0;
			return {
				slot: g.slot,
				taskType: g.taskType,
				difficulty: g.difficulty,
				goal: g.goal,
				baseline,
				rewardKind: reward.kind,
				rewardXp: reward.kind === 'xp' ? reward.xp : 0,
				rewardItemId: reward.kind === 'item' ? reward.itemId : null
			};
		});

		rows = (await db.persistMemberTasks(member.id, periodKey, payload, period).catch(() => [])) as any[];
	}

	const itemIds = [...new Set(rows.map((r) => r.reward_item_id).filter((v: any) => v != null))].map(Number);
	const itemMap = new Map<number, any>();
	for (const id of itemIds) {
		const it = await db.getItem(id).catch(() => null);
		if (it) itemMap.set(id, it);
	}

	const tasks = [];
	for (const row of rows) {
		const def = TASK_BY_ID.get(row.task_type);
		if (!def) continue;

		let progress = 0;
		if (COUNTER_METRICS.has(def.metric)) {
			const current = Number(baselines[def.metric]) || 0;
			progress = Math.max(0, current - (Number(row.baseline) || 0));
		} else {
			progress = await db.countMemberEventsSince(member.id, def.metric, windowStartMs).catch(() => 0);
		}

		const goal = Number(row.goal) || 1;
		const rewardItem = row.reward_item_id != null ? itemMap.get(Number(row.reward_item_id)) : null;

		tasks.push({
			slot: Number(row.slot),
			period,
			id: def.id,
			label: def.label,
			icon: def.icon,
			accent: def.accent,
			unit: def.unit,
			difficulty: row.difficulty,
			description: def.describe(goal),
			goal,
			progress: Math.min(progress, goal),
			rawProgress: progress,
			complete: progress >= goal,
			claimed: !!row.claimed_at,
			reward:
				row.reward_kind === 'item' && rewardItem
					? {
							kind: 'item' as const,
							itemId: Number(row.reward_item_id),
							name: rewardItem.name,
							effectType: rewardItem.effect_type,
							cost: Number(rewardItem.cost) || 0
						}
					: { kind: 'xp' as const, xp: Number(row.reward_xp) || 0 }
		});
	}

	tasks.sort((a, b) => a.slot - b.slot);
	return tasks;
}

export async function loadTasksShared(opts: {
	server: any;
	member: any;
	itemsEnabled: boolean;
	minigamesEnabled: boolean;
	assetsEnabled?: boolean;
	tzOffsetMin: number;
	nowMs?: number;
}) {
	const { server, member, itemsEnabled, minigamesEnabled, tzOffsetMin } = opts;
	const assetsEnabled = opts.assetsEnabled === true;
	const nowMs = opts.nowMs ?? Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	const weekKey = weekKeyFor(nowMs, tzOffsetMin);
	const dayStartMs = dayKey * 86400000 + tzOffsetMin * 60000;
	const weekStartMs = weekStartDayKey(weekKey) * 86400000 + tzOffsetMin * 60000;

	const levels = (await db.ensureMemberLevel(member.id).catch(() => null)) as any;
	const streakRow = (await db.ensureMemberStreak(member.id).catch(() => null)) as any;
	const loginRow = (await db.ensureMemberClaim(member.id).catch(() => null)) as any;

	const baselines: Partial<Record<TaskMetric, number>> = {
		chat_total: Number(levels?.chat_total) || 0,
		reactions_given: Number(levels?.reactions_given) || 0,
		voice_minutes_active: Number(levels?.voice_minutes_active) || 0,
		voice_minutes_afk: Number(levels?.voice_minutes_afk) || 0,
		voice_minutes_video: Number(levels?.voice_minutes_video) || 0,
		voice_minutes_streaming: Number(levels?.voice_minutes_streaming) || 0,
		xp_gained: Number(levels?.experience) || 0
	};

	const eligibility: TaskEligibility = {
		levelingEnabled: true,
		minigamesEnabled,
		itemsEnabled,
		assetsEnabled,
		baselines,
		activeDays: daysActive(member.member_since)
	};

	const catalog = await loadCatalog(server.id, itemsEnabled);
	const currentStreak = Number(streakRow?.current_streak) || 0;

	const shared = { member, serverId: server.id, eligibility, baselines, catalog, currentStreak };
	const daily = await buildPeriod({ ...shared, period: 'daily', periodKey: dayKey, windowStartMs: dayStartMs });
	const weekly = await buildPeriod({ ...shared, period: 'weekly', periodKey: weekKey, windowStartMs: weekStartMs });

	return {
		dayKey,
		weekKey,
		resetsInMs: msUntilNextDay(nowMs, tzOffsetMin),
		weeklyResetsInMs: msUntilNextWeek(nowMs, tzOffsetMin),
		daily,
		weekly,
		tasks: daily,
		streak: shapeStreak(streakRow),
		login: shapeLogin(loginRow, member, dayKey, catalog),
		allClaimed: daily.length > 0 && daily.every((t) => t.claimed),
		empty: daily.length === 0 && weekly.length === 0
	};
}

function shapeLogin(row: any, member: any, dayKey: number, catalog: { id: number; cost: number }[]) {
	const cycleDay = Number(row?.cycle_day) || 0;
	const last = row?.last_claim_day_key == null ? null : Number(row.last_claim_day_key);
	const cyclesCompleted = Number(row?.cycles_completed) || 0;

	const broken = last != null && last < dayKey - 1;
	const nextDay = broken || cycleDay >= LOGIN_CYCLE_DAYS ? 1 : cycleDay + 1;
	const claimedToday = last === dayKey;

	const rewards = loginCyclePreview(Number(member.id), cyclesCompleted, catalog).map((r) => ({
		...r,
		claimed: !claimedToday && r.day < nextDay ? true : claimedToday && r.day <= cycleDay,
		current: !claimedToday && r.day === nextDay
	}));

	return {
		cycleDay,
		nextDay,
		claimedToday,
		canClaim: !claimedToday,
		cycleDays: LOGIN_CYCLE_DAYS,
		cyclesCompleted,
		rewards
	};
}

function shapeStreak(row: any) {
	const current = Number(row?.current_streak) || 0;
	const next = nextMilestone(current);
	return {
		current,
		longest: Number(row?.longest_streak) || 0,
		freezes: Number(row?.freezes_available) || 0,
		freezeMax: STREAK_FREEZE_MAX,
		earnEvery: STREAK_FREEZE_EARN_EVERY,
		lastClaimDayKey: row?.last_claim_day_key == null ? null : Number(row.last_claim_day_key),
		nextMilestone: next,
		toNextMilestone: Math.max(0, next.at - current),
		slots: DAILY_TASK_SLOTS,
		weeklySlots: WEEKLY_TASK_SLOTS
	};
}
