export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;

export const MINUTE_SECONDS = SECONDS_PER_MINUTE;
export const HOUR_SECONDS = MINUTES_PER_HOUR * MINUTE_SECONDS;
export const DAY_SECONDS = HOURS_PER_DAY * HOUR_SECONDS;
export const DAY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;

export const SECOND_MS = MS_PER_SECOND;
export const MINUTE_MS = MINUTE_SECONDS * MS_PER_SECOND;
export const HOUR_MS = HOUR_SECONDS * MS_PER_SECOND;
export const DAY_MS = DAY_SECONDS * MS_PER_SECOND;
export const WEEK_MS = DAYS_PER_WEEK * DAY_MS;
export const WEEK_MINUTES = DAYS_PER_WEEK * DAY_MINUTES;

export function formatElapsed(ms: number, empty: string) {
	if (!ms || ms <= 0) {
		return empty;
	}
	const s = Math.floor(ms / SECOND_MS);
	const m = Math.floor(s / SECONDS_PER_MINUTE);
	const h = Math.floor(m / MINUTES_PER_HOUR);
	const d = Math.floor(h / HOURS_PER_DAY);
	if (d > 0) {
		return `${d}d ${h % HOURS_PER_DAY}h`;
	}
	if (h > 0) {
		return `${h}h ${m % MINUTES_PER_HOUR}m`;
	}
	if (m > 0) {
		return `${m}m ${s % SECONDS_PER_MINUTE}s`;
	}
	return `${s}s`;
}
