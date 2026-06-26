export type ItemEffectId =
	| 'steal'
	| 'bomb'
	| 'boost'
	| 'shield'
	| 'leech'
	| 'reflect'
	| 'insurance'
	| 'gamble'
	| 'gift'
	| 'bounty'
	| 'spy'
	| 'disguise'
	| 'purifier';

export const BAG_CAPACITY = 50;

export function formatDuration(minutes: any): string {
	let m = Math.max(0, Math.round(Number(minutes) || 0));
	if (m <= 0) return '0m';
	const units: [number, string][] = [
		[10080, 'w'],
		[1440, 'd'],
		[60, 'h'],
		[1, 'm']
	];
	const parts: string[] = [];
	for (const [size, suffix] of units) {
		if (m >= size) {
			const value = Math.floor(m / size);
			m -= value * size;
			parts.push(`${value}${suffix}`);
		}
	}
	return parts.slice(0, 2).join(' ');
}

function shortXp(n: any): string {
	const v = Math.max(0, Math.round(Number(n) || 0));
	if (v >= 1_000_000) return `${Number.isInteger(v / 1_000_000) ? v / 1_000_000 : (v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `${Number.isInteger(v / 1_000) ? v / 1_000 : (v / 1_000).toFixed(1)}k`;
	return `${v}`;
}

export type ItemEffect = {
	id: ItemEffectId;
	label: string;
	icon: string;
	accent: string;
	emoji: string;
	verb: string;
	targeted: boolean;
	announced: boolean;
	expiringBuff: boolean;
	defaultCost: number;
	defaultConfig: Record<string, any>;
	buffExpiredText?: (effectValue: number) => string;
	summary: (config: any) => string;
};

export const ITEM_EFFECTS: ItemEffect[] = [
	{
		id: 'steal',
		label: 'Steal',
		icon: 'fa-hand',
		accent: '#c0392b',
		emoji: '💰',
		verb: 'Steal',
		targeted: true,
		announced: true,
		expiringBuff: false,
		defaultCost: 400,
		defaultConfig: { min_percent: 1, max_percent: 25, cooldown_minutes: 30, immunity_minutes: 30 },
		summary: (c) => `Steal ${c.min_percent}–${c.max_percent}% of their XP.`
	},
	{
		id: 'bomb',
		label: 'Bomb',
		icon: 'fa-bomb',
		accent: '#d35400',
		emoji: '💥',
		verb: 'Bomb',
		targeted: true,
		announced: true,
		expiringBuff: false,
		defaultCost: 600,
		defaultConfig: { min_percent: 1, max_percent: 50, cooldown_minutes: 45, immunity_minutes: 30 },
		summary: (c) => `Destroy ${c.min_percent}–${c.max_percent}% of their XP.`
	},
	{
		id: 'boost',
		label: 'Boost',
		icon: 'fa-bolt',
		accent: '#d9a528',
		emoji: '⚡',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 800,
		defaultConfig: { multiplier: 2, effect_duration_minutes: 60, scope: 'all' },
		buffExpiredText: (m) => `Your **${m || 2}× Boost** has worn off.`,
		summary: (c) => `${c.multiplier}× XP · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'shield',
		label: 'Shield',
		icon: 'fa-shield',
		accent: '#1d6f8a',
		emoji: '🛡️',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 500,
		defaultConfig: { effect_duration_minutes: 120 },
		buffExpiredText: () => `Your **Shield** has worn off — you can be attacked again.`,
		summary: (c) => `Block all attacks · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'leech',
		label: 'Leech',
		icon: 'fa-droplet',
		accent: '#5a8a1f',
		emoji: '🩸',
		verb: 'Leech',
		targeted: true,
		announced: true,
		expiringBuff: true,
		defaultCost: 700,
		defaultConfig: { skim_percent: 10, effect_duration_minutes: 120 },
		buffExpiredText: (m) => `Your **${m || 0}% Leech** has ended.`,
		summary: (c) => `Skim ${c.skim_percent}% of their XP · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'reflect',
		label: 'Reflect',
		icon: 'fa-arrows-rotate',
		accent: '#7b5ea7',
		emoji: '🪞',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 650,
		defaultConfig: { effect_duration_minutes: 60 },
		buffExpiredText: () => `Your **Reflect** has worn off.`,
		summary: (c) => `Reflect the next attack · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'insurance',
		label: 'Insurance',
		icon: 'fa-umbrella',
		accent: '#1f9e8f',
		emoji: '💵',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 450,
		defaultConfig: { refund_percent: 50, effect_duration_minutes: 90, cooldown_minutes: 1440 },
		buffExpiredText: () => `Your **Insurance** has expired.`,
		summary: (c) => `Refund ${c.refund_percent ?? 100}% if robbed or bombed · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'gamble',
		label: 'Gamble',
		icon: 'fa-dice',
		accent: '#c8911a',
		emoji: '🎲',
		verb: 'Play',
		targeted: false,
		announced: true,
		expiringBuff: false,
		defaultCost: 0,
		defaultConfig: { win_chance: 50, payout_multiplier: 2 },
		summary: (c) => `${c.win_chance}% to win ${c.payout_multiplier}× your wager`
	},
	{
		id: 'gift',
		label: 'Gift',
		icon: 'fa-gift',
		accent: '#2f8f4e',
		emoji: '🎁',
		verb: 'Give',
		targeted: true,
		announced: true,
		expiringBuff: false,
		defaultCost: 300,
		defaultConfig: { gift_amount: 500, tax_percent: 10 },
		summary: (c) => `Send ${shortXp(c.gift_amount)} XP${c.tax_percent ? ` · −${c.tax_percent}% tax` : ''}`
	},
	{
		id: 'bounty',
		label: 'Bounty',
		icon: 'fa-crosshairs',
		accent: '#a8327d',
		emoji: '🎯',
		verb: 'Place',
		targeted: true,
		announced: true,
		expiringBuff: false,
		defaultCost: 350,
		defaultConfig: { bounty_amount: 500 },
		summary: (c) => `${shortXp(c.bounty_amount)} XP bounty · claimed on next hit`
	},
	{
		id: 'spy',
		label: 'Spy',
		icon: 'fa-magnifying-glass',
		accent: '#4b6584',
		emoji: '🔍',
		verb: 'Spy',
		targeted: true,
		announced: false,
		expiringBuff: false,
		defaultCost: 300,
		defaultConfig: {},
		summary: () => `Reveal a member's bag, active effects and cooldowns.`
	},
	{
		id: 'disguise',
		label: 'Disguise',
		icon: 'fa-mask',
		accent: '#3d3d5c',
		emoji: '🎭',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 750,
		defaultConfig: { effect_duration_minutes: 120 },
		buffExpiredText: () => `Your **Disguise** has worn off — you're visible again.`,
		summary: (c) => `Go anonymous & off the leaderboard · ${formatDuration(c.effect_duration_minutes)}`
	},
	{
		id: 'purifier',
		label: 'Purifier',
		icon: 'fa-soap',
		accent: '#2a9d8f',
		emoji: '🧼',
		verb: 'Cleanse',
		targeted: false,
		announced: false,
		expiringBuff: false,
		defaultCost: 600,
		defaultConfig: {},
		summary: () => `Wipe all your active effects — shields, leeches, immunity and more.`
	}
];

