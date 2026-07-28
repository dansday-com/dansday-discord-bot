export const DAILY_TASK_SLOTS = 9;
export const WEEKLY_TASK_SLOTS = 9;
export const STREAK_FREEZE_MAX = 2;
export const STREAK_FREEZE_EARN_EVERY = 10;
export const LOGIN_CYCLE_DAYS = 7;

export type TaskPeriod = 'daily' | 'weekly';
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
	| 'item_bought'
	| 'xp_gained'
	| 'xp_spent'
	| 'use_spy'
	| 'use_purifier'
	| 'use_shield'
	| 'use_boost'
	| 'use_luck'
	| 'use_gift'
	| 'use_bounty'
	| 'use_bomb'
	| 'use_disguise'
	| 'use_insurance'
	| 'asset_bought'
	| 'asset_sold'
	| 'asset_profit'
	| 'xp_from_voice'
	| 'xp_from_chat'
	| 'xp_from_media'
	| 'xp_stolen'
	| 'gamble_highroll'
	| 'gamble_purist'
	| 'gamble_bigwin'
	| 'gamble_wagered'
	| 'attack_any'
	| 'attack_success'
	| 'bomb_success'
	| 'leech_success'
	| 'use_leech'
	| 'use_reflect'
	| 'xp_from_voice_active'
	| 'xp_from_voice_afk'
	| 'discard_any'
	| 'discard_specific'
	| 'item_specific_used'
	| 'item_specific_bought'
	| 'item_specific_success'
	| 'spy_success'
	| 'bomb_masked'
	| 'steal_masked'
	| 'attack_masked'
	| 'buy_lucky'
	| 'use_lucky'
	| 'attack_lucky'
	| 'bounty_claimed'
	| 'gamble_lucky'
	| 'gamble_lucky_win'
	| 'duration_disguise'
	| 'duration_boost'
	| 'duration_shield'
	| 'duration_luck'
	| 'xp_with_friends'
	| 'friend_ticks'
	| 'friends_peak'
	| 'friends_peak_voice'
	| 'xp_solo'
	| 'xp_solo_voice'
	| 'xp_solo_media'
	| 'xp_solo_chat'
	| 'xp_unleeched';

export type TaskRequirement = 'leveling' | 'minigames' | 'items' | 'assets';

export type TaskDefinition = {
	id: string;
	metric: TaskMetric;
	label: string;
	icon: string;
	accent: string;
	unit: 'messages' | 'reactions' | 'minutes' | 'rounds' | 'wins' | 'members' | 'items' | 'xp' | 'times' | 'trades';
	requires: TaskRequirement;
	difficulties: TaskDifficulty[];
	baselineKey: TaskMetric | null;
	eligibilityKey?: TaskMetric;
	minGoal: Record<TaskDifficulty, number>;
	maxGoal: Record<TaskDifficulty, number>;
	baselineShare: Record<TaskDifficulty, number>;
	weeklyScale?: number;
	costEffect?: string;
	costFactor?: number;
	costIsGoal?: boolean;
	costFixedUnits?: number;
	costExtraEffect?: string;
	durationEffect?: string;
	targetsItem?: boolean;
	describe: (goal: number, ctx?: TaskDescribeContext) => string;
};

