export const MAX_REWARDS = 25;
export const MAX_REWARD_LEVEL = 1000;
export const MAX_REWARD_GOAL = 10_000_000;
export const MAX_REWARD_XP = 10_000_000;
export const MAX_REWARD_NAME = 64;
export const MAX_REWARD_WINNERS = 100_000;
export const REWARD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const REWARD_GOALS = [
	{ id: 'level', label: 'Level', icon: 'fa-star', column: 'level', perUnit: 1, min: 2, max: MAX_REWARD_LEVEL },
	{ id: 'chat', label: 'Messages', icon: 'fa-message', column: 'chat_total', perUnit: 1, min: 1, max: MAX_REWARD_GOAL },
	{ id: 'voice', label: 'Voice hours', icon: 'fa-microphone', column: 'voice_minutes_active', perUnit: 60, min: 1, max: 100_000 },
	{ id: 'video', label: 'Video hours', icon: 'fa-video', column: 'voice_minutes_video', perUnit: 60, min: 1, max: 100_000 },
	{ id: 'stream', label: 'Streaming hours', icon: 'fa-tower-broadcast', column: 'voice_minutes_streaming', perUnit: 60, min: 1, max: 100_000 }
] as const;

export const REWARD_KINDS = [
	{ id: 'role', label: 'Role', icon: 'fa-user-tag' },
	{ id: 'xp', label: 'XP', icon: 'fa-bolt' },
	{ id: 'custom', label: 'Custom', icon: 'fa-gift' }
] as const;

export type RewardGoal = (typeof REWARD_GOALS)[number]['id'];
export type RewardKind = (typeof REWARD_KINDS)[number]['id'];

export type Reward = {
	id: number;
	goal_type: RewardGoal;
	goal: number;
	kind: RewardKind;
	role_id: string | null;
	xp: number;
	name: string | null;
	image: string | null;
	winner_limit: number | null;
};

export type RewardDraft = Omit<Reward, 'id'> & { id: number | null };

export type RewardRules = {
	rewards: Reward[];
	keep: boolean;
	stack: boolean;
};

export type RewardProgress = Record<RewardGoal, number>;
export type RewardEarning = { delivered: boolean };
export type RewardState = 'locked' | 'earned' | 'delivered' | 'replaced' | 'gone' | 'passed';

export const REWARD_KEYS = {
	keep: 'rewards_keep',
	stack: 'rewards_stack'
} as const;

export const DEFAULT_REWARD_SETTINGS = {
	[REWARD_KEYS.keep]: true,
	[REWARD_KEYS.stack]: true
};

const SNOWFLAKE = /^\d{17,20}$/;
const GOAL_BY_ID = new Map<string, (typeof REWARD_GOALS)[number]>(REWARD_GOALS.map((g) => [g.id, g]));
const KIND_IDS = new Set<string>(REWARD_KINDS.map((k) => k.id));

export function rewardGoalMeta(goalType: string) {
	return GOAL_BY_ID.get(goalType) ?? REWARD_GOALS[0];
}

export function rewardGoalUnits(reward: { goal_type: string; goal: number }): number {
	return Math.round((Number(reward.goal) || 0) / rewardGoalMeta(reward.goal_type).perUnit);
}

export function rewardGoalLabel(reward: { goal_type: string; goal: number }): string {
	const units = rewardGoalUnits(reward).toLocaleString();
	if (reward.goal_type === 'level') return `Level ${units}`;
	if (reward.goal_type === 'chat') return `${units} messages`;
	if (reward.goal_type === 'voice') return `${units} voice hours`;
	if (reward.goal_type === 'video') return `${units} video hours`;
	return `${units} streaming hours`;
}

export function sortRewards<T extends { goal_type: string; goal: number }>(rewards: T[]): T[] {
	const order = new Map<string, number>(REWARD_GOALS.map((g, i) => [g.id, i]));
	return [...rewards].sort((x, y) => (order.get(x.goal_type) ?? 0) - (order.get(y.goal_type) ?? 0) || x.goal - y.goal);
}

