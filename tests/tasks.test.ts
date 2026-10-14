import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	DAILY_DIFFICULTY_PLAN,
	DAILY_TASK_SLOTS,
	DIFFICULTY_META,
	TASK_BY_ID,
	TASK_DEFINITIONS,
	WEEKLY_DIFFICULTY_PLAN,
	WEEKLY_TASK_SLOTS,
	gambleWinChance,
	loginCycleBroken,
	loginReadyInMs,
	minuteKeyFor,
	msUntilPeriodEnds,
	periodOpen
} from '../src/lib/tasks.ts';
import { DAY_MINUTES } from '../src/lib/utils/time.ts';

const MINUTE = 60_000;
const KEY = 1_000_000;
const NOW = KEY * MINUTE;

test('task ids are unique, so the lookup table holds every task', () => {
	const ids = TASK_DEFINITIONS.map((task) => task.id);
	assert.deepEqual(
		ids.filter((id, index) => ids.indexOf(id) !== index),
		[]
	);
	assert.equal(TASK_BY_ID.size, TASK_DEFINITIONS.length);
});

test('every task has what a card needs to render', () => {
	for (const task of TASK_DEFINITIONS) {
		assert.ok(task.label && task.icon && task.metric, task.id);
		assert.equal(typeof task.describe, 'function', task.id);
	}
});

test('the difficulty plans fill every slot with a known difficulty', () => {
	assert.equal(DAILY_DIFFICULTY_PLAN.length, DAILY_TASK_SLOTS);
	assert.equal(WEEKLY_DIFFICULTY_PLAN.length, WEEKLY_TASK_SLOTS);
	for (const difficulty of [...DAILY_DIFFICULTY_PLAN, ...WEEKLY_DIFFICULTY_PLAN]) {
		assert.ok(DIFFICULTY_META[difficulty], difficulty);
	}
	assert.ok(DIFFICULTY_META.easy.weight < DIFFICULTY_META.medium.weight && DIFFICULTY_META.medium.weight < DIFFICULTY_META.hard.weight);
});

test('gambleWinChance is the fair chance for a multiplier', () => {
	assert.equal(gambleWinChance(2), 50);
	assert.equal(gambleWinChance(5), 20);
	assert.equal(gambleWinChance(0.5), 100);
	assert.equal(gambleWinChance(Number.NaN), 100);
});

test('a period stays open for exactly its length', () => {
	assert.equal(minuteKeyFor(5 * MINUTE + 30_000), 5);
	assert.equal(periodOpen(null, 'daily', NOW), false);
	assert.equal(periodOpen(KEY, 'daily', NOW), true);
	assert.equal(periodOpen(KEY, 'daily', NOW + (DAY_MINUTES - 1) * MINUTE), true);
	assert.equal(periodOpen(KEY, 'daily', NOW + DAY_MINUTES * MINUTE), false);
	assert.equal(periodOpen(KEY, 'weekly', NOW + (7 * DAY_MINUTES - 1) * MINUTE), true);
	assert.equal(periodOpen(KEY, 'weekly', NOW + 7 * DAY_MINUTES * MINUTE), false);
});

test('msUntilPeriodEnds counts down to zero and never goes negative', () => {
	assert.equal(msUntilPeriodEnds(KEY, 'daily', NOW), DAY_MINUTES * MINUTE);
	assert.equal(msUntilPeriodEnds(KEY, 'daily', NOW + 60 * MINUTE), (DAY_MINUTES - 60) * MINUTE);
	assert.equal(msUntilPeriodEnds(KEY, 'daily', NOW + 2 * DAY_MINUTES * MINUTE), 0);
	assert.equal(msUntilPeriodEnds(KEY, 'weekly', NOW), 7 * DAY_MINUTES * MINUTE);
});

test('the daily login is ready a day after the last one and the cycle breaks after two', () => {
	assert.equal(loginReadyInMs(null, NOW), 0);
	assert.equal(loginReadyInMs(KEY, NOW), DAY_MINUTES * MINUTE);
	assert.equal(loginReadyInMs(KEY, NOW + DAY_MINUTES * MINUTE), 0);
	assert.equal(loginCycleBroken(null, NOW), false);
	assert.equal(loginCycleBroken(KEY, NOW + (2 * DAY_MINUTES - 1) * MINUTE), false);
	assert.equal(loginCycleBroken(KEY, NOW + 2 * DAY_MINUTES * MINUTE), true);
});