export type TaskDescribeContext = { itemName?: string | null };

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
		describe: (g) => `Idle ${g} minutes muted or deafened in voice`
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
		weeklyScale: 3,
		costEffect: '*',
		costFactor: 0.15,
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
		weeklyScale: 2.5,
		costEffect: '*',
		costFactor: 0.4,
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
		weeklyScale: 2.5,
		costEffect: 'steal',
		costFactor: 1.6,
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
		weeklyScale: 3,
		costEffect: '*',
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
		weeklyScale: 3,
		costEffect: '*',
		describe: (g) => (g === 1 ? 'Buy an item from the shop' : `Buy ${g} items from the shop`)
	},
	{
		id: 'xp_earn',
		metric: 'xp_gained',
		label: 'XP grind',
		icon: 'fa-bolt',
		accent: '#c8911a',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'xp_gained',
		minGoal: { easy: 500, medium: 2500, hard: 8000 },
		maxGoal: { easy: 2000, medium: 8000, hard: 30000 },
		baselineShare: RATIO,
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP`
	},
	{
		id: 'xp_burn',
		metric: 'xp_spent',
		label: 'Big spender',
		icon: 'fa-fire',
		accent: '#c0392b',
		unit: 'xp',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_gained',
		minGoal: { easy: 500, medium: 2000, hard: 6000 },
		maxGoal: { easy: 2000, medium: 8000, hard: 25000 },
		baselineShare: { easy: 0.25, medium: 0.7, hard: 1.6 },
		weeklyScale: 2.5,
		costIsGoal: true,
		describe: (g) => `Spend ${g.toLocaleString()} XP in the shop`
	},
	{
		id: 'use_spy',
		metric: 'use_spy',
		label: 'Recon',
		icon: 'fa-magnifying-glass',
		accent: '#5a9eb4',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 7 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'spy',
		describe: (g) => (g === 1 ? 'Spy on a member' : `Spy on ${g} members`)
	},
	{
		id: 'use_purifier',
		metric: 'use_purifier',
		label: 'Spring clean',
		icon: 'fa-broom',
		accent: '#3a9e8f',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'purifier',
		describe: (g) => (g === 1 ? 'Cleanse your effects with a Purifier' : `Use ${g} Purifiers`)
	},
	{
		id: 'use_shield',
		metric: 'use_shield',
		label: 'Turtle up',
		icon: 'fa-shield',
		accent: '#2f6f9f',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'shield',
		describe: (g) => (g === 1 ? 'Raise a Shield' : `Raise ${g} Shields`)
	},
	{
		id: 'use_boost',
		metric: 'use_boost',
		label: 'Overdrive',
		icon: 'fa-rocket',
		accent: '#8e44ad',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'boost',
		describe: (g) => (g === 1 ? 'Activate a Boost' : `Activate ${g} Boosts`)
	},
	{
		id: 'use_luck',
		metric: 'use_luck',
		label: 'Fortune favors',
		icon: 'fa-clover',
		accent: '#1f8a4c',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'luck',
		describe: (g) => (g === 1 ? 'Activate a Luck charm' : `Activate ${g} Luck charms`)
	},
	{
		id: 'use_gift',
		metric: 'use_gift',
		label: 'Generous',
		icon: 'fa-gift',
		accent: '#d4649a',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'gift',
		describe: (g) => (g === 1 ? 'Gift XP to a member' : `Gift XP to ${g} members`)
	},
	{
		id: 'use_bounty',
		metric: 'use_bounty',
		label: 'Wanted',
		icon: 'fa-crosshairs',
		accent: '#b5651d',
		unit: 'times',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'bounty',
		describe: (g) => (g === 1 ? 'Place a Bounty on someone' : `Place ${g} Bounties`)
	},
	{
		id: 'use_bomb',
		metric: 'use_bomb',
		label: 'Demolition',
		icon: 'fa-bomb',
		accent: '#d35400',
		unit: 'times',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'bomb',
		describe: (g) => (g === 1 ? 'Bomb a member' : `Bomb ${g} members`)
	},
	{
		id: 'use_disguise',
		metric: 'use_disguise',
		label: 'Ghost',
		icon: 'fa-mask',
		accent: '#6d5bd0',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'disguise',
		describe: (g) => (g === 1 ? 'Go incognito with a Disguise' : `Use ${g} Disguises`)
	},
	{
		id: 'use_insurance',
		metric: 'use_insurance',
		label: 'Covered',
		icon: 'fa-file-shield',
		accent: '#3a6d82',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'insurance',
		describe: (g) => (g === 1 ? 'Take out Insurance' : `Take out Insurance ${g} times`)
	},
	{
		id: 'asset_buy',
		metric: 'asset_bought',
		label: 'Investor',
		icon: 'fa-arrow-trend-up',
		accent: '#1f8a4c',
		unit: 'trades',
		requires: 'assets',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 8 },
		baselineShare: RATIO,
		weeklyScale: 3,
		describe: (g) => (g === 1 ? 'Open an asset position' : `Open ${g} asset positions`)
	},
	{
		id: 'asset_sell',
		metric: 'asset_sold',
		label: 'Take profit',
		icon: 'fa-money-bill-trend-up',
		accent: '#c8911a',
		unit: 'trades',
		requires: 'assets',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 8 },
		baselineShare: RATIO,
		weeklyScale: 3,
		describe: (g) => (g === 1 ? 'Close an asset position' : `Close ${g} asset positions`)
	},
	{
		id: 'asset_gain',
		metric: 'asset_profit',
		label: 'Green day',
		icon: 'fa-chart-line',
		accent: '#1f8a4c',
		unit: 'xp',
		requires: 'assets',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 100, medium: 500, hard: 2000 },
		maxGoal: { easy: 500, medium: 2500, hard: 10000 },
		baselineShare: RATIO,
		weeklyScale: 4,
		describe: (g) => `Make ${g.toLocaleString()} XP profit on trades`
	},
	{
		id: 'xp_voice',
		metric: 'xp_from_voice',
		label: 'Voice earner',
		icon: 'fa-headset',
		accent: '#1f8a4c',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'xp_from_voice',
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 300, medium: 1000, hard: 4000 },
		maxGoal: { easy: 1500, medium: 5000, hard: 20000 },
		baselineShare: { easy: 0.1, medium: 0.28, hard: 0.6 },
		weeklyScale: 3,
		describe: (g) => `Gain ${g.toLocaleString()} XP from voice (active or AFK)`
	},
	{
		id: 'xp_chat',
		metric: 'xp_from_chat',
		label: 'Chat earner',
		icon: 'fa-comment-dots',
		accent: '#245f73',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'xp_from_chat',
		eligibilityKey: 'chat_total',
		minGoal: { easy: 200, medium: 800, hard: 3000 },
		maxGoal: { easy: 1200, medium: 4000, hard: 15000 },
		baselineShare: { easy: 0.08, medium: 0.22, hard: 0.5 },
		weeklyScale: 3,
		describe: (g) => `Gain ${g.toLocaleString()} XP from chatting`
	},
	{
		id: 'xp_media',
		metric: 'xp_from_media',
		label: 'On air',
		icon: 'fa-photo-film',
		accent: '#6d5bd0',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_from_media',
		eligibilityKey: 'voice_minutes_video',
		minGoal: { easy: 200, medium: 800, hard: 3000 },
		maxGoal: { easy: 1200, medium: 4000, hard: 12000 },
		baselineShare: { easy: 0.08, medium: 0.2, hard: 0.45 },
		weeklyScale: 3,
		describe: (g) => `Gain ${g.toLocaleString()} XP from camera or streaming`
	},
	{
		id: 'gamble_high',
		metric: 'gamble_highroll',
		label: 'High roller',
		icon: 'fa-dice-five',
		accent: '#c8911a',
		unit: 'rounds',
		requires: 'minigames',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 3, hard: 6 },
		maxGoal: { easy: 3, medium: 7, hard: 12 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costFactor: 0.15,
		describe: (g) => (g === 1 ? 'Gamble once at 5× or higher' : `Gamble ${g} times at 5× or higher`)
	},
	{
		id: 'gamble_pure',
		metric: 'gamble_purist',
		label: 'No safety net',
		icon: 'fa-ban',
		accent: '#c0392b',
		unit: 'rounds',
		requires: 'minigames',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 5, hard: 9 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costFactor: 0.15,
		describe: (g) => `Gamble ${g} time${g === 1 ? '' : 's'} at 5× or higher with no Luck active`
	},
	{
		id: 'gamble_jackpot',
		metric: 'gamble_bigwin',
		label: 'Against the odds',
		icon: 'fa-trophy',
		accent: '#b5651d',
		unit: 'wins',
		requires: 'minigames',
		difficulties: ['hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 1 },
		maxGoal: { easy: 1, medium: 2, hard: 3 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: '*',
		costFactor: 0.8,
		describe: (g) => (g === 1 ? 'Win a gamble at 5× or higher' : `Win ${g} gambles at 5× or higher`)
	},
	{
		id: 'gamble_stake',
		metric: 'gamble_wagered',
		label: 'All in',
		icon: 'fa-coins',
		accent: '#2f6f9f',
		unit: 'xp',
		requires: 'minigames',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_gained',
		minGoal: { easy: 500, medium: 2000, hard: 8000 },
		maxGoal: { easy: 2000, medium: 10000, hard: 40000 },
		baselineShare: { easy: 0.3, medium: 0.8, hard: 2 },
		weeklyScale: 3,
		costIsGoal: true,
		costFactor: 0.2,
		describe: (g) => `Wager ${g.toLocaleString()} XP in total`
	},
	{
		id: 'attack_try',
		metric: 'attack_any',
		label: 'Aggressor',
		icon: 'fa-khanda',
		accent: '#d35400',
		unit: 'members',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 7 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'steal|bomb|leech',
		describe: (g) => `Attack ${g} member${g === 1 ? '' : 's'} — hit or miss`
	},
	{
		id: 'attack_land',
		metric: 'attack_success',
		label: 'Clean hit',
		icon: 'fa-bullseye',
		accent: '#c0392b',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'steal|bomb|leech',
		costFactor: 1.6,
		describe: (g) => `Land ${g} successful attack${g === 1 ? '' : 's'}`
	},
	{
		id: 'bomb_land',
		metric: 'bomb_success',
		label: 'Direct hit',
		icon: 'fa-explosion',
		accent: '#d35400',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'bomb',
		costFactor: 1.6,
		describe: (g) => (g === 1 ? 'Successfully bomb a member' : `Successfully bomb ${g} members`)
	},
	{
		id: 'leech_land',
		metric: 'leech_success',
		label: 'Bloodsucker',
		icon: 'fa-droplet',
		accent: '#a1343c',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'leech',
		costFactor: 1.5,
		describe: (g) => (g === 1 ? 'Successfully leech a member' : `Successfully leech ${g} members`)
	},
	{
		id: 'loot',
		metric: 'xp_stolen',
		label: 'Daylight robbery',
		icon: 'fa-sack-dollar',
		accent: '#c0392b',
		unit: 'xp',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 500, medium: 2000, hard: 8000 },
		maxGoal: { easy: 2000, medium: 10000, hard: 40000 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'steal',
		costFixedUnits: 4,
		describe: (g) => `Steal ${g.toLocaleString()} XP from other members`
	},
	{
		id: 'use_leech',
		metric: 'use_leech',
		label: 'Parasite',
		icon: 'fa-droplet',
		accent: '#a1343c',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'leech',
		describe: (g) => (g === 1 ? 'Attach a Leech to someone' : `Attach ${g} Leeches`)
	},
	{
		id: 'use_reflect',
		metric: 'use_reflect',
		label: 'Mirror armor',
		icon: 'fa-shield-halved',
		accent: '#5a9eb4',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'reflect',
		describe: (g) => (g === 1 ? 'Raise a Reflect' : `Raise ${g} Reflects`)
	},
	{
		id: 'xp_voice_active',
		metric: 'xp_from_voice_active',
		label: 'Talker',
		icon: 'fa-microphone-lines',
		accent: '#1f8a4c',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'xp_from_voice_active',
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 300, medium: 1000, hard: 4000 },
		maxGoal: { easy: 1500, medium: 5000, hard: 20000 },
		baselineShare: { easy: 0.08, medium: 0.22, hard: 0.5 },
		weeklyScale: 3,
		describe: (g) => `Gain ${g.toLocaleString()} XP from active voice only`
	},
	{
		id: 'xp_voice_afk',
		metric: 'xp_from_voice_afk',
		label: 'Professional idler',
		icon: 'fa-bed',
		accent: '#7a7f87',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium'],
		baselineKey: 'xp_from_voice_afk',
		eligibilityKey: 'voice_minutes_afk',
		minGoal: { easy: 200, medium: 800, hard: 3000 },
		maxGoal: { easy: 1000, medium: 4000, hard: 12000 },
		baselineShare: { easy: 0.06, medium: 0.15, hard: 0.35 },
		weeklyScale: 3,
		describe: (g) => `Gain ${g.toLocaleString()} XP while muted or deafened in voice`
	},
	{
		id: 'declutter',
		metric: 'discard_any',
		label: 'Declutter',
		icon: 'fa-trash',
		accent: '#7a7f87',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 3, hard: 6 },
		maxGoal: { easy: 3, medium: 6, hard: 12 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costFactor: 0.5,
		describe: (g) => (g === 1 ? 'Discard an item from your bag' : `Discard ${g} items from your bag`)
	},
	{
		id: 'declutter_named',
		metric: 'discard_specific',
		label: 'Spring clearout',
		icon: 'fa-dumpster',
		accent: '#8a6f5c',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 7 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		targetsItem: true,
		costFactor: 0.5,
		describe: (g, c) => `Discard ${g}× ${c?.itemName ?? 'a specific item'}`
	},
	{
		id: 'use_named',
		metric: 'item_specific_used',
		label: 'Specialist',
		icon: 'fa-crosshairs',
		accent: '#8e44ad',
		unit: 'times',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		targetsItem: true,
		describe: (g, c) => `Use ${g}× ${c?.itemName ?? 'a specific item'}`
	},
	{
		id: 'buy_named',
		metric: 'item_specific_bought',
		label: 'Wishlist',
		icon: 'fa-basket-shopping',
		accent: '#245f73',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		targetsItem: true,
		describe: (g, c) => `Buy ${g}× ${c?.itemName ?? 'a specific item'} from the shop`
	},
	{
		id: 'use_named_ok',
		metric: 'item_specific_success',
		label: 'Flawless',
		icon: 'fa-circle-check',
		accent: '#1f8a4c',
		unit: 'times',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		targetsItem: true,
		costFactor: 1.5,
		describe: (g, c) => `Successfully use ${g}× ${c?.itemName ?? 'a specific item'}`
	},
	{
		id: 'spy_clean',
		metric: 'spy_success',
		label: 'Unseen',
		icon: 'fa-user-secret',
		accent: '#5a9eb4',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'spy',
		costFactor: 1.5,
		describe: (g) => `Spy on ${g} member${g === 1 ? '' : 's'} without getting caught`
	},
	{
		id: 'bomb_masked',
		metric: 'bomb_masked',
		label: 'Ghost bomber',
		icon: 'fa-mask',
		accent: '#d35400',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 3 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'bomb',
		costExtraEffect: 'disguise',
		describe: (g) => `Bomb ${g} member${g === 1 ? '' : 's'} while disguised`
	},
	{
		id: 'steal_masked',
		metric: 'steal_masked',
		label: 'Phantom thief',
		icon: 'fa-user-ninja',
		accent: '#c0392b',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 3 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'steal',
		costFactor: 1.6,
		costExtraEffect: 'disguise',
		describe: (g) => `Steal from ${g} member${g === 1 ? '' : 's'} while disguised`
	},
	{
		id: 'attack_masked',
		metric: 'attack_masked',
		label: 'Anonymous menace',
		icon: 'fa-user-secret',
		accent: '#6d5bd0',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'steal|bomb|leech',
		costExtraEffect: 'disguise',
		describe: (g) => `Attack ${g} member${g === 1 ? '' : 's'} while disguised`
	},
	{
		id: 'buy_lucky',
		metric: 'buy_lucky',
		label: 'Lucky shopper',
		icon: 'fa-tags',
		accent: '#1f8a4c',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costExtraEffect: 'luck',
		describe: (g) => `Buy ${g} item${g === 1 ? '' : 's'} while Luck is active`
	},
	{
		id: 'use_lucky',
		metric: 'use_lucky',
		label: 'Fortune user',
		icon: 'fa-hand-sparkles',
		accent: '#c8911a',
		unit: 'items',
		requires: 'items',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 4, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costExtraEffect: 'luck',
		describe: (g) => `Use ${g} item${g === 1 ? '' : 's'} while Luck is active`
	},
	{
		id: 'attack_lucky',
		metric: 'attack_lucky',
		label: 'Blessed strike',
		icon: 'fa-wand-sparkles',
		accent: '#b5651d',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 4 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: 'steal|bomb|leech',
		costFactor: 1.4,
		costExtraEffect: 'luck',
		describe: (g) => `Land ${g} attack${g === 1 ? '' : 's'} while Luck is active`
	},
	{
		id: 'gamble_lucky',
		metric: 'gamble_lucky',
		label: 'Loaded dice',
		icon: 'fa-clover',
		accent: '#1f8a4c',
		unit: 'rounds',
		requires: 'minigames',
		difficulties: ['easy', 'medium'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 3, hard: 6 },
		maxGoal: { easy: 3, medium: 6, hard: 12 },
		baselineShare: RATIO,
		weeklyScale: 3,
		costEffect: '*',
		costFactor: 0.15,
		costExtraEffect: 'luck',
		describe: (g) => `Gamble ${g} time${g === 1 ? '' : 's'} with Luck active`
	},
	{
		id: 'gamble_lucky_win',
		metric: 'gamble_lucky_win',
		label: 'Fortune favours',
		icon: 'fa-trophy',
		accent: '#c8911a',
		unit: 'wins',
		requires: 'minigames',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 3 },
		maxGoal: { easy: 2, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		costEffect: '*',
		costFactor: 0.4,
		costExtraEffect: 'luck',
		describe: (g) => `Win ${g} gamble${g === 1 ? '' : 's'} with Luck active`
	},
	{
		id: 'bounty_claim',
		metric: 'bounty_claimed',
		label: 'Bounty hunter',
		icon: 'fa-sack-dollar',
		accent: '#b5651d',
		unit: 'members',
		requires: 'items',
		difficulties: ['medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 1, hard: 2 },
		maxGoal: { easy: 1, medium: 2, hard: 3 },
		baselineShare: RATIO,
		weeklyScale: 2,
		costEffect: 'steal|bomb|leech',
		costFactor: 1.6,
		describe: (g) => `Collect ${g} bount${g === 1 ? 'y' : 'ies'} by robbing a wanted member`
	},
	{
		id: 'disguise_time',
		metric: 'duration_disguise',
		label: 'Deep cover',
		icon: 'fa-mask',
		accent: '#3d3d5c',
		unit: 'minutes',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		durationEffect: 'disguise',
		describe: (g) => `Stay disguised for ${g.toLocaleString()} minutes in total`
	},
	{
		id: 'boost_time',
		metric: 'duration_boost',
		label: 'Sustained power',
		icon: 'fa-rocket',
		accent: '#8e44ad',
		unit: 'minutes',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		durationEffect: 'boost',
		describe: (g) => `Keep a Boost running for ${g.toLocaleString()} minutes in total`
	},
	{
		id: 'shield_time',
		metric: 'duration_shield',
		label: 'Fortified',
		icon: 'fa-shield',
		accent: '#2f6f9f',
		unit: 'minutes',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		durationEffect: 'shield',
		describe: (g) => `Stay shielded for ${g.toLocaleString()} minutes in total`
	},
	{
		id: 'luck_time',
		metric: 'duration_luck',
		label: 'Lucky streak',
		icon: 'fa-clover',
		accent: '#1f8a4c',
		unit: 'minutes',
		requires: 'items',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		minGoal: { easy: 1, medium: 2, hard: 3 },
		maxGoal: { easy: 1, medium: 3, hard: 5 },
		baselineShare: RATIO,
		weeklyScale: 2.5,
		durationEffect: 'luck',
		describe: (g) => `Keep Luck active for ${g.toLocaleString()} minutes in total`
	},
	{
		id: 'squad_up',
		metric: 'friends_peak_voice',
		label: 'Squad up',
		icon: 'fa-users',
		accent: '#1f8a4c',
		unit: 'members',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: null,
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 1, medium: 2, hard: 4 },
		maxGoal: { easy: 2, medium: 3, hard: 6 },
		baselineShare: RATIO,
		weeklyScale: 1.5,
		describe: (g) => `Be in voice with ${g} friend${g === 1 ? '' : 's'} earning XP alongside you`
	},
	{
		id: 'friend_xp',
		metric: 'xp_with_friends',
		label: 'Better together',
		icon: 'fa-user-group',
		accent: '#3a9e8f',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium', 'hard'],
		baselineKey: 'xp_with_friends',
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 300, medium: 1200, hard: 4000 },
		maxGoal: { easy: 1500, medium: 6000, hard: 20000 },
		baselineShare: { easy: 0.08, medium: 0.2, hard: 0.45 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP while friends are with you`
	},
	{
		id: 'friend_rounds',
		metric: 'friend_ticks',
		label: 'Regulars',
		icon: 'fa-handshake',
		accent: '#5a9eb4',
		unit: 'times',
		requires: 'leveling',
		difficulties: ['easy', 'medium'],
		baselineKey: 'friend_ticks',
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 3, medium: 10, hard: 25 },
		maxGoal: { easy: 12, medium: 30, hard: 60 },
		baselineShare: RATIO,
		weeklyScale: 3,
		describe: (g) => `Pick up the friend bonus ${g} times`
	},
	{
		id: 'solo_grind',
		metric: 'xp_solo',
		label: 'No help needed',
		icon: 'fa-user',
		accent: '#7a7f87',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'friend_ticks',
		minGoal: { easy: 500, medium: 2000, hard: 6000 },
		maxGoal: { easy: 2000, medium: 8000, hard: 25000 },
		baselineShare: { easy: 0.1, medium: 0.25, hard: 0.55 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP with no Boost and no friend bonus`
	},
	{
		id: 'solo_voice',
		metric: 'xp_solo_voice',
		label: 'Lone voice',
		icon: 'fa-microphone-slash',
		accent: '#5c6470',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_solo_voice',
		eligibilityKey: 'voice_minutes_active',
		minGoal: { easy: 300, medium: 1200, hard: 4000 },
		maxGoal: { easy: 1500, medium: 5000, hard: 15000 },
		baselineShare: { easy: 0.07, medium: 0.18, hard: 0.4 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP in voice with no Boost or friend bonus`
	},
	{
		id: 'solo_media',
		metric: 'xp_solo_media',
		label: 'Raw broadcast',
		icon: 'fa-tower-broadcast',
		accent: '#6d5bd0',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_solo_media',
		eligibilityKey: 'voice_minutes_video',
		minGoal: { easy: 300, medium: 1000, hard: 3000 },
		maxGoal: { easy: 1200, medium: 4000, hard: 12000 },
		baselineShare: { easy: 0.06, medium: 0.15, hard: 0.35 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP on camera or stream with no Boost`
	},
	{
		id: 'solo_chat',
		metric: 'xp_solo_chat',
		label: 'Pure talk',
		icon: 'fa-message',
		accent: '#245f73',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['easy', 'medium'],
		baselineKey: 'xp_solo_chat',
		eligibilityKey: 'chat_total',
		minGoal: { easy: 200, medium: 800, hard: 3000 },
		maxGoal: { easy: 1000, medium: 3500, hard: 12000 },
		baselineShare: { easy: 0.06, medium: 0.16, hard: 0.35 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP from chat with no Boost active`
	},
	{
		id: 'unleeched',
		metric: 'xp_unleeched',
		label: 'Untouched',
		icon: 'fa-hand-fist',
		accent: '#a1343c',
		unit: 'xp',
		requires: 'leveling',
		difficulties: ['medium', 'hard'],
		baselineKey: 'xp_unleeched',
		minGoal: { easy: 500, medium: 2000, hard: 6000 },
		maxGoal: { easy: 2000, medium: 8000, hard: 25000 },
		baselineShare: { easy: 0.1, medium: 0.28, hard: 0.6 },
		weeklyScale: 3,
		describe: (g) => `Earn ${g.toLocaleString()} XP without anyone leeching you`
	}
];

export const TASK_BY_ID = new Map(TASK_DEFINITIONS.map((t) => [t.id, t]));

export const DIFFICULTY_META: Record<TaskDifficulty, { label: string; accent: string; weight: number }> = {
	easy: { label: 'Easy', accent: '#1f8a4c', weight: 1 },
	medium: { label: 'Medium', accent: '#c8911a', weight: 2.5 },
	hard: { label: 'Hard', accent: '#c0392b', weight: 6 }
};

export const DAILY_DIFFICULTY_PLAN: TaskDifficulty[] = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard'];
export const WEEKLY_DIFFICULTY_PLAN: TaskDifficulty[] = ['hard', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard'];

export const WEEKLY_GOAL_MULTIPLIER = 5.5;
export const WEEKLY_REWARD_MULTIPLIER = 6;

export function dayKeyFor(nowMs: number, tzOffsetMin = 0): number {
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	return Math.floor((nowMs - offsetMs) / 86400000);
}

export function weekKeyFor(nowMs: number, tzOffsetMin = 0): number {
	return Math.floor((dayKeyFor(nowMs, tzOffsetMin) + 3) / 7);
}

export function weekStartDayKey(weekKey: number): number {
	return weekKey * 7 - 3;
}

export function msUntilNextDay(nowMs: number, tzOffsetMin = 0): number {
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	const local = nowMs - offsetMs;
	return 86400000 - (((local % 86400000) + 86400000) % 86400000);
}

export function msUntilNextWeek(nowMs: number, tzOffsetMin = 0): number {
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	const local = nowMs - offsetMs;
	const nextWeekStartDay = weekStartDayKey(weekKeyFor(nowMs, tzOffsetMin) + 1);
	return nextWeekStartDay * 86400000 - local;
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
	assetsEnabled: boolean;
	baselines: Partial<Record<TaskMetric, number>>;
	activeDays: number;
	effectCosts?: Record<string, number>;
	medianItemCost?: number;
	catalog?: { id: number; cost: number; effectType: string; durationMinutes?: number }[];
	effectDurations?: Record<string, number>;
	recentDaily?: Partial<Record<TaskMetric, number>>;
	levelingRates?: LevelingRates;
};

export const RECENT_WINDOW_DAYS = 7;
export const ACHIEVABLE_SHARE = 0.9;

export function taskCapacity(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number | null {
	const unit = metricUnitXp(def, elig);
	if (unit <= 0) return null;
	return Math.round((serverEarnRate(elig, period) * ACHIEVABLE_SHARE) / unit);
}

export function isViableFor(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod): boolean {
	const capacity = taskCapacity(def, elig, period);
	if (capacity == null) return true;
	const scale = period === 'weekly' ? (def.weeklyScale ?? WEEKLY_GOAL_MULTIPLIER) : 1;
	return capacity >= Math.round(def.minGoal[difficulty] * scale);
}

export const MEASURED_METRICS: TaskMetric[] = [
	'xp_gained',
	'xp_from_voice',
	'xp_from_voice_active',
	'xp_from_voice_afk',
	'xp_from_chat',
	'xp_from_media',
	'xp_with_friends',
	'xp_solo',
	'xp_solo_voice',
	'xp_solo_media',
	'xp_solo_chat',
	'xp_unleeched',
	'friend_ticks'
];

export function effectDuration(effect: string, elig: TaskEligibility): number {
	return Math.max(0, Number((elig.effectDurations ?? {})[effect]) || 0);
}

export function effectUnitCost(costEffect: string, elig: TaskEligibility): number {
	const costs = elig.effectCosts ?? {};
	const effects = costEffect.split('|');
	const catalog = elig.catalog ?? [];

	if (costEffect === '*') {
		const priced = catalog.map((c) => Number(c.cost) || 0).filter((c) => c > 0);
		if (priced.length > 0) return Math.min(...priced);
		return Number(elig.medianItemCost) || 0;
	}

	const typical = effects
		.map((e) => {
			const priced = catalog.filter((c) => c.effectType === e && (Number(c.cost) || 0) > 0).map((c) => Number(c.cost));
			if (priced.length === 0) return Number(costs[e]) || 0;
			return Math.min(...priced);
		})
		.filter((c) => c > 0);

	if (typical.length > 0) return Math.min(...typical);

	const options = effects.map((e) => Number(costs[e]) || 0).filter((c) => c > 0);
	return options.length > 0 ? Math.min(...options) : 0;
}

export function taskCostXp(def: TaskDefinition, goal: number, elig: TaskEligibility, targetCost = 0): number {
	const amount = Math.max(0, Number(goal) || 0);
	const extra = def.costExtraEffect ? effectUnitCost(def.costExtraEffect, elig) : 0;

	if (def.durationEffect) {
		const per = effectDuration(def.durationEffect, elig);
		const unit = effectUnitCost(def.durationEffect, elig);
		if (per <= 0 || unit <= 0) return 0;
		return Math.round(unit * Math.ceil(amount / per)) + extra;
	}

	if (def.costIsGoal) return Math.round(amount * (def.costFactor ?? 1)) + extra;

	if (def.targetsItem) {
		const unit = Number(targetCost) || 0;
		return (unit > 0 ? Math.round(unit * amount * (def.costFactor ?? 1)) : 0) + extra;
	}

	if (!def.costEffect) return extra;

	const unit = effectUnitCost(def.costEffect, elig);
	if (unit <= 0) return extra;

	const units = def.costFixedUnits ?? amount;
	return Math.round(unit * units * (def.costFactor ?? 1)) + extra;
}

export type LevelingRates = {
	messageXp: number;
	messageCooldownSeconds: number;
	voiceXpPerMinute: number;
	videoXpPerMinute: number;
	streamingXpPerMinute: number;
};

export const DEFAULT_LEVELING_RATES: LevelingRates = {
	messageXp: 15,
	messageCooldownSeconds: 15,
	voiceXpPerMinute: 50,
	videoXpPerMinute: 50,
	streamingXpPerMinute: 50
};

export const REFERENCE_CHAT_MESSAGES = 60;
export const REFERENCE_VOICE_MINUTES = 60;

export function serverEarnRate(elig: TaskEligibility, period: TaskPeriod): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const chat = Math.max(0, Number(r.messageXp) || 0) * REFERENCE_CHAT_MESSAGES;
	const voice = Math.max(0, Number(r.voiceXpPerMinute) || 0) * REFERENCE_VOICE_MINUTES;
	const perDay = chat + voice;
	return perDay * (period === 'weekly' ? 7 : 1);
}

export function metricUnitXp(def: TaskDefinition, elig: TaskEligibility): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const metric = def.metric;

	if (def.unit === 'xp' || metric.startsWith('xp_')) return 1;

	switch (metric) {
		case 'chat_total':
			return Math.max(0, Number(r.messageXp) || 0);
		case 'voice_minutes_active':
			return Math.max(0, Number(r.voiceXpPerMinute) || 0);
		case 'voice_minutes_afk':
			return Math.max(0, Number(r.voiceXpPerMinute) || 0) * AFK_XP_SHARE;
		case 'voice_minutes_video':
			return Math.max(0, Number(r.videoXpPerMinute) || 0);
		case 'voice_minutes_streaming':
			return Math.max(0, Number(r.streamingXpPerMinute) || 0);
		default:
			return 0;
	}
}

export const AFK_XP_SHARE = 0.2;

export const PERIOD_MINUTES: Record<TaskPeriod, number> = { daily: 1440, weekly: 10080 };
export const MINUTE_GOAL_SHARE = 0.5;

export function maxMinuteGoal(period: TaskPeriod): number {
	return Math.floor(PERIOD_MINUTES[period] * MINUTE_GOAL_SHARE);
}

export function targetItemDurationFor(targetItemId: number | null | undefined, elig: TaskEligibility): number {
	if (targetItemId == null) return 0;
	const hit = (elig.catalog ?? []).find((c) => Number(c.id) === Number(targetItemId));
	return Math.max(0, Number(hit?.durationMinutes) || 0);
}

export function maxUsesInPeriod(durationMinutes: number, period: TaskPeriod): number {
	const per = Math.max(0, Number(durationMinutes) || 0);
	if (per <= 0) return Infinity;
	return Math.max(1, Math.floor(PERIOD_MINUTES[period] / per));
}

export function clampGoalToPeriod(def: TaskDefinition, goal: number, period: TaskPeriod, targetItemDuration = 0): number {
	const g = Math.max(1, Math.round(Number(goal) || 1));
	if (def.unit === 'minutes') return Math.max(1, Math.min(g, maxMinuteGoal(period)));

	if (def.targetsItem && targetItemDuration > 0) {
		return Math.max(1, Math.min(g, maxUsesInPeriod(targetItemDuration, period)));
	}

	return g;
}

export function taskGrindXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod): number {
	const unit = metricUnitXp(def, elig);
	if (unit <= 0) return 0;
	return Math.round(Math.max(0, Number(goal) || 0) * unit);
}

