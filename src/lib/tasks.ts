export const DAILY_TASK_SLOTS = 18;
export const WEEKLY_TASK_SLOTS = 18;
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
	| 'gamble_wagered_lost'
	| 'gamble_lost'
	| 'gamble_lost_big'
	| 'attack_any'
	| 'attack_success'
	| 'attack_failed'
	| 'attack_reflected'
	| 'attack_blocked'
	| 'attack_on_cooldown'
	| 'spy_caught'
	| 'steal_failed'
	| 'bomb_failed'
	| 'leech_landed'
	| 'leech_occupied'
	| 'leech_failed'
	| 'bounty_paid_out'
	| 'attacked_by_any'
	| 'stolen_from'
	| 'bombed_by'
	| 'leeched_by'
	| 'attacks_survived'
	| 'xp_lost_to_attacks'
	| 'xp_refunded'
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
	baselineKey: TaskMetric | null;
	eligibilityKey?: TaskMetric;
	costEffect?: string;
	costIsGoal?: boolean;
	costFixedUnits?: number;
	costExtraEffect?: string;
	durationEffect?: string;
	targetsItem?: boolean;
	successChance?: number;
	describe: (goal: number, ctx?: TaskDescribeContext) => string;
};

export type TaskDescribeContext = { itemName?: string | null };

export const HIGH_ROLL_MULTIPLIER = 5;

export function gambleWinChance(multiplier: number): number {
	const m = Math.max(1, Number(multiplier) || 1);
	return 100 / m;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
	{
		id: 'chat',
		metric: 'chat_total',
		label: 'Chatter',
		icon: 'fa-comments',
		accent: '#245f73',
		unit: 'messages',
		requires: 'leveling',
		baselineKey: 'chat_total',
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
		baselineKey: 'reactions_given',
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
		baselineKey: 'voice_minutes_active',
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
		baselineKey: 'voice_minutes_video',
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
		baselineKey: 'voice_minutes_streaming',
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
		baselineKey: 'voice_minutes_afk',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: 'steal',
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: 'xp_gained',
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
		baselineKey: 'xp_gained',
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: 'xp_from_voice',
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'xp_from_chat',
		eligibilityKey: 'chat_total',
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
		baselineKey: 'xp_from_media',
		eligibilityKey: 'voice_minutes_video',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: '*',
		successChance: gambleWinChance(HIGH_ROLL_MULTIPLIER),
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
		baselineKey: 'xp_gained',
		costIsGoal: true,
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
		baselineKey: null,
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
		baselineKey: null,
		costEffect: 'steal|bomb|leech',
		describe: (g) => `Land ${g} successful attack${g === 1 ? '' : 's'}`
	},
	{
		id: 'gamble_burn',
		metric: 'gamble_wagered_lost',
		label: 'Bad beat',
		icon: 'fa-fire',
		accent: '#c0392b',
		unit: 'xp',
		requires: 'minigames',
		baselineKey: 'xp_gained',
		costIsGoal: true,
		describe: (g) => `Lose ${g.toLocaleString()} XP in gambles`
	},
	{
		id: 'gamble_bust',
		metric: 'gamble_lost',
		label: 'Cooler',
		icon: 'fa-skull',
		accent: '#8e44ad',
		unit: 'rounds',
		requires: 'minigames',
		baselineKey: null,
		costEffect: '*',
		describe: (g) => (g === 1 ? 'Lose a gamble round' : `Lose ${g} gamble rounds`)
	},
	{
		id: 'gamble_bust_big',
		metric: 'gamble_lost_big',
		label: 'High-stakes bust',
		icon: 'fa-bomb',
		accent: '#c0392b',
		unit: 'rounds',
		requires: 'minigames',
		baselineKey: null,
		costEffect: '*',
		successChance: 100 - gambleWinChance(HIGH_ROLL_MULTIPLIER),
		describe: (g) => `Lose ${g} gamble${g === 1 ? '' : 's'} at 5× or higher`
	},
	{
		id: 'attack_miss',
		metric: 'attack_failed',
		label: 'Swing and a miss',
		icon: 'fa-ban',
		accent: '#7a7f87',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal|bomb|leech',
		describe: (g) => `Have ${g} of your attacks fail`
	},
	{
		id: 'attack_bounced',
		metric: 'attack_reflected',
		label: 'Backfire',
		icon: 'fa-arrows-turn-to-dots',
		accent: '#2b6cb0',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal|bomb',
		describe: (g) => `Get reflected ${g} time${g === 1 ? '' : 's'}`
	},
	{
		id: 'attack_walled',
		metric: 'attack_blocked',
		label: 'Wall of shields',
		icon: 'fa-shield-halved',
		accent: '#1f8a4c',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal|bomb|leech',
		describe: (g) => `Hit ${g} shielded or immune target${g === 1 ? '' : 's'}`
	},
	{
		id: 'spy_busted',
		metric: 'spy_caught',
		label: 'Blown cover',
		icon: 'fa-user-secret',
		accent: '#d35400',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		costEffect: 'spy',
		describe: (g) => (g === 1 ? 'Get caught spying once' : `Get caught spying ${g} times`)
	},
	{
		id: 'steal_miss',
		metric: 'steal_failed',
		label: 'Butterfingers',
		icon: 'fa-hand',
		accent: '#7a7f87',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal',
		describe: (g) => `Have ${g} steal${g === 1 ? '' : 's'} fail`
	},
	{
		id: 'bomb_miss',
		metric: 'bomb_failed',
		label: 'Dud fuse',
		icon: 'fa-bomb',
		accent: '#7a7f87',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'bomb',
		describe: (g) => `Have ${g} bomb${g === 1 ? '' : 's'} fizzle`
	},
	{
		id: 'leech_land',
		metric: 'leech_landed',
		label: 'Parasite',
		icon: 'fa-worm',
		accent: '#8e44ad',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'leech',
		describe: (g) => `Leech ${g} member${g === 1 ? '' : 's'}`
	},
	{
		id: 'leech_taken',
		metric: 'leech_occupied',
		label: 'Already spoken for',
		icon: 'fa-user-slash',
		accent: '#7a7f87',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'leech',
		describe: (g) => `Try to leech ${g} member${g === 1 ? '' : 's'} someone else already has`
	},
	{
		id: 'leech_miss',
		metric: 'leech_failed',
		label: 'Shaken off',
		icon: 'fa-worm',
		accent: '#7a7f87',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'leech',
		describe: (g) => `Have ${g} leech${g === 1 ? '' : 'es'} fail`
	},
	{
		id: 'attack_stalled',
		metric: 'attack_on_cooldown',
		label: 'Trigger happy',
		icon: 'fa-hourglass-half',
		accent: '#c8911a',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal|bomb|leech',
		describe: (g) => `Hit your attack cooldown ${g} time${g === 1 ? '' : 's'}`
	},
	{
		id: 'bounty_payout',
		metric: 'bounty_paid_out',
		label: 'Blood money',
		icon: 'fa-sack-dollar',
		accent: '#c8911a',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		costEffect: 'steal|bomb',
		describe: (g) => `Trigger ${g} bounty payout${g === 1 ? '' : 's'}`
	},
	{
		id: 'took_a_hit',
		metric: 'attacked_by_any',
		label: 'Punching bag',
		icon: 'fa-face-dizzy',
		accent: '#c0392b',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		describe: (g) => `Get hit by ${g} attack${g === 1 ? '' : 's'}`
	},
	{
		id: 'got_robbed',
		metric: 'stolen_from',
		label: 'Pickpocketed',
		icon: 'fa-hand-holding-dollar',
		accent: '#c0392b',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		describe: (g) => `Get robbed ${g} time${g === 1 ? '' : 's'}`
	},
	{
		id: 'got_bombed',
		metric: 'bombed_by',
		label: 'Ground zero',
		icon: 'fa-explosion',
		accent: '#c0392b',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		describe: (g) => `Get bombed ${g} time${g === 1 ? '' : 's'}`
	},
	{
		id: 'got_leeched',
		metric: 'leeched_by',
		label: 'Host body',
		icon: 'fa-virus',
		accent: '#8e44ad',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		describe: (g) => `Get leeched ${g} time${g === 1 ? '' : 's'}`
	},
	{
		id: 'held_the_line',
		metric: 'attacks_survived',
		label: 'Unbreakable',
		icon: 'fa-shield-heart',
		accent: '#1f8a4c',
		unit: 'times',
		requires: 'items',
		baselineKey: null,
		durationEffect: 'shield|reflect',
		describe: (g) => `Survive ${g} attack${g === 1 ? '' : 's'}`
	},
	{
		id: 'bled_xp',
		metric: 'xp_lost_to_attacks',
		label: 'Bleeding out',
		icon: 'fa-droplet',
		accent: '#c0392b',
		unit: 'xp',
		requires: 'items',
		baselineKey: null,
		describe: (g) => `Lose ${g.toLocaleString()} XP to attackers`
	},
	{
		id: 'clawed_back',
		metric: 'xp_refunded',
		label: 'Fully covered',
		icon: 'fa-file-invoice-dollar',
		accent: '#1f8a4c',
		unit: 'xp',
		requires: 'items',
		baselineKey: null,
		costEffect: 'insurance',
		describe: (g) => `Recover ${g.toLocaleString()} XP through Insurance`
	},
	{
		id: 'bomb_land',
		metric: 'bomb_success',
		label: 'Direct hit',
		icon: 'fa-explosion',
		accent: '#d35400',
		unit: 'members',
		requires: 'items',
		baselineKey: null,
		costEffect: 'bomb',
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
		baselineKey: null,
		costEffect: 'leech',
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: 'xp_from_voice_active',
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'xp_from_voice_afk',
		eligibilityKey: 'voice_minutes_afk',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		targetsItem: true,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
		targetsItem: true,
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
		baselineKey: null,
		costEffect: 'spy',
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
		baselineKey: null,
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
		baselineKey: null,
		costEffect: 'steal',
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
		costEffect: 'steal|bomb|leech',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: '*',
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
		baselineKey: null,
		costEffect: 'steal|bomb',
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
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
		baselineKey: null,
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'xp_with_friends',
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'friend_ticks',
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'xp_solo',
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
		baselineKey: 'xp_solo_voice',
		eligibilityKey: 'voice_minutes_active',
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
		baselineKey: 'xp_solo_media',
		eligibilityKey: 'voice_minutes_video',
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
		baselineKey: 'xp_solo_chat',
		eligibilityKey: 'chat_total',
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
		baselineKey: 'xp_unleeched',
		describe: (g) => `Earn ${g.toLocaleString()} XP without anyone leeching you`
	}
];

