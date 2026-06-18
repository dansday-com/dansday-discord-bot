export type ItemEffectId = 'steal' | 'bomb' | 'boost' | 'shield' | 'leech' | 'reflect' | 'insurance' | 'gamble' | 'gift' | 'bounty';

export type ItemEffect = {
	id: ItemEffectId;
	label: string;
	icon: string;
	color: number;
	emoji: string;
	targeted: boolean;
	announced: boolean;
	expiringBuff: boolean;
	buffExpiredText?: (effectValue: number) => string;
	summary: (config: any) => string;
};

export const ITEM_EFFECTS: ItemEffect[] = [
	{
		id: 'steal',
		label: 'Steal',
		icon: 'fa-hand',
		color: 0xfb7185,
		emoji: '💰',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Steal ${c.min_percent ?? 1}–${c.max_percent ?? 25}% of a member's total XP.`
	},
	{
		id: 'bomb',
		label: 'Bomb',
		icon: 'fa-bomb',
		color: 0xfb7185,
		emoji: '💥',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Destroy ${c.min_percent ?? 1}–${c.max_percent ?? 50}% of a member's total XP.`
	},
	{
		id: 'boost',
		label: 'Boost',
		icon: 'fa-bolt',
		color: 0xfbbf24,
		emoji: '⚡',
		targeted: false,
		announced: true,
		expiringBuff: true,
		buffExpiredText: (m) => `Your **${m || 2}× Boost** has worn off.`,
		summary: (c) => `${c.multiplier ?? 2}× XP for ${c.effect_duration_minutes ?? 60} min (${c.scope ?? 'all'}).`
	},
	{
		id: 'shield',
		label: 'Shield',
		icon: 'fa-shield',
		color: 0x38bdf8,
		emoji: '🛡️',
		targeted: false,
		announced: true,
		expiringBuff: true,
		buffExpiredText: () => `Your **Shield** has worn off — you can be attacked again.`,
		summary: (c) => `Block incoming attacks for ${c.effect_duration_minutes ?? 60} min.`
	},
	{
		id: 'leech',
		label: 'Leech',
		icon: 'fa-droplet',
		color: 0xfb7185,
		emoji: '🩸',
		targeted: true,
		announced: true,
		expiringBuff: true,
		buffExpiredText: (m) => `The **${m || 0}% Leech** on you has ended.`,
		summary: (c) => `Skim ${c.skim_percent ?? 10}% of a member's XP for ${c.effect_duration_minutes ?? 120} min.`
	},
	{
		id: 'reflect',
		label: 'Reflect',
		icon: 'fa-arrows-rotate',
		color: 0xc084fc,
		emoji: '🪞',
		targeted: false,
		announced: true,
		expiringBuff: true,
		buffExpiredText: () => `Your **Reflect** has worn off.`,
		summary: (c) => `Bounce the next attack back at the attacker for ${c.effect_duration_minutes ?? 60} min.`
	},
	{
		id: 'insurance',
		label: 'Insurance',
		icon: 'fa-umbrella',
		color: 0x5eead4,
		emoji: '💵',
		targeted: false,
		announced: true,
		expiringBuff: true,
		buffExpiredText: () => `Your **Insurance** has expired.`,
		summary: (c) => `Refund your XP the next time you're robbed (${c.effect_duration_minutes ?? 60} min).`
	},
	{
		id: 'gamble',
		label: 'Gamble',
		icon: 'fa-dice',
		color: 0xfbbf24,
		emoji: '🎲',
		targeted: false,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Wager your XP — ${c.win_chance ?? 50}% chance to win ${c.payout_multiplier ?? 2}× it.`
	},
	{
		id: 'gift',
		label: 'Gift',
		icon: 'fa-gift',
		color: 0x4ade80,
		emoji: '🎁',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Send ${c.gift_amount ?? 0} XP to a member${c.tax_percent ? ` (−${c.tax_percent}% tax)` : ''}.`
	},
	{
		id: 'bounty',
		label: 'Bounty',
		icon: 'fa-crosshairs',
		color: 0xfbbf24,
		emoji: '🎯',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Put ${c.bounty_amount ?? 0} XP on a member — collected by whoever robs them next.`
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

export function effectSummary(item: { effect_type: string; description?: string | null; config?: any }): string {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return item.description ?? '';
	return effect.summary(item.config ?? {});
}

const ACTION_VERB: Record<string, { label: string; icon: string }> = {
	steal: { label: 'Steal', icon: 'fa-hand' },
	bomb: { label: 'Bomb', icon: 'fa-bomb' },
	leech: { label: 'Leech', icon: 'fa-droplet' },
	gift: { label: 'Give', icon: 'fa-gift' },
	bounty: { label: 'Place', icon: 'fa-crosshairs' },
	boost: { label: 'Activate', icon: 'fa-bolt' },
	shield: { label: 'Activate', icon: 'fa-shield' },
	reflect: { label: 'Activate', icon: 'fa-arrows-rotate' },
	insurance: { label: 'Activate', icon: 'fa-umbrella' },
	gamble: { label: 'Play', icon: 'fa-dice' }
};

export function actionVerb(effectType: string): { label: string; icon: string } {
	return ACTION_VERB[effectType] ?? { label: 'Use', icon: 'fa-bolt' };
}

export function isTargetedEffect(type: string): boolean {
	return TARGETED_EFFECTS.has(type);
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
		return { tone: 'neutral', icon: effectIcon('bounty'), title: 'Bounty Placed', line: `Whoever robs them next collects it.`, deltaXp: -xp, untilMs: null };
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
			line: `The next time you're robbed, your XP is refunded.`,
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