export const EFFORT_GRIND_CAP = 60;

export function taskEffortXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return taskCostXp(def, goal, elig, targetCost) + taskGrindXp(def, goal, elig, period);
}

export const EFFORT_BANDS: Record<TaskDifficulty, number> = { easy: 0.18, medium: 0.55, hard: 1 };

export const GOAL_STRETCH_MAX = 40;
export const GOAL_CAPACITY_STRETCH = 25;

export function goalForReward(
	def: TaskDefinition,
	baseGoal: number,
	rewardWorth: number,
	difficulty: TaskDifficulty,
	elig: TaskEligibility,
	period: TaskPeriod,
	targetCost = 0,
	targetItemId: number | null = null
): number {
	const worth = Math.max(0, Number(rewardWorth) || 0);
	const start = Math.max(1, Math.round(Number(baseGoal) || 1));
	if (worth <= 0) return clampGoalToPeriod(def, start, period, targetItemDurationFor(targetItemId, elig));

	const earned = Math.round(worth / REWARD_MARGIN[difficulty]);

	let unitEffort = taskEffortXp(def, start, elig, period, targetCost) / start;

	const durCap = targetItemDurationFor(targetItemId, elig);

	if (!Number.isFinite(unitEffort) || unitEffort <= 0) {
		const rate = serverEarnRate(elig, period);
		if (rate <= 0) return clampGoalToPeriod(def, start, period, durCap);
		unitEffort = (rate * EFFORT_BANDS[difficulty]) / Math.max(1, def.maxGoal[difficulty]);
	}
	if (unitEffort <= 0) return clampGoalToPeriod(def, start, period, durCap);

	const needed = Math.ceil(earned / unitEffort);
	const unitXp = metricUnitXp(def, elig);
	const reachable = unitXp > 0 ? Math.ceil((serverEarnRate(elig, period) * GOAL_CAPACITY_STRETCH) / unitXp) : 0;
	const ceiling = Math.max(start * GOAL_STRETCH_MAX, reachable);

	return clampGoalToPeriod(def, Math.max(start, Math.min(needed, ceiling)), period, targetItemDurationFor(targetItemId, elig));
}

