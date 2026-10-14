import { PERCENT, roundTo } from './utils/numbers.js';

export const TOWER_GAME = 'tower';
export const TOWER_DOORS = 3;
export const TOWER_RESET_HOURS = 24;
export const TOWER_LADDER = [
	{ prize: 500, chance: 75 },
	{ prize: 1000, chance: 70 },
	{ prize: 1500, chance: 65 },
	{ prize: 2500, chance: 60 },
	{ prize: 4000, chance: 55 },
	{ prize: 6500, chance: 50 },
	{ prize: 10000, chance: 45 },
	{ prize: 16000, chance: 40 },
	{ prize: 25000, chance: 35 },
	{ prize: 50000, chance: 30 }
] as const;
export const TOWER_PRIZES = TOWER_LADDER.map((floor) => floor.prize);
export const TOWER_FLOORS = TOWER_LADDER.length;
export const TOWER_FLOOR_CHANCES = TOWER_LADDER.map((floor) => floor.chance);
export const TOWER_FATIGUE = 0.88;
export const TOWER_MIN_CHANCE = 0.1;
export const TOWER_HIGH_FLOOR = 3;

function towerFloorIndex(floor: unknown): number {
	return Math.min(TOWER_FLOORS, Math.max(1, Math.floor(Number(floor) || 1))) - 1;
}

export function towerFatigue(climb: unknown): number {
	return TOWER_FATIGUE ** (Math.max(1, Math.floor(Number(climb) || 1)) - 1);
}

export function towerOddsDropPercent(climb: unknown): number {
	return roundTo((1 - towerFatigue(climb)) * PERCENT, 1);
}

export function towerBaseChance(floor: unknown, climb: unknown = 1): number {
	return Math.max(TOWER_MIN_CHANCE, roundTo(TOWER_FLOOR_CHANCES[towerFloorIndex(floor)] * towerFatigue(climb), 1));
}

export function towerSafeChance(floor: unknown, climb: unknown = 1, luckPercent: unknown = 0): number {
	const base = towerBaseChance(floor, climb);
	const luck = Math.max(0, Number(luckPercent) || 0);
	return luck > 0 ? Math.min(PERCENT, roundTo(base + luck, 1)) : base;
}

export function towerReachChance(floor: unknown, climb: unknown = 1): number {
	let chance = PERCENT;
	for (let f = 1; f <= towerFloorIndex(floor) + 1; f++) {
		chance = (chance * towerBaseChance(f, climb)) / PERCENT;
	}
	return chance;
}

export function towerTrapCount(chance: unknown): number {
	const c = Math.min(PERCENT, Math.max(0, Number(chance) || 0));
	return Math.min(TOWER_DOORS - 1, Math.max(1, Math.round(((PERCENT - c) / PERCENT) * TOWER_DOORS)));
}

export function towerPrize(floor: unknown): number {
	const f = Math.min(TOWER_FLOORS, Math.floor(Number(floor) || 0));
	return f > 0 ? TOWER_PRIZES[f - 1] : 0;
}
