export type RankStyle = {
	color: string;
	glow: string;
	gradient: string;
	bar: string;
	pill: string;
	pillText: string;
};

export const RANK_STYLES: Record<number, RankStyle> = {
	1: {
		color: '#FFD700',
		glow: 'rgba(255,215,0,0.45)',
		gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
		bar: '#e6b800',
		pill: 'linear-gradient(135deg, #b8860b, #ffd700)',
		pillText: '#1a1a1a'
	},
	2: {
		color: '#C0C0C0',
		glow: 'rgba(192,192,192,0.3)',
		gradient: 'linear-gradient(135deg, #e0e0e0 0%, #a0aec0 100%)',
		bar: '#9ca3af',
		pill: 'linear-gradient(135deg, #718096, #e2e8f0)',
		pillText: '#1a1a1a'
	},
	3: {
		color: '#CD7F32',
		glow: 'rgba(205,127,50,0.3)',
		gradient: 'linear-gradient(135deg, #f093fb 0%, #cd7f32 100%)',
		bar: '#c97a3d',
		pill: 'linear-gradient(135deg, #9c4221, #cd7f32)',
		pillText: '#ffffff'
	}
};

export const PODIUM_HEIGHT: Record<number, string> = { 1: '88px', 2: '60px', 3: '44px' };

export function rankStyle(rank: number | null | undefined): RankStyle | null {
	return rank != null && RANK_STYLES[rank] ? RANK_STYLES[rank] : null;
}

export function initial(name: string): string {
	return (name.trim().charAt(0) || '?').toUpperCase();
}
