import { HEX_RADIX, RGB_MAX } from './numbers.js';

export type Rgb = [number, number, number];

export const LUMA_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
export const WCAG_LINEAR_THRESHOLD = 0.03928;
export const SRGB_LINEAR_THRESHOLD = 0.04045;

const HEX_PAIR = 2;
const BLUE_INDEX = 2;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA = 2.4;

function hexChannel(digits: string, index: number) {
	return parseInt(digits.slice(index * HEX_PAIR, (index + 1) * HEX_PAIR), HEX_RADIX);
}

export function hexToRgb(hex: string): Rgb {
	const digits = hex.startsWith('#') ? hex.slice(1) : hex;
	return [hexChannel(digits, 0), hexChannel(digits, 1), hexChannel(digits, BLUE_INDEX)];
}

export function clampChannel(n: number) {
	return Math.max(0, Math.min(RGB_MAX, Math.round(n)));
}

export function rgbToHex(rgb: Rgb): string {
	return `#${rgb.map((n) => clampChannel(n).toString(HEX_RADIX).padStart(HEX_PAIR, '0')).join('')}`;
}

export function linearChannel(channel: number, threshold = WCAG_LINEAR_THRESHOLD) {
	const c = channel / RGB_MAX;
	return c <= threshold ? c / SRGB_LINEAR_SLOPE : ((c + SRGB_GAMMA_OFFSET) / (1 + SRGB_GAMMA_OFFSET)) ** SRGB_GAMMA;
}

export function relativeLuminance([r, g, b]: Rgb) {
	return LUMA_WEIGHTS.r * linearChannel(r) + LUMA_WEIGHTS.g * linearChannel(g) + LUMA_WEIGHTS.b * linearChannel(b);
}

export function weightedLightness([r, g, b]: Rgb) {
	return (LUMA_WEIGHTS.r * r + LUMA_WEIGHTS.g * g + LUMA_WEIGHTS.b * b) / RGB_MAX;
}