const EFFECT_BY_ID: Record<string, ItemEffect> = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, e]));

export const EFFECT_TYPE_IDS: string[] = ITEM_EFFECTS.map((e) => e.id);
export const TARGETED_EFFECTS: Set<string> = new Set(ITEM_EFFECTS.filter((e) => e.targeted).map((e) => e.id));
export const ANNOUNCED_EFFECTS: Set<string> = new Set(ITEM_EFFECTS.filter((e) => e.announced).map((e) => e.id));

export function getItemEffect(type: string): ItemEffect | undefined {
	return EFFECT_BY_ID[type];
}

export function effectLabel(type: string): string {
	return EFFECT_BY_ID[type]?.label ?? type;
}

export function effectIcon(type: string): string {
	return EFFECT_BY_ID[type]?.icon ?? 'fa-cube';
}

export const EFFECT_ACCENT_DEFAULT = '#245f73';

export const EFFECT_ACCENT_HEX: Record<string, string> = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, e.accent]));

export function effectAccentHex(type: string): string {
	return EFFECT_BY_ID[type]?.accent ?? EFFECT_ACCENT_DEFAULT;
}

export function effectAccentInt(type: string): number {
	return parseInt(effectAccentHex(type).slice(1), 16);
}

export function effectAccentCssVars(): string {
	const lines = [`--effect-default: ${EFFECT_ACCENT_DEFAULT};`, ...ITEM_EFFECTS.map((e) => `--effect-${e.id}: ${e.accent};`)];
	return `:root{${lines.join('')}}`;
}

