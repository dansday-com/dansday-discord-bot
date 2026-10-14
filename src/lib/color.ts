import { FULL_TURN_DEGREES, HALF_TURN_DEGREES, PERCENT, RGB_MAX, roundTo } from './utils/numbers.js';
import { SRGB_LINEAR_THRESHOLD, linearChannel } from './utils/rgb.js';

export const COLOR_GAME = 'color';
export const COLOR_ROUNDS = 5;
export const COLOR_MAX_SCORE = 10;
export const COLOR_MAX_TOTAL = COLOR_MAX_SCORE * COLOR_ROUNDS;
export const COLOR_MEMORIZE_MS = 5000;
export const COLOR_OPENING_HUE_GAP = 60;

export type Hsb = { h: number; s: number; b: number };
export type ColorAxis = keyof Hsb;
export type ColorRound = { target: Hsb; guess: Hsb; score: number };

export const COLOR_AXES: ColorAxis[] = ['h', 's', 'b'];
export const COLOR_AXIS_MAX: Record<ColorAxis, number> = { h: 359, s: 100, b: 100 };

const SCORE_FALLOFF = 25.25;
const SCORE_CURVE = 1.55;
const HUE_BONUS_GAP = 25;
const HUE_BONUS_CURVE = 1.5;
const HUE_BONUS_VIVID = 30;
const HUE_BONUS_SHARE = 0.25;
const HUE_PENALTY_START = 30;
const HUE_PENALTY_RANGE = 150;
const HUE_PENALTY_VIVID = 40;
const HUE_PENALTY_SHARE = 0.15;

const TARGET_LEVEL_MIN = 15;
const TARGET_LEVEL_SPAN = 86;
const OPENING_HUE_TRIES = 50;
const OPENING_S_MIN = 30;
const OPENING_S_SPAN = 60;
const OPENING_B_MIN = 40;
const OPENING_B_SPAN = 50;

const HUE_SECTOR_DEGREES = 60;
const HUE_SECTORS = 6;
const BYTE_BITS = 8;
const REC601_WEIGHTS = { r: 0.299, g: 0.587, b: 0.114 };

const SRGB_TO_XYZ = {
	x: { r: 0.4124564, g: 0.3575761, b: 0.1804375 },
	y: { r: 0.2126729, g: 0.7151522, b: 0.072175 },
	z: { r: 0.0193339, g: 0.119192, b: 0.9503041 }
};
const LAB_WHITE = { x: 0.95047, y: 1, z: 1.08883 };
const LAB_EPSILON = 0.008856;
const LAB_LINEAR_SLOPE = 7.787;
const LAB_L_OFFSET = 16;
const LAB_L_SCALE = 116;
const LAB_A_SCALE = 500;
const LAB_B_SCALE = 200;

const CHROMA_POWER = 7;
const CHROMA_REFERENCE = 25;
const CHROMA_REFERENCE_POW = CHROMA_REFERENCE ** CHROMA_POWER;
const CHROMA_STRETCH = 0.5;
const HUE_TERMS = [
	{ weight: -0.17, multiple: 1, shift: -30 },
	{ weight: 0.24, multiple: 2, shift: 0 },
	{ weight: 0.32, multiple: 3, shift: 6 },
	{ weight: -0.2, multiple: 4, shift: -63 }
];
const LIGHTNESS_MID = 50;
const LIGHTNESS_WEIGHT = 0.015;
const LIGHTNESS_OFFSET = 20;
const CHROMA_WEIGHT = 0.045;
const HUE_WEIGHT = 0.015;
const ROTATION_DEGREES = 60;
const ROTATION_CENTER = 275;
const ROTATION_WIDTH = 25;

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function deg(rad: number): number {
	return (rad * HALF_TURN_DEGREES) / Math.PI;
}

function rad(degrees: number): number {
	return (degrees * Math.PI) / HALF_TURN_DEGREES;
}

export function colorTarget(): Hsb {
	return {
		h: Math.floor(Math.random() * FULL_TURN_DEGREES),
		s: TARGET_LEVEL_MIN + Math.floor(Math.random() * TARGET_LEVEL_SPAN),
		b: TARGET_LEVEL_MIN + Math.floor(Math.random() * TARGET_LEVEL_SPAN)
	};
}