export const TASK_BY_ID = new Map(TASK_DEFINITIONS.map((t) => [t.id, t]));

export const DIFFICULTY_META: Record<TaskDifficulty, { label: string; accent: string; weight: number }> = {
	easy: { label: 'Easy', accent: '#1f8a4c', weight: 1 },
	medium: { label: 'Medium', accent: '#c8911a', weight: 2.5 },
	hard: { label: 'Hard', accent: '#c0392b', weight: 6 }
};

export const DAILY_DIFFICULTY_PLAN: TaskDifficulty[] = [
	'easy',
	'easy',
	'easy',
	'easy',
	'easy',
	'easy',
	'medium',
	'medium',
	'medium',
	'medium',
	'medium',
	'medium',
	'hard',
	'hard',
	'hard',
	'hard',
	'hard',
	'hard'
];
export const WEEKLY_DIFFICULTY_PLAN: TaskDifficulty[] = Array.from({ length: WEEKLY_TASK_SLOTS }, () => 'hard');

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
	catalog?: {
		id: number;
		cost: number;
		effectType: string;
		durationMinutes?: number;
		cooldownMinutes?: number;
		immunityMinutes?: number;
		multiplier?: number;
		maxPercent?: number;
		skimPercent?: number;
		refundPercent?: number;
		successChance?: number;
	}[];
	effectDurations?: Record<string, number>;
	recentDaily?: Partial<Record<TaskMetric, number>>;
	recentPeak?: Partial<Record<TaskMetric, number>>;
	levelingRates?: LevelingRates;
	memberCount?: number;
	measuredDailyEarn?: number;
};

export const RECENT_WINDOW_DAYS = 7;
export const ACHIEVABLE_SHARE = 0.9;

export function taskCapacity(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number | null {
	const unit = activityEffortUnitXp(def, elig);
	if (unit <= 0) return null;
	return Math.round((serverEarnRate(elig, period) * ACHIEVABLE_SHARE) / unit);
}

export function historyMetricsFor(elig: TaskEligibility): TaskMetric[] {
	const wanted = new Set<TaskMetric>();
	for (const def of TASK_DEFINITIONS) {
		if (!isEligible(def, elig)) continue;
		if (def.targetsItem) continue;
		wanted.add(def.metric);
	}
	return [...wanted];
}

export function tierGoals(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): Record<TaskDifficulty, number> {
	return {
		easy: deriveGoal(def, 'easy', elig, period, targetCost),
		medium: deriveGoal(def, 'medium', elig, period, targetCost),
		hard: deriveGoal(def, 'hard', elig, period, targetCost)
	};
}

export function hasDistinctTiers(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): boolean {
	const g = tierGoals(def, elig, period, targetCost);
	return g.easy < g.medium && g.medium < g.hard;
}

export function isViableFor(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): boolean {
	if (feasibleUsesInPeriod(def, elig, period) < 1) return false;

	const capacity = taskCapacity(def, elig, period);
	if (capacity == null) return true;
	return capacity >= 1;
}

export function canReachDifficulty(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod): boolean {
	const rate = serverEarnRate(elig, period);
	if (rate <= 0) return true;

	const feasible = feasibleUsesInPeriod(def, elig, period);
	const ceiling = Number.isFinite(feasible) ? feasible : maxMinuteGoal(period) * PERIOD_MINUTES.daily;
	const maxEffort = taskEffortXp(def, ceiling, elig, period, maxTargetCost(elig));
	if (maxEffort / rate < EFFORT_BANDS[difficulty]) return false;

	const minEffort = taskEffortXp(def, 1, elig, period, minTargetCost(elig));
	return gradeDifficulty(minEffort, elig, period) === difficulty || minEffort / rate < EFFORT_BANDS[difficulty];
}

function minTargetCost(elig: TaskEligibility): number {
	const costs = (elig.catalog ?? []).map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	return costs.length > 0 ? Math.min(...costs) : 0;
}

function maxTargetCost(elig: TaskEligibility): number {
	const costs = (elig.catalog ?? []).map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	return costs.length > 0 ? Math.max(...costs) : 0;
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

	if (costEffect === '*') return 0;

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

	if (def.costIsGoal) return Math.round(amount) + extra;

	if (def.targetsItem) {
		const unit = Number(targetCost) || 0;
		return (unit > 0 ? Math.round(unit * amount) : 0) + extra;
	}

	if (def.unit === 'xp' && (def.costFixedUnits ?? 0) > 0) {
		const perUse = xpPerUseFor(def, elig);
		const uses = perUse > 0 ? Math.max(1, Math.ceil(amount / perUse)) : (def.costFixedUnits ?? 1);
		const unitCost = effectUnitCost(def.costEffect ?? '*', elig);
		return Math.round(unitCost * uses) + extra;
	}

	if (!def.costEffect) return extra;

	const unit = effectUnitCost(def.costEffect, elig);
	if (unit <= 0) return extra;

	const units = def.unit === 'xp' ? 1 : amount;
	return Math.round(unit * units) + extra;
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

export function bestBoostMultiplier(elig: TaskEligibility, period: TaskPeriod): number {
	const boosts = (elig.catalog ?? []).filter((c) => c.effectType === 'boost' && (Number(c.multiplier) || 0) > 1 && (Number(c.durationMinutes) || 0) > 0);
	if (boosts.length === 0) return 1;

	const perScope = new Map<number, number>();
	for (const c of boosts) {
		const m = Number(c.multiplier) || 1;
		const prev = perScope.get(m) ?? 0;
		if (m > prev) perScope.set(m, m);
	}

	return [...perScope.values()].reduce((acc, m) => acc * m, 1);
}

export function serverEarnRate(elig: TaskEligibility, period: TaskPeriod): number {
	const days = period === 'weekly' ? 7 : 1;
	const measured = Math.max(0, Number(elig.measuredDailyEarn) || 0) * days;
	const potential = baseEarnRate(elig, period) * bestBoostMultiplier(elig, period);

	return Math.max(measured, potential);
}

export function unboostedEarnRate(elig: TaskEligibility, period: TaskPeriod): number {
	const days = period === 'weekly' ? 7 : 1;
	const measured = Math.max(0, Number(elig.measuredDailyEarn) || 0) * days;

	return Math.max(measured, baseEarnRate(elig, period));
}

export function baseEarnRate(elig: TaskEligibility, period: TaskPeriod): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const chat = Math.max(0, Number(r.messageXp) || 0) * REFERENCE_CHAT_MESSAGES;
	const voice = Math.max(0, Number(r.voiceXpPerMinute) || 0) * REFERENCE_VOICE_MINUTES;
	const perDay = chat + voice;

	const d = DEFAULT_LEVELING_RATES;
	const fallback = d.messageXp * REFERENCE_CHAT_MESSAGES + d.voiceXpPerMinute * REFERENCE_VOICE_MINUTES;
	const daily = perDay > 0 ? perDay : fallback;

	return daily * (period === 'weekly' ? 7 : 1);
}

export const REALISTIC_CHAT_SHARE = 0.1;

export function chatMessagesPerMinute(elig: TaskEligibility): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const cooldown = Math.max(1, Number(r.messageCooldownSeconds) || 1);
	const ceiling = 60 / cooldown;

	const observed = observedPerDay(elig, 'chat_total');
	if (observed > 0) {
		const activeMinutes = maxMinuteGoal('daily');
		const paced = observed / activeMinutes;
		return Math.max(Math.min(paced, ceiling), ceiling * REALISTIC_CHAT_SHARE);
	}

	return ceiling * REALISTIC_CHAT_SHARE;
}

