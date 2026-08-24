export type BrandTone = 'teal' | 'brick' | 'stone';

export const BRAND_TONE: Record<BrandTone, string> = {
	teal: 'bg-primary/12 text-primary',
	brick: 'bg-secondary/10 text-secondary',
	stone: 'bg-neutral/25 text-neutral'
};
