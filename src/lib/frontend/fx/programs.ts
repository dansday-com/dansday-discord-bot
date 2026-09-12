import { blit, clear, hsl, plot, type FxProgram, type FxScene } from './engine.js';
import {
	makeArc,
	makeBands,
	makeBolt,
	makeConfetti,
	makeEcg,
	makeEclipse,
	makeFacets,
	makeNoise,
	makeSprite,
	makeStreak,
	makeVortex,
	withSky
} from './extra.js';
import { makeFoil, makeMaw, makeQuake, makeTear, makeWeave, withBough, withBursts, withCanopy, withGalaxyBand, withGlow, withWater } from './patterns.js';
import { BLOSSOM, BUBBLE, FLAKE, HEART, LEAF, SHARD, STAR } from './sprites.js';
import { makeBreaker, makeHoles, makeSign, makeWishNight, withCone, withFunnel, withGround, withHorizon, withImpacts } from './structure.js';

const P = 6;

function seedParticles(s: FxScene, spawn: (s: FxScene, i: number) => void) {
	for (let i = 0; i < s.n; i++) spawn(s, i);
}

function fieldPalette(s: FxScene, steps: number) {
	const pal: [number, number, number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const h = s.v.hue + (s.v.hue2 - s.v.hue) * t;
		pal.push([...hsl(h, s.v.sat - t * 46, 6 + t * 88), Math.min(1, t * 3.2)] as [number, number, number, number]);
	}
	return pal;
}

/** Heat propagates upward with random decay — the 1993 Doom fire. */
function makeFire(rows: number, decay: number, feed: number): FxProgram {
	const step = (s: FxScene) => {
		const { w, h, buf } = s;
		const fuel = feed * (0.82 + s.v.speed * 0.18);
		const lean = s.v.dir > 0 ? 1 : 2;
		for (let x = 0; x < w; x++) buf[(h - 1) * w + x] = s.rnd() < fuel ? 36 : 28 + ((s.v.drift * 6) | 0);
		for (let x = 0; x < w; x++) {
			for (let y = 1; y < h; y++) {
				const src = y * w + x;
				const v = buf[src];
				if (v === 0) {
					buf[src - w] = 0;
					continue;
				}
				const r = (s.rnd() * 4) | 0;
				const dst = src - w - r + lean + (s.v.tilt > 0.25 ? 1 : 0);
				if (dst >= 0 && dst < w * h) buf[dst] = Math.max(0, v - (r < decay ? 1 : 0));
			}
		}
	};
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).pal = fieldPalette(s, 36);
			const { w, h, buf } = s;
			for (let y = 0; y < h; y++) {
				const heat = 36 * (y / (h - 1));
				for (let x = 0; x < w; x++) buf[y * w + x] = Math.max(0, Math.min(36, Math.round(heat * (0.45 + s.rnd() * 0.9))));
			}
			for (let i = 0; i < 14; i++) step(s);
		},
		frame(s) {
			const { w, h, buf } = s;
			const pal = (s as any).pal as [number, number, number, number][];
			step(s);
			clear(s);
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const v = buf[y * w + x];
					if (!v) continue;
					const c = pal[v < pal.length ? v : pal.length - 1];
					plot(s, x, y, c[0], c[1], c[2], c[3]);
				}
			}
			blit(s);
		}
	};
}

