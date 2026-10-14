import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPie, compact, sharePct } from '../src/lib/frontend/components/dash/chart.ts';

test('compact shortens thousands, millions and billions', () => {
	assert.equal(compact(0), '0');
	assert.equal(compact(999), '999');
	assert.equal(compact(1000), '1.0K');
	assert.equal(compact(1500), '1.5K');
	assert.equal(compact(12_345), '12K');
	assert.equal(compact(1_000_000), '1.0M');
	assert.equal(compact(25_000_000), '25M');
	assert.equal(compact(1_500_000_000), '1.5B');
	assert.equal(compact(12_000_000_000), '12B');
});

test('compact keeps the sign and tolerates values that are not numbers', () => {
	assert.equal(compact(-1500), '-1.5K');
	assert.equal(compact(Number.NaN), '0');
	assert.equal(compact(12.6), '13');
});

test('sharePct scales to the largest row and never drops below the floor', () => {
	assert.equal(sharePct(50, [100, 50]), 50);
	assert.equal(sharePct(100, [100, 50]), 100);
	assert.equal(sharePct(0, [100]), 4);
	assert.equal(sharePct(1, [100], 10), 10);
});

test('buildPie returns nothing for an empty or zero total', () => {
	assert.deepEqual(buildPie([]), { total: 0, segments: [] });
	assert.deepEqual(buildPie([{ value: 0, color: '#000000', label: 'none' }]), { total: 0, segments: [] });
});

test('buildPie draws a single visible item as a full circle', () => {
	const single = buildPie([{ value: 7, color: '#111111', label: 'only' }]);
	assert.equal(single.total, 7);
	assert.equal(single.segments.length, 1);
	assert.equal(single.segments[0].pct, 100);
	assert.equal(single.segments[0].d, '');

	const dominated = buildPie([
		{ value: 1000, color: '#111111', label: 'big' },
		{ value: 1, color: '#222222', label: 'tiny' }
	]);
	assert.equal(dominated.total, 1001);
	assert.equal(dominated.segments.length, 1);
	assert.equal(dominated.segments[0].label, 'big');
});

test('buildPie splits several items into arcs that add up to the whole', () => {
	const pie = buildPie([
		{ value: 1, color: '#111111', label: 'a' },
		{ value: 1, color: '#222222', label: 'b' },
		{ value: 2, color: '#333333', label: 'c' }
	]);
	assert.equal(pie.total, 4);
	assert.deepEqual(
		pie.segments.map((segment) => segment.pct),
		[25, 25, 50]
	);
	for (const segment of pie.segments) {
		assert.match(segment.d, /^M50,50 L[\d.-]+,[\d.-]+ A48,48 0 [01] 1 [\d.-]+,[\d.-]+ Z$/);
	}
});
