export const PERCENT = 100;
export const HEX_RADIX = 16;
export const BASE36_RADIX = 36;
export const RGB_MAX = 255;
export const FULL_TURN_DEGREES = 360;
export const HALF_TURN_DEGREES = 180;
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

const QUARTERS = 4;

export const QUARTER_PERCENTS = Array.from({ length: QUARTERS }, (_, i) => ((i + 1) * PERCENT) / QUARTERS);

const DECIMAL_BASE = 10;

export function roundTo(value: number, decimals: number) {
	const scale = DECIMAL_BASE ** decimals;
	return Math.round(value * scale) / scale;
}
