import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';
import { effectIcon, effectAccentHex } from '$lib/items.js';
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
	taskValueXp,
	costPercentile,
	XP_REWARD_MIN,
	RECENT_WINDOW_DAYS,
	MEASURED_METRICS,
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
	return all
		.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0)
		.map((i) => {
			const cfg = typeof i.config === 'string' ? safeConfig(i.config) : i.config || {};
			return {
				id: Number(i.id),
				cost: Number(i.cost) || 0,
				effectType: String(i.effect_type || ''),
				durationMinutes: Math.max(0, Number(cfg?.effect_duration_minutes) || 0)
			};
		});
}

function safeConfig(raw: string) {
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function longestByEffect(catalog: { effectType: string; durationMinutes: number }[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const c of catalog) {
		if (!c.effectType || c.durationMinutes <= 0) continue;
		const prev = out[c.effectType];
		if (prev == null || c.durationMinutes > prev) out[c.effectType] = c.durationMinutes;
	}
	return out;
}

async function measureRecentDaily(memberId: any): Promise<Partial<Record<TaskMetric, number>>> {
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * 86400000;
	const out: Partial<Record<TaskMetric, number>> = {};
	for (const metric of MEASURED_METRICS) {
		const total = await db.countMemberEventsSince(memberId, metric, sinceMs).catch(() => 0);
		out[metric] = Math.max(0, Number(total) || 0) / RECENT_WINDOW_DAYS;
	}
	return out;
}

function cheapestByEffect(catalog: { cost: number; effectType: string }[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const c of catalog) {
		if (!c.effectType) continue;
		const prev = out[c.effectType];
		if (prev == null || c.cost < prev) out[c.effectType] = c.cost;
	}
	return out;
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
	generate: boolean;
}) {
	const { member, serverId, period, periodKey, windowStartMs, eligibility, baselines, catalog, currentStreak, generate } = opts;

	let rows = (await db.getMemberTasks(member.id, periodKey, period).catch(() => [])) as any[];

	if ((!rows || rows.length === 0) && generate) {
		const enriched = { ...eligibility, recentDaily: await measureRecentDaily(member.id) };
		const generated = generateDailyTasks(Number(member.id), Number(serverId), periodKey, enriched, period);
		if (generated.length === 0) return [];

		const payload = generated.map((g) => {
			const def = TASK_BY_ID.get(g.taskType);
			const targetCost = g.targetItemId != null ? Number(catalog.find((c) => c.id === g.targetItemId)?.cost) || 0 : 0;
			const value = def ? taskValueXp(def, g.goal, g.difficulty, currentStreak, eligibility, period, targetCost) : XP_REWARD_MIN;
			const reward = pickReward(Number(member.id), periodKey, g.slot, g.difficulty, value, catalog, period);
			const metric = def?.metric as TaskMetric | undefined;
			const baseline = metric && COUNTER_METRICS.has(metric) ? Number(baselines[metric]) || 0 : 0;
			return {
				slot: g.slot,
				taskType: g.taskType,
				difficulty: g.difficulty,
				goal: g.goal,
				baseline,
				targetItemId: g.targetItemId ?? null,
				rewardKind: reward.kind,
				rewardXp: reward.kind === 'xp' ? reward.xp : 0,
				rewardItemId: reward.kind === 'item' ? reward.itemId : null
			};
		});

		rows = (await db.persistMemberTasks(member.id, periodKey, payload, period).catch(() => [])) as any[];
	}

	const itemIds = [...new Set([...rows.map((r) => r.reward_item_id), ...rows.map((r) => r.target_item_id)].filter((v: any) => v != null))].map(Number);
	const itemMap = new Map<number, any>();
	for (const id of itemIds) {
		const it = await db.getItem(id).catch(() => null);
		if (it) itemMap.set(id, it);
	}

	const tasks = [];
	for (const row of rows) {
		const def = TASK_BY_ID.get(row.task_type);
		if (!def) continue;

		const targetItemId = row.target_item_id == null ? null : Number(row.target_item_id);
		const targetItem = targetItemId != null ? itemMap.get(targetItemId) : null;
		if (def.targetsItem && !targetItem) continue;

		let progress = 0;
		if (COUNTER_METRICS.has(def.metric)) {
			const current = Number(baselines[def.metric]) || 0;
			progress = Math.max(0, current - (Number(row.baseline) || 0));
		} else {
			progress = await db.countMemberEventsSince(member.id, def.metric, windowStartMs, targetItemId).catch(() => 0);
		}

		const goal = Number(row.goal) || 1;
		const rewardItem = row.reward_item_id != null ? itemMap.get(Number(row.reward_item_id)) : null;

		tasks.push({
			slot: Number(row.slot),
			period,
			id: def.id,
			label: def.label,
			icon: targetItem ? effectIcon(targetItem.effect_type) : def.icon,
			accent: targetItem ? effectAccentHex(targetItem.effect_type) : def.accent,
			unit: def.unit,
			difficulty: row.difficulty,
			description: def.describe(goal, { itemName: targetItem?.name ?? null }),
			targetItem: targetItem ? { id: targetItemId, name: targetItem.name, effectType: targetItem.effect_type } : null,
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
	generate?: boolean;
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

	const catalog = await loadCatalog(server.id, itemsEnabled);
	const medianItemCost = costPercentile(
		catalog.map((c) => c.cost).filter((c) => c > 0),
		50
	);

	const eligibility: TaskEligibility = {
		levelingEnabled: true,
		minigamesEnabled,
		itemsEnabled,
		assetsEnabled,
		baselines,
		activeDays: daysActive(member.member_since),
		effectCosts: cheapestByEffect(catalog),
		medianItemCost,
		catalog,
		effectDurations: longestByEffect(catalog)
	};

	const currentStreak = Number(streakRow?.current_streak) || 0;

	const shared = { member, serverId: server.id, eligibility, baselines, catalog, currentStreak, generate: opts.generate !== false };
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
		login: shapeLogin(loginRow, member, dayKey, catalog, await memberDailyEarn(member.id)),
		allClaimed: daily.length > 0 && daily.every((t) => t.claimed),
		empty: daily.length === 0 && weekly.length === 0
	};
}

export async function memberDailyEarn(memberId: any): Promise<number> {
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * 86400000;
	const total = await db.countMemberEventsSince(memberId, 'xp_gained', sinceMs).catch(() => 0);
	return Math.max(0, Number(total) || 0) / RECENT_WINDOW_DAYS;
}

function shapeLogin(row: any, member: any, dayKey: number, catalog: { id: number; cost: number }[], dailyEarn = 0) {
	const cycleDay = Number(row?.cycle_day) || 0;
	const last = row?.last_claim_day_key == null ? null : Number(row.last_claim_day_key);
	const cyclesCompleted = Number(row?.cycles_completed) || 0;

	const broken = last != null && last < dayKey - 1;
	const nextDay = broken || cycleDay >= LOGIN_CYCLE_DAYS ? 1 : cycleDay + 1;
	const claimedToday = last === dayKey;

	const rewards = loginCyclePreview(Number(member.id), cyclesCompleted, catalog, dailyEarn).map((r) => ({
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