export function gradeDifficulty(effort: number, elig: TaskEligibility, period: TaskPeriod): TaskDifficulty {
	const rate = serverEarnRate(elig, period);
	if (rate <= 0) return 'medium';
	const share = Math.max(0, Number(effort) || 0) / rate;
	if (share >= EFFORT_BANDS.hard) return 'hard';
	if (share >= EFFORT_BANDS.medium) return 'medium';
	return 'easy';
}

export function taskValueXp(
	def: TaskDefinition,
	goal: number,
	difficulty: TaskDifficulty,
	streak: number,
	elig: TaskEligibility,
	period: TaskPeriod = 'daily',
	targetCost = 0
): number {
	const spend = taskCostXp(def, goal, elig, targetCost);
	const grind = taskGrindXp(def, goal, elig, period);
	const streakBonus = 1 + Math.min(1, Math.max(0, streak) * 0.02);

	const rate = serverEarnRate(elig, period);
	let worth = Math.round((grind + spend) * REWARD_MARGIN[difficulty] * streakBonus);

	if (worth <= 0) worth = Math.round(rate * EFFORT_BANDS[difficulty] * REWARD_MARGIN[difficulty] * streakBonus);

	return Math.max(XP_REWARD_MIN, Math.min(XP_REWARD_MAX, Math.max(worth, spend)));
}