export function observedPerDay(elig: TaskEligibility, metric: TaskMetric): number {
	const recent = Number((elig.recentDaily ?? {})[metric]);
	if (Number.isFinite(recent) && recent > 0) return recent;

	const lifetime = Math.max(0, Number(elig.baselines?.[metric]) || 0);
	const days = Math.max(1, Number(elig.activeDays) || 0);
	return lifetime > 0 ? lifetime / days : 0;
}

export function chatXpPerMinute(elig: TaskEligibility): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	return chatMessagesPerMinute(elig) * Math.max(0, Number(r.messageXp) || 0);
}

export function metricXpPerMinute(metric: TaskMetric, elig: TaskEligibility): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const voice = Math.max(0, Number(r.voiceXpPerMinute) || 0);
	const video = Math.max(0, Number(r.videoXpPerMinute) || 0);
	const stream = Math.max(0, Number(r.streamingXpPerMinute) || 0);
	const chat = chatXpPerMinute(elig);

	switch (metric) {
		case 'xp_from_chat':
		case 'xp_solo_chat':
			return chat;
		case 'xp_from_voice_active':
		case 'xp_solo_voice':
			return voice;
		case 'xp_from_voice_afk':
			return voice * AFK_XP_SHARE;
		case 'xp_from_voice':
			return Math.max(voice, voice * AFK_XP_SHARE);
		case 'xp_from_media':
		case 'xp_solo_media':
			return Math.max(video, stream);
		case 'xp_with_friends':
		case 'xp_solo':
		case 'xp_gained':
		case 'xp_unleeched':
			return Math.max(chat, voice, video, stream);
		default:
			return 0;
	}
}

export function xpGoalMinutes(def: TaskDefinition, goal: number, elig: TaskEligibility): number {
	if (xpPerUseFor(def, elig) > 0) return 0;

	const generic = Math.max(effortMinuteWorth(elig), serverEarnRate(elig, 'daily') / PERIOD_MINUTES.daily);
	const perMinute = metricXpPerMinute(def.metric, elig) || (def.unit === 'xp' ? generic : 0);
	if (!(perMinute > 0)) return 0;
	return Math.max(0, Number(goal) || 0) / perMinute;
}

export function effectPercentYield(effectKey: string | undefined, elig: TaskEligibility): number {
	const items = effectItems(effectKey, elig);
	if (items.length === 0) return 0;

	const pcts = items.map((c) => Math.max(Number(c.maxPercent) || 0, Number(c.skimPercent) || 0)).filter((p) => p > 0);

	return pcts.length > 0 ? Math.max(...pcts) : 0;
}

export function xpPerUseFor(def: TaskDefinition, elig: TaskEligibility): number {
	const key = def.costEffect ?? def.durationEffect;
	const pool = victimBalanceXp(elig);
	if (!(pool > 0)) return 0;

	const refund = effectRefundShare(key, elig);
	if (refund > 0) {
		const lost = effectPercentYield('steal|bomb|leech', elig);
		return lost > 0 ? (pool * lost * refund) / 10000 : 0;
	}

	if (isInflicted(def)) return 0;

	const pct = effectPercentYield(key, elig);
	if (!(pct > 0)) return 0;

	return (pool * pct) / 100;
}

export function victimBalanceXp(elig: TaskEligibility): number {
	const attackCost = Math.max(effectUnitCost('steal', elig), effectUnitCost('bomb', elig), effectUnitCost('leech', elig));
	const daily = unboostedEarnRate(elig, 'daily');
	if (!(attackCost > 0)) return daily;

	const pct = effectPercentYield('steal|bomb|leech', elig);
	if (!(pct > 0)) return daily;

	return Math.max(daily, (attackCost * 100) / pct);
}

