export const TONES = ['teal', 'sky', 'violet', 'amber', 'emerald', 'rose', 'cyan', 'pink', 'orange', 'lime'] as const;

export type Tone = (typeof TONES)[number];

export function toneVars(tone: Tone): string {
	return `--tone: var(--t-${tone}); --tone-soft: var(--t-${tone}-soft);`;
}

export function toneAt(index: number): Tone {
	return TONES[index % TONES.length];
}
