export const selectValuesDays1To30 = Array.from({ length: 30 }, (_, i) => i + 1);

export function formatDayCount(v: number): string {
	return v === 1 ? '1 day' : `${v} days`;
}

export function formatSeconds(v: number): string {
	return `${v}s`;
}

export function formatMultiplier(v: number): string {
	return `${v}x`;
}
