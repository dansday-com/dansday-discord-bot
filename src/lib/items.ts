export type ItemEffectId =
	| 'steal'
	| 'bomb'
	| 'boost'
	| 'shield'
	| 'leech'
	| 'reflect'
	| 'insurance'
	| 'gift'
	| 'bounty'
	| 'spy'
	| 'disguise'
	| 'purifier'
	| 'luck';

export const BAG_CAPACITY = 50;

export function effectiveBagStock(inventory: { quantity?: number; enabled?: boolean | number; usable?: boolean | number }[]): number {
	return inventory.reduce((sum, r) => {
		const enabled = r.enabled !== false && r.enabled !== 0;
		const usable = r.usable !== false && r.usable !== 0;
		if (!enabled && !usable) return sum;
		return sum + (Number(r.quantity) || 0);
	}, 0);
}

export function discountedItemCost(cost: any, luckPercent: any, effectType?: any): number {
	const base = Math.max(0, Number(cost) || 0);
	const luck = Math.max(0, Number(luckPercent) || 0);
	if (luck <= 0 || effectType === 'luck') return base;
	return Math.max(0, Math.floor(base * (1 - luck / 100)));
}

function applyLuckBoost(value: number, luckPercent: any, max = Infinity): number {
	const luck = Math.max(0, Number(luckPercent) || 0);
	if (luck <= 0) return value;
	return Math.min(max, value + luck);
}

function applyLuckReduction(value: number, luckPercent: any): number {
	const luck = Math.max(0, Number(luckPercent) || 0);
	if (luck <= 0) return value;
	return Math.max(0, value - luck);
}

export const LUCK_ICON = '🍀';

function fmtPct(n: number): string {
	return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function luckBoostLabel(base: any, luckPercent: any, opts: { max?: number; unit?: string } = {}): string {
	const { max = Infinity, unit = '%' } = opts;
	const b = Number(base) || 0;
	const total = applyLuckBoost(b, luckPercent, max);
	const bonus = total - b;
	return bonus > 0 ? `${fmtPct(total)}${unit} (${fmtPct(b)} +${fmtPct(bonus)} ${LUCK_ICON})` : `${fmtPct(total)}${unit}`;
}

export function luckReduceLabel(base: any, luckPercent: any, unit = '%'): string {
	const b = Number(base) || 0;
	const total = applyLuckReduction(b, luckPercent);
	const bonus = b - total;
	return bonus > 0 ? `${fmtPct(total)}${unit} (${fmtPct(b)} −${fmtPct(bonus)} ${LUCK_ICON})` : `${fmtPct(total)}${unit}`;
}

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
	summary: (config: any, luckPercent?: number) => string;
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
		summary: (c, luck) => `Steal ${c.min_percent}–${luckBoostLabel(c.max_percent, luck)} of their XP.`
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
		summary: (c, luck) => `Destroy ${c.min_percent}–${luckBoostLabel(c.max_percent, luck)} of their XP.`
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
		buffExpiredText: () => `Your **Shield** has worn off. You can be attacked again.`,
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
		summary: (c, luck) => `Skim ${luckBoostLabel(c.skim_percent ?? 0, luck)} of their XP · ${formatDuration(c.effect_duration_minutes)}`
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
		summary: (c, luck) => `Refund ${luckBoostLabel(c.refund_percent ?? 100, luck)} if robbed or bombed · ${formatDuration(c.effect_duration_minutes)}`
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
		summary: (c, luck) => {
			const tax = Number(c.tax_percent) || 0;
			return `Send ${shortXp(c.gift_amount)} XP${tax ? ` · ${luckReduceLabel(tax, luck)} tax` : ''}`;
		}
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
		defaultConfig: { spy_chance: 100 },
		summary: (c, luck) => {
			const chance = applyLuckBoost(Number(c.spy_chance ?? 100), luck);
			return chance >= 100
				? `Reveal a member's bag, active effects and cooldowns.`
				: `${luckBoostLabel(c.spy_chance ?? 100, luck)} to reveal their bag, effects & cooldowns. Fail and they're alerted.`;
		}
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
		buffExpiredText: () => `Your **Disguise** has worn off. You're visible again.`,
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
		summary: () => `Wipe all your active effects: shields, leeches, immunity and more.`
	},
	{
		id: 'luck',
		label: 'Luck',
		icon: 'fa-clover',
		accent: '#3fa34d',
		emoji: '🍀',
		verb: 'Activate',
		targeted: false,
		announced: true,
		expiringBuff: true,
		defaultCost: 550,
		defaultConfig: { luck_percent: 20, effect_duration_minutes: 60 },
		buffExpiredText: (v) => `Your **+${v || 0}% Luck** has worn off.`,
		summary: (c) => `+${c.luck_percent}% odds on steal, bomb, spy, leech, insurance & minigames, cheaper prices · ${formatDuration(c.effect_duration_minutes)}`
	}
];

