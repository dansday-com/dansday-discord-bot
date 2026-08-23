import { ITEM_EFFECTS, effectAccentHex, effectGuide, effectSummary } from './items.js';

export const GUIDE_TITLE = 'How the XP Game Works';
export const GUIDE_SUBTITLE = 'Earn XP, clear tasks, shop for items, and outplay everyone.';

export const GUIDE_SECTIONS = {
	earn: { icon: 'fas fa-bolt', heading: 'How to earn XP', lead: 'XP is the currency for everything here, and your rank on the leaderboard.' },
	basics: { icon: 'fas fa-circle-info', heading: 'Know the basics', lead: 'The words you will see around your account, and what each one means.' },
	items: { subHeading: 'Every item explained', notInShop: 'Not in this shop yet' },
	tips: { icon: 'fas fa-chess-knight', heading: 'Strategy & combos' }
};

export type GuideCard = { icon: string; accent: string; title: string; desc: string };
export type GuideStep = { icon: string; title: string; desc: string };
export type GuideNote = { icon: string; accent: string; title: string; text: string };

export const EARN_METHODS: GuideCard[] = [
	{ icon: 'fa-comments', accent: '#5a8a1f', title: 'Chat', desc: 'Messages in enabled channels earn XP.' },
	{ icon: 'fa-microphone', accent: '#1d6f8a', title: 'Voice', desc: 'Active minutes in voice earn XP, AFK minutes earn less.' },
	{ icon: 'fa-video', accent: '#7b5ea7', title: 'Video', desc: 'Camera on in voice pays bonus XP per minute.' },
	{ icon: 'fa-tower-broadcast', accent: '#c8911a', title: 'Streaming', desc: 'Going live or screen-sharing pays extra per minute.' }
];

export const FRIEND_BOOST: GuideNote = {
	icon: 'fa-handshake',
	accent: '#2f8f4e',
	title: '🤝 Friend Boost',
	text: 'Every other member sharing your voice channel adds +10% voice XP, and it stacks — five friends is +50%.'
};

export const BASICS: GuideCard[] = [
	{
		icon: 'fa-wallet',
		accent: '#245f73',
		title: 'Wallet XP',
		desc: 'Your XP is both level progress and shop currency, so spending or losing it drops your rank.'
	},
	{
		icon: 'fa-wand-magic-sparkles',
		accent: '#7b5ea7',
		title: 'Effect status',
		desc: 'Active buffs and debuffs sit as chips at the top with the time each has left.'
	},
	{
		icon: 'fa-stopwatch',
		accent: '#d35400',
		title: 'Cooldown',
		desc: 'Steal, bomb and insurance lock for a while after use. A Purifier never clears cooldowns.'
	},
	{
		icon: 'fa-shield-halved',
		accent: '#1f9e8f',
		title: 'Immunity',
		desc: 'Right after you are robbed or bombed, attacks bounce off until the window runs out.'
	},
	{ icon: 'fa-crosshairs', accent: '#a8327d', title: 'Bounty', desc: 'A bounty puts XP on a member’s head for whoever robs or bombs them next.' },
	{
		icon: 'fa-clock-rotate-left',
		accent: '#4b6584',
		title: 'History',
		desc: 'Every buy, use, attack, trade and reward is logged. Disguised attackers stay anonymous.'
	}
];

export type GuideFeature = {
	id: string;
	icon: string;
	title: string;
	lead: string;
	steps: GuideStep[];
	cards: GuideCard[];
	note: GuideNote;
};

