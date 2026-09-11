import { effectPalette, mulberry32, normalizeEffect, normalizeSeed } from '$lib/effects.js';

export type FxVariant = {
	seed: number;
	hue: number;
	hue2: number;
	sat: number;
	light: number;
	dir: number;
	speed: number;
	density: number;
	drift: number;
	tilt: number;
};

export type FxScene = {
	w: number;
	h: number;
	ctx: CanvasRenderingContext2D;
	img: ImageData;
	px: Uint8ClampedArray;
	buf: Uint8Array;
	parts: Float32Array;
	n: number;
	v: FxVariant;
	rnd: () => number;
	t: number;
};

export type FxProgram = {
	rows: number;
	stride: number;
	init: (s: FxScene) => void;
	frame: (s: FxScene) => void;
};

const HEX = /^#([0-9a-f]{6})$/i;

function hueOf(hex: string): [number, number, number] {
	const m = HEX.exec(hex);
	if (!m) return [24, 90, 55];
	const int = parseInt(m[1], 16);
	const r = ((int >> 16) & 255) / 255;
	const g = ((int >> 8) & 255) / 255;
	const b = (int & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l * 100];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return [h * 360, s * 100, l * 100];
}

export function fxVariant(family: string, seed: unknown, accent: unknown): FxVariant {
	const id = normalizeEffect(family);
	const s = normalizeSeed(seed);
	const rnd = mulberry32(s + id.length * 7919);
	const [a, b] = effectPalette(id, accent);
	const [h1, s1, l1] = hueOf(a);
	const [h2] = hueOf(b);
	const jitter = (rnd() - 0.5) * 22;
	return {
		seed: s,
		hue: h1 + jitter,
		hue2: h2 + jitter,
		sat: Math.max(40, Math.min(100, s1 + (rnd() - 0.5) * 18)),
		light: l1,
		dir: rnd() < 0.5 ? -1 : 1,
		speed: 0.72 + rnd() * 0.72,
		density: 0.7 + rnd() * 0.6,
		drift: 0.35 + rnd() * 1.1,
		tilt: (rnd() - 0.5) * 0.9
	};
}

export function createScene(canvas: HTMLCanvasElement, program: FxProgram, v: FxVariant, aspect: number): FxScene {
	const h = program.rows;
	const w = Math.max(24, Math.min(420, Math.round(h * aspect)));
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { alpha: true })!;
	const img = ctx.createImageData(w, h);
	const scene: FxScene = {
		w,
		h,
		ctx,
		img,
		px: img.data,
		buf: new Uint8Array(w * h),
		parts: new Float32Array(Math.ceil(w * program.stride) * 6),
		n: Math.max(8, Math.round(w * program.stride * v.density)),
		v,
		rnd: mulberry32(v.seed + 90001),
		t: 0
	};
	program.init(scene);
	return scene;
}

export function runScene(canvas: HTMLCanvasElement, program: FxProgram, scene: FxScene, fps: number) {
	let raf = 0;
	let last = 0;
	const interval = 1000 / fps;
	const tick = (now: number) => {
		raf = requestAnimationFrame(tick);
		if (now - last < interval) return;
		last = now;
		scene.t += 1;
		program.frame(scene);
	};
	raf = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(raf);
}

export function clear(s: FxScene) {
	s.px.fill(0);
}

export function blit(s: FxScene) {
	s.ctx.putImageData(s.img, 0, 0);
}

export function plot(s: FxScene, x: number, y: number, r: number, g: number, b: number, a: number) {
	if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
	const i = ((y | 0) * s.w + (x | 0)) * 4;
	const px = s.px;
	const na = a * 255;
	px[i] = Math.min(255, px[i] + r * a);
	px[i + 1] = Math.min(255, px[i + 1] + g * a);
	px[i + 2] = Math.min(255, px[i + 2] + b * a);
	px[i + 3] = Math.min(255, px[i + 3] + na);
}

export function hsl(h: number, s: number, l: number): [number, number, number] {
	const hh = (((h % 360) + 360) % 360) / 360;
	const ss = Math.max(0, Math.min(1, s / 100));
	const ll = Math.max(0, Math.min(1, l / 100));
	if (ss === 0) {
		const g = ll * 255;
		return [g, g, g];
	}
	const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
	const p = 2 * ll - q;
	const f = (t: number) => {
		let x = t;
		if (x < 0) x += 1;
		if (x > 1) x -= 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}