export function effectDefaultConfig(type: string): Record<string, any> {
	return { ...(EFFECT_BY_ID[type]?.defaultConfig ?? {}) };
}

export function effectDefaultCost(type: string): number {
	return EFFECT_BY_ID[type]?.defaultCost ?? 0;
}

export function effectSummary(item: { effect_type: string; description?: string | null; config?: any }): string {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return item.description ?? '';
	return effect.summary({ ...effect.defaultConfig, ...(item.config ?? {}) });
}

export type EffectMetaChip = { icon: string; label: string };

export function effectMeta(item: { effect_type: string; config?: any }): EffectMetaChip[] {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return [];
	const c = { ...effect.defaultConfig, ...(item.config ?? {}) } as Record<string, any>;
	const chips: EffectMetaChip[] = [];
	const pctRange = (min: any, max: any) => (Number(min) === Number(max) ? `${Number(max) || 0}%` : `${Number(min) || 0}–${Number(max) || 0}%`);

	switch (item.effect_type) {
		case 'steal':
		case 'bomb':
			chips.push({ icon: 'fa-percent', label: pctRange(c.min_percent, c.max_percent) });
			if (Number(c.cooldown_minutes) > 0) chips.push({ icon: 'fa-stopwatch', label: formatDuration(c.cooldown_minutes) });
			if (Number(c.immunity_minutes) > 0) chips.push({ icon: 'fa-shield-halved', label: formatDuration(c.immunity_minutes) });
			break;
		case 'boost':
			chips.push({ icon: 'fa-xmark', label: `${c.multiplier ?? 2}×` });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'leech':
			chips.push({ icon: 'fa-percent', label: `${c.skim_percent ?? 0}%` });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'shield':
		case 'reflect':
		case 'disguise':
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'insurance':
			chips.push({ icon: 'fa-rotate-left', label: `${c.refund_percent ?? 100}%` });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			if (Number(c.cooldown_minutes) > 0) chips.push({ icon: 'fa-stopwatch', label: formatDuration(c.cooldown_minutes) });
			break;
		case 'gamble':
			chips.push({ icon: 'fa-dice', label: `${c.win_chance ?? 0}%` });
			chips.push({ icon: 'fa-coins', label: `${c.payout_multiplier ?? 0}×` });
			break;
		case 'gift':
			chips.push({ icon: 'fa-coins', label: `${shortXp(c.gift_amount)} XP` });
			if (Number(c.tax_percent) > 0) chips.push({ icon: 'fa-receipt', label: `−${c.tax_percent}%` });
			break;
		case 'bounty':
			chips.push({ icon: 'fa-coins', label: `${shortXp(c.bounty_amount)} XP` });
			break;
	}
	return chips;
}

export function actionVerb(effectType: string): { label: string; icon: string } {
	const effect = EFFECT_BY_ID[effectType];
	return effect ? { label: effect.verb, icon: effect.icon } : { label: 'Use', icon: 'fa-bolt' };
}