function isEligible(def: TaskDefinition, elig: TaskEligibility): boolean {
	if (def.requires === 'leveling' && !elig.levelingEnabled) return false;
	if (def.requires === 'minigames' && !elig.minigamesEnabled) return false;
	if (def.requires === 'items' && !elig.itemsEnabled) return false;
	if (def.requires === 'assets' && !elig.assetsEnabled) return false;

	if (def.costEffect && def.costEffect !== '*' && effectUnitCost(def.costEffect, elig) <= 0) return false;
	if (def.costExtraEffect && effectUnitCost(def.costExtraEffect, elig) <= 0) return false;
	if (def.durationEffect && (effectDuration(def.durationEffect, elig) <= 0 || effectUnitCost(def.durationEffect, elig) <= 0)) return false;
	if (def.targetsItem && (elig.catalog?.length ?? 0) === 0) return false;

	if (def.eligibilityKey && (Number(elig.baselines[def.eligibilityKey]) || 0) <= 0) return false;

	return true;
}

export function goalFor(
	def: TaskDefinition,
	difficulty: TaskDifficulty,
	elig: TaskEligibility,
	rand: () => number,
	period: TaskPeriod = 'daily',
	targetCost = 0
): number {
	const scale = period === 'weekly' ? (def.weeklyScale ?? WEEKLY_GOAL_MULTIPLIER) : 1;

	if (def.durationEffect) {
		const per = effectDuration(def.durationEffect, elig);
		if (per <= 0) return 0;
		const lo = Math.max(1, Math.round(def.minGoal[difficulty] * scale));
		const hi = Math.max(lo, Math.round(def.maxGoal[difficulty] * scale));
		const units = lo + Math.floor(rand() * (hi - lo + 1));
		return clampGoalToPeriod(def, units * per, period);
	}

	const min = Math.round(def.minGoal[difficulty] * scale);
	const max = Math.round(def.maxGoal[difficulty] * scale);

	let target = min;
	const capacity = taskCapacity(def, elig, period);
	if (capacity != null && capacity > 0) {
		target = capacity * def.baselineShare[difficulty] * scale;
	} else {
		target = min + (max - min) * rand() * 0.6;
	}

	const jitter = 0.85 + rand() * 0.3;
	let scaled = Math.round(target * jitter);

	if (max >= 1000) {
		const step = max >= 10000 ? 500 : 100;
		scaled = Math.round(scaled / step) * step;
	}

	let goal = Math.max(min, Math.min(max, scaled || min));

	if (capacity != null && capacity >= min) goal = Math.min(goal, capacity);

	const unitCost = def.costIsGoal
		? (def.costFactor ?? 1)
		: def.targetsItem
			? (Number(targetCost) || 0) * (def.costFactor ?? 1)
			: def.costEffect
				? effectUnitCost(def.costEffect, elig) * (def.costFactor ?? 1)
				: 0;
	if (unitCost > 0 && !def.costFixedUnits) {
		const affordable = Math.floor(XP_REWARD_MAX / (REWARD_MARGIN[difficulty] * unitCost));
		if (affordable >= 1) goal = Math.min(goal, affordable);
	}

	return Math.max(1, goal);
}

