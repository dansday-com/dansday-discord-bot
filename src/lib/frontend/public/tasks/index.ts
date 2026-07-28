import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';
import { effectIcon, effectAccentHex, itemAvailability } from '$lib/items.js';
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
	goalForReward,
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
	rarityTierFor,
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

async function loadCatalog(serverId: any, itemsEnabled: boolean, tzOffsetMin = 0) {
	if (!itemsEnabled) return [];
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) return [];
	const all = (await db.listItems(panelId).catch(() => [])) as any[];
	const nowMs = Date.now();
	return all
		.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0)
		.filter((i) => {
			const state = itemAvailability(i, nowMs, tzOffsetMin).state;
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
				successChance: Math.max(0, Math.min(100, Number(cfg?.spy_chance ?? 100)))
			};
		});
}

async function loadLevelingRates(serverId: any): Promise<LevelingRates> {
	const rowOrRows = await db.getServerSettings(serverId, 'leveling').catch(() => null);
	const row = Array.isArray(rowOrRows) ? (rowOrRows[0] ?? null) : rowOrRows;
	const raw = (row as any)?.settings;
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
		if (!c.effectType || c.durationMinutes <= 0) continue;
		const prev = out[c.effectType];
		if (prev == null || c.durationMinutes > prev) out[c.effectType] = c.durationMinutes;
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

async function needsGeneration(memberId: any, dayKey: number, weekKey: number): Promise<boolean> {
	const daily = (await db.getMemberTasks(memberId, dayKey, 'daily').catch(() => [])) as any[];
	if (!daily || daily.length === 0) return true;
	const weekly = (await db.getMemberTasks(memberId, weekKey, 'weekly').catch(() => [])) as any[];
	return !weekly || weekly.length === 0;
}

async function loadMemberHistory(memberId: any, elig: TaskEligibility, nowMs: number) {
	const sinceMs = nowMs - RECENT_WINDOW_DAYS * 86400000;
	const metrics = historyMetricsFor(elig);

	const recentDaily: Partial<Record<TaskMetric, number>> = {};
	const recentPeak: Partial<Record<TaskMetric, number>> = {};

	const counted = await Promise.all(
		metrics.map(async (metric) => ({
			metric,
			total: await db.countMemberEventsSince(memberId, metric, sinceMs).catch(() => 0)
		}))
	);

	for (const { metric, total } of counted) {
		const value = Number(total) || 0;
		if (value <= 0) continue;
		if (PEAK_METRICS.has(metric)) recentPeak[metric] = value;
		else recentDaily[metric] = value / RECENT_WINDOW_DAYS;
	}

	return { recentDaily, recentPeak };
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
		const generated = generateDailyTasks(Number(member.id), Number(serverId), periodKey, eligibility, period);
		if (generated.length === 0) return [];

		const payload = generated.map((g) => {
			const def = TASK_BY_ID.get(g.taskType);
			const targetCost = g.targetItemId != null ? Number(catalog.find((c) => c.id === g.targetItemId)?.cost) || 0 : 0;
			const value = def ? taskValueXp(def, g.goal, g.difficulty, currentStreak, eligibility, period, targetCost) : XP_REWARD_MIN;
			const spend = def ? taskCostXp(def, g.goal, eligibility, targetCost) : 0;
			const draft = pickReward(Number(member.id), periodKey, g.slot, g.difficulty, value, catalog, period, spend);

			const draftWorth = draft.kind === 'item' ? Number(catalog.find((c) => c.id === draft.itemId)?.cost) || 0 : draft.xp;
			const goal = def ? goalForReward(def, g.goal, draftWorth, g.difficulty, eligibility, period, targetCost, g.targetItemId ?? null) : g.goal;

			const finalSpend = def ? taskCostXp(def, goal, eligibility, targetCost) : 0;
			const finalValue = def ? taskValueXp(def, goal, g.difficulty, currentStreak, eligibility, period, targetCost) : XP_REWARD_MIN;
			const reward = finalSpend > draftWorth ? pickReward(Number(member.id), periodKey, g.slot, g.difficulty, finalValue, catalog, period, finalSpend) : draft;

			const metric = def?.metric as TaskMetric | undefined;
			const baseline = metric && COUNTER_METRICS.has(metric) ? Number(baselines[metric]) || 0 : 0;
			return {
				slot: g.slot,
				taskType: g.taskType,
				difficulty: g.difficulty,
				goal,
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
	tzKnown?: boolean;
}) {
	const { server, member, itemsEnabled, minigamesEnabled, tzOffsetMin } = opts;
	const assetsEnabled = opts.assetsEnabled === true;
	const nowMs = opts.nowMs ?? Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	const weekKey = weekKeyFor(nowMs, tzOffsetMin);
	const dayStartMs = dayKey * 86400000 + tzOffsetMin * 60000;
	const weekStartMs = weekStartDayKey(weekKey) * 86400000 + tzOffsetMin * 60000;

	const levels = (await db.ensureMemberLevel(member.id).catch(() => null)) as any;
	const streakRow = (await db.ensureMemberStreak(member.id, opts.tzKnown !== false ? tzOffsetMin : undefined).catch(() => null)) as any;
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

	const catalog = await loadCatalog(server.id, itemsEnabled, tzOffsetMin);
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
		effectDurations: longestByEffect(catalog),
		levelingRates: await loadLevelingRates(server.id),
		memberCount: await db.countServerMembers(server.id).catch(() => 0)
	};

	if (opts.generate !== false && (await needsGeneration(member.id, dayKey, weekKey))) {
		const history = await loadMemberHistory(member.id, eligibility, nowMs);
		eligibility.recentDaily = history.recentDaily;
		eligibility.recentPeak = history.recentPeak;
	}

	const currentStreak = Number(streakRow?.current_streak) || 0;

	const shared = { member, serverId: server.id, eligibility, baselines, catalog, currentStreak, generate: opts.generate !== false };
	const daily = await buildPeriod({ ...shared, period: 'daily', periodKey: dayKey, windowStartMs: dayStartMs });
	const weekly = await buildPeriod({ ...shared, period: 'weekly', periodKey: weekKey, windowStartMs: weekStartMs });

	const completedToday = daily.some((t) => t.complete) || weekly.some((t) => t.complete);
	const earnedStreak =
		completedToday && Number(streakRow?.last_claim_day_key) !== dayKey
			? await db.applyStreakDay(member.id, dayKey, STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_EVERY).catch(() => null)
			: null;

	return {
		dayKey,
		weekKey,
		resetsInMs: msUntilNextDay(nowMs, tzOffsetMin),
		weeklyResetsInMs: msUntilNextWeek(nowMs, tzOffsetMin),
		daily,
		weekly,
		tasks: daily,
		streak: shapeStreak(earnedStreak?.row ?? streakRow),
		streakEarned: !!earnedStreak?.changed,
		streakMilestone: earnedStreak?.changed ? streakMilestone(Number(earnedStreak.streak) || 0) : null,
		login: shapeLogin(loginRow, member, dayKey, catalog, await memberDailyEarn(member.id), opts.tzKnown !== false),
		reelPool: (() => {
			const costs = catalog.map((c) => c.cost);
			return [...catalog]
				.sort((a, b) => a.cost - b.cost)
				.map((c) => ({ name: c.name, cost: c.cost, effectType: c.effectType, tier: rarityTierFor(c.cost, costs) }));
		})(),
		allClaimed: daily.length > 0 && daily.every((t) => t.claimed),
		empty: daily.length === 0 && weekly.length === 0
	};
}

export async function memberDailyEarn(memberId: any): Promise<number> {
	const sinceMs = Date.now() - RECENT_WINDOW_DAYS * 86400000;
	const total = await db.countMemberEventsSince(memberId, 'xp_gained', sinceMs).catch(() => 0);
	return Math.max(0, Number(total) || 0) / RECENT_WINDOW_DAYS;
}

function shapeLogin(row: any, member: any, dayKey: number, catalog: { id: number; cost: number }[], dailyEarn = 0, tzKnown = true) {
	const cycleDay = Number(row?.cycle_day) || 0;
	const last = row?.last_claim_day_key == null ? null : Number(row.last_claim_day_key);
	const cyclesCompleted = Number(row?.cycles_completed) || 0;

	const broken = last != null && last < dayKey - 1;
	const nextDay = broken || cycleDay >= LOGIN_CYCLE_DAYS ? 1 : cycleDay + 1;
	const claimedToday = last === dayKey;
	const canClaim = tzKnown && !claimedToday;

	const rewards = loginCyclePreview(Number(member.id), cyclesCompleted, catalog, dailyEarn).map((r) => ({
		...r,
		claimed: !claimedToday && r.day < nextDay ? true : claimedToday && r.day <= cycleDay,
		current: canClaim && r.day === nextDay
	}));

	return {
		cycleDay,
		nextDay,
		claimedToday,
		canClaim,
		tzKnown,
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