export function isTargetedEffect(type: string): boolean {
	return TARGETED_EFFECTS.has(type);
}

export type EffectGuide = { what: string; how: string; tip: string };

const EFFECT_GUIDES: Record<string, EffectGuide> = {
	steal: {
		what: 'Take a slice of another member’s XP and add it straight to your own balance.',
		how: 'Pick a target. They keep playing, you just walk off with a cut. Blocked by their Shield, Reflect or active Immunity.',
		tip: 'Spy first — robbing a shielded target just wastes the item.'
	},
	bomb: {
		what: 'Destroy a chunk of a target’s XP. Unlike Steal, the XP is gone — nobody gets it.',
		how: 'Pick a target. Pure sabotage, higher ceiling than Steal. Blocked by Shield, Reflect or Immunity.',
		tip: 'Use it to knock a rival off the top of the leaderboard.'
	},
	boost: {
		what: 'Multiply the XP you earn from chatting and voice for a limited time.',
		how: 'Activate it on yourself — no target. Every XP gain is multiplied until it wears off.',
		tip: 'Pop it right before a long voice session with friends to stack with the Friend Boost.'
	},
	shield: {
		what: 'Block every incoming Steal, Bomb and Leech while it lasts.',
		how: 'Activate on yourself. Attackers who hit you get blocked and lose their item.',
		tip: 'Raise it before you log off so nobody farms you while you’re away.'
	},
	leech: {
		what: 'Attach to a target and quietly siphon a percentage of every XP they earn to you.',
		how: 'Pick a target. While active, a cut of their gains is redirected to you. One leech per target.',
		tip: 'Leech an active grinder, then stay quiet — the longer it runs, the more you skim.'
	},
	reflect: {
		what: 'Bounce the next attack back at whoever hits you.',
		how: 'Activate on yourself. The next Steal or Bomb is reflected — the attacker takes the loss instead.',
		tip: 'A nasty surprise for anyone who thinks you’re an easy target.'
	},
	insurance: {
		what: 'Refund part of your loss the next time you’re robbed or bombed.',
		how: 'Activate on yourself. If you get hit while it’s up, a percentage of the lost XP comes back.',
		tip: 'Good when you can’t sit on a Shield but still want a safety net.'
	},
	gamble: {
		what: 'Wager your XP for a chance to multiply it — or lose it all.',
		how: 'Choose how much to risk. Win and your wager is multiplied; lose and it’s gone.',
		tip: 'Only gamble what you can afford to drop on the leaderboard.'
	},
	gift: {
		what: 'Send some of your XP to another member.',
		how: 'Pick a recipient. They receive the XP (minus any tax). No way to steal it back.',
		tip: 'Reward teammates, pay off a debt, or fund an alliance.'
	},
	bounty: {
		what: 'Put a price on a target’s head — whoever steals or bombs them next collects it.',
		how: 'Pick a target. The bounty sits on them until someone lands a hit and claims the reward.',
		tip: 'Stack bounties on a rival to turn the whole server into their hunters.'
	},
	spy: {
		what: 'Secretly reveal a member’s bag, active effects, cooldowns and bounty.',
		how: 'Pick a target. The report is private to you — they’re never told they were spied on.',
		tip: 'Scout before every attack so you never waste an item on a shielded target.'
	},
	disguise: {
		what: 'Go anonymous — your attacks hide your name, spies can’t read you, and you drop off the leaderboard.',
		how: 'Activate on yourself. While it lasts, victims only see “a mysterious member” in history.',
		tip: 'Strike rivals without painting a target on your own back.'
	},
	purifier: {
		what: 'Wipe every active effect off yourself — shields, boosts, leeches, disguise and immunity.',
		how: 'Activate on yourself. Each effect ends immediately. Your attack cooldowns are NOT cleared.',
		tip: 'The fastest way to shake off a leech that’s draining you.'
	}
};

