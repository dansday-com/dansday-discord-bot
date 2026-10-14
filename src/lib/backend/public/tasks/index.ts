import db from '../../../database.js';
import type { ServerRow } from '../../../schema.js';
import { parseMySQLDateTimeUtc } from '../../../utils/index.js';
import { effectIcon, effectAccentHex, itemAvailability } from '../../../items.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	WEEKLY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	LOGIN_CYCLE_DAYS,
	minuteKeyFor,
	periodOpen,
	msUntilPeriodEnds,
	loginReadyInMs,
	loginCycleBroken,
	generateDailyTasks,
	DEFAULT_LEVELING_RATES,
	type LevelingRates,
	pickReward,
	taskValueXp,
	taskCostXp,
	costPercentile,
	XP_REWARD_MIN,
	RECENT_WINDOW_DAYS,
	historyMetricsFor,
	PEAK_METRICS,
	nextMilestone,
	streakMilestone,
	loginCyclePreview,
	loginTierOddsFor,
	rarityTierFor,
	type TaskEligibility,
	type TaskMetric,
	type TaskPeriod
} from '../../../tasks.js';
import { DAY_MS, MINUTE_MS } from '../../../utils/time.js';
import { PERCENT } from '../../../utils/numbers.js';

const MEDIAN_PERCENTILE = 50;

const COUNTER_METRICS = new Set<TaskMetric>([
	'chat_total',
	'reactions_given',
	'voice_minutes_active',
	'voice_minutes_afk',
	'voice_minutes_video',
	'voice_minutes_streaming'
]);

function daysActive(memberSince: unknown): number {
	const dt = parseMySQLDateTimeUtc(memberSince);
	if (!dt) {
		return 1;
	}
	const days = Math.floor((Date.now() - dt.getTime()) / DAY_MS);
	return Math.max(1, days);
}

async function loadCatalog(serverId: number, areItemsEnabled: boolean, tzOffsetMin = 0) {
	if (!areItemsEnabled) {
		return [];
	}
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) {
		return [];
	}
	const all = (await db.listItems(panelId).catch(() => [])) as Record<string, unknown>[];
	const nowMs = Date.now();
	return all
		.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0)
		.filter((i) => {
			const { state } = itemAvailability(i, nowMs, tzOffsetMin);
			return state === 'active' || state === 'always';
		})
		.map((i) => {
			const cfg = typeof i.config === 'string' ? safeConfig(i.config) : i.config || {};
			return {
				id: Number(i.id),
				cost: Number(i.cost) || 0,
				name: String(i.name || ''),
				effectType: String(i.effect_type || ''),
				durationMinutes: Math.max(0, Number(cfg?.effect_duration_minutes) || 0),
				cooldownMinutes: Math.max(0, Number(cfg?.cooldown_minutes) || 0),
				immunityMinutes: Math.max(0, Number(cfg?.immunity_minutes) || 0),
				multiplier: Math.max(0, Number(cfg?.multiplier) || 0),
				maxPercent: Math.max(0, Number(cfg?.max_percent) || 0),
				skimPercent: Math.max(0, Number(cfg?.skim_percent) || 0),
				refundPercent: Math.max(0, Number(cfg?.refund_percent) || 0),
				successChance: Math.max(0, Math.min(PERCENT, Number(cfg?.spy_chance ?? PERCENT)))
			};
		});
}

async function loadLevelingRates(serverId: number | string): Promise<LevelingRates> {
	const rowOrRows = await db.getServerSettings(serverId, 'leveling').catch(() => null);
	const row = Array.isArray(rowOrRows) ? (rowOrRows[0] ?? null) : rowOrRows;
	const raw = row?.settings;
	const cfg = (typeof raw === 'string' ? safeConfig(raw) : raw) || {};

	const d = DEFAULT_LEVELING_RATES;
	return {
		messageXp: Number(cfg?.MESSAGE?.XP ?? d.messageXp) || 0,
		messageCooldownSeconds: Number(cfg?.MESSAGE?.COOLDOWN_SECONDS ?? d.messageCooldownSeconds) || 0,
		voiceXpPerMinute: Number(cfg?.VOICE?.XP_PER_MINUTE ?? d.voiceXpPerMinute) || 0,
		videoXpPerMinute: Number(cfg?.VIDEO?.XP_PER_MINUTE ?? d.videoXpPerMinute) || 0,
		streamingXpPerMinute: Number(cfg?.STREAMING?.XP_PER_MINUTE ?? d.streamingXpPerMinute) || 0
	};
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
		if (!c.effectType || c.durationMinutes <= 0) {
			continue;
		}
		const prev = out[c.effectType];
		if (prev == null || c.durationMinutes > prev) {
			out[c.effectType] = c.durationMinutes;
		}
	}
	return out;
}

