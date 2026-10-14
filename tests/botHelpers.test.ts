import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration } from '../src/lib/backend/bots/official-bot/components/moderation.ts';
import { type Translator, errorReasonFor } from '../src/lib/backend/bots/official-bot/i18n.ts';
import { parseLocalizedDuration } from '../src/lib/backend/bots/official-bot/localizedInput.ts';
import { t } from '../src/lib/localeStore.ts';

const english: Translator = Object.assign((key: string, params?: Record<string, unknown>) => String(t(key, 'en', params)), { lang: 'en' });
const GENERIC = english('common.errors.reasons.unexpected');

test('durations are read from short units', () => {
	assert.equal(parseLocalizedDuration('45s'), 45);
	assert.equal(parseLocalizedDuration('10m'), 600);
	assert.equal(parseLocalizedDuration('2h'), 7200);
	assert.equal(parseLocalizedDuration('1d'), 86400);
	assert.equal(parseLocalizedDuration('1w'), 604800);
	assert.equal(parseLocalizedDuration('1h 30m'), 5400);
});

test('a bare number is minutes', () => {
	assert.equal(parseLocalizedDuration('90'), 5400);
});

test('durations are read from words in English and in the member language', () => {
	assert.equal(parseLocalizedDuration('2 hours'), 7200);
	assert.equal(parseLocalizedDuration('10 minutes'), 600);
	assert.equal(parseLocalizedDuration('30 menit'), 1800);
	assert.equal(parseLocalizedDuration('1 jam'), 3600);
	assert.equal(parseLocalizedDuration('3 hari'), 259200);
});

test('text that is not a duration, or adds up to nothing, is rejected', () => {
	assert.equal(parseLocalizedDuration('abc'), null);
	assert.equal(parseLocalizedDuration(''), null);
	assert.equal(parseLocalizedDuration(null), null);
	assert.equal(parseLocalizedDuration('0m'), null);
});

test('moderation durations print the largest units first', () => {
	assert.equal(formatDuration(english, 90061), '1d 1h 1m');
	assert.equal(formatDuration(english, 3600), '1h');
	assert.equal(formatDuration(english, 45), '45s');
	assert.equal(formatDuration(english, 0), null);
	assert.equal(formatDuration(english, null), null);
});

test('known Discord error codes get their own cause and fix', () => {
	const reasons = [10003, 10007, 10011, 30005, 50001, 50013, 50035].map((code) => errorReasonFor(english, { code }));
	for (const reason of reasons) {
		assert.ok(reason.length > 0);
		assert.notEqual(reason, GENERIC);
		assert.equal(reason.startsWith('common.errors'), false);
	}
	assert.equal(new Set(reasons).size, reasons.length);
});

test('anything else gets the generic reason and never the raw error', () => {
	assert.equal(GENERIC.startsWith('common.errors'), false);
	assert.equal(errorReasonFor(english, { code: 99999 }), GENERIC);
	assert.equal(errorReasonFor(english, new Error('ECONNRESET at 10.0.0.1')), GENERIC);
	assert.equal(errorReasonFor(english, null), GENERIC);
});
