export const DAILY_TASK_SLOTS = 5;
export const STREAK_FREEZE_MAX = 2;
export const STREAK_FREEZE_EARN_EVERY = 10;

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export type TaskMetric =
	| 'chat_total'
	| 'reactions_given'
	| 'voice_minutes_active'
	| 'voice_minutes_afk'
	| 'voice_minutes_video'
	| 'voice_minutes_streaming'
	| 'gamble_played'
	| 'gamble_won'
	| 'steal_success'
	| 'item_used'
	| 'item_bought';

export type TaskRequirement = 'leveling' | 'minigames' | 'items';

export type TaskDefinition = {
	id: string;
	metric: TaskMetric;
	label: string;
	icon: string;
	accent: string;
	unit: 'messages' | 'reactions' | 'minutes' | 'rounds' | 'wins' | 'members' | 'items';
	requires: TaskRequirement;
	difficulties: TaskDifficulty[];
	baselineKey: TaskMetric | null;
	minGoal: Record<TaskDifficulty, number>;
	maxGoal: Record<TaskDifficulty, number>;
	baselineShare: Record<TaskDifficulty, number>;
	describe: (goal: number) => string;
};

const RATIO = { easy: 0.35, medium: 0.75, hard: 1.35 } as const;

export const TASK_DEFINITIONS: TaskDefinition[] = [
	{
		id: 'chat',
		metric: 'chat_total',
		label: 'Chatter',
		icon: 'fa-comments',
		accent: '#245f73',
		unit: 'messages',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'chat_total',
		minGoal: { easy: 5, medium: 15, hard: 35 },
		maxGoal: { easy: 25, medium: 70, hard: 160 },
		baselineShare: RATIO,
		describe: (g) => `Send ${g} messages`
	},
	{
		id: 'react',
		metric: 'reactions_given',
		label: 'Reactor',
		icon: 'fa-face-smile',
		accent: '#c8911a',
		unit: 'reactions',
		requires: 'leveling',
		difficulties: ['easy', 'medium'],
		baselineKey: 'reactions_given',
		minGoal: { easy: 3, medium: 8, hard: 20 },
		maxGoal: { easy: 12, medium: 30, hard: 60 },
		baselineShare: RATIO,
		describe: (g) => `React to ${g} messages`
	},
	{
		id: 'voice',
		metric: 'voice_minutes_active',
		label: 'Voice time',
		icon: 'fa-microphone',
		accent: '#1f8a4c',
		unit: 'minutes',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'voice_minutes_active',
		minGoal: { easy: 5, medium: 20, hard: 45 },
		maxGoal: { easy: 20, medium: 60, hard: 150 },
		baselineShare: RATIO,
		describe: (g) => `Spend ${g} minutes in voice`
	},
	{
		id: 'video',
		metric: 'voice_minutes_video',
		label: 'On camera',
		icon: 'fa-video',
		accent: '#6d5bd0',
		unit: 'minutes',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'voice_minutes_video',
		minGoal: { easy: 3, medium: 10, hard: 25 },
		maxGoal: { easy: 15, medium: 40, hard: 90 },
		baselineShare: RATIO,
		describe: (g) => `Stay on camera for ${g} minutes`
	},
	{
		id: 'stream',
		metric: 'voice_minutes_streaming',
		label: 'Streaming',
		icon: 'fa-desktop',
		accent: '#b5651d',
		unit: 'minutes',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'voice_minutes_streaming',
		minGoal: { easy: 3, medium: 10, hard: 25 },
		maxGoal: { easy: 15, medium: 40, hard: 90 },
		baselineShare: RATIO,
		describe: (g) => `Stream for ${g} minutes`
	},
	{
		id: 'afk',
		metric: 'voice_minutes_afk',
		label: 'Idle hands',
		icon: 'fa-moon',
		accent: '#7a7f87',
		unit: 'minutes',
		requires: 'leveling',
		difficulties: ['easy'],
		baselineKey: 'voice_minutes_afk',
		minGoal: { easy: 10, medium: 25, hard: 60 },
		maxGoal: { easy: 45, medium: 90, hard: 180 },
		baselineShare: RATIO,
		describe: (g) => `Idle ${g} minutes in the AFK channel`
	},
	{
		id: 'gamble_play',
		metric: 'gamble_played',
		label: 'Roll the dice',
		icon: 'fa-dice',
		accent: '#2f6f9f',
		unit: 'rounds',
		requires: 'minigames',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 3, hard: 6 },
		maxGoal: { easy: 3, medium: 8, hard: 15 },
		baselineShare: RATIO,
		describe: (g) => (g === 1 ? 'Play a gamble round' : `Play ${g} gamble rounds`)
	},
	{
		id: 'gamble_win',
		metric: 'gamble_won',
		label: 'Lucky streak',
		icon: 'fa-clover',
		accent: '#1f8a4c',
		unit: 'wins',
		requires: 'minigames',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		describe: (g) => (g === 1 ? 'Win a gamble round' : `Win ${g} gamble rounds`)
	},
	{
		id: 'steal',
		metric: 'steal_success',
		label: 'Pickpocket',
		icon: 'fa-hand',
		accent: '#c0392b',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		describe: (g) => (g === 1 ? 'Successfully steal from a member' : `Successfully steal from ${g} members`)
	},
	{
		id: 'item_use',
		metric: 'item_used',
		label: 'Field test',
		icon: 'fa-wand-magic-sparkles',
		accent: '#8e44ad',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 8 },
		baselineShare: RATIO,
		describe: (g) => (g === 1 ? 'Use an item' : `Use ${g} items`)
	},
	{
		id: 'item_buy',
		metric: 'item_bought',
		label: 'Shopper',
		icon: 'fa-cart-shopping',
		accent: '#245f73',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		describe: (g) => (g === 1 ? 'Buy an item from the shop' : `Buy ${g} items from the shop`)
	}
];

