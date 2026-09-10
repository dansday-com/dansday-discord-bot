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
	'blizzard'
] as const;

export type EffectFamily = (typeof EFFECT_FAMILIES)[number];

export type EffectMeta = { id: EffectFamily; label: string; icon: string; particles: boolean };

export const EFFECTS: EffectMeta[] = [
	{ id: 'glitch', label: 'Glitch', icon: 'fa-bolt', particles: false },
	{ id: 'sparkle', label: 'Sparkle', icon: 'fa-wand-magic-sparkles', particles: true },
	{ id: 'snow', label: 'Snow', icon: 'fa-snowflake', particles: true },
	{ id: 'rain', label: 'Rain', icon: 'fa-cloud-rain', particles: true },
	{ id: 'ember', label: 'Embers', icon: 'fa-fire', particles: true },
	{ id: 'confetti', label: 'Confetti', icon: 'fa-star', particles: true },
	{ id: 'bubbles', label: 'Bubbles', icon: 'fa-circle', particles: true },
	{ id: 'scanlines', label: 'Scanlines', icon: 'fa-display', particles: false },
	{ id: 'grain', label: 'Grain', icon: 'fa-film', particles: false },
	{ id: 'holo', label: 'Holo', icon: 'fa-rainbow', particles: false },
	{ id: 'aurora', label: 'Aurora', icon: 'fa-mountain-sun', particles: false },
	{ id: 'pulse', label: 'Pulse', icon: 'fa-heart-pulse', particles: false },
	{ id: 'earthquake', label: 'Earthquake', icon: 'fa-house-crack', particles: true },
	{ id: 'thunder', label: 'Thunder', icon: 'fa-bolt-lightning', particles: false },
	{ id: 'tsunami', label: 'Tsunami', icon: 'fa-water', particles: false },
	{ id: 'tornado', label: 'Tornado', icon: 'fa-tornado', particles: false },
	{ id: 'meteor', label: 'Meteor', icon: 'fa-meteor', particles: false },
	{ id: 'blizzard', label: 'Blizzard', icon: 'fa-wind', particles: true }
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

type Tuning = { tile: [number, number]; dot: [number, number]; speed: [number, number]; opacity: [number, number]; drift?: [number, number] };

const TUNING: Record<string, Tuning> = {
	sparkle: { tile: [26, 64], dot: [0.6, 1.6], speed: [3, 8], opacity: [0.35, 0.75] },
	snow: { tile: [34, 78], dot: [1.1, 2.6], speed: [9, 22], opacity: [0.35, 0.7] },
	rain: { tile: [14, 34], dot: [0.7, 1.4], speed: [1.1, 2.6], opacity: [0.3, 0.6] },
	ember: { tile: [30, 70], dot: [0.9, 2.2], speed: [5, 13], opacity: [0.4, 0.8] },
	confetti: { tile: [30, 66], dot: [1.4, 3.2], speed: [6, 15], opacity: [0.4, 0.8] },
	bubbles: { tile: [40, 96], dot: [2, 5], speed: [10, 26], opacity: [0.22, 0.5] },
	scanlines: { tile: [3, 8], dot: [0.5, 1], speed: [4, 12], opacity: [0.16, 0.4] },
	grain: { tile: [60, 140], dot: [0.5, 1], speed: [0.4, 1.2], opacity: [0.18, 0.42] },
	holo: { tile: [120, 320], dot: [0.5, 1], speed: [5, 14], opacity: [0.25, 0.6] },
	aurora: { tile: [160, 420], dot: [0.5, 1], speed: [14, 34], opacity: [0.3, 0.62] },
	pulse: { tile: [1, 1], dot: [0.5, 1], speed: [2.4, 6], opacity: [0.35, 0.8] },
	glitch: { tile: [1, 1], dot: [0.5, 1], speed: [2.2, 5.5], opacity: [0.5, 0.95] },
	earthquake: { tile: [40, 90], dot: [0.8, 1.9], speed: [2.6, 5.4], opacity: [0.3, 0.6], drift: [-6, 6] },
	thunder: { tile: [1, 1], dot: [0.5, 1], speed: [4.5, 11], opacity: [0.4, 0.85] },
	tsunami: { tile: [1, 1], dot: [0.5, 1], speed: [6, 14], opacity: [0.3, 0.62] },
	tornado: { tile: [1, 1], dot: [0.5, 1], speed: [3.5, 9], opacity: [0.28, 0.58] },
	meteor: { tile: [40, 96], dot: [0.9, 2], speed: [1.6, 4], opacity: [0.4, 0.8], drift: [-260, -110] },
	blizzard: { tile: [22, 52], dot: [0.9, 2.1], speed: [2.4, 5.5], opacity: [0.4, 0.75], drift: [90, 220] }
};

export type EffectVariant = { family: EffectFamily; seed: number; style: string };

export function effectVariant(family: any, seed: any, accent: any): EffectVariant {
	const id = normalizeEffect(family);
	const s = normalizeSeed(seed);
	if (id === 'none') return { family: 'none', seed: s, style: '' };

	const rand = mulberry32(s + id.length * 7919);
	const pick = (range: [number, number]) => range[0] + rand() * (range[1] - range[0]);

	const tuning = TUNING[id] ?? TUNING.sparkle;
	const [h, sat, light] = hexToHsl(parseHex(accent));

	const hueShift = Math.round((rand() - 0.5) * 70);
	const hueSpread = Math.round((rand() - 0.5) * 120);
	const tile = pick(tuning.tile);
	const dot = pick(tuning.dot);
	const speed = pick(tuning.speed);
	const opacity = pick(tuning.opacity);
	const driftRange = tuning.drift ?? ([-20, 20] as [number, number]);
	const drift = Math.round(driftRange[0] + rand() * (driftRange[1] - driftRange[0]));
	const angle = Math.round(6 + rand() * 26);
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
		'--fx-color': hsla(h + hueShift, sat + 18, light + 26, 1),
		'--fx-color-2': hsla(h + hueShift + hueSpread, sat + 10, light + 38, 1)
	};

	return {
		family: id,
		seed: s,
		style: Object.entries(vars)
			.map(([key, value]) => `${key}: ${value}`)
			.join('; ')
	};
}
