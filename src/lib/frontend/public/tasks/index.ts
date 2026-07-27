import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';
import {
	TASK_BY_ID,
	DAILY_TASK_SLOTS,
	STREAK_FREEZE_MAX,
	STREAK_FREEZE_EARN_EVERY,
	dayKeyFor,
	msUntilNextDay,
	generateDailyTasks,
	pickReward,
	nextMilestone,
	type TaskEligibility,
	type TaskMetric
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

export async function loadTasksShared(opts: {
	server: any;
	member: any;
	itemsEnabled: boolean;
	minigamesEnabled: boolean;
	tzOffsetMin: number;
	nowMs?: number;
}) {
	const { server, member, itemsEnabled, minigamesEnabled, tzOffsetMin } = opts;
	const nowMs = opts.nowMs ?? Date.now();
	const dayKey = dayKeyFor(nowMs, tzOffsetMin);
	const dayStartMs = dayKey * 86400000 + tzOffsetMin * 60000;

	const levels = (await db.ensureMemberLevel(member.id).catch(() => null)) as any;
	const streakRow = (await db.ensureMemberStreak(member.id).catch(() => null)) as any;

	const baselines: Partial<Record<TaskMetric, number>> = {
		chat_total: Number(levels?.chat_total) || 0,
		reactions_given: Number(levels?.reactions_given) || 0,
		voice_minutes_active: Number(levels?.voice_minutes_active) || 0,
		voice_minutes_afk: Number(levels?.voice_minutes_afk) || 0,
		voice_minutes_video: Number(levels?.voice_minutes_video) || 0,
		voice_minutes_streaming: Number(levels?.voice_minutes_streaming) || 0
	};

	const eligibility: TaskEligibility = {
		levelingEnabled: true,
		minigamesEnabled,
		itemsEnabled,
		baselines,
		activeDays: daysActive(member.member_since)
	};

	let rows = (await db.getMemberDailyTasks(member.id, dayKey).catch(() => [])) as any[];

	if (!rows || rows.length === 0) {
		const generated = generateDailyTasks(Number(member.id), Number(server.id), dayKey, eligibility);
		if (generated.length === 0) {
			return {
				dayKey,
				resetsInMs: msUntilNextDay(nowMs, tzOffsetMin),
				tasks: [],
				streak: shapeStreak(streakRow),
				empty: true as const
			};
		}

		let catalog: { id: number; cost: number }[] = [];
		if (itemsEnabled) {
			const panelId = await db.getServerPanelId(server.id).catch(() => null);
			if (panelId != null) {
				const all = (await db.listItems(panelId).catch(() => [])) as any[];
				catalog = all
					.filter((i) => i.enabled !== false && i.enabled !== 0 && (Number(i.cost) || 0) > 0)
					.map((i) => ({ id: Number(i.id), cost: Number(i.cost) || 0 }));
			}
		}

		const currentStreak = Number(streakRow?.current_streak) || 0;
		const payload = generated.map((g) => {
			const reward = pickReward(Number(member.id), dayKey, g.slot, g.difficulty, currentStreak, catalog);
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

		rows = (await db.persistMemberDailyTasks(member.id, dayKey, payload).catch(() => [])) as any[];
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
			progress = await db.countMemberEventsSince(member.id, def.metric, dayStartMs).catch(() => 0);
		}

		const goal = Number(row.goal) || 1;
		const rewardItem = row.reward_item_id != null ? itemMap.get(Number(row.reward_item_id)) : null;

		tasks.push({
			slot: Number(row.slot),
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

	return {
		dayKey,
		resetsInMs: msUntilNextDay(nowMs, tzOffsetMin),
		tasks,
		streak: shapeStreak(streakRow),
		allClaimed: tasks.length > 0 && tasks.every((t) => t.claimed),
		empty: false as const
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
		slots: DAILY_TASK_SLOTS
	};
}
