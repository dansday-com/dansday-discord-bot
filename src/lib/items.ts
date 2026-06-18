export type ItemEffectId = 'xp_steal' | 'xp_bomb' | 'xp_boost' | 'shield' | 'leech' | 'reflect' | 'insurance' | 'gamble' | 'gift' | 'bounty';

export type ItemEffect = {
	id: ItemEffectId;
	label: string;
	icon: string;
	accent: string;
	accentSoft: string;
	color: number;
	emoji: string;
	targeted: boolean;
	announced: boolean;
	expiringBuff: boolean;
	buffExpiredText?: (magnitude: number) => string;
	summary: (config: any) => string;
};

export const ITEM_EFFECTS: ItemEffect[] = [
	{
		id: 'xp_steal',
		label: 'XP Steal',
		icon: 'fa-hand',
		accent: '#fb7185',
		accentSoft: 'rgba(251, 113, 133, 0.15)',
		color: 0xfb7185,
		emoji: '💰',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Steal ${c.min_percent ?? 1}–${c.max_percent ?? 25}% of a member's total XP.`
	},
	{
		id: 'xp_bomb',
		label: 'XP Bomb',
		icon: 'fa-bomb',
		accent: '#fb7185',
		accentSoft: 'rgba(251, 113, 133, 0.15)',
		color: 0xfb7185,
		emoji: '💥',
		targeted: true,
		announced: true,
		expiringBuff: false,
		summary: (c) => `Destroy ${c.min_percent ?? 1}–${c.max_percent ?? 50}% of a member's total XP.`
	},
	{
		id: 'xp_boost',
		label: 'XP Boost',
		icon: 'fa-bolt',
		accent: '#fbbf24',
		accentSoft: 'rgba(251, 191, 36, 0.15)',
		color: 0xfbbf24,
		emoji: '⚡',
		targeted: false,
		announced: true,
		expiringBuff: true,
		buffExpiredText: (m) => `Your **${m || 2}× XP Boost** has worn off.`,
		summary: (c) => `${c.multiplier ?? 2}× XP for ${c.effect_duration_minutes ?? 60} min (${c.scope ?? 'all'}).`
	},
	{
		id: 'shield',
		label: 'Shield',
		icon: 'fa-shield',
		accent: '#38bdf8',
		accentSoft: 'rgba(56, 189, 248, 0.15)',
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
		accent: '#a3e635',
		accentSoft: 'rgba(163, 230, 53, 0.15)',
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
		accent: '#38bdf8',
		accentSoft: 'rgba(56, 189, 248, 0.15)',
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
		accent: '#38bdf8',
		accentSoft: 'rgba(56, 189, 248, 0.15)',
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
		accent: '#fbbf24',
		accentSoft: 'rgba(251, 191, 36, 0.15)',
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
		accent: '#4ade80',
		accentSoft: 'rgba(74, 222, 128, 0.15)',
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
		accent: '#c084fc',
		accentSoft: 'rgba(192, 132, 252, 0.15)',
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

export function effectSummary(item: { effect_type: string; description?: string | null; config?: any }): string {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return item.description ?? '';
	return effect.summary(item.config ?? {});
}

export function isTargetedEffect(type: string): boolean {
	return TARGETED_EFFECTS.has(type);
}
