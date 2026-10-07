export const MAX_REWARDS = 25;
export const MAX_REWARD_LEVEL = 1000;

export type Reward = { level: number; role_id: string };

export type RewardRules = {
	rewards: Reward[];
	keep: boolean;
	stack: boolean;
};

export const REWARD_KEYS = {
	rewards: 'rewards',
	keep: 'rewards_keep',
	stack: 'rewards_stack'
} as const;

export const DEFAULT_REWARD_SETTINGS = {
	[REWARD_KEYS.rewards]: [] as Reward[],
	[REWARD_KEYS.keep]: true,
	[REWARD_KEYS.stack]: true
};

const SNOWFLAKE = /^\d{17,20}$/;

export function normalizeRewards(raw: unknown): Reward[] {
	if (!Array.isArray(raw)) return [];
	const byRole = new Map<string, Reward>();
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const entry = item as Record<string, unknown>;
		const roleId = String(entry.role_id ?? '').trim();
		if (!SNOWFLAKE.test(roleId)) continue;
		const level = Math.trunc(Number(entry.level));
		if (!Number.isFinite(level) || level < 2 || level > MAX_REWARD_LEVEL) continue;
		const existing = byRole.get(roleId);
		if (!existing || level < existing.level) byRole.set(roleId, { level, role_id: roleId });
	}
	return [...byRole.values()].sort((a, b) => a.level - b.level).slice(0, MAX_REWARDS);
}

export function rewardsFromSettings(settings: unknown): RewardRules {
	const base = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
	return {
		rewards: normalizeRewards(base[REWARD_KEYS.rewards]),
		keep: base[REWARD_KEYS.keep] !== false,
		stack: base[REWARD_KEYS.stack] !== false
	};
}

export function rewardEffectiveLevel(rules: RewardRules, level: number, heldRoleIds: Iterable<string>): number {
	if (!rules.keep) return level;
	const held = new Set(heldRoleIds);
	return rules.rewards.reduce((top, r) => (held.has(r.role_id) ? Math.max(top, r.level) : top), level);
}

export function rewardTargetRoleIds(rules: RewardRules, effectiveLevel: number): Set<string> {
	const earned = rules.rewards.filter((r) => r.level <= effectiveLevel);
	if (earned.length === 0) return new Set();
	const top = earned[earned.length - 1].level;
	return new Set((rules.stack ? earned : earned.filter((r) => r.level === top)).map((r) => r.role_id));
}

export function planRewardRoles(rules: RewardRules, level: number, heldRoleIds: Iterable<string>): { add: string[]; remove: string[] } {
	if (rules.rewards.length === 0) return { add: [], remove: [] };
	const held = new Set(heldRoleIds);
	const target = rewardTargetRoleIds(rules, rewardEffectiveLevel(rules, level, held));
	return {
		add: [...target].filter((id) => !held.has(id)),
		remove: rules.rewards.map((r) => r.role_id).filter((id) => held.has(id) && !target.has(id))
	};
}

export function xpForLevel(level: number, baseXp: number, multiplier: number): number {
	if (level <= 1) return 0;
	if (multiplier === 1) return Math.ceil(baseXp * (level - 1));
	return Math.ceil((baseXp * (Math.pow(multiplier, level - 1) - 1)) / (multiplier - 1));
}