/** Points falling with a shared wind vector — one storm, not 57 arguments. */
function makeFall(rows: number, stride: number, opts: { len: number; wind: number; sway: number; size: number; fall?: number; from?: number }): FxProgram {
	return {
		rows,
		stride,
		init(s) {
			seedParticles(s, (sc, i) => {
				const p = sc.parts;
				p[i * P] = sc.rnd() * sc.w;
				p[i * P + 1] = (opts.from ?? 0) * sc.h + sc.rnd() * (1 - (opts.from ?? 0)) * sc.h;
				p[i * P + 2] = 0.25 + sc.rnd() * 0.85;
				p[i * P + 3] = sc.rnd() * Math.PI * 2;
				p[i * P + 4] = 0.4 + sc.rnd() * 0.6;
			});
		},
		frame(s) {
			clear(s);
			const wind = opts.wind * (0.55 + s.v.drift * 0.65) * s.v.dir;
			const rate = opts.fall ?? 1.5;
			const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.5, 92);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.08;
				p[o] += wind * p[o + 2] + Math.sin(p[o + 3]) * opts.sway;
				p[o + 1] += p[o + 2] * s.v.speed * rate;
				if (p[o + 1] > s.h) {
					p[o + 1] = (opts.from ?? 0) * s.h - 2;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o] < -2) p[o] = s.w + 2;
				const a = p[o + 4];
				const size = opts.size * p[o + 2];
				for (let k = 0; k < opts.len; k++) {
					const t = k / Math.max(1, opts.len);
					plot(s, p[o] - wind * p[o + 2] * k, p[o + 1] - p[o + 2] * s.v.speed * rate * k, r, g, b, a * (1 - t) * 0.9);
				}
				if (size > 0.8) plot(s, p[o] + 1, p[o + 1], r, g, b, a * 0.55);
			}
			blit(s);
		}
	};
}

/** Sparks thrown up and out, falling back under gravity. */
function makeFountain(rows: number, stride: number, gravity: number, spread: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.w * 0.5 + (sc.rnd() - 0.5) * sc.w * spread;
		p[i * P + 1] = sc.h - 1;
		p[i * P + 2] = (sc.rnd() - 0.5) * 0.9 + sc.v.tilt;
		p[i * P + 3] = -(0.7 + sc.rnd() * 1.5) * sc.v.speed;
		p[i * P + 4] = 0.5 + sc.rnd() * 0.5;
		p[i * P + 5] = 0;
	};
	return {
		rows,
		stride,
		init(s) {
			seedParticles(s, (sc, i) => {
				spawn(sc, i);
				sc.parts[i * P + 1] = sc.rnd() * sc.h;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += gravity;
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				p[o + 5] += 1;
				if (p[o + 1] > s.h || p[o] < -3 || p[o] > s.w + 3) spawn(s, i);
				const life = Math.max(0, 1 - p[o + 5] / 90);
				const [r, g, b] = hsl(s.v.hue + (1 - life) * 26, s.v.sat, 52 + life * 42);
				plot(s, p[o], p[o + 1], r, g, b, p[o + 4] * life);
				plot(s, p[o], p[o + 1] - 1, r, g, b, p[o + 4] * life * 0.4);
			}
			blit(s);
		}
	};
}

/** Vertical curtains driven by layered sines — light, not drawn ribbons. */
function makeCurtain(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).ph = [s.rnd() * 9, s.rnd() * 9, s.rnd() * 9];
		},
		frame(s) {
			clear(s);
			const ph = (s as any).ph as number[];
			const t = s.t * 0.012 * s.v.speed * s.v.dir;
			for (let band = 0; band < 3; band++) {
				const hue = s.v.hue + band * 34 + (s.v.hue2 - s.v.hue) * 0.3;
				const [r, g, b] = hsl(hue, s.v.sat, 58);
				for (let x = 0; x < s.w; x++) {
					const u = x / s.w;
					const wave = Math.sin(u * 5.2 + t * 1.3 + ph[band]) * 0.5 + Math.sin(u * 11 - t * 0.8 + ph[band] * 2) * 0.28 + Math.sin(u * 2.1 + t * 0.4) * 0.22;
					const top = s.h * (0.06 + band * 0.05) + wave * s.h * (0.1 + s.v.drift * 0.1) + s.v.tilt * s.h * 0.05;
					const len = s.h * (0.42 + 0.16 * Math.sin(u * 7 + t + band));
					for (let y = 0; y < len; y++) {
						const f = y / len;
						const a = (1 - f) * (0.16 + 0.1 * Math.sin(u * 15 + t * 2)) * (1 - band * 0.18);
						if (a > 0.004) plot(s, x, top + y, r, g, b, a);
					}
				}
			}
			blit(s);
		}
	};
}

