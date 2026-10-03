export const ESCALATION_ACTIONS = ['timeout', 'kick', 'ban', 'tempban'] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];

export const ESCALATION_TIMED_ACTIONS: readonly EscalationAction[] = ['timeout', 'tempban'];
export const MAX_ESCALATION_STEPS = 10;
export const MAX_REASON_PRESETS = 25;
export const MAX_REASON_PRESET_LENGTH = 200;
export const MAX_WARN_EXPIRY_DAYS = 3650;
export const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

export type EscalationStep = { warns: number; action: EscalationAction; duration_seconds: number | null };

export type ModerationRules = {
	warn_expiry_days: number;
	escalation: EscalationStep[];
	reason_presets: string[];
};

export const MODERATION_RULE_KEYS = {
	warn_expiry_days: 'moderation_warn_expiry_days',
	escalation: 'moderation_escalation',
	reason_presets: 'moderation_reason_presets'
} as const;

export const DEFAULT_MODERATION_RULE_SETTINGS = {
	[MODERATION_RULE_KEYS.warn_expiry_days]: 0,
	[MODERATION_RULE_KEYS.escalation]: [] as EscalationStep[],
	[MODERATION_RULE_KEYS.reason_presets]: [] as string[]
};

function wholeNumber(value: unknown, min: number, max: number): number {
	const n = Math.trunc(Number(value));
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

export function normalizeEscalation(raw: unknown): EscalationStep[] {
	if (!Array.isArray(raw)) return [];
	const byWarns = new Map<number, EscalationStep>();
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const step = item as Record<string, unknown>;
		const action = String(step.action) as EscalationAction;
		if (!ESCALATION_ACTIONS.includes(action)) continue;
		const warns = wholeNumber(step.warns, 0, 100);
		if (warns < 1) continue;
		const timed = ESCALATION_TIMED_ACTIONS.includes(action);
		const duration = timed ? wholeNumber(step.duration_seconds, 0, action === 'timeout' ? MAX_TIMEOUT_SECONDS : 10 * 365 * 86400) : null;
		if (timed && (!duration || duration < 60)) continue;
		byWarns.set(warns, { warns, action, duration_seconds: duration });
	}
	return [...byWarns.values()].sort((a, b) => a.warns - b.warns).slice(0, MAX_ESCALATION_STEPS);
}

export function normalizeReasonPresets(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of raw) {
		const text = String(item ?? '')
			.trim()
			.slice(0, MAX_REASON_PRESET_LENGTH);
		if (!text || seen.has(text.toLowerCase())) continue;
		seen.add(text.toLowerCase());
		out.push(text);
	}
	return out.slice(0, MAX_REASON_PRESETS);
}

export function moderationRulesFromSettings(settings: unknown): ModerationRules {
	const base = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
	return {
		warn_expiry_days: wholeNumber(base[MODERATION_RULE_KEYS.warn_expiry_days], 0, MAX_WARN_EXPIRY_DAYS),
		escalation: normalizeEscalation(base[MODERATION_RULE_KEYS.escalation]),
		reason_presets: normalizeReasonPresets(base[MODERATION_RULE_KEYS.reason_presets])
	};
}

export function escalationStepFor(rules: ModerationRules, activeWarnings: number): EscalationStep | null {
	return rules.escalation.find((step) => step.warns === activeWarnings) ?? null;
}