export type GeneratedTask = {
	slot: number;
	taskType: string;
	difficulty: TaskDifficulty;
	goal: number;
	targetItemId?: number | null;
	effort?: number;
};

export function generateDailyTasks(
	memberId: number,
	serverId: number,
	periodKey: number,
	elig: TaskEligibility,
	period: TaskPeriod = 'daily'
): GeneratedTask[] {
	const pool = TASK_DEFINITIONS.filter((d) => isEligible(d, elig));
	if (pool.length === 0) return [];

	const plan = period === 'weekly' ? WEEKLY_DIFFICULTY_PLAN : DAILY_DIFFICULTY_PLAN;
	const slots = period === 'weekly' ? WEEKLY_TASK_SLOTS : DAILY_TASK_SLOTS;

	const out: GeneratedTask[] = [];
	const used = new Set<string>();

	for (let slot = 0; slot < slots; slot++) {
		const wanted = plan[slot];
		const rand = mulberry32(hashSeed(period, memberId, serverId, periodKey, slot));

		let candidates = pool.filter((d) => d.difficulties.includes(wanted) && !used.has(d.id) && isViableFor(d, wanted, elig, period));
		let difficulty = wanted;

		if (candidates.length === 0) {
			const fallback = pool.filter((d) => !used.has(d.id) && d.difficulties.some((diff) => isViableFor(d, diff, elig, period)));
			if (fallback.length === 0) break;
			const fb = fallback[Math.floor(rand() * fallback.length) % fallback.length];
			const options = fb.difficulties.filter((diff) => isViableFor(fb, diff, elig, period));
			difficulty = options.includes(wanted) ? wanted : options[options.length - 1];
			candidates = [fb];
		}

		const pick = candidates[Math.floor(rand() * candidates.length) % candidates.length];
		used.add(pick.id);

		let targetItemId: number | null = null;
		let targetCost = 0;
		if (pick.targetsItem) {
			const shop = elig.catalog ?? [];
			const chosen = shop[Math.floor(rand() * shop.length) % shop.length];
			if (chosen) {
				targetItemId = chosen.id;
				targetCost = Number(chosen.cost) || 0;
			}
		}

		const goal = clampGoalToPeriod(pick, goalFor(pick, difficulty, elig, rand, period, targetCost), period, targetItemDurationFor(targetItemId, elig));

		out.push({
			slot,
			taskType: pick.id,
			difficulty,
			goal,
			targetItemId,
			effort: taskEffortXp(pick, goal, elig, period, targetCost)
		});
	}

	return regradeByEffort(out, elig, period);
}