/** Matter spiralling inward and vanishing at the centre. */
function makeSpiral(rows: number, stride: number, inward: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * Math.PI * 2;
		p[i * P + 1] = 0.45 + sc.rnd() * 0.75;
		p[i * P + 2] = (0.4 + sc.rnd() * 0.9) * sc.v.speed;
		p[i * P + 3] = 0.4 + sc.rnd() * 0.6;
	};
	return {
		rows,
		stride,
		init(s) {
			seedParticles(s, spawn);
		},
		frame(s) {
			clear(s);
			const cx = s.w * 0.5;
			const cy = s.h * 0.5;
			const rx = s.w * 0.46;
			const ry = s.h * 0.46;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o] += 0.035 * p[o + 2] * s.v.dir;
				p[o + 1] -= inward * p[o + 2];
				if (p[o + 1] <= 0.06) spawn(s, i);
				const x = cx + Math.cos(p[o]) * rx * p[o + 1];
				const y = cy + Math.sin(p[o]) * ry * p[o + 1];
				const heat = 1 - p[o + 1];
				const [r, g, b] = hsl(s.v.hue + heat * 50, s.v.sat, 46 + heat * 46);
				plot(s, x, y, r, g, b, p[o + 3] * (0.35 + heat * 0.65));
			}
			blit(s);
		}
	};
}

