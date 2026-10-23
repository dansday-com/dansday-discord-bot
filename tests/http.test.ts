import assert from 'node:assert/strict';
import { test } from 'node:test';
import { numberField, numberFieldOr, optionalText, positiveIntegerField, readJsonObject } from '../src/lib/http.ts';

const jsonRequest = (body: string) => new Request('https://x.test', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });

test('readJsonObject returns the parsed object', async () => {
	assert.deepEqual(await readJsonObject(jsonRequest('{"is_frozen":true}')), { is_frozen: true });
});

test('readJsonObject returns an empty object for anything that is not a JSON object', async () => {
	assert.deepEqual(await readJsonObject(jsonRequest('not json')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('[1,2]')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('null')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('"text"')), {});
});

test('optionalText keeps non-empty text only', () => {
	assert.equal(optionalText('hello'), 'hello');
	assert.equal(optionalText(''), null);
	assert.equal(optionalText(5), null);
	assert.equal(optionalText(null), null);
});

test('numberField reads numbers and numeric text, anything else is NaN', () => {
	assert.equal(numberField(5), 5);
	assert.equal(numberField('7'), 7);
	assert.ok(Number.isNaN(numberField('abc')));
	assert.ok(Number.isNaN(numberField(true)));
	assert.ok(Number.isNaN(numberField(null)));
	assert.ok(Number.isNaN(numberField([1])));
});

test('numberFieldOr falls back for a missing, zero or non-numeric value, and rejects other types', () => {
	assert.equal(numberFieldOr(undefined, 1), 1);
	assert.equal(numberFieldOr(null, 0), 0);
	assert.equal(numberFieldOr('3', 1), 3);
	assert.equal(numberFieldOr(0, 1), 1);
	assert.equal(numberFieldOr('abc', 1), 1);
	assert.ok(Number.isNaN(numberFieldOr(true, 1)));
	assert.ok(Number.isNaN(numberFieldOr({}, 1)));
});

test('positiveIntegerField accepts whole numbers above zero only', () => {
	assert.equal(positiveIntegerField(4), 4);
	assert.equal(positiveIntegerField('12'), 12);
	assert.equal(positiveIntegerField(0), null);
	assert.equal(positiveIntegerField(-2), null);
	assert.equal(positiveIntegerField(1.5), null);
	assert.equal(positiveIntegerField(true), null);
	assert.equal(positiveIntegerField('x'), null);
});