export function effectGuide(type: string): EffectGuide | null {
	return EFFECT_GUIDES[type] ?? null;
}

function scheduleMinutesLocal(hhmm: any, fallback: number): number {
	if (hhmm == null || hhmm === '') return fallback;
	const [h, m] = String(hhmm)
		.split(':')
		.map((n) => Number(n) || 0);
	return h * 60 + m;
}

export function itemAvailability(
	item: { available_from?: string | null; available_to?: string | null; recurring_schedule?: any; availableUntil?: number | null },
	nowMs: number,
	tzOffsetMin = 0
): { visible: boolean; availableUntil: number | null } {
	const schedule = item.recurring_schedule;
	const hasSchedule = !!(schedule && Array.isArray(schedule.days) && schedule.days.length > 0);

	if (!hasSchedule) {
		return { visible: true, availableUntil: item.availableUntil ?? null };
	}

	if (item.available_from && nowMs < new Date(item.available_from).getTime()) return { visible: false, availableUntil: null };
	if (item.available_to && nowMs > new Date(item.available_to).getTime()) return { visible: false, availableUntil: null };

	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	const local = new Date(nowMs + offsetMs);

	const days = schedule.days.map(Number);
	const fromMin = scheduleMinutesLocal(schedule.from, 0);
	const toMin = scheduleMinutesLocal(schedule.to, 1439);
	const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
	if (!days.includes(local.getUTCDay()) || minutes < fromMin || minutes > toMin) {
		return { visible: false, availableUntil: null };
	}

	const ends: number[] = [];
	if (item.available_to) {
		const t = new Date(item.available_to).getTime();
		if (Number.isFinite(t)) ends.push(t);
	}
	// Local day boundary expressed back in real (UTC) ms by subtracting the offset.
	const startOfLocalDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs;
	const uniqueDays = new Set(days);
	const isFullDay = fromMin <= 0 && toMin >= 1439;
	if (isFullDay && uniqueDays.size >= 7) {
		return { visible: true, availableUntil: ends.length ? Math.min(...ends) : null };
	}
	let trailingDays = 0;
	if (isFullDay) {
		while (trailingDays < 6 && uniqueDays.has((local.getUTCDay() + trailingDays + 1) % 7)) {
			trailingDays++;
		}
	}
	const endOfWindow = startOfLocalDay + trailingDays * 86400000 + (toMin * 60 + 59) * 1000;
	ends.push(endOfWindow);
	return { visible: true, availableUntil: ends.length ? Math.min(...ends) : null };
}

export type SpyReportBagItem = { name: string; effect_type: string; quantity: number };
export type SpyReportEffect = {
	effect_type: string;
	effect_value: number;
	expiresAt: number | null;
	leechRole: 'attacker' | 'victim' | null;
	leechWith: string | null;
};
export type SpyReportCooldown = { kind: 'steal' | 'bomb' | 'insurance' | 'immunity'; until: number };
export type SpyReport = {
	targetName: string;
	disguised?: boolean;
	bag: SpyReportBagItem[];
	effects: SpyReportEffect[];
	cooldowns: SpyReportCooldown[];
	bounty?: number;
};

export type ItemOutcome = {
	tone: 'win' | 'lose' | 'neutral';
	icon: string;
	title: string;
	line: string;
	deltaXp: number | null;
	untilMs: number | null;
	spyReport?: SpyReport | null;
};

function toMs(value: any): number | null {
	if (!value) return null;
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isFinite(ms) ? ms : null;
}