function cheapestByEffect(catalog: { cost: number; effectType: string }[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const c of catalog) {
		if (!c.effectType) {
			continue;
		}
		const prev = out[c.effectType];
		if (prev == null || c.cost < prev) {
			out[c.effectType] = c.cost;
		}
	}
	return out;
}

async function needsGeneration(memberId: number | string, dayKey: number, weekKey: number): Promise<boolean> {
	const daily = await db.getMemberTasks(memberId, dayKey, 'daily').catch(() => []);
	if (!daily || daily.length === 0) {
		return true;
	}
	const weekly = await db.getMemberTasks(memberId, weekKey, 'weekly').catch(() => []);
	return !weekly || weekly.length === 0;
}

async function loadMemberHistory(memberId: number | string, elig: TaskEligibility, nowMs: number) {
	const sinceMs = nowMs - RECENT_WINDOW_DAYS * DAY_MS;
	const metrics = historyMetricsFor(elig);

	const recentDaily: Partial<Record<TaskMetric, number>> = {};
	const recentPeak: Partial<Record<TaskMetric, number>> = {};

	const counted = await Promise.all(
		metrics.map(async (metric) => ({
			metric,
			total: await db.countMemberEventsSince(memberId, { metric, sinceMs }).catch(() => 0)
		}))
	);

	for (const { metric, total } of counted) {
		const value = Number(total) || 0;
		if (value <= 0) {
			continue;
		}
		if (PEAK_METRICS.has(metric)) {
			recentPeak[metric] = value;
		} else {
			recentDaily[metric] = value / RECENT_WINDOW_DAYS;
		}
	}

	return { recentDaily, recentPeak };
}

type TaskMember = { id: number; member_since: Date | string | null };

type PeriodContext = {
	member: TaskMember;
	serverId: number;
	period: TaskPeriod;
	periodKey: number;
	windowStartMs: number;
	eligibility: TaskEligibility;
	baselines: Partial<Record<TaskMetric, number>>;
	catalog: { id: number; cost: number }[];
	currentStreak: number;
	generate: boolean;
};
type GeneratedTask = ReturnType<typeof generateDailyTasks>[number];
type TaskRow = Awaited<ReturnType<typeof db.getMemberTasks>>[number];
type TaskItem = NonNullable<Awaited<ReturnType<typeof db.getItem>>>;

function generatedTaskRow(g: GeneratedTask, ctx: PeriodContext) {
	const { eligibility, catalog, period, periodKey } = ctx;
	const def = TASK_BY_ID.get(g.taskType);
	const targetCost = g.targetItemId != null ? Number(catalog.find((c) => c.id === g.targetItemId)?.cost) || 0 : 0;
	const { goal } = g;
	const spend = def ? taskCostXp(def, goal, { elig: eligibility, targetCost }) : 0;
	const value = def
		? taskValueXp(def, { goal, difficulty: g.difficulty, streak: ctx.currentStreak }, { elig: eligibility, period, targetCost })
		: XP_REWARD_MIN;
	const reward = pickReward({ memberId: Number(ctx.member.id), periodKey, slot: g.slot, difficulty: g.difficulty, value, catalog, period, minWorth: spend });
	const metric = def?.metric as TaskMetric | undefined;
	return {
		slot: g.slot,
		taskType: g.taskType,
		difficulty: g.difficulty,
		goal,
		baseline: metric && COUNTER_METRICS.has(metric) ? Number(ctx.baselines[metric]) || 0 : 0,
		targetItemId: g.targetItemId ?? null,
		rewardKind: reward.kind,
		rewardXp: reward.kind === 'xp' ? reward.xp : 0,
		rewardItemId: reward.kind === 'item' ? reward.itemId : null
	};
}

async function periodTaskRows(ctx: PeriodContext): Promise<TaskRow[]> {
	const rows = await db.getMemberTasks(ctx.member.id, ctx.periodKey, ctx.period).catch(() => []);
	if ((rows && rows.length > 0) || !ctx.generate) {
		return rows;
	}
	const generated = generateDailyTasks(
		{ memberId: Number(ctx.member.id), serverId: Number(ctx.serverId), periodKey: ctx.periodKey },
		ctx.eligibility,
		ctx.period
	);
	if (generated.length === 0) {
		return [];
	}
	const payload = generated.map((g) => generatedTaskRow(g, ctx));
	return db.persistMemberTasks(ctx.member.id, { dayKey: ctx.periodKey, rows: payload, period: ctx.period }).catch(() => []);
}

async function taskItems(rows: TaskRow[]) {
	const itemIds = [...new Set([...rows.map((r) => r.reward_item_id), ...rows.map((r) => r.target_item_id)].filter((v) => v != null))].map(Number);
	const itemMap = new Map<number, TaskItem>();
	for (const id of itemIds) {
		const it = await db.getItem(id).catch(() => null);
		if (it) {
			itemMap.set(id, it);
		}
	}
	return itemMap;
}