export function effectRefundShare(effectKey: string | undefined, elig: TaskEligibility): number {
	const pcts = effectItems(effectKey, elig)
		.map((c) => Math.max(0, Number(c.refundPercent) || 0))
		.filter((p) => p > 0);

	return pcts.length > 0 ? Math.max(...pcts) : 0;
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
export const MINUTE_GOAL_SHARE = 1 / 16;

export function activeDaysInPeriod(period: TaskPeriod): number {
	const days = PERIOD_MINUTES[period] / PERIOD_MINUTES.daily;
	return days <= 1 ? days : Math.max(1, Math.ceil(Math.sqrt(days)));
}

export function maxMinuteGoal(period: TaskPeriod): number {
	const perDay = PERIOD_MINUTES.daily * MINUTE_GOAL_SHARE;
	return Math.floor(perDay * activeDaysInPeriod(period));
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

function effectItems(effectKey: string | undefined, elig: TaskEligibility) {
	if (!effectKey) return [];
	const wanted = effectKey.split('|');
	return (elig.catalog ?? []).filter((c) => wanted.includes(c.effectType) && (Number(c.cost) || 0) > 0);
}

export function effectSuccessChance(effectKey: string | undefined, elig: TaskEligibility): number {
	const items = effectItems(effectKey, elig);
	if (items.length === 0) return 100;
	const best = Math.max(...items.map((c) => Number(c.successChance ?? 100)));
	return Math.max(1, Math.min(100, best));
}

export function taskSuccessChance(def: TaskDefinition, elig: TaskEligibility): number {
	const declared = Number(def.successChance);
	if (Number.isFinite(declared) && declared > 0) return Math.max(1, Math.min(100, declared));
	if (def.costEffect && def.costEffect !== '*') return effectSuccessChance(def.costEffect, elig);
	return 100;
}

export function taskAttemptsPerSuccess(def: TaskDefinition, elig: TaskEligibility): number {
	return 100 / taskSuccessChance(def, elig);
}

export const DAILY_ACTION_CAP = 50;

export const COUNTED_ACTION_UNITS = new Set(['items', 'members', 'rounds', 'times', 'wins', 'trades']);

export const ACTIVITY_ACTION_UNITS = new Set(['messages', 'reactions', 'minutes']);

export const ACTIVITY_EFFORT_XP = 200;

export const ACTIVITY_ACTION_CAP: Record<TaskPeriod, number> = { daily: 50, weekly: 200 };

export function isActivityAction(def: TaskDefinition): boolean {
	return ACTIVITY_ACTION_UNITS.has(def.unit);
}

export function activityEffortUnitXp(def: TaskDefinition, elig: TaskEligibility): number {
	if (!isActivityAction(def)) return metricUnitXp(def, elig);
	return Math.max(ACTIVITY_EFFORT_XP, metricUnitXp(def, elig));
}

export const ACTIVITY_TIER_SHARE: Record<TaskDifficulty, number> = { easy: 1 / 3, medium: 2 / 3, hard: 1 };

export const MIN_TIER_SPREAD = Object.keys(ACTIVITY_TIER_SHARE).length;

export const TIER_ORDER: TaskDifficulty[] = ['easy', 'medium', 'hard'];

export function activityGoalFor(difficulty: TaskDifficulty, period: TaskPeriod): number {
	const cap = ACTIVITY_ACTION_CAP[period];
	return Math.max(1, Math.round(cap * ACTIVITY_TIER_SHARE[difficulty]));
}

export const DISCARDABLE_CAP = 50;

export const PEAK_CONCURRENCY_CAP = 5;

export const GRADE_MATCH_ATTEMPTS = 12;

export const PEAK_METRICS = new Set<TaskMetric>(['friends_peak_voice']);

export const INFLICTED_METRICS = new Set<TaskMetric>([
	'attacked_by_any',
	'stolen_from',
	'bombed_by',
	'leeched_by',
	'attacks_survived',
	'xp_lost_to_attacks',
	'xp_refunded',
	'bounty_paid_out',
	'attack_failed',
	'leech_failed'
]);

export const UNMEASURED_INFLICTED_GOAL: Record<TaskDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

export const INFLICTED_XP_SHARE = 0.25;

export const XP_YIELD_SHARE = 0.3;

export function isInflicted(def: TaskDefinition): boolean {
	return INFLICTED_METRICS.has(def.metric);
}

export function isPeakMetric(def: TaskDefinition): boolean {
	return PEAK_METRICS.has(def.metric);
}

export function effectRateLimit(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const minutes = PERIOD_MINUTES[period];
	const effectKey = def.costEffect && def.costEffect !== '*' ? def.costEffect : def.durationEffect;
	const items = effectItems(effectKey, elig);
	if (items.length === 0) return 0;

	const gates = items.map((c) => Math.max(Number(c.cooldownMinutes) || 0, Number(c.immunityMinutes) || 0, Number(c.durationMinutes) || 0)).filter((v) => v > 0);

	if (gates.length === 0) return 0;

	return Math.max(1, Math.floor(minutes / Math.min(...gates)));
}

export function hardTierUnitCap(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const perAction = def.unit === 'minutes' ? 1 : activityUnitMinutes(def, elig) || ACTION_EFFORT_MINUTES[def.unit] || 0;
	if (!(perAction > 0)) return 0;

	const perUnit = perAction * taskAttemptsPerSuccess(def, elig);
	if (!(perUnit > 0)) return 0;

	return Math.ceil(tierTargetMinutes('hard', period) / perUnit);
}

export function feasibleUsesInPeriod(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const minutes = PERIOD_MINUTES[period];
	const effectKey = def.costEffect && def.costEffect !== '*' ? def.costEffect : def.durationEffect;
	const items = effectItems(effectKey, elig);

	const days = Math.max(1, Math.round(minutes / PERIOD_MINUTES.daily));

	let cap = Infinity;
	if (COUNTED_ACTION_UNITS.has(def.unit)) cap = DAILY_ACTION_CAP * days;
	if (isActivityAction(def)) cap = Math.min(cap, Math.max(ACTIVITY_ACTION_CAP[period], hardTierUnitCap(def, elig, period)));

	if (def.unit === 'items' && !def.targetsItem) {
		cap = Math.min(cap, Math.max(DISCARDABLE_CAP, hardTierUnitCap(def, elig, period)));
	}

	if (def.durationEffect && def.unit === 'minutes') {
		const longest = Math.max(0, ...items.map((c) => Number(c.durationMinutes) || 0));
		if (longest > 0) return Math.max(1, Math.min(maxMinuteGoal(period), longest * Math.max(1, Math.floor(minutes / longest))));
	}

	const gateKeys = def.durationEffect ? (['cooldownMinutes', 'durationMinutes'] as const) : (['cooldownMinutes'] as const);
	for (const key of gateKeys) {
		const gates = items.map((c) => Number(c[key]) || 0).filter((v) => v > 0);
		if (gates.length > 0) cap = Math.min(cap, Math.max(1, Math.floor(minutes / Math.min(...gates))));
	}

	if (isPeakMetric(def)) {
		const others = Math.max(0, (Number(elig.memberCount) || 0) - 1);
		return Math.max(1, Math.min(cap, others, PEAK_CONCURRENCY_CAP));
	}

	const pvpXp = def.unit === 'xp' && xpPerUseFor(def, elig) > 0;

	if (def.unit === 'members' || pvpXp) {
		const others = Math.max(0, (Number(elig.memberCount) || 0) - 1);
		if (others > 0) {
			const immunities = items.map((c) => Number(c.immunityMinutes) || 0).filter((v) => v > 0);
			const perTarget = immunities.length > 0 ? Math.max(1, Math.floor(minutes / Math.min(...immunities))) : days;
			cap = Math.min(cap, others * perTarget);
		}
	}

	if (def.unit === 'xp') {
		const perMinute = metricXpPerMinute(def.metric, elig);
		if (perMinute > 0) return Math.max(1, Math.floor(maxMinuteGoal(period) * perMinute));

		const perUse = xpPerUseFor(def, elig);
		if (perUse > 0) {
			const byTime = Math.floor(tierTargetMinutes('hard', period) / (ACTION_EFFORT_MINUTES.members ?? 1));
			const uses = Math.max(1, Math.min(Number.isFinite(cap) ? cap : byTime, byTime));
			return Math.max(1, Math.floor(uses * perUse));
		}

		const perMinuteSpend = effortMinuteWorth(elig) / Math.max(SPEND_DIFFICULTY_WEIGHT, 1e-6);
		return Math.max(1, Math.ceil(tierTargetMinutes('hard', period) * perMinuteSpend));
	}

	if (!Number.isFinite(cap)) return cap;

	const perAction = ACTION_EFFORT_MINUTES[def.unit] ?? 0;
	if (perAction > 0) cap = Math.min(cap, Math.floor(minutes / perAction));

	return Math.max(1, Math.floor(cap / taskAttemptsPerSuccess(def, elig)));
}

export const SPEND_BUDGET_SHARE = 0.6;
export const DIFFICULTY_STRETCH: Record<TaskDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

export const TENURE_RAMP_DAYS = RECENT_WINDOW_DAYS;

export function tenureShare(elig: TaskEligibility): number {
	const days = Math.max(0, Number(elig.activeDays) || 0);
	if (days >= TENURE_RAMP_DAYS) return 1;
	return Math.max(1 / TENURE_RAMP_DAYS, (days + 1) / TENURE_RAMP_DAYS);
}

export const TIER_EFFORT_WEIGHT: Record<RarityTier, number> = {
	common: 1,
	uncommon: 0.85,
	rare: 0.7,
	epic: 0.55,
	legendary: 0.4,
	mythic: 0.3
};

export function taskItemTier(def: TaskDefinition, elig: TaskEligibility, targetCost = 0): RarityTier {
	const costs = (elig.catalog ?? []).map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	if (costs.length === 0) return 'common';

	const cost = targetCost > 0 ? targetCost : effectUnitCost(def.costEffect || def.durationEffect || '*', elig);
	if (!(cost > 0)) return 'common';

	return rarityTierFor(cost, costs);
}

export function spendBudget(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const earn = serverEarnRate(elig, period);
	const spends = !!(def.costEffect || def.durationEffect || def.targetsItem || def.costIsGoal);
	if (!spends) return earn;

	const banked = Math.max(0, Number(elig.baselines?.xp_gained) || 0);
	const affordable = earn + banked * SPEND_BUDGET_SHARE;

	return Math.max(earn, affordable) * tenureShare(elig);
}

export const SPEND_BUDGET_EARN_CAP = 3;

export const DIFFICULTY_RATE_SHARE: Record<TaskDifficulty, number> = { easy: 0.35, medium: 0.8, hard: 1.35 };

export const RATE_CONFIDENCE_MIN = 3;

export function measuredRate(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number | null {
	const observed = Number((elig.recentDaily ?? {})[def.metric]);
	if (!Number.isFinite(observed) || observed <= 0) return null;

	const days = Math.max(1, Math.round(PERIOD_MINUTES[period] / PERIOD_MINUTES.daily));
	return observed * days;
}

export function goalFromHistory(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod): number | null {
	if (isPeakMetric(def)) {
		const peak = Number((elig.recentPeak ?? {})[def.metric]);
		if (!Number.isFinite(peak) || peak <= 0) return null;
		const stretch = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2;
		return Math.max(1, Math.round(peak) + stretch);
	}

	const rate = measuredRate(def, elig, period);
	if (rate === null) return null;

	const target = rate * DIFFICULTY_RATE_SHARE[difficulty];
	if (rate < RATE_CONFIDENCE_MIN && !COUNTED_ACTION_UNITS.has(def.unit)) return null;

	return Math.max(1, Math.round(target));
}

export function tierTargetMinutes(difficulty: TaskDifficulty, period: TaskPeriod): number {
	return Math.max(1, gradeBudgetMinutes(period) * ACTIVITY_TIER_SHARE[difficulty]);
}

export function gradeBudgetMinutes(period: TaskPeriod): number {
	return maxMinuteGoal(period) * XP_YIELD_SHARE;
}

export function unitWorkMinutes(def: TaskDefinition, elig: TaskEligibility, targetCost = 0): number {
	if (def.unit === 'minutes') return 1;

	if (def.unit === 'xp') {
		const perMinute = metricXpPerMinute(def.metric, elig);
		if (perMinute > 0) return 1 / perMinute;

		const perUse = xpPerUseFor(def, elig);
		if (perUse > 0) {
			const perUseSpend = spendMinutes(unitSpendXp(def, elig, targetCost) / Math.max(1, def.costFixedUnits ?? 1), elig, 1);
			return ((ACTION_EFFORT_MINUTES.members ?? 1) + perUseSpend) / perUse;
		}

		return spendMinutes(1, elig, Infinity);
	}

	const perAction = activityUnitMinutes(def, elig) || ACTION_EFFORT_MINUTES[def.unit] || 0;
	const attempts = taskAttemptsPerSuccess(def, elig);
	const action = perAction * attempts;
	const spend = spendMinutes(unitSpendXp(def, elig, targetCost), elig);

	return action + spend;
}

export function fixedWorkMinutes(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const marginal = unitSpendXp(def, elig, targetCost);
	const fixedSpend = Math.max(0, taskCostXp(def, 1, elig, targetCost) - marginal);
	if (!(fixedSpend > 0)) return 0;

	return spendMinutes(fixedSpend, elig, 1);
}

export function unitSpendXp(def: TaskDefinition, elig: TaskEligibility, targetCost = 0): number {
	const one = taskCostXp(def, 1, elig, targetCost);
	const two = taskCostXp(def, 2, elig, targetCost);
	return Math.max(0, two - one) || one;
}

export function goalAffordableMax(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const marginal = unitSpendXp(def, elig, targetCost);
	if (!(marginal > 0)) return Infinity;

	const fixed = Math.max(0, taskCostXp(def, 1, elig, targetCost) - marginal);
	const budget = spendBudget(def, elig, period) - fixed;
	if (!(budget > 0)) return 1;

	const affordable = Math.floor(budget / marginal);
	const payable = Math.floor((serverEarnRate(elig, period) * WORTH_BUDGET_SHARE) / marginal);

	return Math.max(1, affordable, Math.min(MIN_TIER_SPREAD, payable));
}

export function goalCeiling(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return Math.max(
		1,
		Math.min(feasibleUsesInPeriod(def, elig, period), goalPayableMax(def, elig, period, targetCost), goalAffordableMax(def, elig, period, targetCost))
	);
}

export const DELIBERATE_UNITS = new Set(['times', 'rounds', 'wins', 'items', 'members', 'trades']);

export const HARD_ACTIONS_PER_DAY = UNMEASURED_INFLICTED_GOAL.hard;

export function actionCountCap(def: TaskDefinition, period: TaskPeriod): number {
	if (!DELIBERATE_UNITS.has(def.unit)) return Infinity;

	const perDay = def.unit === 'members' ? UNMEASURED_INFLICTED_GOAL.hard : HARD_ACTIONS_PER_DAY;

	return perDay * activeDaysInPeriod(period);
}

export function inflictedReach(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const ladder = UNMEASURED_INFLICTED_GOAL.hard;

	if (def.unit === 'xp') {
		const perHit = xpPerUseFor(def, elig) || effectPercentYield(def.costEffect ?? '*', elig);
		const basis = perHit > 0 ? perHit : serverEarnRate(elig, 'daily') * INFLICTED_XP_SHARE;
		return Math.max(1, Math.round(basis * ladder));
	}

	return ladder;
}

export function timeCountCap(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const budget = tierTargetMinutes('hard', period);

	if (def.unit === 'minutes') return budget;

	if (def.unit === 'xp') {
		const perMinute = metricXpPerMinute(def.metric, elig);
		return perMinute > 0 ? Math.floor(budget * perMinute) : Infinity;
	}

	const perAction = activityUnitMinutes(def, elig);
	return perAction > 0 ? Math.floor(budget / perAction) : Infinity;
}

export function hardTierReach(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const worth = worthLimitedGoal(def, elig, period, targetCost);
	const limit = effectRateLimit(def, elig, period);

	let reach = limit > 0 ? Math.min(worth, limit) : worth;

	reach = Math.min(reach, actionCountCap(def, period));
	reach = Math.min(reach, timeCountCap(def, elig, period));

	if (isInflicted(def)) {
		reach = Math.min(reach, inflictedReach(def, elig, period));
	}

	if (def.unit === 'members') {
		const others = Math.max(1, (Number(elig.memberCount) || 0) - 1);
		reach = Math.min(reach, others);
	}

	return Math.max(1, reach);
}

export function deriveGoal(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return goalLadder(def, elig, period, targetCost)[TIER_ORDER.indexOf(difficulty)];
}

export function goalLadder(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number[] {
	const reach = hardTierReach(def, elig, period, targetCost);
	const floor = goalFloor(def, elig);

	if (floor > 0) {
		const uses = Math.max(1, Math.round(reach / floor));
		return tierLadder(uses).map((n) => n * floor);
	}

	return tierLadder(Math.max(reach, minMeaningfulGoal(def, elig)));
}

export function goalFloor(def: TaskDefinition, elig: TaskEligibility): number {
	if (def.unit === 'minutes' && def.durationEffect) {
		return Math.max(0, Math.round(shortestEffectDuration(def.durationEffect, elig)));
	}

	if (def.unit !== 'xp') return 0;

	const perUse = xpPerUseFor(def, elig);
	return perUse > 0 ? Math.max(1, Math.round(perUse)) : 0;
}

export function shortestEffectDuration(effectKey: string, elig: TaskEligibility): number {
	const mins = effectItems(effectKey, elig)
		.map((c) => Math.max(0, Number(c.durationMinutes) || 0))
		.filter((m) => m > 0);

	return mins.length > 0 ? Math.min(...mins) : 0;
}

export function minMeaningfulGoal(def: TaskDefinition, elig: TaskEligibility): number {
	if (def.unit !== 'xp') return 0;

	const perUse = xpPerUseFor(def, elig);
	if (perUse > 0) return Math.max(1, Math.round(perUse));

	const perMinute = metricXpPerMinute(def.metric, elig) || effortMinuteWorth(elig);
	return Math.max(1, Math.round(perMinute * MIN_TIER_SPREAD));
}

export function tierLadder(reach: number): number[] {
	const top = Math.max(1, Math.round(Number(reach) || 1));

	if (top >= MIN_TIER_SPREAD) {
		return TIER_ORDER.map((d, i) => Math.max(i + 1, Math.round(top * ACTIVITY_TIER_SHARE[d])));
	}

	return TIER_ORDER.map((_, i) => Math.min(top, i + 1));
}

export function isAchievableIn(def: TaskDefinition, difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): boolean {
	const goal = deriveGoal(def, difficulty, elig, period, targetCost);

	if (def.unit !== 'xp' && goal > feasibleUsesInPeriod(def, elig, period)) return false;
	if (taskCostXp(def, goal, elig, targetCost) > spendBudget(def, elig, period)) return false;
	if (DELIBERATE_UNITS.has(def.unit) && goal > goalAffordableMax(def, elig, period, targetCost)) return false;
	if (taskWorkMinutes(def, goal, elig, period, targetCost) > PERIOD_MINUTES[period] * MINUTE_GOAL_SHARE) return false;

	return isWorthIn(def, goal, elig, period, targetCost);
}

export function isWorthIn(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): boolean {
	const cost = taskCostWorth(def, goal, elig, period, targetCost);
	if (!(cost > 0)) return true;

	return taskValueXp(def, goal, 'hard', 0, elig, period, targetCost) >= cost;
}

export function achievableDifficulties(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): TaskDifficulty[] {
	const offered = TIER_ORDER.filter((d) => isAchievableIn(def, d, elig, period, targetCost));

	const seen = new Set<number>();
	return offered.filter((d) => {
		const goal = deriveGoal(def, d, elig, period, targetCost);
		if (seen.has(goal)) return false;
		seen.add(goal);
		return true;
	});
}

export function goalPayableMax(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const marginal = Math.max(0, taskEffortXp(def, 2, elig, period, targetCost) - taskEffortXp(def, 1, elig, period, targetCost));
	const unitEffort = marginal > 0 ? marginal : Math.max(1, taskEffortXp(def, 1, elig, period, targetCost));
	return Math.max(1, Math.floor(rewardCeiling(elig) / (unitEffort * EFFORT_REWARD_MARGIN)));
}

export function xpGoalTierMinutes(difficulty: TaskDifficulty, period: TaskPeriod): number {
	return Math.max(1, Math.round(maxMinuteGoal(period) * ACTIVITY_TIER_SHARE[difficulty] * XP_YIELD_SHARE));
}

export function maxXpGoalInPeriod(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	const perMinute = metricXpPerMinute(def.metric, elig);
	if (!(perMinute > 0)) return Infinity;
	return Math.max(1, Math.floor(maxMinuteGoal(period) * perMinute));
}

export function clampGoalToPeriod(def: TaskDefinition, goal: number, period: TaskPeriod, targetItemDuration = 0): number {
	const g = Math.max(1, Math.round(Number(goal) || 1));
	if (def.unit === 'minutes') return Math.max(1, Math.min(g, maxMinuteGoal(period)));

	if (isActivityAction(def)) return g;

	if (def.targetsItem && targetItemDuration > 0) {
		return Math.max(1, Math.min(g, maxUsesInPeriod(targetItemDuration, period)));
	}

	return g;
}

export function taskGrindXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod): number {
	const unit = activityEffortUnitXp(def, elig);
	if (unit <= 0) return 0;
	return Math.round(Math.max(0, Number(goal) || 0) * unit);
}

export const EFFORT_GRIND_CAP = 60;

export const ACTION_EFFORT_MINUTES: Record<string, number> = {
	items: 1,
	rounds: 1,
	trades: 3,
	times: 5,
	wins: 5,
	members: 8
};

export function effortMinuteWorth(elig: TaskEligibility): number {
	const r = elig.levelingRates ?? DEFAULT_LEVELING_RATES;
	const voice = Math.max(0, Number(r.voiceXpPerMinute) || 0);
	if (voice > 0) return voice;

	const chatPerMinute = Math.max(0, Number(r.messageXp) || 0) * 4;
	if (chatPerMinute > 0) return chatPerMinute;

	return DEFAULT_LEVELING_RATES.voiceXpPerMinute;
}

export function payMinuteWorth(elig: TaskEligibility): number {
	const earned = (serverEarnRate(elig, 'daily') * TASK_REWARD_SHARE) / PERIOD_MINUTES.daily;

	return Math.max(effortMinuteWorth(elig), earned);
}

export function actionEffortXp(def: TaskDefinition, goal: number, elig: TaskEligibility): number {
	const minuteWorth = effortMinuteWorth(elig);
	if (minuteWorth <= 0) return 0;

	if (def.unit === 'minutes') {
		const elapsed = Math.max(0, Number(goal) || 0);
		const grind = taskGrindXp(def, elapsed, elig, 'daily');
		return Math.max(0, Math.round(elapsed * minuteWorth) - grind);
	}

	if (def.unit === 'xp') {
		const minutes = xpGoalMinutes(def, goal, elig);
		if (minutes <= 0) return 0;
		return Math.round(minutes * minuteWorth);
	}

	const perAction = ACTION_EFFORT_MINUTES[def.unit];
	if (!perAction) return 0;

	const count = isPeakMetric(def) ? 1 : Math.max(0, Number(goal) || 0);
	const attempts = count * taskAttemptsPerSuccess(def, elig);
	return Math.round(attempts * perAction * minuteWorth);
}

export function taskEffortXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return taskCostXp(def, goal, elig, targetCost) + taskGrindXp(def, goal, elig, period) + actionEffortXp(def, goal, elig);
}

export const SPEND_DIFFICULTY_WEIGHT = 0.15;

export const SPEND_MINUTES_CAP = 5;

export function spendMinutes(spend: number, elig: TaskEligibility, units = 1): number {
	const perMinute = Math.max(effortMinuteWorth(elig), serverEarnRate(elig, 'daily') / PERIOD_MINUTES.daily);
	if (!(perMinute > 0)) return 0;

	const raw = (Math.max(0, Number(spend) || 0) / perMinute) * SPEND_DIFFICULTY_WEIGHT;
	return Math.min(raw, Math.max(1, Number(units) || 1) * SPEND_MINUTES_CAP);
}

export const ACTIVITY_UNIT_MINUTES: Record<string, number> = {
	messages: 1,
	reactions: 1 / 2
};

export function activityUnitMinutes(def: TaskDefinition, elig: TaskEligibility): number {
	return ACTIVITY_UNIT_MINUTES[def.unit] ?? 0;
}

export function taskWorkMinutes(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const count = Math.max(0, Number(goal) || 0);

	if (def.unit === 'minutes') {
		const per = def.durationEffect ? effectDuration(def.durationEffect, elig) : 0;
		const uses = per > 0 ? Math.max(1, Math.ceil(count / per)) : 1;
		return count + spendMinutes(taskCostXp(def, goal, elig, targetCost), elig, uses);
	}

	const marginalUnit = unitSpendXp(def, elig, targetCost);
	const fixedSpend = Math.max(0, taskCostXp(def, 1, elig, targetCost) - marginalUnit);
	const marginalSpend = Math.max(0, taskCostXp(def, goal, elig, targetCost) - fixedSpend);
	const spend = spendMinutes(fixedSpend, elig, 1) + spendMinutes(marginalSpend, elig, count);

	if (def.unit === 'xp') {
		const earned = xpGoalMinutes(def, goal, elig);
		if (earned > 0) return earned + spend;

		const perUse = xpPerUseFor(def, elig);
		if (perUse > 0) {
			const uses = count / perUse;
			const useSpend = spendMinutes(requiredSpendXp(def, goal, elig, period, targetCost), elig, Math.max(1, Math.ceil(uses)));
			return uses * (ACTION_EFFORT_MINUTES.members ?? 1) + useSpend;
		}

		return Math.max(spend, spendMinutes(count, elig, Infinity));
	}

	const perAction = activityUnitMinutes(def, elig) || ACTION_EFFORT_MINUTES[def.unit] || 0;
	if (perAction <= 0) return spend;

	const units = isPeakMetric(def) ? 1 : count;
	return units * taskAttemptsPerSuccess(def, elig) * perAction + spend;
}

export function taskWorkXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return Math.round(taskWorkMinutes(def, goal, elig, period, targetCost) * payMinuteWorth(elig));
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

	if (isActivityAction(def)) return clampGoalToPeriod(def, start, period);
	if (worth <= 0) return clampGoalToPeriod(def, start, period, targetItemDurationFor(targetItemId, elig));

	const earned = Math.round(worth / EFFORT_REWARD_MARGIN);

	let unitEffort = taskEffortXp(def, start, elig, period, targetCost) / start;

	const durCap = targetItemDurationFor(targetItemId, elig);

	if (!Number.isFinite(unitEffort) || unitEffort <= 0) {
		const rate = serverEarnRate(elig, period);
		if (rate <= 0) return clampGoalToPeriod(def, start, period, durCap);
		const feasible = feasibleUsesInPeriod(def, elig, period);
		const spread = Number.isFinite(feasible) ? Math.max(1, feasible) : Math.max(1, start);
		unitEffort = (rate * EFFORT_BANDS[difficulty]) / spread;
	}
	if (unitEffort <= 0) return clampGoalToPeriod(def, start, period, durCap);

	const needed = Math.ceil(earned / unitEffort);
	const unitXp = activityEffortUnitXp(def, elig);
	const reachable = unitXp > 0 ? Math.ceil((serverEarnRate(elig, period) * GOAL_CAPACITY_STRETCH) / unitXp) : 0;
	const ceiling = Math.max(start * GOAL_STRETCH_MAX, reachable);

	return clampGoalToPeriod(def, Math.max(start, Math.min(needed, ceiling)), period, targetItemDurationFor(targetItemId, elig));
}

export const TIER_GRADE_TOLERANCE = 0.9;

export function taskCostWorth(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const amount = Math.max(0, Number(goal) || 0);

	if (def.unit === 'xp') {
		const timeToEarn = taskWorkMinutes(def, goal, elig, period, targetCost) * effortMinuteWorth(elig);
		const kept = taskRefundXp(def, goal, elig, period, targetCost) > 0 ? 0 : amount;

		return Math.max(kept, timeToEarn);
	}

	const minutes = taskWorkMinutes(def, goal, elig, period, targetCost);
	const timeWorth = minutes * payMinuteWorth(elig);
	const risk = riskPerUnitXp(def, elig, period) * amount;
	const suffered = sufferedLossXp(def, elig) * amount;

	return Math.max(0, timeWorth + risk + suffered);
}

export function taskRefundXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const amount = Math.max(0, Number(goal) || 0);
	const spend = Math.max(0, requiredSpendXp(def, goal, elig, period, targetCost));
	if (def.unit !== 'xp') return spend;

	const forfeited = def.costIsGoal || isInflicted(def) ? amount : 0;

	return Math.max(spend, forfeited);
}