export function colorHueGap(a: number, b: number): number {
	const d = Math.abs(a - b) % FULL_TURN_DEGREES;
	return d > HALF_TURN_DEGREES ? FULL_TURN_DEGREES - d : d;
}

export function colorOpeningGuess(target: Hsb): Hsb {
	let h = Math.floor(Math.random() * FULL_TURN_DEGREES);
	for (let tries = 0; tries < OPENING_HUE_TRIES && colorHueGap(h, target.h) < COLOR_OPENING_HUE_GAP; tries++) {
		h = Math.floor(Math.random() * FULL_TURN_DEGREES);
	}
	return { h, s: OPENING_S_MIN + Math.floor(Math.random() * OPENING_S_SPAN), b: OPENING_B_MIN + Math.floor(Math.random() * OPENING_B_SPAN) };
}

export function colorGuess(raw: Record<string, unknown>): Hsb | null {
	const [h, s, b] = COLOR_AXES.map((axis) => (raw?.[axis] == null || raw[axis] === '' ? NaN : Number(raw[axis])));
	if (![h, s, b].every(Number.isFinite)) {
		return null;
	}
	return {
		h: ((Math.round(h) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES,
		s: clamp(Math.round(s), 0, COLOR_AXIS_MAX.s),
		b: clamp(Math.round(b), 0, COLOR_AXIS_MAX.b)
	};
}

export function hsbToRgb(c: Hsb): [number, number, number] {
	const s = clamp(c.s, 0, PERCENT) / PERCENT;
	const v = clamp(c.b, 0, PERCENT) / PERCENT;
	const h = (((c.h % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES) / HUE_SECTOR_DEGREES;
	const chroma = v * s;
	const x = chroma * (1 - Math.abs((h % 2) - 1));
	const m = v - chroma;
	const sector = Math.floor(h);
	const [r, g, b] = [
		[chroma, x, 0],
		[x, chroma, 0],
		[0, chroma, x],
		[0, x, chroma],
		[x, 0, chroma],
		[chroma, 0, x]
	][sector % HUE_SECTORS];
	return [Math.round((r + m) * RGB_MAX), Math.round((g + m) * RGB_MAX), Math.round((b + m) * RGB_MAX)];
}

export function hsbToCss(c: Hsb): string {
	const [r, g, b] = hsbToRgb(c);
	return `rgb(${r} ${g} ${b})`;
}

export function hsbToHex(c: Hsb): number {
	const [r, g, b] = hsbToRgb(c);
	return (r << (2 * BYTE_BITS)) | (g << BYTE_BITS) | b;
}

export function colorLuma(c: Hsb): number {
	const [r, g, b] = hsbToRgb(c);
	return (REC601_WEIGHTS.r * r + REC601_WEIGHTS.g * g + REC601_WEIGHTS.b * b) / RGB_MAX;
}

function labCurve(t: number): number {
	return t > LAB_EPSILON ? Math.cbrt(t) : LAB_LINEAR_SLOPE * t + LAB_L_OFFSET / LAB_L_SCALE;
}

function xyzAxis(weights: { r: number; g: number; b: number }, [r, g, b]: number[]): number {
	return weights.r * r + weights.g * g + weights.b * b;
}

function hsbToLab(c: Hsb): [number, number, number] {
	const linear = hsbToRgb(c).map((channel) => linearChannel(channel, SRGB_LINEAR_THRESHOLD));
	const x = labCurve(xyzAxis(SRGB_TO_XYZ.x, linear) / LAB_WHITE.x);
	const y = labCurve(xyzAxis(SRGB_TO_XYZ.y, linear) / LAB_WHITE.y);
	const z = labCurve(xyzAxis(SRGB_TO_XYZ.z, linear) / LAB_WHITE.z);
	return [LAB_L_SCALE * y - LAB_L_OFFSET, LAB_A_SCALE * (x - y), LAB_B_SCALE * (y - z)];
}

function labHue(b: number, a: number): number {
	if (a === 0 && b === 0) {
		return 0;
	}
	const h = deg(Math.atan2(b, a));
	return h < 0 ? h + FULL_TURN_DEGREES : h;
}

export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
	const [l1, a1, b1] = lab1;
	const [l2, a2, b2] = lab2;

	const chromaMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
	const chromaMeanPow = chromaMean ** CHROMA_POWER;
	const stretch = 1 + CHROMA_STRETCH * (1 - Math.sqrt(chromaMeanPow / (chromaMeanPow + CHROMA_REFERENCE_POW)));

	const a1p = a1 * stretch;
	const a2p = a2 * stretch;
	const c1 = Math.hypot(a1p, b1);
	const c2 = Math.hypot(a2p, b2);
	const h1 = labHue(b1, a1p);
	const h2 = labHue(b2, a2p);
	const isAchromatic = c1 * c2 === 0;

	let hueDelta = 0;
	if (!isAchromatic) {
		hueDelta = h2 - h1;
		if (hueDelta > HALF_TURN_DEGREES) {
			hueDelta -= FULL_TURN_DEGREES;
		} else if (hueDelta < -HALF_TURN_DEGREES) {
			hueDelta += FULL_TURN_DEGREES;
		}
	}

	let hueMean = h1 + h2;
	if (!isAchromatic) {
		if (Math.abs(h1 - h2) <= HALF_TURN_DEGREES) {
			hueMean = (h1 + h2) / 2;
		} else {
			hueMean = h1 + h2 < FULL_TURN_DEGREES ? (h1 + h2 + FULL_TURN_DEGREES) / 2 : (h1 + h2 - FULL_TURN_DEGREES) / 2;
		}
	}

	const dL = l2 - l1;
	const dC = c2 - c1;
	const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(hueDelta / 2));

	const lMean = (l1 + l2) / 2;
	const cMean = (c1 + c2) / 2;
	const cMeanPow = cMean ** CHROMA_POWER;

	const t = HUE_TERMS.reduce((sum, term) => sum + term.weight * Math.cos(rad(term.multiple * hueMean + term.shift)), 1);
	const sL = 1 + (LIGHTNESS_WEIGHT * (lMean - LIGHTNESS_MID) ** 2) / Math.sqrt(LIGHTNESS_OFFSET + (lMean - LIGHTNESS_MID) ** 2);
	const sC = 1 + CHROMA_WEIGHT * cMean;
	const sH = 1 + HUE_WEIGHT * cMean * t;
	const rotation =
		-Math.sin(rad(ROTATION_DEGREES * Math.exp(-(((hueMean - ROTATION_CENTER) / ROTATION_WIDTH) ** 2)))) *
		2 *
		Math.sqrt(cMeanPow / (cMeanPow + CHROMA_REFERENCE_POW));

	return Math.sqrt((dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rotation * (dC / sC) * (dH / sH));
}

export function colorScore(target: Hsb, guess: Hsb): number {
	const distance = deltaE2000(hsbToLab(target), hsbToLab(guess));
	const base = COLOR_MAX_SCORE / (1 + (distance / SCORE_FALLOFF) ** SCORE_CURVE);
	const hueGap = colorHueGap(target.h, guess.h);
	const vivid = (target.s + guess.s) / 2;
	const hueBonus =
		(COLOR_MAX_SCORE - base) * Math.max(0, 1 - (hueGap / HUE_BONUS_GAP) ** HUE_BONUS_CURVE) * Math.min(1, vivid / HUE_BONUS_VIVID) * HUE_BONUS_SHARE;
	const huePenalty = base * Math.max(0, (hueGap - HUE_PENALTY_START) / HUE_PENALTY_RANGE) * Math.min(1, vivid / HUE_PENALTY_VIVID) * HUE_PENALTY_SHARE;
	return clamp(roundTo(base + hueBonus - huePenalty, 2), 0, COLOR_MAX_SCORE);
}

export function colorTotal(scores: number[]): number {
	return roundTo(
		scores.reduce((sum, s) => sum + (Number(s) || 0), 0),
		2
	);
}

export function colorXp(total: unknown): number {
	return Math.round(clamp(Number(total) || 0, 0, COLOR_MAX_TOTAL));
}