export const TASK_BY_ID = new Map(TASK_DEFINITIONS.map((t) => [t.id, t]));

export const DIFFICULTY_META: Record<TaskDifficulty, { label: string; accent: string; weight: number }> = {
	easy: { label: 'Easy', accent: '#1f8a4c', weight: 1 },
	medium: { label: 'Medium', accent: '#c8911a', weight: 2.2 },
	hard: { label: 'Hard', accent: '#c0392b', weight: 4.5 }
};

export const DAILY_DIFFICULTY_PLAN: TaskDifficulty[] = ['easy', 'easy', 'medium', 'medium', 'hard'];

export function dayKeyFor(nowMs: number, tzOffsetMin = 0): number {
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	return Math.floor((nowMs - offsetMs) / 86400000);
}

export function msUntilNextDay(nowMs: number, tzOffsetMin = 0): number {
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	const local = nowMs - offsetMs;
	return 86400000 - (((local % 86400000) + 86400000) % 86400000);
}

function hashSeed(...parts: (string | number)[]): number {
	let h = 2166136261;
	const str = parts.join(':');
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type TaskEligibility = {
	levelingEnabled: boolean;
	minigamesEnabled: boolean;
	itemsEnabled: boolean;
	baselines: Partial<Record<TaskMetric, number>>;
	activeDays: number;
};

function isEligible(def: TaskDefinition, elig: TaskEligibility): boolean {
	if (def.requires === 'leveling' && !elig.levelingEnabled) return false;
	if (def.requires === 'minigames' && !elig.minigamesEnabled) return false;
	if (def.requires === 'items' && !elig.itemsEnabled) return false;

	if (def.baselineKey) {
		const total = Number(elig.baselines[def.baselineKey]) || 0;
		if (total <= 0 && def.metric !== 'chat_total' && def.metric !== 'reactions_given') return false;
	}
	return true;
}

export function goalFor(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, rand: () => number): number {
	const min = def.minGoal[difficulty];
	const max = def.maxGoal[difficulty];

	let target = min;
	if (def.baselineKey) {
		const total = Number(elig.baselines[def.baselineKey]) || 0;
		const days = Math.max(1, elig.activeDays);
		const perDay = total / days;
		target = perDay * def.baselineShare[difficulty];
	} else {
		target = min + (max - min) * rand() * 0.6;
	}

	const jitter = 0.85 + rand() * 0.3;
	const scaled = Math.round(target * jitter);
	return Math.max(min, Math.min(max, scaled || min));
}

export type GeneratedTask = {
	slot: number;
	taskType: string;
	difficulty: TaskDifficulty;
	goal: number;
};

export function generateDailyTasks(memberId: number, serverId: number, dayKey: number, elig: TaskEligibility): GeneratedTask[] {
	const pool = TASK_DEFINITIONS.filter((d) => isEligible(d, elig));
	if (pool.length === 0) return [];

	const out: GeneratedTask[] = [];
	const used = new Set<string>();

	for (let slot = 0; slot < DAILY_TASK_SLOTS; slot++) {
		const wanted = DAILY_DIFFICULTY_PLAN[slot];
		const rand = mulberry32(hashSeed(memberId, serverId, dayKey, slot));

		let candidates = pool.filter((d) => d.difficulties.includes(wanted) && !used.has(d.id));
		let difficulty = wanted;

		if (candidates.length === 0) {
			candidates = pool.filter((d) => !used.has(d.id));
			if (candidates.length === 0) break;
			difficulty = candidates[0].difficulties.includes(wanted) ? wanted : candidates[0].difficulties[candidates[0].difficulties.length - 1];
		}

		const pick = candidates[Math.floor(rand() * candidates.length) % candidates.length];
		used.add(pick.id);

		out.push({ slot, taskType: pick.id, difficulty, goal: goalFor(pick, difficulty, elig, rand) });
	}

	return out;
}

export type RewardPlan = { kind: 'xp'; xp: number } | { kind: 'item'; itemId: number; xp: 0 };

export function xpRewardFor(difficulty: TaskDifficulty, streak: number, medianCost: number): number {
	const base = Math.max(40, Math.round(medianCost * 0.18));
	const scaled = base * DIFFICULTY_META[difficulty].weight;
	const streakBonus = 1 + Math.min(1, Math.max(0, streak) * 0.02);
	return Math.max(20, Math.round((scaled * streakBonus) / 10) * 10);
}

export function costPercentile(costs: number[], percentile: number): number {
	if (costs.length === 0) return 0;
	const sorted = [...costs].sort((a, b) => a - b);
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((percentile / 100) * (sorted.length - 1))));
	return sorted[idx];
}