function nearestDifficulty(wanted: TaskDifficulty, allowed: TaskDifficulty[]): TaskDifficulty {
	const target = DIFFICULTY_META[wanted].weight;
	return [...allowed].sort((a, b) => Math.abs(DIFFICULTY_META[a].weight - target) - Math.abs(DIFFICULTY_META[b].weight - target))[0];
}

function regradeByEffort(tasks: GeneratedTask[], elig: TaskEligibility, period: TaskPeriod): GeneratedTask[] {
	if (tasks.length === 0) return tasks;

	const plan = period === 'weekly' ? WEEKLY_DIFFICULTY_PLAN : DAILY_DIFFICULTY_PLAN;
	const ranked = [...tasks].sort((a, b) => (a.effort ?? 0) - (b.effort ?? 0));
	const quota = plan.slice(0, tasks.length).sort((a, b) => DIFFICULTY_META[a].weight - DIFFICULTY_META[b].weight);

	for (let i = 0; i < ranked.length; i++) {
		const slotted = quota[i] ?? gradeDifficulty(ranked[i].effort ?? 0, elig, period);
		const allowed = TASK_BY_ID.get(ranked[i].taskType)?.difficulties ?? [];
		const difficulty = allowed.length === 0 || allowed.includes(slotted) ? slotted : nearestDifficulty(slotted, allowed);
		ranked[i] = { ...ranked[i], difficulty };
	}

	const bySlot = new Map(ranked.map((t) => [t.slot, t]));
	return tasks.map((t) => bySlot.get(t.slot) ?? t);
}

export type RewardPlan = { kind: 'xp'; xp: number } | { kind: 'item'; itemId: number; xp: 0 };

export const XP_REWARD_MIN = 1000;
export const XP_REWARD_MAX = 20000000;

export const REWARD_MARGIN: Record<TaskDifficulty, number> = { easy: 1.35, medium: 1.5, hard: 1.75 };

function scaledBase(medianCost: number, factor: number): number {
	const median = Math.max(0, Number(medianCost) || 0);
	const linear = median * factor;
	if (linear <= 12000) return Math.max(XP_REWARD_MIN, Math.round(linear));
	return Math.max(XP_REWARD_MIN, Math.round(12000 + Math.sqrt(linear - 12000) * 90));
}

export function xpRewardFor(difficulty: TaskDifficulty, streak: number, medianCost: number): number {
	const base = scaledBase(medianCost, 1.5);
	const scaled = base * DIFFICULTY_META[difficulty].weight;
	const streakBonus = 1 + Math.min(1, Math.max(0, streak) * 0.02);
	const rounded = Math.round((scaled * streakBonus) / 100) * 100;
	return Math.max(XP_REWARD_MIN, Math.min(XP_REWARD_MAX, rounded));
}

export function costPercentile(costs: number[], percentile: number): number {
	if (costs.length === 0) return 0;
	const sorted = [...costs].sort((a, b) => a - b);
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((percentile / 100) * (sorted.length - 1))));
	return sorted[idx];
}