export function rewardProgress(stats: Record<string, unknown> | null | undefined): RewardProgress {
	const out = {} as RewardProgress;
	for (const g of REWARD_GOALS) out[g.id] = Math.max(0, Math.floor(Number(stats?.[g.column]) || 0));
	if (out.level < 1) out.level = 1;
	return out;
}

export function rewardRuleFlags(settings: unknown): { keep: boolean; stack: boolean } {
	const base = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
	return { keep: base[REWARD_KEYS.keep] !== false, stack: base[REWARD_KEYS.stack] !== false };
}

export function normalizeRewardDrafts(raw: unknown, knownRoleIds: Set<string>): { rewards: RewardDraft[]; error: string | null } {
	if (!Array.isArray(raw)) return { rewards: [], error: null };
	if (raw.length > MAX_REWARDS) return { rewards: [], error: `A server can have up to ${MAX_REWARDS} rewards.` };
	const rewards: RewardDraft[] = [];
	const roles = new Set<string>();
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const entry = item as Record<string, unknown>;
		const meta = GOAL_BY_ID.get(String(entry.goal_type ?? ''));
		if (!meta) return { rewards: [], error: 'Pick a goal for every reward.' };
		const units = Math.trunc(Number(entry.units));
		if (!Number.isFinite(units) || units < meta.min || units > meta.max)
			return { rewards: [], error: `${meta.label} goes from ${meta.min} to ${meta.max.toLocaleString()}.` };
		const kind = String(entry.kind ?? '');
		if (!KIND_IDS.has(kind)) return { rewards: [], error: 'Pick what every reward gives.' };

		const id = Number(entry.id);
		const limit = entry.winner_limit === null || entry.winner_limit === undefined || entry.winner_limit === '' ? null : Math.trunc(Number(entry.winner_limit));
		if (limit !== null && (!Number.isFinite(limit) || limit < 1 || limit > MAX_REWARD_WINNERS))
			return { rewards: [], error: `A winner limit goes from 1 to ${MAX_REWARD_WINNERS.toLocaleString()}.` };

		const draft: RewardDraft = {
			id: Number.isInteger(id) && id > 0 ? id : null,
			goal_type: meta.id,
			goal: units * meta.perUnit,
			kind: kind as RewardKind,
			role_id: null,
			xp: 0,
			name: null,
			image: null,
			winner_limit: limit
		};

		if (draft.kind === 'role') {
			const roleId = String(entry.role_id ?? '').trim();
			if (!SNOWFLAKE.test(roleId) || !knownRoleIds.has(roleId)) return { rewards: [], error: 'Pick a role for every role reward.' };
			if (roles.has(roleId)) return { rewards: [], error: 'Each role can only be one reward.' };
			roles.add(roleId);
			draft.role_id = roleId;
		} else if (draft.kind === 'xp') {
			const xp = Math.trunc(Number(entry.xp));
			if (!Number.isFinite(xp) || xp < 1 || xp > MAX_REWARD_XP) return { rewards: [], error: `XP rewards go from 1 to ${MAX_REWARD_XP.toLocaleString()}.` };
			draft.xp = xp;
		} else {
			const name = String(entry.name ?? '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, MAX_REWARD_NAME);
			if (!name) return { rewards: [], error: 'Name every custom reward.' };
			draft.name = name;
			draft.image = typeof entry.image === 'string' && entry.image ? entry.image : null;
		}
		rewards.push(draft);
	}
	return { rewards, error: null };
}

type Standing = { reward: Reward; reached: boolean; active: boolean; settled: boolean; earned: boolean };