export function pickReward(
	memberId: number,
	dayKey: number,
	slot: number,
	difficulty: TaskDifficulty,
	streak: number,
	catalog: { id: number; cost: number }[]
): RewardPlan {
	const costs = catalog.map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	const median = costPercentile(costs, 50) || 500;
	const rand = mulberry32(hashSeed('reward', memberId, dayKey, slot));

	const itemChance = difficulty === 'hard' ? 0.6 : difficulty === 'medium' ? 0.25 : 0.08;

	if (catalog.length > 0 && rand() < itemChance) {
		const band: Record<TaskDifficulty, [number, number]> = {
			easy: [0, 35],
			medium: [30, 70],
			hard: [65, 100]
		};
		const [lo, hi] = band[difficulty];
		const loCost = costPercentile(costs, lo);
		const hiCost = costPercentile(costs, hi);
		const inBand = catalog.filter((c) => {
			const v = Number(c.cost) || 0;
			return v >= loCost && v <= hiCost;
		});
		const chooseFrom = inBand.length > 0 ? inBand : catalog;
		const picked = chooseFrom[Math.floor(rand() * chooseFrom.length) % chooseFrom.length];
		if (picked) return { kind: 'item', itemId: picked.id, xp: 0 };
	}

	return { kind: 'xp', xp: xpRewardFor(difficulty, streak, median) };
}

export function streakMilestone(streak: number): { at: number; label: string; emoji: string } | null {
	const milestones = [
		{ at: 7, label: 'One week', emoji: '🔥' },
		{ at: 30, label: 'One month', emoji: '⚡' },
		{ at: 100, label: 'Century', emoji: '💎' },
		{ at: 365, label: 'One year', emoji: '👑' }
	];
	return milestones.find((m) => m.at === streak) ?? null;
}

export function nextMilestone(streak: number): { at: number; label: string; emoji: string } {
	const milestones = [
		{ at: 7, label: 'One week', emoji: '🔥' },
		{ at: 30, label: 'One month', emoji: '⚡' },
		{ at: 100, label: 'Century', emoji: '💎' },
		{ at: 365, label: 'One year', emoji: '👑' }
	];
	return milestones.find((m) => m.at > streak) ?? { at: streak + 100, label: 'Legend', emoji: '🌟' };
}