/** A star band plus scattered field, twinkling on its own clock. */
function makeStarfield(rows: number, stride: number, band: number): FxProgram {
	return {
		rows,
		stride,
		init(s) {
			seedParticles(s, (sc, i) => {
				const p = sc.parts;
				const x = sc.rnd();
				const near = sc.rnd() < band;
				const line = 0.86 - (0.5 + sc.v.drift * 0.3) * x;
				p[i * P] = x * sc.w;
				p[i * P + 1] = (near ? line + (sc.rnd() - 0.5) * 0.42 : sc.rnd()) * sc.h;
				p[i * P + 2] = 0.25 + sc.rnd() * 0.75;
				p[i * P + 3] = sc.rnd() * Math.PI * 2 + sc.v.tilt;
				p[i * P + 4] = near ? 1 : 0.55;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += (0.02 + p[o + 2] * 0.03 * s.v.speed) * (s.v.dir > 0 ? 1 : 0.7);
				const tw = 0.45 + 0.55 * Math.sin(p[o + 3]);
				const [r, g, b] = hsl(s.v.hue + p[o + 2] * 46, s.v.sat * 0.7, 66 + p[o + 2] * 28);
				plot(s, p[o], p[o + 1], r, g, b, tw * p[o + 4] * 0.9);
			}
			blit(s);
		}
	};
}

/** Points that fade in and out where they stand. */
function makeTwinkle(rows: number, stride: number, rise: number): FxProgram {
	return {
		rows,
		stride,
		init(s) {
			seedParticles(s, (sc, i) => {
				const p = sc.parts;
				p[i * P] = sc.rnd() * sc.w;
				p[i * P + 1] = sc.rnd() * sc.h;
				p[i * P + 2] = 0.3 + sc.rnd() * 0.8;
				p[i * P + 3] = sc.rnd() * Math.PI * 2;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.03 * p[o + 2] * s.v.speed;
				p[o + 1] -= rise * p[o + 2];
				p[o] += Math.sin(p[o + 3] * 0.6) * 0.16 * s.v.drift;
				if (p[o + 1] < -1) {
					p[o + 1] = s.h + 1;
					p[o] = s.rnd() * s.w;
				}
				const tw = Math.max(0, Math.sin(p[o + 3]));
				const [r, g, b] = hsl(s.v.hue + (s.v.hue2 - s.v.hue) * p[o + 2], s.v.sat, 62 + tw * 30);
				plot(s, p[o], p[o + 1], r, g, b, tw * 0.95);
				plot(s, p[o] + 1, p[o + 1], r, g, b, tw * 0.3);
				plot(s, p[o], p[o + 1] + 1, r, g, b, tw * 0.3);
			}
			blit(s);
		}
	};
}

export const PROGRAMS: Record<string, FxProgram> = {
	fire: makeFire(52, 3, 0.86),
	ember: withGlow(makeFountain(56, 0.34, 0.012, 1.9), 0.95, 0.5, 52, 1502),
	volcano: withCone(makeFountain(56, 0.42, 0.028, 0.34)),

	snow: withSky(makeSprite(56, 0.16, FLAKE, { fall: 1, sway: 0.2, tumble: 0.04, wind: 0.16, light: 94, spread: 8, from: 0.2 }), 3, 88, 0.4),
	blizzard: withSky(makeFall(56, 1.15, { len: 4, wind: 1.35, sway: 0.05, size: 0.6, from: 0.2 }), 4, 80, 2.4),
	rain: withSky(makeFall(56, 1.0, { len: 6, wind: 0.28, sway: 0, size: 0.5, from: 0.2 }), 3, 54, 0.5),
	sandstorm: withGround(makeFall(56, 1.4, { len: 6, wind: 3.4, sway: 0.12, size: 0.5, fall: -0.14 }), 279, 0.22, 0.09, 34),
	earthquake: makeQuake(56),

	aurora: withGlow(makeCurtain(56), 0.78, 0.7, 56, 1401),
	blackhole: withHorizon(makeSpiral(56, 0.7, 0.006)),
	void: makeMaw(56),
	tornado: withSky(withFunnel(makeVortex(56, 0.8)), 4, 48, 1.2),

	milkyway: withGalaxyBand(makeStarfield(56, 0.95, 0.72)),
	eclipse: makeEclipse(56),
	sparkle: withBursts(makeSprite(56, 0.14, STAR, { fall: 0, sway: 0.04, tumble: 0, wind: 0.02, light: 92, spread: 24, twinkle: 0.55 }), 3, 150, 1704),
	fireflies: withGround(makeTwinkle(56, 0.4, 0.05), 211, 0.2, 0.06, 18),
	crystal: withGlow(makeSprite(56, 0.12, SHARD, { fall: -1, sway: 0.22, tumble: 0.03, wind: 0.08, light: 78, spread: 36 }), 0.85, 0.55, 62, 1805),

	meteor: withImpacts(withGround(makeStreak(56, 0.34, 1.5, 9), 233, 0.17, 0.1, 16), 210),
	fallingstar: withGround(makeWishNight(56), 257, 0.15, 0.08, 12),
	thunder: withSky(makeBolt(56, 46), 3, 42, 0.3),
	tsunami: makeBreaker(56),
	pulse: makeEcg(56),
	rainbow: withSky(makeArc(56, 7, 2.4), 2, 92, 0.25),

	bubbles: withWater(makeSprite(56, 0.13, BUBBLE, { fall: -1, sway: 0.3, tumble: 0, wind: 0.08, light: 80, spread: 14 }), 0.12),
	love: withGlow(makeSprite(56, 0.13, HEART, { fall: -1, sway: 0.38, tumble: 0.05, wind: 0.1, light: 70, spread: 18 }), 0.7, 0.62, 62, 1603),

	confetti: withBursts(makeConfetti(56, 0.7, 300), 4, 120, 1906),
	autumn: withCanopy(makeSprite(56, 0.14, LEAF, { fall: 1, sway: 0.55, tumble: 0.12, wind: 0.4, light: 56, spread: 46 })),
	sakura: withBough(makeSprite(56, 0.14, BLOSSOM, { fall: 1, sway: 0.6, tumble: 0.07, wind: 0.3, light: 82, spread: 20 })),

	glass: makeFacets(56, 0.18, false),
	bullethole: makeHoles(56),

	holo: makeFoil(56),
	silk: makeWeave(56),
	neon: makeSign(56),
	scanlines: makeBands(56, { count: 7, slant: 0, soft: 2, spread: 0.2, light: 70 }),
	glitch: makeTear(56),

	grain: makeNoise(56, 0.5, 1)
};

export const CANVAS_FAMILIES = new Set(Object.keys(PROGRAMS));

export const BLEND: Record<string, 'screen' | 'normal'> = {
	autumn: 'normal',
	blackhole: 'normal',
	bubbles: 'normal',
	bullethole: 'normal',
	earthquake: 'normal',
	fallingstar: 'normal',
	fireflies: 'normal',
	meteor: 'normal',
	neon: 'normal',
	sakura: 'normal',
	sandstorm: 'normal',
	tsunami: 'normal',
	void: 'normal',
	volcano: 'normal'
};
