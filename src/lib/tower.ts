export const TOWER_GAME = 'tower';
export const TOWER_DOORS = 3;
export const TOWER_RUNS_PER_DAY = 3;
export const TOWER_COOLDOWN_HOURS = 24;
export const TOWER_PRIZES = [500, 1000, 2000, 4000, 8000, 15000, 30000, 50000] as const;
export const TOWER_FLOORS = TOWER_PRIZES.length;
export const TOWER_BASE_SAFE_CHANCE = ((TOWER_DOORS - 1) / TOWER_DOORS) * 100;

export function towerSafeChance(luckPercent: any = 0): number {
	const luck = Math.max(0, Number(luckPercent) || 0);
	return luck > 0 ? Math.min(100, TOWER_BASE_SAFE_CHANCE + luck) : TOWER_BASE_SAFE_CHANCE;
}

export function towerPrize(floor: any): number {
	const f = Math.min(TOWER_FLOORS, Math.floor(Number(floor) || 0));
	return f > 0 ? TOWER_PRIZES[f - 1] : 0;
}
