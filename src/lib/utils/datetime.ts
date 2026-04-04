import { DateTime } from 'luxon';

const STORAGE_ZONE = 'utc';

export function formatTimestamp(timestamp = Date.now(), includeSeconds = false) {
	return DateTime.fromMillis(timestamp, { zone: STORAGE_ZONE }).toFormat(includeSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm');
}

export function toMySQLDateTime(date?: string | Date): Date | null {
	if (!date) {
		return DateTime.utc().toJSDate();
	}
	if (typeof date === 'string') {
		const dt = DateTime.fromISO(date);
		if (!dt.isValid) return null;
		return dt.toUTC().toJSDate();
	}
	return DateTime.fromJSDate(date).toUTC().toJSDate();
}

export function getDateTimeFromSqlUtc(value: string | Date | null | undefined): DateTime {
	if (value == null || value === '') {
		return DateTime.fromMillis(NaN);
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return DateTime.fromMillis(NaN);
		return DateTime.fromJSDate(value, { zone: 'utc' });
	}
	const dt = DateTime.fromSQL(String(value), { zone: 'utc' });
	return dt;
}

export function parseMySQLDateTimeUtc(mysqlDateTimeString: unknown): Date | null {
	const dt = getDateTimeFromSqlUtc(mysqlDateTimeString as string | Date);
	return dt.isValid ? dt.toJSDate() : null;
}

export function dbDateTimeToMs(value: unknown): number {
	const d = parseMySQLDateTimeUtc(value);
	return d != null && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

export function formatDbDateTime(value: unknown, includeSeconds = false): string {
	const d = parseMySQLDateTimeUtc(value);
	if (!d) return '—';
	return formatTimestamp(d.getTime(), includeSeconds);
}

export function dbUtcValueToIso(value: unknown): string | null {
	const d = parseMySQLDateTimeUtc(value);
	if (!d || Number.isNaN(d.getTime())) return null;
	return d.toISOString();
}

export function formatDbDateTimeLocal(value: unknown, includeSeconds = false): string {
	const d = parseMySQLDateTimeUtc(value);
	if (!d) return '—';
	return DateTime.fromJSDate(d, { zone: 'utc' })
		.setZone('local')
		.toFormat(includeSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm');
}

export function isUtcSqlExpired(value: string | Date | null | undefined): boolean {
	const dt = getDateTimeFromSqlUtc(value);
	if (!dt.isValid) return false;
	return dt < DateTime.utc();
}

export function getNowUtc() {
	return DateTime.utc();
}

export function getDateTimeFromJSDate(date: Date) {
	return DateTime.fromJSDate(date).toUTC();
}

export function addMinutesToNow(minutes: number) {
	return DateTime.utc().plus({ minutes }).toJSDate();
}

export function addDaysToNow(days: number) {
	return DateTime.utc().plus({ days }).toJSDate();
}

export function getCurrentDateTime() {
	return DateTime.utc().toJSDate();
}
