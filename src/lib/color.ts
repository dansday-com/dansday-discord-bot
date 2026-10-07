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
const LAB_WHITE = [0.95047, 1, 1.08883];
const POW25_7 = Math.pow(25, 7);

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function deg(rad: number): number {
	return (rad * 180) / Math.PI;
}

function rad(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

export function colorTarget(): Hsb {
	return {
		h: Math.floor(Math.random() * 360),
		s: 15 + Math.floor(Math.random() * 86),
		b: 15 + Math.floor(Math.random() * 86)
	};
}

export function colorHueGap(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

export function colorOpeningGuess(target: Hsb): Hsb {
	let h = Math.floor(Math.random() * 360);
	for (let tries = 0; tries < 50 && colorHueGap(h, target.h) < COLOR_OPENING_HUE_GAP; tries++) h = Math.floor(Math.random() * 360);
	return { h, s: 30 + Math.floor(Math.random() * 60), b: 40 + Math.floor(Math.random() * 50) };
}

export function colorGuess(raw: any): Hsb | null {
	const [h, s, b] = COLOR_AXES.map((axis) => (raw?.[axis] == null || raw[axis] === '' ? NaN : Number(raw[axis])));
	if (![h, s, b].every(Number.isFinite)) return null;
	return {
		h: ((Math.round(h) % 360) + 360) % 360,
		s: clamp(Math.round(s), 0, COLOR_AXIS_MAX.s),
		b: clamp(Math.round(b), 0, COLOR_AXIS_MAX.b)
	};
}

export function hsbToRgb(c: Hsb): [number, number, number] {
	const s = clamp(c.s, 0, 100) / 100;
	const v = clamp(c.b, 0, 100) / 100;
	const h = (((c.h % 360) + 360) % 360) / 60;
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
	][sector % 6];
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hsbToCss(c: Hsb): string {
	const [r, g, b] = hsbToRgb(c);
	return `rgb(${r} ${g} ${b})`;
}

export function hsbToHex(c: Hsb): number {
	const [r, g, b] = hsbToRgb(c);
	return (r << 16) | (g << 8) | b;
}

export function colorLuma(c: Hsb): number {
	const [r, g, b] = hsbToRgb(c);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function linear(channel: number): number {
	const c = channel / 255;
	return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function labCurve(t: number): number {
	return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function hsbToLab(c: Hsb): [number, number, number] {
	const [r, g, b] = hsbToRgb(c).map(linear);
	const x = labCurve((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / LAB_WHITE[0]);
	const y = labCurve((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / LAB_WHITE[1]);
	const z = labCurve((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / LAB_WHITE[2]);
	return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labHue(b: number, a: number): number {
	if (a === 0 && b === 0) return 0;
	const h = deg(Math.atan2(b, a));
	return h < 0 ? h + 360 : h;
}

export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
	const [l1, a1, b1] = lab1;
	const [l2, a2, b2] = lab2;

	const chromaMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
	const chromaMean7 = Math.pow(chromaMean, 7);
	const stretch = 1 + 0.5 * (1 - Math.sqrt(chromaMean7 / (chromaMean7 + POW25_7)));

	const a1p = a1 * stretch;
	const a2p = a2 * stretch;
	const c1 = Math.hypot(a1p, b1);
	const c2 = Math.hypot(a2p, b2);
	const h1 = labHue(b1, a1p);
	const h2 = labHue(b2, a2p);
	const achromatic = c1 * c2 === 0;

	let hueDelta = 0;
	if (!achromatic) {
		hueDelta = h2 - h1;
		if (hueDelta > 180) hueDelta -= 360;
		else if (hueDelta < -180) hueDelta += 360;
	}

	let hueMean = h1 + h2;
	if (!achromatic) {
		if (Math.abs(h1 - h2) <= 180) hueMean = (h1 + h2) / 2;
		else hueMean = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
	}

	const dL = l2 - l1;
	const dC = c2 - c1;
	const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(hueDelta / 2));

	const lMean = (l1 + l2) / 2;
	const cMean = (c1 + c2) / 2;
	const cMean7 = Math.pow(cMean, 7);

	const t =
		1 - 0.17 * Math.cos(rad(hueMean - 30)) + 0.24 * Math.cos(rad(2 * hueMean)) + 0.32 * Math.cos(rad(3 * hueMean + 6)) - 0.2 * Math.cos(rad(4 * hueMean - 63));
	const sL = 1 + (0.015 * Math.pow(lMean - 50, 2)) / Math.sqrt(20 + Math.pow(lMean - 50, 2));
	const sC = 1 + 0.045 * cMean;
	const sH = 1 + 0.015 * cMean * t;
	const rotation = -Math.sin(rad(60 * Math.exp(-Math.pow((hueMean - 275) / 25, 2)))) * 2 * Math.sqrt(cMean7 / (cMean7 + POW25_7));

	return Math.sqrt(Math.pow(dL / sL, 2) + Math.pow(dC / sC, 2) + Math.pow(dH / sH, 2) + rotation * (dC / sC) * (dH / sH));
}

export function colorScore(target: Hsb, guess: Hsb): number {
	const distance = deltaE2000(hsbToLab(target), hsbToLab(guess));
	const base = COLOR_MAX_SCORE / (1 + Math.pow(distance / SCORE_FALLOFF, SCORE_CURVE));
	const hueGap = colorHueGap(target.h, guess.h);
	const vivid = (target.s + guess.s) / 2;
	const hueBonus = (COLOR_MAX_SCORE - base) * Math.max(0, 1 - Math.pow(hueGap / 25, 1.5)) * Math.min(1, vivid / 30) * 0.25;
	const huePenalty = base * Math.max(0, (hueGap - 30) / 150) * Math.min(1, vivid / 40) * 0.15;
	return clamp(round2(base + hueBonus - huePenalty), 0, COLOR_MAX_SCORE);
}

export function colorTotal(scores: number[]): number {
	return round2(scores.reduce((sum, s) => sum + (Number(s) || 0), 0));
}

export function colorXp(total: any): number {
	return Math.round(clamp(Number(total) || 0, 0, COLOR_MAX_TOTAL));
}
