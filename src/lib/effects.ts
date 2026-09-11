import { BRAND_PRIMARY } from './brand.js';

export const EFFECT_FAMILIES = [
	'none',
	'glitch',
	'sparkle',
	'snow',
	'rain',
	'ember',
	'confetti',
	'bubbles',
	'scanlines',
	'grain',
	'holo',
	'aurora',
	'pulse',
	'earthquake',
	'thunder',
	'tsunami',
	'tornado',
	'meteor',
	'blizzard',
	'rainbow',
	'fire',
	'love',
	'glass',
	'bullethole',
	'volcano',
	'sandstorm',
	'void',
	'eclipse',
	'fallingstar',
	'milkyway',
	'blackhole',
	'autumn',
	'sakura',
	'fireflies',
	'silk',
	'crystal',
	'neon'
] as const;

export type EffectFamily = (typeof EFFECT_FAMILIES)[number];

export type EffectMeta = { id: EffectFamily; label: string; icon: string; particles: boolean };

export const EFFECTS: EffectMeta[] = [
	{ id: 'glitch', label: 'Glitch', icon: 'fa-tower-broadcast', particles: false },
	{ id: 'sparkle', label: 'Sparkle', icon: 'fa-wand-magic-sparkles', particles: false },
	{ id: 'snow', label: 'Snow', icon: 'fa-snowflake', particles: false },
	{ id: 'rain', label: 'Rain', icon: 'fa-cloud-rain', particles: false },
	{ id: 'ember', label: 'Embers', icon: 'fa-burst', particles: false },
	{ id: 'confetti', label: 'Confetti', icon: 'fa-gift', particles: false },
	{ id: 'bubbles', label: 'Bubbles', icon: 'fa-soap', particles: false },
	{ id: 'scanlines', label: 'Scanlines', icon: 'fa-display', particles: false },
	{ id: 'grain', label: 'Grain', icon: 'fa-film', particles: false },
	{ id: 'holo', label: 'Holo', icon: 'fa-certificate', particles: false },
	{ id: 'aurora', label: 'Aurora', icon: 'fa-mountain-sun', particles: false },
	{ id: 'pulse', label: 'Pulse', icon: 'fa-wave-square', particles: false },
	{ id: 'earthquake', label: 'Earthquake', icon: 'fa-house-crack', particles: false },
	{ id: 'thunder', label: 'Thunder', icon: 'fa-bolt-lightning', particles: false },
	{ id: 'tsunami', label: 'Tsunami', icon: 'fa-water', particles: false },
	{ id: 'tornado', label: 'Tornado', icon: 'fa-tornado', particles: false },
	{ id: 'meteor', label: 'Meteor', icon: 'fa-meteor', particles: false },
	{ id: 'blizzard', label: 'Blizzard', icon: 'fa-wind', particles: false },
	{ id: 'rainbow', label: 'Rainbow', icon: 'fa-rainbow', particles: false },
	{ id: 'fire', label: 'Fire', icon: 'fa-fire-flame-curved', particles: false },
	{ id: 'love', label: 'Love', icon: 'fa-heart', particles: false },
	{ id: 'glass', label: 'Glass', icon: 'fa-gem', particles: false },
	{ id: 'bullethole', label: 'Bullet Hole', icon: 'fa-crosshairs', particles: false },
	{ id: 'volcano', label: 'Volcano', icon: 'fa-volcano', particles: false },
	{ id: 'sandstorm', label: 'Sandstorm', icon: 'fa-smog', particles: false },
	{ id: 'void', label: 'Void', icon: 'fa-compact-disc', particles: false },
	{ id: 'eclipse', label: 'Eclipse', icon: 'fa-circle-half-stroke', particles: false },
	{ id: 'fallingstar', label: 'Falling Star', icon: 'fa-star-half-stroke', particles: false },
	{ id: 'milkyway', label: 'Milky Way', icon: 'fa-spiral', particles: false },
	{ id: 'blackhole', label: 'Black Hole', icon: 'fa-record-vinyl', particles: false },
	{ id: 'autumn', label: 'Autumn', icon: 'fa-leaf', particles: false },
	{ id: 'sakura', label: 'Sakura', icon: 'fa-spa', particles: false },
	{ id: 'fireflies', label: 'Fireflies', icon: 'fa-hand-sparkles', particles: false },
	{ id: 'silk', label: 'Silk', icon: 'fa-ribbon', particles: false },
	{ id: 'crystal', label: 'Crystal', icon: 'fa-diamond', particles: false },
	{ id: 'neon', label: 'Neon', icon: 'fa-signature', particles: false }
];

