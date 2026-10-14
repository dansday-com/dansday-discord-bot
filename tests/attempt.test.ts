import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attempt, attemptSync } from '../src/lib/utils/attempt.ts';

test('attempt hands back the value a call resolves to', async () => {
	assert.deepEqual(await attempt(async () => 42), { ok: true, value: 42 });
	assert.deepEqual(await attempt(() => 'sync'), { ok: true, value: 'sync' });
});

test('attempt keeps falsy values as successes', async () => {
	assert.deepEqual(await attempt(async () => 0), { ok: true, value: 0 });
	assert.deepEqual(await attempt(async () => null), { ok: true, value: null });
});

test('attempt captures both rejections and synchronous throws', async () => {
	const failure = new Error('nope');
	assert.deepEqual(
		await attempt(async () => {
			throw failure;
		}),
		{ ok: false, error: failure }
	);
	assert.deepEqual(
		await attempt(() => {
			throw failure;
		}),
		{ ok: false, error: failure }
	);
});

test('attemptSync reports synchronous results without waiting', () => {
	assert.deepEqual(
		attemptSync(() => JSON.parse('{"a":1}')),
		{ ok: true, value: { a: 1 } }
	);
	const parsed = attemptSync(() => JSON.parse('{'));
	assert.equal(parsed.ok, false);
	assert.ok(!parsed.ok && parsed.error instanceof SyntaxError);
});