const EFFECT_BY_ID: Record<string, ItemEffect> = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, e]));

export const EFFECT_TYPE_IDS: string[] = ITEM_EFFECTS.map((e) => e.id);
export const TARGETED_EFFECTS: Set<string> = new Set(ITEM_EFFECTS.filter((e) => e.targeted).map((e) => e.id));
export const ANNOUNCED_EFFECTS: Set<string> = new Set(ITEM_EFFECTS.filter((e) => e.announced).map((e) => e.id));

export function getItemEffect(type: string): ItemEffect | undefined {
	return EFFECT_BY_ID[type];
}

const ACTION_META: Record<string, { label: string; icon: string }> = {
	bounty_collected: { label: 'Bounty claimed', icon: 'fa-sack-dollar' }
};

export function effectLabel(type: string): string {
	return EFFECT_BY_ID[type]?.label ?? ACTION_META[type]?.label ?? type;
}

export function effectIcon(type: string): string {
	return EFFECT_BY_ID[type]?.icon ?? ACTION_META[type]?.icon ?? 'fa-cube';
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

export function effectSummary(item: { effect_type: string; description?: string | null; config?: any }, luckPercent = 0): string {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return item.description ?? '';
	return effect.summary({ ...effect.defaultConfig, ...(item.config ?? {}) }, luckPercent);
}

export type EffectMetaChip = { icon: string; label: string };

export function effectMeta(item: { effect_type: string; config?: any }, luckPercent = 0): EffectMetaChip[] {
	const effect = EFFECT_BY_ID[item.effect_type];
	if (!effect) return [];
	const c = { ...effect.defaultConfig, ...(item.config ?? {}) } as Record<string, any>;
	const chips: EffectMetaChip[] = [];
	const pctRangeBoosted = (min: any, max: any) => {
		const lo = Number(min) || 0;
		const hi = luckBoostLabel(max, luckPercent);
		return lo === (Number(max) || 0) && !luckPercent ? hi : `${lo}–${hi}`;
	};
	const boosted = (base: any, max = Infinity) => luckBoostLabel(base, luckPercent, { max });
	const reduced = (base: any) => luckReduceLabel(base, luckPercent);

	switch (item.effect_type) {
		case 'steal':
		case 'bomb':
			chips.push({ icon: 'fa-percent', label: pctRangeBoosted(c.min_percent, c.max_percent) });
			if (Number(c.cooldown_minutes) > 0) chips.push({ icon: 'fa-stopwatch', label: formatDuration(c.cooldown_minutes) });
			if (Number(c.immunity_minutes) > 0) chips.push({ icon: 'fa-shield-halved', label: formatDuration(c.immunity_minutes) });
			break;
		case 'boost':
			chips.push({ icon: 'fa-xmark', label: `${c.multiplier ?? 2}×` });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'leech':
			chips.push({ icon: 'fa-percent', label: boosted(c.skim_percent ?? 0) });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'shield':
		case 'reflect':
		case 'disguise':
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			break;
		case 'insurance':
			chips.push({ icon: 'fa-rotate-left', label: boosted(c.refund_percent ?? 100) });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
			if (Number(c.cooldown_minutes) > 0) chips.push({ icon: 'fa-stopwatch', label: formatDuration(c.cooldown_minutes) });
			break;
		case 'gift':
			chips.push({ icon: 'fa-coins', label: `${shortXp(c.gift_amount)} XP` });
			if (Number(c.tax_percent) > 0) chips.push({ icon: 'fa-receipt', label: reduced(c.tax_percent) });
			break;
		case 'bounty':
			chips.push({ icon: 'fa-coins', label: `${shortXp(c.bounty_amount)} XP` });
			break;
		case 'spy':
			if (Number(c.spy_chance ?? 100) < 100) chips.push({ icon: 'fa-percent', label: boosted(c.spy_chance) });
			break;
		case 'luck':
			chips.push({ icon: 'fa-percent', label: `+${c.luck_percent ?? 0}%` });
			chips.push({ icon: 'fa-hourglass-half', label: formatDuration(c.effect_duration_minutes) });
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

export const DISGUISED_MENTION = 'A mysterious member 🎭';

export function disguisedText(text: string): string {
	return text.replace(/^Your\b/, `${DISGUISED_MENTION}'s`);
}

export type EffectGuide = { what: string; how: string; tip: string };

const EFFECT_GUIDES: Record<string, EffectGuide> = {
	steal: {
		what: 'Take a slice of another member’s XP and add it straight to your own balance.',
		how: 'Pick a target. They keep playing, you just walk off with a cut. Blocked by their Shield, Reflect or active Immunity.',
		tip: 'Spy first. Robbing a shielded target just wastes the item.'
	},
	bomb: {
		what: 'Destroy a chunk of a target’s XP. Unlike Steal, the XP is gone for good.',
		how: 'Pick a target. Pure sabotage, higher ceiling than Steal. Blocked by Shield, Reflect or Immunity.',
		tip: 'Use it to knock a rival off the top of the leaderboard.'
	},
	boost: {
		what: 'Multiply the XP you earn from chatting and voice for a limited time.',
		how: 'Activate it on yourself, no target needed. Every XP gain is multiplied until it wears off.',
		tip: 'Pop it right before a long voice session with friends to stack with the Friend Boost.'
	},
	shield: {
		what: 'Block every incoming Steal, Bomb and Leech while it lasts.',
		how: 'Activate on yourself. Attackers who hit you get blocked and lose their item.',
		tip: 'Raise it before you log off so nobody farms you while you’re away.'
	},
	leech: {
		what: 'Attach to a target and quietly siphon a percentage of every XP they earn to you.',
		how: 'Pick a target. A cut of their gains is redirected to you while active. You can leech several members at once, but each member can only be leeched by one person. An active Luck buff boosts your skim percentage.',
		tip: 'Spread leeches across active grinders and stay quiet. Pop Luck first to skim more.'
	},
	reflect: {
		what: 'Bounce the next attack back at whoever hits you.',
		how: 'Activate on yourself. The next Steal or Bomb is reflected, so the attacker takes the loss instead.',
		tip: 'A nasty surprise for anyone who thinks you’re an easy target.'
	},
	insurance: {
		what: 'Refund part of your loss the next time you’re robbed or bombed.',
		how: 'Activate on yourself. If you get hit while it’s up, a percentage of the lost XP comes back. An active Luck buff raises the refund percentage.',
		tip: 'Good when you can’t sit on a Shield but still want a safety net. Stack Luck for a bigger refund.'
	},
	gift: {
		what: 'Send some of your XP to another member.',
		how: 'Pick a recipient. They receive the XP (minus any tax). No way to steal it back. An active Luck buff lowers the tax, so more of your gift gets through.',
		tip: 'Reward teammates, pay off a debt, or fund an alliance. Send big gifts while Luck is active to cut the tax.'
	},
	bounty: {
		what: 'Put a price on a target’s head. Whoever steals or bombs them next collects it.',
		how: 'Pick a target. The bounty sits on them until someone lands a hit and claims the reward.',
		tip: 'Stack bounties on a rival to turn the whole server into their hunters.'
	},
	spy: {
		what: 'Secretly reveal a member’s bag, active effects, cooldowns and bounty.',
		how: 'Pick a target. If the spy has a success chance and you fail, you’re caught and the target is alerted with your name. An active Luck buff raises your success chance.',
		tip: 'Scout before a big attack, and skip a risky spy when you can’t afford to be seen. Luck makes risky spies safer.'
	},
	disguise: {
		what: 'Go anonymous. Your attacks hide your name and you drop off the leaderboard.',
		how: 'Activate on yourself. Victims only see “a mysterious member” in history, though a successful Spy can still unmask you.',
		tip: 'Strike rivals without painting a target on your own back.'
	},
	purifier: {
		what: 'Wipe every active effect off yourself: shields, boosts, leeches, disguise and immunity.',
		how: 'Activate on yourself. Each effect ends immediately. Your attack cooldowns are NOT cleared.',
		tip: 'The fastest way to shake off a leech that’s draining you.'
	},
	luck: {
		what: 'Boost your fortune across the board: a higher ceiling on steal and bomb, better minigame odds, sharper spying, bigger leech skims, lower gift tax, bigger insurance refunds, a stronger friend boost, discounted shop prices, and it shields you as a victim by reducing how much any leech on you can drain.',
		how: 'Activate on yourself, no target needed. The percentage applies on top of every roll and rate you control while it lasts, and also softens leeches other members have on you. On steal and bomb it lifts the top of the range, not the bottom, so your best hits get bigger. Buffs like insurance lock in your luck the moment you activate them, so activate luck first.',
		tip: 'Pop it before a big minigame session, a raid or a shopping spree to stretch every bit of XP further, and it quietly limits leech drain the whole time it runs.'
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

export type ItemWindowState = 'active' | 'upcoming' | 'ended' | 'always';

export function floatingWallClockMs(value: any, offsetMs: number): number | null {
	if (!value) return null;
	const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
	if (!m) return null;
	const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
	return asUtc - offsetMs;
}

export function itemAvailability(
	item: { available_from?: string | null; available_to?: string | null; recurring_schedule?: any; availableUntil?: number | null },
	nowMs: number,
	tzOffsetMin = 0
): { visible: boolean; availableUntil: number | null; state: ItemWindowState; startsAt: number | null } {
	const schedule = item.recurring_schedule;
	const hasSchedule = !!(schedule && Array.isArray(schedule.days) && schedule.days.length > 0);
	const offsetMs = (Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0) * 60000;
	const fromMs = floatingWallClockMs(item.available_from, offsetMs);
	const toMs = floatingWallClockMs(item.available_to, offsetMs);

	if (!hasSchedule) {
		if (fromMs && nowMs < fromMs) return { visible: true, availableUntil: null, state: 'upcoming', startsAt: fromMs };
		if (toMs && nowMs > toMs) return { visible: false, availableUntil: null, state: 'ended', startsAt: null };
		if (!fromMs && !toMs) return { visible: true, availableUntil: item.availableUntil ?? null, state: 'always', startsAt: null };
		return { visible: true, availableUntil: toMs ?? item.availableUntil ?? null, state: 'active', startsAt: null };
	}

	if (fromMs && nowMs < fromMs) return { visible: true, availableUntil: null, state: 'upcoming', startsAt: fromMs };
	if (toMs && nowMs > toMs) return { visible: false, availableUntil: null, state: 'ended', startsAt: null };

	const local = new Date(nowMs + offsetMs);

	const days = schedule.days.map(Number);
	const fromMin = scheduleMinutesLocal(schedule.from, 0);
	const toMin = scheduleMinutesLocal(schedule.to, 1439);
	const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
	const startOfLocalDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs;
	const uniqueDays = new Set(days);

	if (!days.includes(local.getUTCDay()) || minutes < fromMin || minutes > toMin) {
		let startsAt: number | null = null;
		for (let ahead = 0; ahead <= 7; ahead++) {
			const day = (local.getUTCDay() + ahead) % 7;
			if (!uniqueDays.has(day)) continue;
			const candidate = startOfLocalDay + ahead * 86400000 + fromMin * 60000;
			if (candidate > nowMs) {
				startsAt = candidate;
				break;
			}
		}
		if (startsAt != null && (!toMs || startsAt <= toMs)) return { visible: true, availableUntil: null, state: 'upcoming', startsAt };
		return { visible: false, availableUntil: null, state: 'ended', startsAt: null };
	}

	const ends: number[] = [];
	if (toMs && Number.isFinite(toMs)) ends.push(toMs);
	const isFullDay = fromMin <= 0 && toMin >= 1439;
	if (isFullDay && uniqueDays.size >= 7) {
		return { visible: true, availableUntil: ends.length ? Math.min(...ends) : null, state: 'active', startsAt: null };
	}
	let trailingDays = 0;
	if (isFullDay) {
		while (trailingDays < 6 && uniqueDays.has((local.getUTCDay() + trailingDays + 1) % 7)) {
			trailingDays++;
		}
	}
	const endOfWindow = startOfLocalDay + trailingDays * 86400000 + (toMin * 60 + 59) * 1000;
	ends.push(endOfWindow);
	return { visible: true, availableUntil: ends.length ? Math.min(...ends) : null, state: 'active', startsAt: null };
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
export type SpyReportAsset = {
	symbol: string;
	asset_name: string;
	asset_image: string | null;
	xp_invested: number;
	value: number;
	pnl: number;
	pnl_percent: number;
};
export type SpyReport = {
	targetName: string;
	disguised?: boolean;
	caught?: boolean;
	bag: SpyReportBagItem[];
	effects: SpyReportEffect[];
	cooldowns: SpyReportCooldown[];
	bounty?: number;
	assets?: SpyReportAsset[];
	assetsInvested?: number;
	assetsValue?: number;
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

	if (effectType === 'steal' || effectType === 'bomb') {
		const verb = effectType === 'steal' ? 'Robbed' : 'Bombed';
		if (outcome === 'blocked')
			return { tone: 'lose', icon: 'fa-shield', title: 'Blocked!', line: `Their shield blocked your attack.`, deltaXp: null, untilMs: null };
		if (outcome === 'reflected')
			return { tone: 'lose', icon: 'fa-arrows-rotate', title: 'Reflected!', line: `It bounced back and you lost the XP.`, deltaXp: -xp, untilMs: null };
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
		if (outcome === 'caught' || report?.caught) {
			return {
				tone: 'lose',
				icon: 'fa-triangle-exclamation',
				title: 'Spy Caught',
				line: `${name} caught you. No intel, and they know it was you.`,
				deltaXp: null,
				untilMs: null
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

	if (effectType === 'gift') {
		const luckNote = r.luckPercent > 0 ? ` Your +${r.luckPercent}% luck 🍀 cut the tax.` : '';
		return {
			tone: 'neutral',
			icon: effectIcon('gift'),
			title: 'Gift Sent',
			line: `They received ${xp.toLocaleString()} XP.${luckNote}`,
			deltaXp: null,
			untilMs: null
		};
	}
	if (effectType === 'bounty')
		return {
			tone: 'neutral',
			icon: effectIcon('bounty'),
			title: 'Bounty Placed',
			line: `Whoever steals or bombs them next collects it.`,
			deltaXp: -xp,
			untilMs: null
		};
	if (effectType === 'leech') {
		const luckNote = r.luckPercent > 0 ? ` (+${r.luckPercent}% luck 🍀)` : '';
		return {
			tone: 'neutral',
			icon: effectIcon('leech'),
			title: 'Leech Attached',
			line: `You'll siphon ${r.skimPercent ?? 0}%${luckNote} of their XP while active.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	}

	if (effectType === 'shield')
		return {
			tone: 'win',
			icon: effectIcon('shield'),
			title: 'Shield Active',
			line: `You're protected. Incoming steals and bombs will be blocked.`,
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
			line: `You're anonymous. Your attacks hide your name and you're off the leaderboard.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'purifier') {
		const n = Number(r.cleared) || 0;
		return {
			tone: 'win',
			icon: effectIcon('purifier'),
			title: 'Purified',
			line: n > 0 ? `Wiped ${n} active effect${n === 1 ? '' : 's'} off you. Clean slate.` : `Nothing to cleanse. You were already clean.`,
			deltaXp: null,
			untilMs: null
		};
	}
	if (effectType === 'insurance') {
		const luckNote = r.luckPercent > 0 ? ` (+${r.luckPercent}% luck 🍀)` : '';
		return {
			tone: 'win',
			icon: effectIcon('insurance'),
			title: 'Insurance Active',
			line: `The next time you're robbed or bombed, ${r.refundPercent ?? 100}%${luckNote} of your loss is refunded.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	}
	if (effectType === 'boost')
		return {
			tone: 'win',
			icon: effectIcon('boost'),
			title: 'Boost Active',
			line: `Your XP earnings are multiplied while it lasts.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};
	if (effectType === 'luck')
		return {
			tone: 'win',
			icon: effectIcon('luck'),
			title: 'Luck Active',
			line: `+${r.luckPercent ?? 0}% luck on steal, bomb, minigames, spy, leech, gift tax, insurance, friend boost and shop prices.`,
			deltaXp: null,
			untilMs: toMs(r.expiresAt)
		};

	return { tone: 'neutral', icon: 'fa-circle-check', title: 'Done', line: `Item used.`, deltaXp: xp || null, untilMs: null };
}
