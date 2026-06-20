export type ItemEffectId = 'steal' | 'bomb' | 'boost' | 'shield' | 'leech' | 'reflect' | 'insurance' | 'gamble' | 'gift' | 'bounty';

export const BAG_CAPACITY = 50;

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
		summary: (c) => `Steal ${c.min_percent}–${c.max_percent}% of a member's total XP.`
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
		summary: (c) => `Destroy ${c.min_percent}–${c.max_percent}% of a member's total XP.`
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
		summary: (c) => `${c.multiplier}× XP for ${c.effect_duration_minutes} min (${c.scope}).`
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
		summary: (c) => `Block incoming steals, bombs and leeches for ${c.effect_duration_minutes} min.`
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
		summary: (c) => `Skim ${c.skim_percent}% of a member's XP for ${c.effect_duration_minutes} min.`
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
		summary: (c) => `Bounce the next attack back at the attacker for ${c.effect_duration_minutes} min.`
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
		summary: (c) =>
			`Refund ${c.refund_percent ?? 100}% of XP the next time you're robbed (${c.effect_duration_minutes} min)${c.cooldown_minutes ? `, ${Math.round((c.cooldown_minutes / 60) * 10) / 10}h cooldown` : ''}.`
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
		summary: (c) => `Wager your XP — ${c.win_chance}% chance to win ${c.payout_multiplier}× it.`
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
		summary: (c) => `Send ${c.gift_amount} XP to a member${c.tax_percent ? ` (−${c.tax_percent}% tax)` : ''}.`
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
		summary: (c) => `Put ${c.bounty_amount} XP on a member — collected by whoever steals or bombs them next.`
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

export function actionVerb(effectType: string): { label: string; icon: string } {
	const effect = EFFECT_BY_ID[effectType];
	return effect ? { label: effect.verb, icon: effect.icon } : { label: 'Use', icon: 'fa-bolt' };
}

export function isTargetedEffect(type: string): boolean {
	return TARGETED_EFFECTS.has(type);
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
	nowMs: number
): { visible: boolean; availableUntil: number | null } {
	const schedule = item.recurring_schedule;
	const hasSchedule = !!(schedule && Array.isArray(schedule.days) && schedule.days.length > 0);

	if (!hasSchedule) {
		return { visible: true, availableUntil: item.availableUntil ?? null };
	}

	const now = new Date(nowMs);
	if (item.available_from && nowMs < new Date(item.available_from).getTime()) return { visible: false, availableUntil: null };
	if (item.available_to && nowMs > new Date(item.available_to).getTime()) return { visible: false, availableUntil: null };

	const days = schedule.days.map(Number);
	const fromMin = scheduleMinutesLocal(schedule.from, 0);
	const toMin = scheduleMinutesLocal(schedule.to, 1439);
	const minutes = now.getHours() * 60 + now.getMinutes();
	if (!days.includes(now.getDay()) || minutes < fromMin || minutes > toMin) {
		return { visible: false, availableUntil: null };
	}

	const ends: number[] = [];
	if (item.available_to) {
		const t = new Date(item.available_to).getTime();
		if (Number.isFinite(t)) ends.push(t);
	}
	const endOfWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime() + (toMin * 60 + 59) * 1000;
	ends.push(endOfWindow);
	return { visible: true, availableUntil: ends.length ? Math.min(...ends) : null };
}

export type ItemOutcome = {
	tone: 'win' | 'lose' | 'neutral';
	icon: string;
	title: string;
	line: string;
	deltaXp: number | null;
	untilMs: number | null;
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
	if (effectType === 'insurance')
		return {
			tone: 'win',
			icon: effectIcon('insurance'),
			title: 'Insurance Active',
			line: `The next time you're robbed, ${r.refundPercent ?? 100}% of your loss is refunded.`,
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
