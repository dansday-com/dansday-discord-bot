import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ITEM_EFFECTS,
	actionVerb,
	discountedItemCost,
	effectAccentHex,
	effectAccentInt,
	effectDefaultCost,
	effectLabel,
	effectMeta,
	effectSummary,
	effectiveBagStock,
	floatingWallClockMs,
	formatDuration,
	isTargetedEffect,
	itemAvailability,
	luckBoostLabel,
	luckReduceLabel
} from '../src/lib/items.ts';

const HOUR = 60 * 60 * 1000;
const at = (day: number, hour = 0, minute = 0) => Date.UTC(2026, 0, day, hour, minute);

test('effectiveBagStock counts every stack unless it is both disabled and unusable', () => {
	assert.equal(effectiveBagStock([]), 0);
	assert.equal(effectiveBagStock([{ quantity: 3 }, { quantity: 2, enabled: false, usable: false }, { quantity: 4, enabled: 0, usable: 1 }]), 7);
	assert.equal(effectiveBagStock([{ quantity: 5, enabled: true, usable: false }, {}]), 5);
});

test('discountedItemCost takes the luck percentage off and rounds down', () => {
	assert.equal(discountedItemCost(100, 0), 100);
	assert.equal(discountedItemCost(100, 10), 90);
	assert.equal(discountedItemCost(99, 10), 89);
	assert.equal(discountedItemCost(100, 150), 0);
});

test('discountedItemCost never discounts luck or gift items and treats bad input as zero', () => {
	assert.equal(discountedItemCost(100, 10, 'luck'), 100);
	assert.equal(discountedItemCost(100, 10, 'gift'), 100);
	assert.equal(discountedItemCost(-5, 10), 0);
	assert.equal(discountedItemCost('abc', 10), 0);
	assert.equal(discountedItemCost('200', '25'), 150);
});

test('luckBoostLabel shows the total first, then the base and bonus', () => {
	assert.equal(luckBoostLabel(10, 0), '10%');
	assert.equal(luckBoostLabel(10, 5), '15% (10 +5 🍀)');
	assert.equal(luckBoostLabel(10.5, 2), '12.5% (10.5 +2 🍀)');
	assert.equal(luckBoostLabel(95, 10, { max: 100 }), '100% (95 +5 🍀)');
	assert.equal(luckBoostLabel(10, 5, { unit: 'x' }), '15x (10 +5 🍀)');
});

test('luckReduceLabel lowers the value but never below zero', () => {
	assert.equal(luckReduceLabel(20, 0), '20%');
	assert.equal(luckReduceLabel(20, 5), '15% (20 −5 🍀)');
	assert.equal(luckReduceLabel(3, 5), '0% (3 −3 🍀)');
});

test('formatDuration prints the two largest units', () => {
	assert.equal(formatDuration(0), '0m');
	assert.equal(formatDuration(-5), '0m');
	assert.equal(formatDuration('abc'), '0m');
	assert.equal(formatDuration(59), '59m');
	assert.equal(formatDuration(60), '1h');
	assert.equal(formatDuration(90), '1h 30m');
	assert.equal(formatDuration(1500), '1d 1h');
	assert.equal(formatDuration(10080), '1w');
	assert.equal(formatDuration(11581), '1w 1d');
});

test('floatingWallClockMs reads the wall-clock time in the given offset', () => {
	assert.equal(floatingWallClockMs('2026-01-01 18:00', 0), at(1, 18));
	assert.equal(floatingWallClockMs('2026-01-01T18:00:00', 0), at(1, 18));
	assert.equal(floatingWallClockMs('2026-01-01 18:00', 7 * HOUR), at(1, 11));
	assert.equal(floatingWallClockMs(null, 0), null);
	assert.equal(floatingWallClockMs('garbage', 0), null);
});

test('an item with no window is always available', () => {
	assert.deepEqual(itemAvailability({}, at(1)), { visible: true, availableUntil: null, state: 'always', startsAt: null });
	assert.deepEqual(itemAvailability({ availableUntil: 123 }, at(1)), { visible: true, availableUntil: 123, state: 'always', startsAt: null });
});

test('a fixed window is upcoming before it, active inside it and ended after it', () => {
	const item = { available_from: '2026-01-02 00:00', available_to: '2026-01-04 00:00' };
	assert.deepEqual(itemAvailability(item, at(1)), { visible: true, availableUntil: null, state: 'upcoming', startsAt: at(2) });
	assert.deepEqual(itemAvailability(item, at(3)), { visible: true, availableUntil: at(4), state: 'active', startsAt: null });
	assert.deepEqual(itemAvailability(item, at(5)), { visible: false, availableUntil: null, state: 'ended', startsAt: null });
});

test('window times are wall-clock in the member timezone', () => {
	const item = { available_from: '2026-01-01 18:00' };
	const utcPlusSeven = 7 * 60;
	assert.equal(itemAvailability(item, at(1, 10, 59), utcPlusSeven).state, 'upcoming');
	assert.equal(itemAvailability(item, at(1, 10, 59), utcPlusSeven).startsAt, at(1, 11));
	assert.equal(itemAvailability(item, at(1, 11, 1), utcPlusSeven).state, 'active');
	assert.equal(itemAvailability(item, at(1, 11, 1), 0).state, 'upcoming');
});

test('effect helpers fall back for unknown effect types', () => {
	assert.equal(isTargetedEffect('steal'), true);
	assert.equal(isTargetedEffect('boost'), false);
	assert.deepEqual(actionVerb('nope'), { label: 'Use', icon: 'fa-bolt' });
});

test('every item effect has a label, an accent colour and a summary', () => {
	assert.equal(new Set(ITEM_EFFECTS.map((effect) => effect.id)).size, ITEM_EFFECTS.length);
	for (const effect of ITEM_EFFECTS) {
		assert.ok(effectLabel(effect.id), effect.id);
		assert.match(effectAccentHex(effect.id), /^#[0-9a-f]{6}$/i, effect.id);
		assert.equal(effectAccentInt(effect.id), Number.parseInt(effectAccentHex(effect.id).slice(1), 16), effect.id);
		assert.ok(effectSummary({ effect_type: effect.id }).length > 0, effect.id);
		assert.ok(Array.isArray(effectMeta({ effect_type: effect.id })), effect.id);
	}
});

test('effect chips show the configured numbers, with luck applied', () => {
	const steal = { effect_type: 'steal', config: { min_percent: 5, max_percent: 10, cooldown_minutes: 60 } };
	assert.deepEqual(
		effectMeta(steal).map((chip) => chip.label),
		['5–10%', '1h', '30m']
	);
	assert.equal(effectMeta(steal, 5)[0].label, '5–15% (10 +5 🍀)');
	assert.equal(effectSummary(steal), 'Steal 5–10% of their XP.');
	assert.deepEqual(
		effectMeta({ effect_type: 'boost', config: { multiplier: 3, effect_duration_minutes: 90 } }).map((chip) => chip.label),
		['3×', '1h 30m']
	);
	assert.deepEqual(
		effectMeta({ effect_type: 'gift', config: { gift_amount: 1500, tax_percent: 10 } }, 5).map((chip) => chip.label),
		['1.5k XP', '5% (10 −5 🍀)']
	);
});

test('an unknown effect type has no chips, no summary and no cost', () => {
	assert.deepEqual(effectMeta({ effect_type: 'nope', config: {} }), []);
	assert.equal(effectSummary({ effect_type: 'nope', config: {} }), '');
	assert.equal(effectDefaultCost('nope'), 0);
	assert.equal(effectLabel('nope'), 'nope');
});
