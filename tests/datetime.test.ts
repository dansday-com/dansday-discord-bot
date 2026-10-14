import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	dbDateTimeToMs,
	dbUtcValueToIso,
	formatDbDateTime,
	formatTimestamp,
	isUtcSqlExpired,
	parseMySQLDateTimeUtc,
	toMySQLDateTime
} from '../src/lib/utils/datetime.ts';

const NEW_YEAR_MS = Date.UTC(2026, 0, 1, 12, 30, 45);

test('formatTimestamp prints day first in UTC', () => {
	assert.equal(formatTimestamp(NEW_YEAR_MS), '01/01/2026 12:30');
	assert.equal(formatTimestamp(NEW_YEAR_MS, 'second'), '01/01/2026 12:30:45');
});

test('toMySQLDateTime converts ISO strings and dates, and rejects text that is not a date', () => {
	assert.equal(toMySQLDateTime('2026-01-01T12:30:45Z')?.getTime(), NEW_YEAR_MS);
	assert.equal(toMySQLDateTime('2026-01-01T19:30:45+07:00')?.getTime(), NEW_YEAR_MS);
	assert.equal(toMySQLDateTime(new Date(NEW_YEAR_MS))?.getTime(), NEW_YEAR_MS);
	assert.equal(toMySQLDateTime('not a date'), null);
});

test('toMySQLDateTime with no argument is the current time', () => {
	const before = Date.now();
	const now = toMySQLDateTime()?.getTime() ?? 0;
	assert.ok(now >= before && now <= Date.now());
});

test('database datetimes are read as UTC whatever the machine timezone is', () => {
	assert.equal(parseMySQLDateTimeUtc('2026-01-01 12:30:45')?.getTime(), NEW_YEAR_MS);
	assert.equal(parseMySQLDateTimeUtc(new Date(NEW_YEAR_MS))?.getTime(), NEW_YEAR_MS);
	assert.equal(dbDateTimeToMs('2026-01-01 12:30:45'), NEW_YEAR_MS);
	assert.equal(dbUtcValueToIso('2026-01-01 12:30:45'), '2026-01-01T12:30:45.000Z');
	assert.equal(formatDbDateTime('2026-01-01 12:30:45'), '01/01/2026 12:30');
});

test('missing or invalid database values fall back instead of throwing', () => {
	for (const value of [null, undefined, '', 'garbage', new Date(Number.NaN)]) {
		assert.equal(parseMySQLDateTimeUtc(value), null);
		assert.equal(dbDateTimeToMs(value), 0);
		assert.equal(dbUtcValueToIso(value), null);
		assert.equal(formatDbDateTime(value), '—');
	}
});

test('isUtcSqlExpired compares against the current UTC time', () => {
	assert.equal(isUtcSqlExpired('2000-01-01 00:00:00'), true);
	assert.equal(isUtcSqlExpired('2999-01-01 00:00:00'), false);
	assert.equal(isUtcSqlExpired(new Date(Date.now() - 60_000)), true);
	assert.equal(isUtcSqlExpired(new Date(Date.now() + 60_000)), false);
	assert.equal(isUtcSqlExpired(null), false);
	assert.equal(isUtcSqlExpired('garbage'), false);
});