export function sufferedLossXp(def: TaskDefinition, elig: TaskEligibility): number {
	if (!isInflicted(def)) return 0;
	if (def.unit === 'xp') return 1;

	const pct = effectPercentYield('steal|bomb|leech', elig);
	if (!(pct > 0)) return 0;

	return (unboostedEarnRate(elig, 'daily') * pct) / 100;
}

export const WAGER_RISK_SHARE = 0.05;

export function riskPerUnitXp(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod): number {
	if (def.requires !== 'minigames') return 0;
	if (def.unit === 'xp' || def.costIsGoal) return 0;

	const bankroll = unboostedEarnRate(elig, 'daily') * WORTH_BUDGET_SHARE;
	if (!(bankroll > 0)) return 0;

	return bankroll * WAGER_RISK_SHARE * taskAttemptsPerSuccess(def, elig);
}

export function worthBudget(elig: TaskEligibility, period: TaskPeriod, def?: TaskDefinition): number {
	const income = serverEarnRate(elig, period) * WORTH_BUDGET_SHARE;
	if (!def) return income;

	const spends = !!((def.costEffect && def.costEffect !== '*') || def.durationEffect || def.targetsItem || def.costIsGoal);
	if (!spends) return income;

	const payable = (serverEarnRate(elig, period) * REWARD_INCOME_CAP) / EFFORT_REWARD_MARGIN;
	return Math.min(Math.max(income, spendBudget(def, elig, period) * WORTH_BUDGET_SHARE), payable);
}