export const FEATURES: GuideFeature[] = [
	{
		id: 'items',
		icon: 'fa-cart-shopping',
		title: 'Items & the shop',
		lead: 'Spend XP on buffs, protection and attacks. Your bag holds 50 items.',
		steps: [
			{ icon: 'fa-store', title: 'Open Items', desc: 'Browse by category. Each card shows its cost and effect.' },
			{ icon: 'fa-coins', title: 'Buy with XP', desc: 'Copies stack on one card, and every price drops while Luck runs.' },
			{ icon: 'fa-bolt', title: 'Use it', desc: 'Hit Use on an owned card. Buffs apply instantly, Remove drops one.' },
			{ icon: 'fa-crosshairs', title: 'Pick a target', desc: 'Steal, bomb, leech, spy, gift and bounty ask who to hit.' }
		],
		cards: [],
		note: {
			icon: 'fa-triangle-exclamation',
			accent: '#b23b2e',
			title: '⚠️ XP you spend is gone',
			text: 'Buying takes XP straight out of your Wallet, so it can cost you levels and leaderboard places. Buy what you will actually use.'
		}
	},
	{
		id: 'tasks',
		icon: 'fa-list-check',
		title: 'Tasks & streaks',
		lead: 'Eighteen daily goals plus eighteen harder weekly ones, generated from what you already do here.',
		steps: [
			{ icon: 'fa-calendar-check', title: 'Check in', desc: 'Claim one day of the 7-day cycle. Day 7 pays 50,000 XP.' },
			{ icon: 'fa-bolt', title: 'Just play', desc: 'Chat, voice, gamble, trade or attack — progress tracks itself.' },
			{ icon: 'fa-gift', title: 'Claim rewards', desc: 'Finished tasks pay XP or a shop item, delivered straight to your bag.' },
			{ icon: 'fa-fire', title: 'Keep the streak', desc: 'Finish any one task — daily or weekly — to bank the day. +2% task XP per streak day, up to +100%.' }
		],
		cards: [
			{ icon: 'fa-sun', accent: '#c8911a', title: '18 tasks every day', desc: 'Six easy, six medium, six hard, reset at midnight on your own clock.' },
			{ icon: 'fa-calendar-week', accent: '#7b5ea7', title: '18 weekly tasks', desc: 'All hard, Monday to Sunday, sized against a full week of activity.' },
			{
				icon: 'fa-gauge-high',
				accent: '#245f73',
				title: 'Goals sized to you',
				desc: 'Built from your own last seven days of that exact activity, never from your level.'
			},
			{
				icon: 'fa-scale-balanced',
				accent: '#8e44ad',
				title: 'Honest difficulty',
				desc: 'Easy really is easy — every goal is graded on the effort it actually takes.'
			},
			{ icon: 'fa-gift', accent: '#1a7f57', title: 'XP or an item', desc: 'Every task has a 30% chance of paying a shop item instead of XP.' },
			{ icon: 'fa-fire', accent: '#d35400', title: 'Streak', desc: 'Milestones at 7, 30, 100 and 365 days get announced in the server.' },
			{ icon: 'fa-snowflake', accent: '#1d6f8a', title: 'Freezes', desc: 'Two cover a missed day by themselves, one back every 10 claims.' }
		],
		note: {
			icon: 'fa-calendar-check',
			accent: '#c8911a',
			title: '🎁 Daily check-in',
			text: 'One claim a day. XP runs 1,000 up to 50,000 on day 7, and every day has a 50% shot at a shop item instead. Rare drops get likelier the deeper you go — mythic 1% on day 1, 4% on day 7. Miss a day and you restart at day 1.'
		}
	},
	{
		id: 'minigames',
		icon: 'fa-dice',
		title: 'Minigames',
		lead: 'Free-to-play games where you wager XP for a shot at more. New games get added over time.',
		steps: [
			{ icon: 'fa-dice', title: 'Open Minigames', desc: 'Pick a game from the Minigames tab. No item or ticket needed.' },
			{ icon: 'fa-percent', title: 'Set your odds', desc: 'In Gamble you pick the multiplier up to 10×; win chance is 100 ÷ it.' },
			{ icon: 'fa-coins', title: 'Wager XP', desc: 'Only XP earned above your level is at risk, so a loss never de-levels you.' },
			{ icon: 'fa-bolt', title: 'Play & win', desc: 'Results post to the channel and feed the Minigames leaderboard.' }
		],
		cards: [],
		note: {
			icon: 'fa-triangle-exclamation',
			accent: '#b23b2e',
			title: '⚠️ The house edge shows up over time',
			text: 'Odds are fair on each play, but chasing losses drains XP fast. Only wager what you can afford to drop on the leaderboard.'
		}
	},
	{
		id: 'assets',
		icon: 'fa-chart-line',
		title: 'Assets market',
		lead: 'Invest XP in real crypto at live prices — no real money and no real coins.',
		steps: [
			{ icon: 'fa-magnifying-glass', title: 'Open Assets', desc: 'Browse the Top 50, Gainers, Losers, or search any coin.' },
			{ icon: 'fa-arrow-trend-up', title: 'Invest XP', desc: 'Buy from 10,000 XP up. Buying again averages into one holding.' },
			{ icon: 'fa-wallet', title: 'Watch it move', desc: 'Invested XP leaves your Wallet and your level until you sell.' },
			{ icon: 'fa-hand-holding-dollar', title: 'Sell anytime', desc: 'No cooldown. XP comes back scaled by how the price moved.' }
		],
		cards: [
			{ icon: 'fa-coins', accent: '#245f73', title: 'XP becomes the investment', desc: 'Invested XP leaves your Wallet and your level until you sell.' },
			{ icon: 'fa-shield-halved', accent: '#1f9e8f', title: 'Safe from attacks', desc: 'XP inside an asset cannot be stolen, bombed or leeched.' },
			{ icon: 'fa-arrow-trend-up', accent: '#1a7f57', title: 'Real market prices', desc: 'Live crypto prices in IDR, with no cooldown on selling.' },
			{ icon: 'fa-clock-rotate-left', accent: '#4b6584', title: 'Tracked in History', desc: 'Every buy and sell is logged with what it earned or cost you.' }
		],
		note: {
			icon: 'fa-triangle-exclamation',
			accent: '#b23b2e',
			title: '⚠️ Prices go down too',
			text: 'The market is real and volatile. If a coin drops after you buy, selling returns less XP than you invested.'
		}
	}
];

