export const REEL_SECONDS = 6.8;
export const REEL_CURVE = { x1: 0.06, y1: 0.72, x2: 0.06, y2: 1 };
export const REEL_RESULT_DELAY_MS = 7000;
export const SPIN_REEL_CELLS = 40;
export const IDLE_REEL_CELLS = 14;

const REEL_FALLBACK_WIDTH_PX = 360;

export function reelCellOffset(wrap: HTMLElement | undefined, index: number): number | null {
	const wrapW = wrap?.clientWidth ?? REEL_FALLBACK_WIDTH_PX;
	const cell = wrap?.querySelectorAll<HTMLElement>('[data-reel-cell]')?.[index];
	return cell ? wrapW / 2 - (cell.offsetLeft + cell.offsetWidth / 2) : null;
}