export const WORTH_BUDGET_SHARE = 0.35;

export const REWARD_INCOME_CAP = MIN_TIER_SPREAD * 1.5;

export function worthLimitedGoal(def: TaskDefinition, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	const ceiling = goalCeiling(def, elig, period, targetCost);
	const budget = worthBudget(elig, period, def);
	if (!(budget > 0)) return ceiling;

	const unit = taskCostWorth(def, 1, elig, period, targetCost);
	if (!(unit > 0)) return ceiling;

	const marginal = Math.max(unit, taskCostWorth(def, 2, elig, period, targetCost) - unit);
	const fixed = Math.max(0, taskCostWorth(def, 1, elig, period, targetCost) - marginal);

	const affordableSteps = Math.floor((budget - fixed) / marginal);
	const viable = Math.max(affordableSteps, Math.min(MIN_TIER_SPREAD, ceiling));

	return Math.max(1, Math.min(ceiling, viable));
}

export function gradeByMinutes(minutes: number, period: TaskPeriod): TaskDifficulty {
	const budget = gradeBudgetMinutes(period);
	if (budget <= 0) return 'medium';

	const share = Math.max(0, Number(minutes) || 0) / budget;
	if (share >= ACTIVITY_TIER_SHARE.hard * TIER_GRADE_TOLERANCE) return 'hard';
	if (share >= ACTIVITY_TIER_SHARE.medium * TIER_GRADE_TOLERANCE) return 'medium';
	return 'easy';
}

