import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	MODERATION_ACTION_META,
	MODERATION_REASON_OPTIONAL,
	MODERATION_TIMED_ACTIONS,
	formatDuration,
	moderateEach,
	splitDuration
} from '../src/lib/frontend/moderation.ts';

test('every action named in the lists has a label, icon and colour', () => {
	for (const action of [...MODERATION_TIMED_ACTIONS, ...MODERATION_REASON_OPTIONAL]) {
		const meta = MODERATION_ACTION_META[action];
		assert.ok(meta?.label && meta.icon && meta.color, action);
	}
});

test('formatDuration prints days, hours and minutes, or seconds when shorter', () => {
	assert.equal(formatDuration(null), null);
	assert.equal(formatDuration(0), null);
	assert.equal(formatDuration(45), '45s');
	assert.equal(formatDuration(60), '1m');
	assert.equal(formatDuration(3600), '1h');
	assert.equal(formatDuration(86400), '1d');
	assert.equal(formatDuration(90061), '1d 1h 1m');
});

test('splitDuration picks the largest unit that divides evenly', () => {
	assert.deepEqual(splitDuration(172800), { amount: 2, unit: '86400' });
	assert.deepEqual(splitDuration(7200), { amount: 2, unit: '3600' });
	assert.deepEqual(splitDuration(600), { amount: 10, unit: '60' });
	assert.deepEqual(splitDuration(90), { amount: 2, unit: '60' });
	assert.deepEqual(splitDuration(0), { amount: 1, unit: '60' });
	assert.deepEqual(splitDuration(null), { amount: 1, unit: '60' });
});

test('moderateEach posts once per member and reports what happened to each', async () => {
	const original = globalThis.fetch;
	const requests: { url: string; body: Record<string, unknown> }[] = [];
	globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
		requests.push({ url: String(url), body });
		if (body.target_id === '2') {
			return new Response(JSON.stringify({ ok: true, escalated: true }), { status: 200 });
		}
		if (body.target_id === '3') {
			return new Response(JSON.stringify({ ok: false, error: 'No permission' }), { status: 403 });
		}
		if (body.target_id === '4') {
			throw new Error('network down');
		}
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	}) as typeof fetch;
	try {
		const progress: number[] = [];
		const result = await moderateEach(7, ['1', '2', '3', '4'], { action: 'warn', reason: 'Spam' }, (done) => progress.push(done));
		assert.deepEqual(result, { done: 2, failed: 2, failedIds: ['3', '4'], escalated: 1, error: 'No permission' });
		assert.deepEqual(progress, [1, 2, 3, 4]);
		assert.deepEqual(
			requests.map((request) => request.url),
			Array(4).fill('/api/servers/7/moderation')
		);
		assert.deepEqual(requests[0].body, { action: 'warn', reason: 'Spam', target_id: '1' });
	} finally {
		globalThis.fetch = original;
	}
});

test('moderateEach with nobody selected does nothing', async () => {
	assert.deepEqual(await moderateEach(7, [], { action: 'warn' }), { done: 0, failed: 0, failedIds: [], escalated: 0, error: null });
});
