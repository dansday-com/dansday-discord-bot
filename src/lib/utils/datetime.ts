import { DateTime } from 'luxon';

const TIMEZONE = process.env.TIMEZONE || 'UTC';

export function formatTimestamp(timestamp = Date.now(), includeSeconds = false) {
	return DateTime.fromMillis(timestamp, { zone: TIMEZONE }).toFormat(includeSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm');
}

export function toMySQLDateTime(date?: string | Date): Date | null {
	if (!date) {
		return DateTime.now().setZone(TIMEZONE).toJSDate();
	}
	if (typeof date === 'string') {
		const dt = DateTime.fromISO(date);
		if (!dt.isValid) return null;
		return dt.setZone(TIMEZONE).toJSDate();
	}
	return DateTime.fromJSDate(date).setZone(TIMEZONE).toJSDate();
}

export function parseMySQLDateTime(mysqlDateTimeString: any): Date | null {
	if (!mysqlDateTimeString) return null;
	if (mysqlDateTimeString instanceof Date) return mysqlDateTimeString;
	const dateStr = String(mysqlDateTimeString);
	const dt = DateTime.fromSQL(dateStr, { zone: TIMEZONE });
	if (!dt.isValid) return null;
	return dt.toJSDate();
}

export function getNowInTimezone() {
	return DateTime.now().setZone(TIMEZONE);
}

export function getDateTimeFromSQL(sqlString: string) {
	return DateTime.fromSQL(String(sqlString), { zone: TIMEZONE });
}

export function getDateTimeFromJSDate(date: Date) {
	return DateTime.fromJSDate(date).setZone(TIMEZONE);
}

export function addMinutesToNow(minutes: number) {
	return DateTime.now().setZone(TIMEZONE).plus({ minutes }).toJSDate();
}

export function addDaysToNow(days: number) {
	return DateTime.now().setZone(TIMEZONE).plus({ days }).toJSDate();
}

export function getCurrentDateTime() {
	return DateTime.now().setZone(TIMEZONE).toJSDate();
}