function taskReward(row: TaskRow, rewardItem: TaskItem | null | undefined) {
	if (row.reward_kind === 'item' && rewardItem) {
		return {
			kind: 'item' as const,
			itemId: Number(row.reward_item_id),
			name: rewardItem.name,
			effectType: rewardItem.effect_type,
			cost: Number(rewardItem.cost) || 0
		};
	}
	return { kind: 'xp' as const, xp: Number(row.xp_reward) || 0 };
}

async function taskView(row: TaskRow, { ctx, itemMap }: { ctx: PeriodContext; itemMap: Map<number, TaskItem> }) {
	const def = TASK_BY_ID.get(row.task_type);
	const targetItemId = row.target_item_id == null ? null : Number(row.target_item_id);
	const targetItem = targetItemId != null ? itemMap.get(targetItemId) : null;
	if (!def || (def.targetsItem && !targetItem)) {
		return null;
	}

	const progress = COUNTER_METRICS.has(def.metric)
		? Math.max(0, (Number(ctx.baselines[def.metric]) || 0) - (Number(row.baseline) || 0))
		: await db.countMemberEventsSince(ctx.member.id, { metric: def.metric, sinceMs: ctx.windowStartMs, targetItemId }).catch(() => 0);
	const goal = Number(row.goal) || 1;

	return {
		slot: Number(row.slot),
		period: ctx.period,
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
		reward: taskReward(row, row.reward_item_id != null ? itemMap.get(Number(row.reward_item_id)) : null)
	};
}

async function buildPeriod(ctx: PeriodContext) {
	const rows = await periodTaskRows(ctx);
	const itemMap = await taskItems(rows);
	const tasks: NonNullable<Awaited<ReturnType<typeof taskView>>>[] = [];
	for (const row of rows) {
		const task = await taskView(row, { ctx, itemMap });
		if (task) {
			tasks.push(task);
		}
	}
	return tasks.sort((a, b) => a.slot - b.slot);
}

type TasksRequest = {
	server: Pick<ServerRow, 'id'>;
	member: TaskMember;
	itemsEnabled: boolean;
	minigamesEnabled: boolean;
	marketEnabled?: boolean;
	tzOffsetMin: number;
	nowMs?: number;
	generate?: boolean;
	tzKnown?: boolean;
};
type TaskCatalog = Awaited<ReturnType<typeof loadCatalog>>;
type LevelsRow = Awaited<ReturnType<typeof db.ensureMemberLevel>>;

function taskBaselines(levels: LevelsRow | null): Partial<Record<TaskMetric, number>> {
	return {
		chat_total: Number(levels?.chat_total) || 0,
		reactions_given: Number(levels?.reactions_given) || 0,
		voice_minutes_active: Number(levels?.voice_minutes_active) || 0,
		voice_minutes_afk: Number(levels?.voice_minutes_afk) || 0,
		voice_minutes_video: Number(levels?.voice_minutes_video) || 0,
		voice_minutes_streaming: Number(levels?.voice_minutes_streaming) || 0,
		xp_gained: Number(levels?.xp) || 0
	};
}

async function taskEligibility(
	opts: TasksRequest,
	{ catalog, baselines }: { catalog: TaskCatalog; baselines: Partial<Record<TaskMetric, number>> }
): Promise<TaskEligibility> {
	const { server, member } = opts;
	return {
		levelingEnabled: true,
		minigamesEnabled: opts.minigamesEnabled,
		itemsEnabled: opts.itemsEnabled,
		marketEnabled: opts.marketEnabled === true,
		baselines,
		activeDays: daysActive(member.member_since),
		effectCosts: cheapestByEffect(catalog),
		medianItemCost: costPercentile(
			catalog.map((c) => c.cost).filter((c) => c > 0),
			MEDIAN_PERCENTILE
		),
		catalog,
		effectDurations: longestByEffect(catalog),
		levelingRates: await loadLevelingRates(server.id),
		memberCount: await db.countServerMembers(server.id).catch(() => 0),
		measuredDailyEarn: await memberDailyEarn(member.id),
		invitesTracked: await db.serverTracksInvites(server.id).catch(() => false)
	};
}

function reelPool(catalog: TaskCatalog) {
	const costs = catalog.map((c) => c.cost);
	return [...catalog]
		.sort((a, b) => a.cost - b.cost)
		.map((c) => ({ name: c.name, cost: c.cost, effectType: c.effectType, tier: rarityTierFor(c.cost, costs) }));
}

