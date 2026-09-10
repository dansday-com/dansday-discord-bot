export type HapticPattern =
	| 'tick'
	| 'select'
	| 'success'
	| 'failure'
	| 'reveal'
	| 'jackpot'
	| 'strike'
	| 'rumble'
	| 'crash'
	| 'impact'
	| 'gust'
	| 'squall'
	| 'heartbeat'
	| 'stutter'
	| 'crackle'
	| 'eruption'
	| 'gunshot'
	| 'flutter'
	| 'drone'
	| 'shatter'
	| 'wisp'
	| 'collapse';

const PATTERNS: Record<HapticPattern, number | number[]> = {
	tick: 7,
	select: 14,
	success: [20, 44, 20],
	failure: [58, 66, 30],
	reveal: [12, 30, 12, 30, 55],
	jackpot: [14, 36, 14, 36, 14, 36, 30, 70, 110],
	strike: [10, 40, 90],
	rumble: [16, 26, 16, 26, 16, 26, 40],
	crash: [26, 34, 80],
	impact: [8, 22, 64],
	gust: [10, 30, 10, 30, 10, 30],
	squall: [6, 46, 6, 46, 14],
	heartbeat: [18, 110, 26],
	stutter: [5, 14, 5, 14, 5, 14],
	crackle: [4, 30, 7, 22, 4],
	eruption: [40, 30, 20, 24, 60, 40, 90],
	gunshot: [3, 12, 46],
	flutter: [12, 90, 20, 300, 12, 90, 20],
	drone: [70, 18, 70, 18, 70],
	shatter: [22, 18, 9, 16, 5, 14, 3],
	wisp: [6, 26, 11],
	collapse: [90, 20, 60, 18, 34, 16, 18, 14, 8]
};

export type EffectBeat = { selector: string; pattern: HapticPattern; minGap: number };

export const EFFECT_BEATS: Record<string, EffectBeat> = {
	thunder: { selector: '.fx-strike', pattern: 'strike', minGap: 2600 },
	earthquake: { selector: '.fx-chasm', pattern: 'rumble', minGap: 3200 },
	tsunami: { selector: '.fx-breaker', pattern: 'crash', minGap: 3600 },
	meteor: { selector: '.fx-p', pattern: 'impact', minGap: 2400 },
	tornado: { selector: '.fx-funnel', pattern: 'gust', minGap: 3000 },
	blizzard: { selector: '.fx-p', pattern: 'squall', minGap: 4200 },
	pulse: { selector: '.fx-ecg', pattern: 'heartbeat', minGap: 1800 },
	glitch: { selector: '.fx-tear-r', pattern: 'stutter', minGap: 2200 },
	fire: { selector: '.fx-heat', pattern: 'crackle', minGap: 2800 },
	volcano: { selector: '.fx-lavajet', pattern: 'eruption', minGap: 3400 },
	bullethole: { selector: '.fx-hole', pattern: 'gunshot', minGap: 900 },
	love: { selector: '.fx-heartglow', pattern: 'flutter', minGap: 2600 },
	void: { selector: '.fx-lens', pattern: 'drone', minGap: 4000 },
	glass: { selector: '.fx-shard', pattern: 'shatter', minGap: 3000 },
	fallingstar: { selector: '.fx-p', pattern: 'wisp', minGap: 3800 },
	blackhole: { selector: '.fx-spaghetti', pattern: 'collapse', minGap: 4400 }
};

export function supportsHaptics(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

let lastAt = 0;

export function haptic(pattern: HapticPattern): boolean {
	if (!supportsHaptics()) return false;
	if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
	if ((navigator as any).userActivation?.hasBeenActive === false) return false;

	const now = Date.now();
	if (now - lastAt < 45) return false;
	lastAt = now;

	try {
		return navigator.vibrate(PATTERNS[pattern] ?? 10);
	} catch {
		return false;
	}
}

export function hapticForTone(tone: 'win' | 'lose' | 'neutral'): boolean {
	if (tone === 'win') return haptic('success');
	if (tone === 'lose') return haptic('failure');
	return haptic('select');
}

export function stopHaptics(): boolean {
	if (!supportsHaptics()) return false;
	try {
		return navigator.vibrate(0);
	} catch {
		return false;
	}
}