export const TIPS: { icon: string; accent: string; text: string }[] = [
	{ icon: 'fa-magnifying-glass', accent: effectAccentHex('spy'), text: 'Spy before you attack so you never waste an item on a shielded target.' },
	{ icon: 'fa-triangle-exclamation', accent: effectAccentHex('spy'), text: 'A risky Spy can backfire — fail and the target is alerted with your name.' },
	{ icon: 'fa-mask', accent: effectAccentHex('disguise'), text: 'Disguise hides your name, but a lucky Spy can still unmask you.' },
	{ icon: 'fa-shield', accent: effectAccentHex('shield'), text: 'Raise a Shield before you log off so nobody farms you while away.' },
	{ icon: 'fa-soap', accent: effectAccentHex('purifier'), text: 'Stuck with a leech draining you? A Purifier wipes it instantly.' },
	{ icon: 'fa-arrows-rotate', accent: effectAccentHex('reflect'), text: 'Expecting a hit? Reflect turns their attack back on them.' },
	{ icon: 'fa-clover', accent: effectAccentHex('luck'), text: 'Activate Luck first — timed buffs lock in the luck you had when you used them.' },
	{ icon: 'fa-crosshairs', accent: effectAccentHex('bounty'), text: 'Placed a Bounty? Land the hit yourself before someone else cashes in.' },
	{ icon: 'fa-shield-halved', accent: effectAccentHex('insurance'), text: 'Insurance only pays on your next loss, so use it just before you expect a hit.' },
	{ icon: 'fa-handshake', accent: '#2f8f4e', text: 'Grind voice with friends — every member in the channel adds +10% voice XP.' },
	{ icon: 'fa-fire', accent: '#d35400', text: 'Finish at least one task a day — a longer streak grows every later reward.' },
	{ icon: 'fa-calendar-week', accent: '#7b5ea7', text: 'Aim your week at the weekly tasks; the same activity clears your dailies too.' },
	{ icon: 'fa-list-check', accent: '#1a7f57', text: 'Tasks that ask you to buy or use items pay back more XP than they cost.' },
	{ icon: 'fa-chart-line', accent: '#245f73', text: 'Park XP in an asset to hide it from attacks, but watch the price.' }
];

export function buildGuideItems(items: { effect_type: string; cost?: number | null; config?: any }[]) {
	const byEffect = new Map<string, any>();
	for (const it of items ?? []) {
		if (!byEffect.has(it.effect_type)) byEffect.set(it.effect_type, it);
	}

	return ITEM_EFFECTS.map((e) => {
		const live = byEffect.get(e.id);
		return {
			id: e.id,
			label: e.label,
			emoji: e.emoji,
			icon: e.icon,
			accent: effectAccentHex(e.id),
			cost: live?.cost ?? null,
			available: !!live,
			summary: live ? effectSummary({ effect_type: e.id, config: live.config }) : e.summary(e.defaultConfig),
			guide: effectGuide(e.id)
		};
	});
}