const BY_ID = new Map(EFFECTS.map((e) => [e.id, e]));

export function normalizeEffect(id: any): EffectFamily {
	const value = String(id ?? '').toLowerCase();
	return (EFFECT_FAMILIES as readonly string[]).includes(value) ? (value as EffectFamily) : 'none';
}

export function effectMeta(id: any): EffectMeta | undefined {
	return BY_ID.get(normalizeEffect(id));
}

export const EFFECT_SPIN_COST = 1000;
export const EFFECT_SPIN_GAME = 'effect_spin';

export const SPINNABLE_EFFECTS = EFFECT_FAMILIES.filter((id) => id !== 'none');

export const SEED_RANGE = 100000;

export function normalizeSeed(seed: any): number {
	const value = Math.trunc(Number(seed));
	if (!Number.isFinite(value)) return 0;
	return ((value % SEED_RANGE) + SEED_RANGE) % SEED_RANGE;
}

export function randomSeed(): number {
	return Math.floor(Math.random() * SEED_RANGE);
}

export function rollEffect(): { effect: EffectFamily; seed: number } {
	const effect = SPINNABLE_EFFECTS[Math.floor(Math.random() * SPINNABLE_EFFECTS.length)];
	return { effect, seed: randomSeed() };
}

function parseHex(value: any): string {
	const raw = String(value ?? '').trim();
	const withHash = raw.startsWith('#') ? raw : `#${raw}`;
	return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toLowerCase() : BRAND_PRIMARY;
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hexToHsl(hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l * 100];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return [h * 360, s * 100, l * 100];
}

function hsla(h: number, s: number, l: number, a: number): string {
	const hue = Math.round(((h % 360) + 360) % 360);
	const sat = Math.round(Math.max(0, Math.min(100, s)));
	const lig = Math.round(Math.max(0, Math.min(100, l)));
	return `hsla(${hue}, ${sat}%, ${lig}%, ${a})`;
}

type Tuning = {
	tile: [number, number];
	dot: [number, number];
	speed: [number, number];
	opacity: [number, number];
	drift?: [number, number];
};