export function describeItemOutcome(effectType: string, result: any): ItemOutcome {
	const r = result ?? {};
	const outcome = r.outcome;
	const xp = Number(r.xp) || 0;

	if (effectType === 'gamble') {
		if (r.won) return { tone: 'win', icon: 'fa-trophy', title: 'You Won!', line: `Your wager paid off.`, deltaXp: Number(r.net) || 0, untilMs: null };
		return { tone: 'lose', icon: 'fa-skull', title: 'You Lost', line: `Better luck next time.`, deltaXp: -(Number(r.wager) || 0), untilMs: null };
	}

	if (effectType === 'steal' || effectType === 'bomb') {
		const verb = effectType === 'steal' ? 'Robbed' : 'Bombed';
		if (outcome === 'blocked')
			return { tone: 'lose', icon: 'fa-shield', title: 'Blocked!', line: `Their shield blocked your attack.`, deltaXp: null, untilMs: null };
		if (outcome === 'reflected')
			return { tone: 'lose', icon: 'fa-arrows-rotate', title: 'Reflected!', line: `It bounced back — you lost the XP.`, deltaXp: -xp, untilMs: null };
		const extra = effectType === 'steal' ? `+${xp.toLocaleString()} XP taken` : `${xp.toLocaleString()} XP destroyed`;
		return {
			tone: 'win',
			icon: effectIcon(effectType),
			title: `${verb}!`,
			line: extra,
			deltaXp: effectType === 'steal' ? xp : 0,
			untilMs: null
		};
	}

	if (effectType === 'spy') {
		const report = (r.spyReport ?? null) as SpyReport | null;
		const name = report?.targetName || 'the target';
		if (report?.disguised) {
			return {
				tone: 'lose',
				icon: 'fa-mask',
				title: 'Spy Foiled',
				line: `${name} is in disguise — your spy came back with nothing.`,
				deltaXp: null,
				untilMs: null,
				spyReport: report
			};
		}
		return {
			tone: 'neutral',
			icon: effectIcon('spy'),
			title: 'Spy Report',
			line: report ? `Here's what ${name} is holding right now.` : `Couldn't gather intel.`,
			deltaXp: null,
			untilMs: null,
			spyReport: report
		};
	}

	if (effectType === 'gift')
		return { tone: 'neutral', icon: effectIcon('gift'), title: 'Gift Sent', line: `They received ${xp.toLocaleString()} XP.`, deltaXp: null, untilMs: null };
	if (effectType === 'bounty')
		return {
			tone: 'neutral',
			icon: effectIcon('bounty'),
			title: 'Bounty Placed',
			line: `Whoever steals or bombs them next collects it.`,
			deltaXp: -xp,
			untilMs: null
		};
	if (effectType === 'leech')
		return {
			tone: 'neutral',
			icon: effectIcon('leech'),
			title: 'Leech Attached',
			line: `You'll siphon a cut of their XP while active.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};

	if (effectType === 'shield')
		return {
			tone: 'win',
			icon: effectIcon('shield'),
			title: 'Shield Active',
			line: `You're protected — incoming steals and bombs will be blocked.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'reflect')
		return {
			tone: 'win',
			icon: effectIcon('reflect'),
			title: 'Reflect Active',
			line: `The next attack on you bounces back at the attacker.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'disguise')
		return {
			tone: 'win',
			icon: effectIcon('disguise'),
			title: 'Disguise Active',
			line: `You're anonymous — your attacks hide your name, spies can't read you, and you're off the leaderboard.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'purifier') {
		const n = Number(r.cleared) || 0;
		return {
			tone: 'win',
			icon: effectIcon('purifier'),
			title: 'Purified',
			line: n > 0 ? `Wiped ${n} active effect${n === 1 ? '' : 's'} off you — clean slate.` : `Nothing to cleanse — you were already clean.`,
			deltaXp: null,
			untilMs: null
		};
	}
	if (effectType === 'insurance')
		return {
			tone: 'win',
			icon: effectIcon('insurance'),
			title: 'Insurance Active',
			line: `The next time you're robbed or bombed, ${r.refundPercent ?? 100}% of your loss is refunded.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'boost')
		return {
			tone: 'win',
			icon: effectIcon('boost'),
			title: 'Boost Active',
			line: `Your XP earnings are multiplied while it lasts.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};

	return { tone: 'neutral', icon: 'fa-circle-check', title: 'Done', line: `Item used.`, deltaXp: xp || null, untilMs: null };
}