async function periodKeys(memberId: number, nowMs: number) {
	const nowKey = minuteKeyFor(nowMs);
	const [latestDaily, latestWeekly] = await Promise.all([
		db.getLatestTaskKey(memberId, 'daily').catch(() => null),
		db.getLatestTaskKey(memberId, 'weekly').catch(() => null)
	]);
	return {
		dayKey: periodOpen(latestDaily, 'daily', nowMs) ? latestDaily : nowKey,
		weekKey: periodOpen(latestWeekly, 'weekly', nowMs) ? latestWeekly : nowKey
	};
}

export async function loadTasksShared(opts: TasksRequest) {
	const { server, member, tzOffsetMin } = opts;
	const nowMs = opts.nowMs ?? Date.now();
	const { dayKey, weekKey } = await periodKeys(member.id, nowMs);

	const levels = await db.ensureMemberLevel(member.id).catch(() => null);
	const streakRow = await db.ensureMemberStreak(member.id, opts.tzKnown !== false ? tzOffsetMin : undefined).catch(() => null);
	const loginRow = await db.ensureMemberClaim(member.id).catch(() => null);
	const baselines = taskBaselines(levels);
	const catalog = await loadCatalog(server.id, opts.itemsEnabled, tzOffsetMin);
	const eligibility = await taskEligibility(opts, { catalog, baselines });

	if (opts.generate !== false && (await needsGeneration(member.id, dayKey, weekKey))) {
		const history = await loadMemberHistory(member.id, eligibility, nowMs);
		eligibility.recentDaily = history.recentDaily;
		eligibility.recentPeak = history.recentPeak;
	}

	const shared = {
		member,
		serverId: server.id,
		eligibility,
		baselines,
		catalog,
		currentStreak: Number(streakRow?.current_streak) || 0,
		generate: opts.generate !== false
	};
	const daily = await buildPeriod({ ...shared, period: 'daily', periodKey: dayKey, windowStartMs: dayKey * MINUTE_MS });
	const weekly = await buildPeriod({ ...shared, period: 'weekly', periodKey: weekKey, windowStartMs: weekKey * MINUTE_MS });

	const isCompletedToday = daily.some((t) => t.complete) || weekly.some((t) => t.complete);
	const earnedStreak =
		daily.length > 0 && isCompletedToday && Number(streakRow?.last_claim_day_key) !== dayKey
			? await db.applyStreakDay(member.id, { dayKey, freezeMax: STREAK_FREEZE_MAX, earnEvery: STREAK_FREEZE_EARN_EVERY }).catch(() => null)
			: null;

	return {
		dayKey,
		weekKey,
		resetsInMs: msUntilPeriodEnds(dayKey, 'daily', nowMs),
		weeklyResetsInMs: msUntilPeriodEnds(weekKey, 'weekly', nowMs),
		daily,
		weekly,
		tasks: daily,
		streak: shapeStreak(earnedStreak?.row ?? streakRow),
		streakEarned: !!earnedStreak?.changed,
		streakMilestone: earnedStreak?.changed ? streakMilestone(Number(earnedStreak.streak) || 0) : null,
		login: shapeLogin(loginRow, nowMs, catalog),
		reelPool: reelPool(catalog),
		allClaimed: daily.length > 0 && daily.every((t) => t.claimed),
		empty: daily.length === 0 && weekly.length === 0
	};
}

export async function memberDailyEarn(memberId: number | string): Promise<number> {
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * DAY_MS;
	const total = await db.countMemberEventsSince(memberId, { metric: 'xp_gained', sinceMs }).catch(() => 0);
	return Math.max(0, Number(total) || 0) / RECENT_WINDOW_DAYS;
}

function shapeLogin(row: Record<string, unknown> | null, nowMs: number, catalog: { id: number; cost: number }[]) {
	const cycleDay = Number(row?.cycle_day) || 0;
	const last = row?.last_claim_day_key == null ? null : Number(row.last_claim_day_key);
	const cyclesCompleted = Number(row?.cycles_completed) || 0;

	const isBroken = loginCycleBroken(last, nowMs);
	const nextDay = isBroken || cycleDay >= LOGIN_CYCLE_DAYS ? 1 : cycleDay + 1;
	const readyInMs = loginReadyInMs(last, nowMs);
	const isClaimedToday = readyInMs > 0;
	const canClaim = !isClaimedToday;

	const rewards = loginCyclePreview().map((r) => ({
		...r,
		claimed: !isClaimedToday && r.day < nextDay ? true : isClaimedToday && r.day <= cycleDay,
		current: canClaim && r.day === nextDay,
		odds: loginTierOddsFor(catalog, r.day)
	}));

	return {
		cycleDay,
		nextDay,
		claimedToday: isClaimedToday,
		canClaim,
		readyInMs,
		cycleDays: LOGIN_CYCLE_DAYS,
		cyclesCompleted,
		rewards
	};
}

function shapeStreak(row: Record<string, unknown> | null) {
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