export function gradeTask(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): TaskDifficulty {
	const reach = hardTierReach(def, elig, period, targetCost);
	if (!(reach > 0)) return gradeByMinutes(taskWorkMinutes(def, goal, elig, period, targetCost), period);

	const g = Math.max(0, Number(goal) || 0);
	const tiers = goalLadder(def, elig, period, targetCost);

	if (tiers[0] >= tiers[TIER_ORDER.length - 1]) return 'easy';

	for (let i = 0; i < TIER_ORDER.length; i++) {
		if (g <= tiers[i]) return TIER_ORDER[i];
	}

	return TIER_ORDER[TIER_ORDER.length - 1];
}

export function gradeDifficulty(effort: number, elig: TaskEligibility, period: TaskPeriod, def?: TaskDefinition): TaskDifficulty {
	const perMinute = effortMinuteWorth(elig);
	if (!(perMinute > 0)) return 'medium';
	return gradeByMinutes(Math.max(0, Number(effort) || 0) / perMinute, period);
}

export function requiredSpendXp(def: TaskDefinition, goal: number, elig: TaskEligibility, period: TaskPeriod, targetCost = 0): number {
	return taskCostXp(def, goal, elig, targetCost);
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
	const streakBonus = 1 + Math.min(1, Math.max(0, streak) * 0.02);
	const effort = taskCostWorth(def, goal, elig, period, targetCost);
	const refund = taskRefundXp(def, goal, elig, period, targetCost);

	const cap = serverEarnRate(elig, period) * REWARD_INCOME_CAP;
	const paid = refund + effort * EFFORT_REWARD_MARGIN * streakBonus;
	const worth = Math.min(Math.round(paid), Math.round(cap));

	return Math.max(XP_REWARD_MIN, Math.min(rewardCeiling(elig), worth));
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
	const derived = deriveGoal(def, difficulty, elig, period, targetCost);

	if (def.durationEffect) {
		const per = effectDuration(def.durationEffect, elig);
		if (per <= 0) return 0;
		const uses = Math.max(1, Math.min(derived, feasibleUsesInPeriod(def, elig, period)));
		return clampGoalToPeriod(def, uses * per, period);
	}

	const jitter = 0.85 + rand() * 0.3;
	let scaled = Math.round(derived * jitter);

	if (derived >= 1000) {
		const step = derived >= 10000 ? 500 : 100;
		scaled = Math.round(scaled / step) * step;
	}

	return Math.max(1, Math.min(scaled || derived, feasibleUsesInPeriod(def, elig, period)));
}

