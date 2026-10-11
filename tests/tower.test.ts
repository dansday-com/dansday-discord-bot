import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	TOWER_DOORS,
	TOWER_FLOORS,
	TOWER_FLOOR_CHANCES,
	TOWER_MIN_CHANCE,
	TOWER_PRIZES,
	towerBaseChance,
	towerFatigue,
	towerOddsDropPercent,
	towerPrize,
	towerReachChance,
	towerSafeChance,
	towerTrapCount
} from '../src/lib/tower.ts';

test('each floor pays more and is harder than the one below', () => {
	assert.equal(TOWER_PRIZES.length, TOWER_FLOORS);
	assert.equal(TOWER_FLOOR_CHANCES.length, TOWER_FLOORS);
	for (let floor = 1; floor < TOWER_FLOORS; floor++) {
		assert.ok(TOWER_PRIZES[floor] > TOWER_PRIZES[floor - 1]);
		assert.ok(TOWER_FLOOR_CHANCES[floor] < TOWER_FLOOR_CHANCES[floor - 1]);
	}
});

test('every repeat climb on the same day lowers the odds', () => {
	assert.equal(towerFatigue(1), 1);
	assert.equal(towerFatigue(2), 0.88);
	assert.equal(towerFatigue(0), 1);
	assert.equal(towerOddsDropPercent(1), 0);
	assert.equal(towerOddsDropPercent(2), 12);
	assert.equal(towerOddsDropPercent(3), 22.6);
});

test('towerBaseChance reads the floor table, clamps the floor and never drops below the minimum', () => {
	assert.equal(towerBaseChance(1), 75);
	assert.equal(towerBaseChance(TOWER_FLOORS), 30);
	assert.equal(towerBaseChance(99), 30);
	assert.equal(towerBaseChance(0), 75);
	assert.equal(towerBaseChance(1, 2), 66);
	assert.equal(towerBaseChance(TOWER_FLOORS, 1000), TOWER_MIN_CHANCE);
});

test('luck adds to the chance of a safe door up to one hundred percent', () => {
	assert.equal(towerSafeChance(1), 75);
	assert.equal(towerSafeChance(1, 1, 10), 85);
	assert.equal(towerSafeChance(1, 1, 50), 100);
	assert.equal(towerSafeChance(1, 1, -5), 75);
});

test('the chance of reaching a floor is the product of the floors below it', () => {
	assert.equal(towerReachChance(1), 75);
	assert.equal(towerReachChance(2), 52.5);
	assert.equal(towerReachChance(0), 75);
	for (let floor = 2; floor <= TOWER_FLOORS; floor++) {
		assert.ok(towerReachChance(floor) < towerReachChance(floor - 1));
	}
});

test('there is always at least one trap and at least one safe door', () => {
	assert.equal(towerTrapCount(100), 1);
	assert.equal(towerTrapCount(75), 1);
	assert.equal(towerTrapCount(30), 2);
	assert.equal(towerTrapCount(0), TOWER_DOORS - 1);
});

test('towerPrize pays nothing below the first floor and caps at the top', () => {
	assert.equal(towerPrize(0), 0);
	assert.equal(towerPrize(-1), 0);
	assert.equal(towerPrize(1), 500);
	assert.equal(towerPrize(TOWER_FLOORS), 50000);
	assert.equal(towerPrize(TOWER_FLOORS + 5), 50000);
});