const TUNING: Record<string, Tuning> = {
	sparkle: { tile: [13, 28], dot: [1.3, 2.8], speed: [2.2, 5], opacity: [0.75, 1] },
	snow: { tile: [17, 38], dot: [1.9, 3.8], speed: [7, 15], opacity: [0.7, 1] },
	rain: { tile: [7, 16], dot: [0.9, 1.8], speed: [0.8, 1.8], opacity: [0.6, 0.9] },
	ember: { tile: [15, 34], dot: [1.5, 3.2], speed: [3.5, 9], opacity: [0.8, 1] },
	confetti: { tile: [17, 36], dot: [2.2, 4.4], speed: [4, 10], opacity: [0.8, 1] },
	bubbles: { tile: [24, 56], dot: [2.6, 6], speed: [7, 18], opacity: [0.5, 0.8] },
	scanlines: { tile: [3, 6], dot: [0.5, 1], speed: [3, 8], opacity: [0.32, 0.6] },
	grain: { tile: [60, 140], dot: [0.5, 1], speed: [0.3, 0.9], opacity: [0.35, 0.6] },
	holo: { tile: [120, 320], dot: [0.5, 1], speed: [3.5, 9], opacity: [0.55, 0.9] },
	aurora: { tile: [160, 420], dot: [0.5, 1], speed: [10, 24], opacity: [0.6, 0.95] },
	pulse: { tile: [1, 1], dot: [0.5, 1], speed: [1.8, 4.2], opacity: [0.65, 1] },
	glitch: { tile: [1, 1], dot: [0.5, 1], speed: [1.8, 4.2], opacity: [0.8, 1] },
	earthquake: { tile: [20, 46], dot: [1.3, 2.8], speed: [1.8, 4], opacity: [0.55, 0.85], drift: [-9, 9] },
	thunder: { tile: [1, 1], dot: [0.5, 1], speed: [3, 7.5], opacity: [0.75, 1] },
	tsunami: { tile: [1, 1], dot: [0.5, 1], speed: [4, 10], opacity: [0.6, 0.9] },
	tornado: { tile: [1, 1], dot: [0.5, 1], speed: [2.4, 6], opacity: [0.55, 0.88] },
	meteor: { tile: [24, 56], dot: [1.1, 2.4], speed: [1.1, 2.8], opacity: [0.85, 1], drift: [-300, -150] },
	rainbow: { tile: [1, 1], dot: [0.5, 1], speed: [4, 10], opacity: [0.6, 0.95] },
	fire: { tile: [1, 1], dot: [0.5, 1], speed: [1.1, 2.4], opacity: [0.8, 1] },
	blizzard: { tile: [11, 26], dot: [1.5, 3.2], speed: [1.6, 3.8], opacity: [0.75, 1], drift: [120, 260] },
	love: { tile: [18, 40], dot: [2.4, 5.2], speed: [5, 11], opacity: [0.7, 1], drift: [-40, 40] },
	glass: { tile: [1, 1], dot: [0.5, 1], speed: [4.5, 9], opacity: [0.6, 0.95] },
	bullethole: { tile: [1, 1], dot: [0.5, 1], speed: [2.6, 5.4], opacity: [0.7, 1] },
	volcano: { tile: [14, 32], dot: [1.6, 3.4], speed: [2.8, 6], opacity: [0.8, 1], drift: [-70, 70] },
	sandstorm: { tile: [9, 21], dot: [1.1, 2.4], speed: [0.9, 2.1], opacity: [0.5, 0.85], drift: [220, 420] },
	void: { tile: [20, 46], dot: [1.2, 2.8], speed: [3.2, 7], opacity: [0.65, 1] },
	eclipse: { tile: [26, 60], dot: [0.9, 2], speed: [6, 13], opacity: [0.55, 0.95] },
	fallingstar: { tile: [30, 70], dot: [1.2, 2.6], speed: [2.4, 5.5], opacity: [0.8, 1], drift: [-220, -120] },
	milkyway: { tile: [22, 52], dot: [0.7, 1.8], speed: [7, 16], opacity: [0.5, 0.95] },
	blackhole: { tile: [24, 54], dot: [1, 2.2], speed: [3.6, 8], opacity: [0.7, 1] },
	autumn: { tile: [16, 36], dot: [2.2, 4.8], speed: [6, 13], opacity: [0.75, 1], drift: [-90, 90] },
	sakura: { tile: [15, 34], dot: [2, 4.4], speed: [7, 15], opacity: [0.7, 1], drift: [-70, 70] },
	fireflies: { tile: [22, 50], dot: [1.4, 3], speed: [4, 9], opacity: [0.6, 1], drift: [-50, 50] },
	silk: { tile: [1, 1], dot: [0.5, 1], speed: [5, 11], opacity: [0.65, 1] },
	crystal: { tile: [19, 44], dot: [1.2, 2.8], speed: [3.4, 7.5], opacity: [0.7, 1] },
	neon: { tile: [1, 1], dot: [0.5, 1], speed: [2.2, 5], opacity: [0.75, 1] }
};