export type GeneratedTask = {
	slot: number;
	taskType: string;
	difficulty: TaskDifficulty;
	goal: number;
	targetItemId?: number | null;
	effort?: number;
	work?: number;
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
		const difficulty = plan[slot];
		const rand = mulberry32(hashSeed(period, memberId, serverId, periodKey, slot));

		const available = pool.filter((d) => !used.has(d.id) && isViableFor(d, elig, period));
		if (available.length === 0) break;

		const gradeable = available.filter((d) => canReachDifficulty(d, difficulty, elig, period));
		const candidates = gradeable.length > 0 ? gradeable : available;

		const build = (pick: TaskDefinition) => {
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
			const effort = taskEffortXp(pick, goal, elig, period, targetCost);
			const work = taskWorkXp(pick, goal, elig, period, targetCost);

			return { slot, taskType: pick.id, difficulty, goal, targetItemId, effort, work, targetCost };
		};

		let chosenTask: GeneratedTask | null = null;
		for (let attempt = 0; attempt < GRADE_MATCH_ATTEMPTS && chosenTask === null; attempt++) {
			const pick = candidates[Math.floor(rand() * candidates.length) % candidates.length];
			const built = build(pick);
			if (isAchievableIn(pick, difficulty, elig, period, built.targetCost)) {
				used.add(pick.id);
				chosenTask = built;
			}
		}

		if (chosenTask === null) {
			const pick = candidates[Math.floor(rand() * candidates.length) % candidates.length];
			used.add(pick.id);
			chosenTask = build(pick);
		}

		out.push(chosenTask);
	}

	return out;
}

export type RewardPlan = { kind: 'xp'; xp: number } | { kind: 'item'; itemId: number; xp: 0 };

export const XP_REWARD_MIN = 1000;

export function difficultyRewardFloor(difficulty: TaskDifficulty, elig: TaskEligibility, period: TaskPeriod): number {
	const floor = Math.round(serverEarnRate(elig, period) * EFFORT_BANDS[difficulty] * EFFORT_REWARD_MARGIN);
	return Math.max(XP_REWARD_MIN, Math.min(floor, rewardCeiling(elig)));
}
export const XP_REWARD_MAX = 20000000;

export function rewardCeiling(elig: TaskEligibility): number {
	const priced = (elig.catalog ?? []).map((c) => Number(c.cost) || 0).filter((c) => c > 0);
	if (priced.length === 0) return XP_REWARD_MAX;
	return Math.min(XP_REWARD_MAX, Math.round(Math.max(...priced) * EFFORT_REWARD_MARGIN));
}

export const EFFORT_REWARD_MARGIN = 1.5;

export const TASK_REWARD_SHARE = 0.5;

export const FLOOR_EFFORT_CAP = 4;

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

export const LOGIN_TIER_BASE_ODDS: Record<RarityTier, number> = {
	common: 50,
	uncommon: 24,
	rare: 14,
	epic: 8,
	legendary: 3,
	mythic: 1
};

export const LOGIN_TIER_DAY_GROWTH: Record<RarityTier, number> = {
	common: 0,
	uncommon: 0.5,
	rare: 0.5,
	epic: 0.5,
	legendary: 0.5,
	mythic: 0.5
};

export const LOGIN_TIER_DRAIN: RarityTier = 'common';

export function loginTierOdds(day: number): Record<RarityTier, number> {
	const steps = Math.max(0, Math.min(LOGIN_CYCLE_DAYS, Math.round(Number(day) || 1)) - 1);

	const odds = { ...LOGIN_TIER_BASE_ODDS };
	let drained = 0;

	for (const tier of Object.keys(LOGIN_TIER_DAY_GROWTH) as RarityTier[]) {
		const growth = LOGIN_TIER_DAY_GROWTH[tier] * steps;
		if (growth <= 0) continue;
		odds[tier] += growth;
		drained += growth;
	}

	odds[LOGIN_TIER_DRAIN] = Math.max(0, odds[LOGIN_TIER_DRAIN] - drained);

	return odds;
}

export function loginTierOddsFor<T extends { cost: number }>(catalog: T[], day: number): { tier: RarityTier; chance: number }[] {
	const priced = catalog.filter((c) => (Number(c.cost) || 0) > 0);
	if (priced.length === 0) return [];

	const costs = priced.map((c) => Number(c.cost) || 0);
	const stocked = new Set(priced.map((c) => rarityTierFor(Number(c.cost) || 0, costs)));

	const odds = loginTierOdds(day);
	const live = (Object.keys(odds) as RarityTier[]).filter((t) => stocked.has(t));

	const total = live.reduce((sum, t) => sum + odds[t], 0);
	if (!(total > 0)) return live.map((tier) => ({ tier, chance: 100 / live.length }));

	return live.map((tier) => ({ tier, chance: (odds[tier] / total) * 100 }));
}

export function pickTierByDay<T extends { cost: number }>(catalog: T[], day: number, roll: number): RarityTier | null {
	const table = loginTierOddsFor(catalog, day);
	if (table.length === 0) return null;

	let cursor = Math.min(0.9999999, Math.max(0, roll)) * 100;
	for (const row of table) {
		cursor -= row.chance;
		if (cursor < 0) return row.tier;
	}
	return table[table.length - 1].tier;
}

export function pickGachaItem<T extends { id: number; cost: number }>(catalog: T[], day: number, tierRoll: number, itemRoll: number): T | null {
	const priced = catalog.filter((c) => (Number(c.cost) || 0) > 0);
	if (priced.length === 0) return null;

	const tier = pickTierByDay(priced, day, tierRoll);
	if (tier === null) return null;

	const costs = priced.map((c) => Number(c.cost) || 0);
	const pool = priced.filter((c) => rarityTierFor(Number(c.cost) || 0, costs) === tier);
	if (pool.length === 0) return pickWeightedByRarity(priced, itemRoll);

	return pool[Math.floor(Math.min(0.9999999, Math.max(0, itemRoll)) * pool.length) % pool.length];
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
	const ceiling = rewardCeiling({ catalog } as TaskEligibility);
	const floor = Math.max(0, Math.round(Number(minWorth) || 0));
	const worth = Math.max(XP_REWARD_MIN, floor, Math.min(ceiling, Math.round(Number(value) || 0)));
	const rand = mulberry32(hashSeed('reward', period, memberId, periodKey, slot));

	if (catalog.length > 0 && rand() < TASK_ITEM_REWARD_CHANCE) {
		const affordable = catalog.filter((c) => (Number(c.cost) || 0) >= worth * ITEM_VALUE_FLOOR);
		const fair = affordable.filter((c) => (Number(c.cost) || 0) <= worth);

		const pool = fair.length > 0 ? fair : cheapestOf(affordable);
		if (pool.length > 0) {
			const picked = pool[Math.floor(rand() * pool.length) % pool.length];
			if (picked) return { kind: 'item', itemId: picked.id, xp: 0 };
		}
	}

	const xp = Math.max(XP_REWARD_MIN, floor, Math.min(ceiling, Math.round(worth / 100) * 100));
	return { kind: 'xp', xp };
}

export const LOGIN_DAY_XP = [1000, 2500, 5000, 9000, 15000, 25000, 50000] as const;
export const LOGIN_ITEM_REWARD_CHANCE = 0.5;

export type LoginReward = { day: number; kind: 'xp'; xp: number; jackpot: boolean } | { day: number; kind: 'item'; itemId: number; jackpot: boolean };

export function loginRewardFor(memberId: number, cycleIndex: number, day: number, catalog: { id: number; cost: number }[], dailyEarn = 0): LoginReward {
	const jackpot = day === LOGIN_CYCLE_DAYS;
	const rand = mulberry32(hashSeed('login', memberId, cycleIndex, day));

	const worth = LOGIN_DAY_XP[Math.max(0, Math.min(LOGIN_CYCLE_DAYS - 1, day - 1))];

	if (catalog.length > 0 && rand() < LOGIN_ITEM_REWARD_CHANCE) {
		const picked = pickGachaItem(catalog, day, rand(), rand());
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