function standings(rules: RewardRules, progress: RewardProgress, heldRoleIds: Iterable<string>, earnings: Map<number, RewardEarning>): Standing[] {
	const held = new Set(heldRoleIds);
	const out: Standing[] = [];
	for (const goal of REWARD_GOALS) {
		const ladder = rules.rewards.filter((r) => r.goal_type === goal.id);
		if (ladder.length === 0) continue;
		const value = progress[goal.id] ?? 0;
		const wears = (r: Reward) => r.kind === 'role' && r.winner_limit === null && !!r.role_id && held.has(r.role_id);
		const roleValue = rules.keep ? ladder.reduce((top, r) => (wears(r) ? Math.max(top, r.goal) : top), value) : value;

		const rows = ladder.map((reward) => {
			const row = earnings.get(reward.id);
			const settled = !!row && (reward.kind === 'xp' || row.delivered);
			const kept = !!row && (rules.keep || value >= reward.goal);
			const reached =
				settled ||
				(reward.winner_limit !== null
					? kept
					: reward.kind === 'role'
						? roleValue >= reward.goal
						: reward.kind === 'custom' && row
							? kept
							: value >= reward.goal);
			return { reward, reached, active: reached, settled, earned: !!row };
		});

		if (!rules.stack) {
			const top = rows.reduce((max, s) => (s.reached && s.reward.kind !== 'xp' ? Math.max(max, s.reward.goal) : max), 0);
			for (const s of rows) if (s.reward.kind !== 'xp' && !s.settled) s.active = s.reached && s.reward.goal === top;
		}
		out.push(...rows);
	}
	return out;
}

export function limitedRewardCandidates(
	rules: RewardRules,
	progress: RewardProgress,
	earnings: Map<number, RewardEarning>,
	before: Partial<RewardProgress> | null | undefined
): Reward[] {
	if (!before) return [];
	return rules.rewards.filter((r) => {
		if (r.winner_limit === null || earnings.has(r.id)) return false;
		const was = before[r.goal_type];
		return was !== undefined && was < r.goal && (progress[r.goal_type] ?? 0) >= r.goal;
	});
}

export function planRewards(
	rules: RewardRules,
	progress: RewardProgress,
	heldRoleIds: Iterable<string>,
	earnings: Map<number, RewardEarning>
): { addRoles: string[]; removeRoles: string[]; earn: Reward[]; withdraw: Reward[] } {
	const held = new Set(heldRoleIds);
	const target = new Set<string>();
	const earn: Reward[] = [];
	const withdraw: Reward[] = [];
	for (const s of standings(rules, progress, held, earnings)) {
		const r = s.reward;
		if (r.kind === 'role') {
			if (s.active && r.role_id) target.add(r.role_id);
			if (r.winner_limit !== null && s.earned && !s.active) withdraw.push(r);
		} else if (r.kind === 'xp') {
			if (s.reached && !s.earned && r.winner_limit === null) earn.push(r);
		} else if (s.active && !s.earned && r.winner_limit === null) {
			earn.push(r);
		} else if (s.earned && !s.settled && !s.active) {
			withdraw.push(r);
		}
	}
	const rewardRoles = rules.rewards.filter((r) => r.kind === 'role' && r.role_id).map((r) => r.role_id as string);
	return {
		addRoles: [...target].filter((id) => !held.has(id)),
		removeRoles: rewardRoles.filter((id) => held.has(id) && !target.has(id)),
		earn,
		withdraw
	};
}

export function rewardStates(
	rules: RewardRules,
	progress: RewardProgress,
	heldRoleIds: Iterable<string>,
	earnings: Map<number, RewardEarning>,
	winners: Map<number, number>
): Map<number, RewardState> {
	const out = new Map<number, RewardState>();
	for (const s of standings(rules, progress, heldRoleIds, earnings)) {
		const r = s.reward;
		const full = r.winner_limit !== null && !s.earned && (winners.get(r.id) ?? 0) >= r.winner_limit;
		if (full) out.set(r.id, 'gone');
		else if (r.winner_limit !== null && !s.earned) out.set(r.id, (progress[r.goal_type] ?? 0) >= r.goal ? 'passed' : 'locked');
		else if (!s.reached) out.set(r.id, 'locked');
		else if (!s.active) out.set(r.id, 'replaced');
		else if (r.kind === 'custom') out.set(r.id, s.settled ? 'delivered' : 'earned');
		else out.set(r.id, 'earned');
	}
	return out;
}

export function xpForLevel(level: number, baseXp: number, multiplier: number): number {
	if (level <= 1) return 0;
	if (multiplier === 1) return Math.ceil(baseXp * (level - 1));
	return Math.ceil((baseXp * (Math.pow(multiplier, level - 1) - 1)) / (multiplier - 1));
}