export const PARTICLE_COUNTS: Record<string, number> = {
	meteor: 19,
	fire: 25,
	confetti: 32,
	rain: 110,
	snow: 48,
	blizzard: 57,
	earthquake: 28,
	sparkle: 35,
	ember: 39,
	bubbles: 28,
	aurora: 9,
	pulse: 3,
	rainbow: 0,
	love: 33,
	glass: 0,
	bullethole: 0,
	volcano: 39,
	sandstorm: 60,
	void: 40,
	eclipse: 35,
	fallingstar: 15,
	milkyway: 74,
	blackhole: 48,
	autumn: 39,
	sakura: 44,
	fireflies: 39,
	silk: 0,
	crystal: 33,
	neon: 0
};

const PALETTE: Record<string, [string, string]> = {
	snow: ['#ffffff', '#dcefff'],
	blizzard: ['#ffffff', '#c2e6ff'],
	rain: ['#d6ecff', '#8ec6f2'],
	tsunami: ['#1f7fc4', '#7fe6ff'],
	fire: ['#ff6a1a', '#ffd166'],
	ember: ['#ff7a18', '#ffb347'],
	thunder: ['#fdfbff', '#b9a7ff'],
	meteor: ['#fff3d0', '#ff9a4d'],
	tornado: ['#9aa5b1', '#5b6773'],
	earthquake: ['#8a7358', '#5c4a38'],
	aurora: ['#4ade80', '#38bdf8'],
	rainbow: ['#ff5f6d', '#38bdf8'],
	sparkle: ['#fff6c9', '#ffd76a'],
	confetti: ['#ff5f6d', '#4ade80'],
	bubbles: ['#c8f2ff', '#ffffff'],
	scanlines: ['#7dffb0', '#2ad17a'],
	grain: ['#d4d4d4', '#8f8f8f'],
	holo: ['#ff8ad4', '#8ad4ff'],
	glitch: ['#00fff0', '#ff00a8'],
	love: ['#ff5c8a', '#ffd1dc'],
	glass: ['#cfe9ff', '#8fb6d6'],
	bullethole: ['#cfc7b6', '#4a423a'],
	volcano: ['#ff5a1f', '#ffc247'],
	sandstorm: ['#d9a441', '#f3d9a4'],
	void: ['#a855f7', '#22d3ee'],
	eclipse: ['#ffd88a', '#3b3358'],
	fallingstar: ['#fff6d5', '#8ec6ff'],
	milkyway: ['#b6a4ff', '#7fd8ff'],
	blackhole: ['#ffb347', '#7dd3fc'],
	autumn: ['#d2691e', '#f4a442'],
	sakura: ['#ffb7d5', '#fff0f6'],
	fireflies: ['#ffd97a', '#8fd6a0'],
	silk: ['#b8438f', '#ffd6ec'],
	crystal: ['#a78bfa', '#e9d5ff'],
	neon: ['#ff2d95', '#22d3ee']
};

export function effectPalette(family: any, accent: any): [string, string] {
	const id = normalizeEffect(family);
	const pair = PALETTE[id];
	if (pair) return pair;
	const hex = parseHex(accent);
	return [hex, hex];
}

export type EffectVariant = { family: EffectFamily; seed: number; style: string; particles: string[] };