export const ITEM_VALUE_FLOOR = 0.85;
export const ITEM_VALUE_CEILING = 1.25;

export const TASK_ITEM_REWARD_CHANCE = 0.3;

export function priciestOf<T extends { cost: number }>(catalog: T[]): T[] {
	if (catalog.length === 0) return [];
	let best = -Infinity;
	for (const c of catalog) {
		const v = Number(c.cost) || 0;
		if (v > best) best = v;
	}
	return catalog.filter((c) => (Number(c.cost) || 0) === best);
}

export function cheapestOf<T extends { cost: number }>(catalog: T[]): T[] {
	if (catalog.length === 0) return [];
	let best = Infinity;
	for (const c of catalog) {
		const v = Number(c.cost) || 0;
		if (v < best) best = v;
	}
	return catalog.filter((c) => (Number(c.cost) || 0) === best);
}

export const LOGIN_RARITY_EXPONENT = 1.15;
export const LOGIN_RARITY_MIN_CHANCE = 0.01;

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_TIERS: { id: RarityTier; label: string; minRatio: number; accent: string }[] = [
	{ id: 'mythic', label: 'Mythic', minRatio: 500, accent: '#c0392b' },
	{ id: 'legendary', label: 'Legendary', minRatio: 100, accent: '#c8911a' },
	{ id: 'epic', label: 'Epic', minRatio: 25, accent: '#8e44ad' },
	{ id: 'rare', label: 'Rare', minRatio: 8, accent: '#2b6cb0' },
	{ id: 'uncommon', label: 'Uncommon', minRatio: 3, accent: '#1f8a4c' },
	{ id: 'common', label: 'Common', minRatio: 0, accent: '#6b7a82' }
];

export function rarityTierFor(cost: number, costs: number[]): RarityTier {
	const value = Number(cost) || 0;
	const priced = costs.map((c) => Number(c) || 0).filter((c) => c > 0);
	if (value <= 0 || priced.length === 0) return 'common';

	const cheapest = Math.min(...priced);
	const ratio = cheapest > 0 ? value / cheapest : 1;

	for (const tier of RARITY_TIERS) {
		if (ratio >= tier.minRatio) return tier.id;
	}
	return 'common';
}

export function rarityMeta(tier: RarityTier) {
	return RARITY_TIERS.find((t) => t.id === tier) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}

export function pickWeightedByRarity<T extends { cost: number }>(catalog: T[], roll: number): T | null {
	const priced = catalog.filter((c) => (Number(c.cost) || 0) > 0);
	if (priced.length === 0) return null;

	const cheapest = Math.min(...priced.map((c) => Number(c.cost) || 0));
	const raw = priced.map((c) => Math.pow(cheapest / (Number(c.cost) || cheapest), LOGIN_RARITY_EXPONENT));
	const rawTotal = raw.reduce((a, b) => a + b, 0);
	if (!(rawTotal > 0)) return priced[0];

	const floor = Math.min(LOGIN_RARITY_MIN_CHANCE, 1 / priced.length);
	const headroom = 1 - floor * priced.length;
	const weights = raw.map((w) => floor + (w / rawTotal) * headroom);
	const total = weights.reduce((a, b) => a + b, 0);

	let cursor = Math.min(0.9999999, Math.max(0, roll)) * total;
	for (let i = 0; i < priced.length; i++) {
		cursor -= weights[i];
		if (cursor < 0) return priced[i];
	}
	return priced[priced.length - 1];
}

export function pickReward(
	memberId: number,
	periodKey: number,
	slot: number,
	difficulty: TaskDifficulty,
	value: number,
	catalog: { id: number; cost: number }[],
	period: TaskPeriod = 'daily',
	minWorth = 0
): RewardPlan {
	const floor = Math.max(0, Math.round(Number(minWorth) || 0));
	const worth = Math.max(XP_REWARD_MIN, floor, Math.min(XP_REWARD_MAX, Math.round(Number(value) || 0)));
	const rand = mulberry32(hashSeed('reward', period, memberId, periodKey, slot));

	if (catalog.length > 0 && rand() < TASK_ITEM_REWARD_CHANCE) {
		const affordable = catalog.filter((c) => (Number(c.cost) || 0) >= Math.max(floor, worth * ITEM_VALUE_FLOOR));
		const fair = affordable.filter((c) => (Number(c.cost) || 0) <= worth * ITEM_VALUE_CEILING);

		const pool = fair.length > 0 ? fair : cheapestOf(affordable);
		if (pool.length > 0) {
			const picked = pool[Math.floor(rand() * pool.length) % pool.length];
			if (picked) return { kind: 'item', itemId: picked.id, xp: 0 };
		}
	}

	const varied = worth * (1 + rand() * 0.35);
	const xp = Math.max(XP_REWARD_MIN, floor, Math.min(XP_REWARD_MAX, Math.round(varied / 100) * 100));
	return { kind: 'xp', xp };
}

export const LOGIN_DAY_WEIGHTS = [1, 1.5, 2.2, 3.2, 4.5, 6.5, 25] as const;
export const LOGIN_JACKPOT_MIN_XP = 25000;
export const LOGIN_ITEM_REWARD_CHANCE = 0.5;
export const LOGIN_DAILY_EARN_SHARE = 0.25;

export type LoginReward = { day: number; kind: 'xp'; xp: number; jackpot: boolean } | { day: number; kind: 'item'; itemId: number; jackpot: boolean };

export function loginRewardFor(memberId: number, cycleIndex: number, day: number, catalog: { id: number; cost: number }[], dailyEarn = 0): LoginReward {
	const costs = catalog.map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	const median = costPercentile(costs, 50) || 500;
	const jackpot = day === LOGIN_CYCLE_DAYS;
	const weight = LOGIN_DAY_WEIGHTS[Math.max(0, Math.min(LOGIN_CYCLE_DAYS - 1, day - 1))];
	const rand = mulberry32(hashSeed('login', memberId, cycleIndex, day));

	const earn = Math.max(0, Number(dailyEarn) || 0);
	const base = earn > 0 ? Math.max(XP_REWARD_MIN, Math.round(earn * LOGIN_DAILY_EARN_SHARE)) : scaledBase(median, 1.2);
	const floor = jackpot ? LOGIN_JACKPOT_MIN_XP : XP_REWARD_MIN;
	const worth = Math.max(floor, Math.min(XP_REWARD_MAX, Math.round((base * weight) / 100) * 100));

	if (catalog.length > 0 && rand() < LOGIN_ITEM_REWARD_CHANCE) {
		const picked = pickWeightedByRarity(catalog, rand());
		if (picked) return { day, kind: 'item', itemId: picked.id, jackpot };
	}

	return { day, kind: 'xp', xp: worth, jackpot };
}

export function loginCyclePreview(memberId: number, cycleIndex: number, catalog: { id: number; cost: number }[], dailyEarn = 0): LoginReward[] {
	return Array.from({ length: LOGIN_CYCLE_DAYS }, (_, i) => loginRewardFor(memberId, cycleIndex, i + 1, catalog, dailyEarn));
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
