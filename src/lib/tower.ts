export const TOWER_GAME = 'tower';
export const TOWER_DOORS = 3;
export const TOWER_RESET_HOURS = 24;
export const TOWER_PRIZES = [500, 1000, 1500, 2500, 4000, 6500, 10000, 16000, 25000, 50000] as const;
export const TOWER_FLOORS = TOWER_PRIZES.length;
export const TOWER_FLOOR_CHANCES = [75, 70, 65, 60, 55, 50, 45, 40, 35, 30] as const;
export const TOWER_FATIGUE = 0.88;
export const TOWER_MIN_CHANCE = 0.1;

function towerFloorIndex(floor: any): number {
	return Math.min(TOWER_FLOORS, Math.max(1, Math.floor(Number(floor) || 1))) - 1;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export function towerFatigue(climb: any): number {
	return Math.pow(TOWER_FATIGUE, Math.max(1, Math.floor(Number(climb) || 1)) - 1);
}

export function towerOddsDropPercent(climb: any): number {
	return round1((1 - towerFatigue(climb)) * 100);
}

export function towerBaseChance(floor: any, climb: any = 1): number {
	return Math.max(TOWER_MIN_CHANCE, round1(TOWER_FLOOR_CHANCES[towerFloorIndex(floor)] * towerFatigue(climb)));
}

export function towerSafeChance(floor: any, climb: any = 1, luckPercent: any = 0): number {
	const luck = Math.max(0, Number(luckPercent) || 0);
	if (luck <= 0) return towerBaseChance(floor, climb);
	return Math.max(TOWER_MIN_CHANCE, round1(Math.min(100, TOWER_FLOOR_CHANCES[towerFloorIndex(floor)] + luck) * towerFatigue(climb)));
}

export function towerLuckBonus(floor: any, climb: any = 1, luckPercent: any = 0): number {
	return round1(towerSafeChance(floor, climb, luckPercent) - towerBaseChance(floor, climb));
}

export function towerTrapCount(chance: any): number {
	const c = Math.min(100, Math.max(0, Number(chance) || 0));
	return Math.min(TOWER_DOORS - 1, Math.max(1, Math.round(((100 - c) / 100) * TOWER_DOORS)));
}

export function towerPrize(floor: any): number {
	const f = Math.min(TOWER_FLOORS, Math.floor(Number(floor) || 0));
	return f > 0 ? TOWER_PRIZES[f - 1] : 0;
}
