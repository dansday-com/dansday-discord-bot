export const LEADERBOARD_METRICS = [
	'xp',
	'chat',
	'voice_total',
	'voice_active',
	'voice_afk',
	'video',
	'streaming',
	'minigames_gamble_net',
	'minigames_gamble_ratio',
	'minigames_gamble_big',
	'minigames_tower_net',
	'minigames_tower_ratio',
	'minigames_tower_big',
	'minigames_color_net',
	'minigames_color_avg',
	'minigames_color_best',
	'items_bounty_total',
	'items_bounty_claimer',
	'items_bounty_give',
	'items_steal_total',
	'items_steal_rate',
	'items_steal_big',
	'items_bomb_total',
	'items_bomb_rate',
	'items_bomb_big',
	'items_gift_give',
	'items_gift_receive',
	'invites'
] as const;

export const LEADERBOARD_PERIODS = ['all', 'month', 'week'] as const;

const LEADERBOARD_MIN_LIMIT = 3;
const LEADERBOARD_MAX_LIMIT = 50;

export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

function oneOf<T extends string>(allowed: readonly T[], value: string): value is T {
	return (allowed as readonly string[]).includes(value);
}

export function parseLeaderboardMetric(value: string | null): LeaderboardMetric {
	const metric = (value || 'xp').toLowerCase();
	return oneOf(LEADERBOARD_METRICS, metric) ? metric : 'xp';
}

export function parseLeaderboardPeriod(value: string | null): LeaderboardPeriod {
	const period = (value || 'all').toLowerCase();
	return oneOf(LEADERBOARD_PERIODS, period) ? period : 'all';
}

export function parseLeaderboardLimit(value: string | null): number {
	return Math.max(LEADERBOARD_MIN_LIMIT, Math.min(LEADERBOARD_MAX_LIMIT, Number(value || LEADERBOARD_MAX_LIMIT)));
}