function buildParticles(family: EffectFamily, rand: () => number, c1: [number, number, number], c2: [number, number, number]): string[] {
	const [hue, sat, light] = c1;
	const [hue2, sat2, light2] = c2;
	const count = PARTICLE_COUNTS[family] ?? 0;
	if (count === 0) return [];
	const out: string[] = [];

	for (let i = 0; i < count; i++) {
		const x = (i / count) * 100 + (rand() - 0.5) * (80 / count);
		const delay = -(rand() * 6).toFixed(2);
		const scale = (0.55 + rand() * 0.95).toFixed(2);

		if (family === 'meteor') {
			const dur = (0.9 + rand() * 1.9).toFixed(2);
			const len = Math.round(60 + rand() * 130);
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${dur}s`,
					`--p-len: ${len}px`,
					`--p-thick: ${(1 + rand() * 1.8).toFixed(2)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'fire') {
			const dur = (0.7 + rand() * 1.1).toFixed(2);
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${dur}s`,
					`--p-w: ${Math.round(10 + rand() * 26)}px`,
					`--p-h: ${Math.round(26 + rand() * 62)}px`,
					`--p-scale: ${scale}`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'earthquake') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 88).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(0.9 + rand() * 1.6).toFixed(2)}s`,
					`--p-w: ${Math.round(3 + rand() * 7)}px`,
					`--p-spin: ${Math.round((rand() - 0.5) * 360)}deg`,
					`--p-drift: ${Math.round((rand() - 0.5) * 40)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 0.9)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'snow' || family === 'blizzard') {
			const dur = family === 'blizzard' ? (1.4 + rand() * 2.2).toFixed(2) : (5 + rand() * 8).toFixed(2);
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${dur}s`,
					`--p-w: ${Math.round(5 + rand() * 12)}px`,
					`--p-spin: ${Math.round(180 + rand() * 540)}deg`,
					`--p-drift: ${family === 'blizzard' ? Math.round(150 + rand() * 190) : Math.round((rand() - 0.5) * 90)}px`,
					`--p-soft: ${Math.round(58 + rand() * 28)}%`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 0.95)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'sparkle') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 100).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(1.1 + rand() * 2.4).toFixed(2)}s`,
					`--p-w: ${Math.round(7 + rand() * 18)}px`,
					`--p-spin: ${Math.round(rand() * 90)}deg`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'ember') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(2.2 + rand() * 3.6).toFixed(2)}s`,
					`--p-w: ${(2 + rand() * 4.5).toFixed(1)}px`,
					`--p-drift: ${Math.round((rand() - 0.5) * 120)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'bubbles') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(4 + rand() * 6).toFixed(2)}s`,
					`--p-w: ${Math.round(7 + rand() * 26)}px`,
					`--p-drift: ${Math.round((rand() - 0.5) * 70)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 0.85)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'aurora') {
			out.push(
				[
					`--p-x: ${(i * 22 - 8).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(6 + rand() * 7).toFixed(2)}s`,
					`--p-w: ${Math.round(60 + rand() * 130)}px`,
					`--p-skew: ${Math.round((rand() - 0.5) * 30)}deg`,
					`--p-hue: ${hsla(hue + i * 34, sat, light, 0.9)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'pulse') {
			out.push(
				[
					`--p-delay: ${(-i * 1.1).toFixed(2)}s`,
					`--p-dur: ${(2.4 + rand() * 1.6).toFixed(2)}s`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'rain') {
			const dur = (1.1 + rand() * 1.9).toFixed(2);
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 70).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${dur}s`,
					`--p-w: ${(2.6 + rand() * 3.4).toFixed(1)}px`,
					`--p-trail: ${Math.round(22 + rand() * 62)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 8, sat, light, 0.9)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'love') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(4.5 + rand() * 5).toFixed(2)}s`,
					`--p-w: ${Math.round(7 + rand() * 14)}px`,
					`--p-rock: ${Math.round(18 + rand() * 34)}deg`,
					`--p-drift: ${Math.round((rand() - 0.5) * 110)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 22, sat, light + (rand() - 0.5) * 16, 0.95)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'volcano') {
			out.push(
				[
					`--p-x: ${(38 + rand() * 24).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(1.6 + rand() * 2.4).toFixed(2)}s`,
					`--p-w: ${(2 + rand() * 5).toFixed(1)}px`,
					`--p-arc: ${Math.round((rand() - 0.5) * 300)}px`,
					`--p-lift: ${(0.4 + rand() * 0.55).toFixed(2)}`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 18, sat, light + rand() * 14, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'sandstorm') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 96).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(0.7 + rand() * 1.3).toFixed(2)}s`,
					`--p-w: ${(1.4 + rand() * 3.4).toFixed(1)}px`,
					`--p-trail: ${Math.round(10 + rand() * 46)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 14, sat, light + (rand() - 0.5) * 18, 0.8)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'void') {
			out.push(
				[
					`--p-orbit: ${Math.round(18 + rand() * 62)}px`,
					`--p-angle: ${Math.round(rand() * 360)}deg`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(2.4 + rand() * 3.6).toFixed(2)}s`,
					`--p-w: ${(1.4 + rand() * 3).toFixed(1)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 40, sat, light + rand() * 10, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'milkyway') {
			const band = 88 - 0.766 * x;
			const y = rand() < 0.72 ? band + (rand() - 0.5) * 46 : rand() * 100;
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${Math.max(1, Math.min(97, y)).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(2 + rand() * 4.5).toFixed(2)}s`,
					`--p-w: ${(0.9 + rand() * 2.4).toFixed(2)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 46, sat, light + rand() * 12, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'eclipse') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 100).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(2 + rand() * 4.5).toFixed(2)}s`,
					`--p-w: ${(0.9 + rand() * 2.4).toFixed(2)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 46, sat, light + rand() * 12, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'sakura') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(6 + rand() * 8).toFixed(2)}s`,
					`--p-w: ${Math.round(5 + rand() * 9)}px`,
					`--p-glide: ${Math.round(30 + rand() * 90)}px`,
					`--p-spin: ${Math.round(120 + rand() * 300)}deg`,
					`--p-drift: ${Math.round((rand() - 0.5) * 130)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 18, sat - rand() * 10, light + (rand() - 0.5) * 12, 0.95)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'fireflies') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(18 + rand() * 74).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(4 + rand() * 6).toFixed(2)}s`,
					`--p-w: ${(2 + rand() * 3.2).toFixed(1)}px`,
					`--p-wander: ${Math.round(18 + rand() * 54)}px`,
					`--p-rise: ${Math.round(14 + rand() * 46)}px`,
					`--p-blink: ${(0.4 + rand() * 0.9).toFixed(2)}s`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 26, sat, light + rand() * 12, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'crystal') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-y: ${(rand() * 96).toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(2.6 + rand() * 4).toFixed(2)}s`,
					`--p-w: ${(1.6 + rand() * 3.4).toFixed(1)}px`,
					`--p-lift: ${Math.round(10 + rand() * 40)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 40, sat, light + rand() * 16, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'autumn') {
			out.push(
				[
					`--p-x: ${x.toFixed(1)}%`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(5 + rand() * 7).toFixed(2)}s`,
					`--p-w: ${Math.round(8 + rand() * 16)}px`,
					`--p-spin: ${Math.round(420 + rand() * 900)}deg`,
					`--p-flip: ${Math.round(180 + rand() * 720)}deg`,
					`--p-drift: ${Math.round((rand() - 0.5) * 170)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 34, sat - rand() * 14, light + (rand() - 0.5) * 20, 0.96)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'blackhole') {
			out.push(
				[
					`--p-ring: ${Math.round(26 + rand() * 54)}px`,
					`--p-angle: ${Math.round(rand() * 360)}deg`,
					`--p-arc: ${Math.round(14 + rand() * 40)}px`,
					`--p-delay: ${delay}s`,
					`--p-dur: ${(3.4 + rand() * 5).toFixed(2)}s`,
					`--p-thick: ${(0.9 + rand() * 1.6).toFixed(2)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 54, sat, light + rand() * 14, 1)}`
				].join('; ')
			);
			continue;
		}

		if (family === 'fallingstar') {
			out.push(
				[
					`--p-x: ${(12 + rand() * 78).toFixed(1)}%`,
					`--p-y: ${(rand() * 34).toFixed(1)}%`,
					`--p-delay: ${(-rand() * 14).toFixed(2)}s`,
					`--p-dur: ${(1.1 + rand() * 1.5).toFixed(2)}s`,
					`--p-len: ${Math.round(70 + rand() * 150)}px`,
					`--p-thick: ${(1.1 + rand() * 1.5).toFixed(2)}px`,
					`--p-hue: ${hsla(hue + (rand() - 0.5) * 26, sat, light, 1)}`
				].join('; ')
			);
			continue;
		}

		const dur = (2.5 + rand() * 4).toFixed(2);
		out.push(
			[
				`--p-x: ${x.toFixed(1)}%`,
				`--p-delay: ${delay}s`,
				`--p-dur: ${dur}s`,
				`--p-w: ${Math.round(4 + rand() * 8)}px`,
				`--p-spin: ${Math.round(180 + rand() * 720)}deg`,
				`--p-hue: ${hsla(rand() * 360, 85, 62, 1)}`
			].join('; ')
		);
	}
	return out;
}

export function spreadPieces(seed: any, count: number, jitter = 0.34, scaleMin = 0.82, scaleMax = 1.18) {
	const n = Math.max(1, Math.round(count));
	const rand = mulberry32(normalizeSeed(seed) + n * 104729 + 7);
	const step = 100 / n;
	const out: { left: number; scale: number; delay: number; flip: boolean }[] = [];
	for (let i = 0; i < n; i++) {
		out.push({
			left: Number((i * step + (rand() - 0.5) * step * jitter).toFixed(2)),
			scale: Number((scaleMin + rand() * (scaleMax - scaleMin)).toFixed(3)),
			delay: Number((rand() * 5).toFixed(2)),
			flip: rand() > 0.5
		});
	}
	return out;
}

export function effectVariant(family: any, seed: any, accent: any): EffectVariant {
	const id = normalizeEffect(family);
	const s = normalizeSeed(seed);
	if (id === 'none') return { family: 'none', seed: s, style: '', particles: [] };

	const rand = mulberry32(s + id.length * 7919);
	const pick = (range: [number, number]) => range[0] + rand() * (range[1] - range[0]);

	const tuning = TUNING[id] ?? TUNING.sparkle;
	const accentHex = parseHex(accent);
	const pair = PALETTE[id];
	const c1 = hexToHsl(pair ? pair[0] : accentHex);
	const c2 = hexToHsl(pair ? pair[1] : accentHex);

	const jitter = Math.round((rand() - 0.5) * 10);
	const tile = pick(tuning.tile);
	const dot = pick(tuning.dot);
	const speed = pick(tuning.speed);
	const opacity = pick(tuning.opacity);
	const driftRange = tuning.drift ?? ([-20, 20] as [number, number]);
	const drift = Math.round(driftRange[0] + rand() * (driftRange[1] - driftRange[0]));
	const angle = Math.round(6 + rand() * 26);
	const windRatio = 1.1 + rand() * 1.3;
	const windRot = ((Math.atan2(1, windRatio) * 180) / Math.PI).toFixed(1);
	const delay = (rand() * speed).toFixed(2);
	const layerScale = 1.3 + rand() * 1.5;

	const vars: Record<string, string> = {
		'--fx-tile': `${tile.toFixed(1)}px`,
		'--fx-tile-2': `${(tile * layerScale).toFixed(1)}px`,
		'--fx-dot': `${dot.toFixed(2)}px`,
		'--fx-dot-2': `${(dot * 1.9).toFixed(2)}px`,
		'--fx-speed': `${speed.toFixed(2)}s`,
		'--fx-speed-2': `${(speed * 1.55).toFixed(2)}s`,
		'--fx-delay': `-${delay}s`,
		'--fx-opacity': opacity.toFixed(2),
		'--fx-drift': `${drift}px`,
		'--fx-angle': `${angle}deg`,
		'--fx-wind': `${windRatio.toFixed(2)}`,
		'--fx-wind-rot': `${windRot}deg`,
		'--fx-sway': `${Math.round(8 + rand() * 26)}px`,
		'--fx-color': hsla(c1[0] + jitter, c1[1], c1[2], 1),
		'--fx-color-2': hsla(c2[0] + jitter, c2[1], c2[2], 1)
	};

	return {
		family: id,
		seed: s,
		style: Object.entries(vars)
			.map(([key, value]) => `${key}: ${value}`)
			.join('; '),
		particles: buildParticles(id, rand, [c1[0] + jitter, c1[1], c1[2]], [c2[0] + jitter, c2[1], c2[2]])
	};
}
