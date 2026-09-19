import { makeCrown, makeCupcake, makeGem } from './cute.js';
import { mulberry32 } from '$lib/effects.js';
import { makeCandle, makeDice, makeFishtank, makeMoney, makePopcorn, makeRainglass, makeVinyl } from './objects.js';
import { blit, clear, edge, hsl, plot, type FxProgram, type FxScene } from './engine.js';
import { makeArc, makeBolt, makeConfetti, makeEcg, makeEclipse, makeFacets, makeIdler, makeSprite, makeVortex, withOvercast, withSky } from './extra.js';
import {
	boughSource,
	canopySource,
	makeCrt,
	makeEmbers,
	makeFilm,
	makeFoilLit,
	makeGlyphRain,
	makeMaw,
	makeQuake,
	makeSunset,
	makeTear,
	makeWeave,
	withBough,
	withBursts,
	withCanopy,
	withGalaxyBand,
	withGlow,
	withWater
} from './patterns.js';
import { makeFog, makeFrost, makeSmoke } from './air.js';
import { makeJelly, makeMeadow, makeSwarm } from './life.js';
import { makeCircuit, makePrism } from './optic.js';
import { makeAnthill, makeBloom, makeCoral, makeCulture, makeDecay, makeGraze, makeLichen, makeMycelium, makeSlime, makeSpore } from './grow.js';
import { makeDrip, makeRipple, makeWaterfall } from './water.js';
import { BLOSSOM, BUBBLE, FLAKE, HEART, LEAF, SHARD, STAR } from './sprites.js';
import {
	makeBreaker,
	makeHoles,
	makeSign,
	makeStrike,
	makeWishNight,
	withCone,
	withFunnel,
	withGround,
	withHorizon,
	withScreen,
	withShore
} from './structure.js';

const P = 6;

function seedParticles(s: FxScene, spawn: (s: FxScene, i: number) => void) {
	for (let i = 0; i < s.n; i++) spawn(s, i);
}

function fieldPalette(s: FxScene, steps: number) {
	const pal: [number, number, number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const h = s.v.hue + (s.v.hue2 - s.v.hue) * t;
		pal.push([...hsl(h, s.v.sat - t * 46, 6 + t * 88), Math.min(1, t * t * 1.9)] as [number, number, number, number]);
	}
	return pal;
}

function makeFire(rows: number, decay: number, feed: number, reach: number): FxProgram {
	const step = (s: FxScene) => {
		const { w, h, buf } = s;
		const top = (s as any).levels as number;
		const coals = (s as any).coals as number[][];
		const fuel = feed * (0.82 + s.v.speed * 0.18);
		const lean = s.v.dir > 0 ? 1 : 2;
		const idle = Math.max(1, Math.round(top * (0.6 + s.v.drift * 0.14)));
		for (let x = 0; x < w; x++) {
			let bed = 0;
			for (const [cx, cw, cs] of coals) bed = Math.max(bed, cs * Math.max(0, 1 - Math.abs(x / w - cx) / cw));
			buf[(h - 1) * w + x] = s.rnd() < fuel * (0.35 + bed * 0.65) ? top : Math.round(idle * (0.4 + bed * 0.6));
		}
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
			const r = mulberry32(s.v.seed + 4421);
			const coals: number[][] = [];
			const n = 3 + ((r() * 4) | 0);
			for (let i = 0; i < 7; i++) {
				const keep = i < n;
				const cx = 0.08 + r() * 0.84;
				const cw = 0.1 + r() * 0.22;
				const cs = 0.45 + r() * 0.55;
				if (keep) coals.push([cx, cw, cs]);
			}
			(s as any).coals = coals;
			const levels = Math.max(6, Math.round(s.h * reach * (0.82 + s.v.drift * 0.24)));
			(s as any).levels = levels;
			(s as any).pal = fieldPalette(s, levels);
			(s as any).sparks = [] as number[][];
			(s as any).tips = new Float32Array(s.w);
			const { w, h, buf } = s;
			for (let y = 0; y < h; y++) {
				const heat = levels * (y / (h - 1));
				for (let x = 0; x < w; x++) buf[y * w + x] = Math.max(0, Math.min(levels, Math.round(heat * (0.45 + s.rnd() * 0.9))));
			}
			for (let i = 0; i < 14; i++) step(s);
		},
		frame(s) {
			const { w, h, buf } = s;
			const pal = (s as any).pal as [number, number, number, number][];
			const levels = (s as any).levels as number;
			const coals = (s as any).coals as number[][];
			const tips = (s as any).tips as Float32Array;
			step(s);
			clear(s);

			for (let x = 0; x < w; x++) tips[x] = h;
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const v = buf[y * w + x];
					if (!v) continue;
					const c = pal[v < pal.length ? v : pal.length - 1];
					plot(s, x, y, c[0], c[1], c[2], c[3]);
					if (v > levels * 0.2 && y < tips[x]) tips[x] = y;
				}
			}

			const [hr, hg, hb] = hsl(s.v.hue + 8, s.v.sat * 0.6, 54);
			const lift = Math.sin(s.t * 0.05 * s.v.speed) * 0.5 + 0.5;
			for (let x = 0; x < w; x++) {
				const tip = tips[x];
				if (tip >= h) continue;
				const span = h * 0.24;
				for (let k = 1; k < span; k++) {
					const y = tip - k;
					if (y < 0) break;
					const f = 1 - k / span;
					const swirl = 0.6 + 0.4 * Math.sin(x * 0.2 + s.t * 0.06 * s.v.dir + k * 0.3);
					plot(s, x + Math.sin(k * 0.4 + s.t * 0.03) * s.v.drift, y, hr, hg, hb, f * f * swirl * 0.12 * (0.7 + lift * 0.3));
				}
			}

			const [cr, cg, cb] = hsl(s.v.hue - 6, s.v.sat, 46);
			const [gr2, gg2, gb2] = hsl(s.v.hue + 14, s.v.sat * 0.8, 86);
			for (const [cx, cw, cs] of coals) {
				const px = cx * w;
				const half = cw * w;
				const glow = cs * (0.62 + 0.38 * Math.sin(s.t * 0.07 * s.v.speed + cx * 9));
				for (let dx = -half; dx <= half; dx++) {
					const u = Math.abs(dx) / half;
					if (u > 1) continue;
					const body = 1 - u * u;
					for (let k = 0; k < 3; k++) {
						const y = h - 1 - k;
						const a = body * glow * (1 - k / 3);
						plot(s, px + dx, y, cr, cg, cb, a * 0.8);
						if (k === 0 && body > 0.55) plot(s, px + dx, y, gr2, gg2, gb2, (body - 0.55) * glow * 0.9);
					}
				}
			}

			const sparks = (s as any).sparks as number[][];
			for (let k = 0; k < 3; k++) {
				const sx = (s.rnd() * w) | 0;
				const lim = levels * 0.72;
				for (let y = 1; y < h; y++) {
					if (buf[y * w + sx] > lim && buf[(y - 1) * w + sx] <= levels * 0.12) {
						if (s.rnd() < 0.25) sparks.push([sx, y, 0, 0.3 + s.rnd() * 0.7]);
						break;
					}
				}
			}
			for (let i = sparks.length - 1; i >= 0; i--) {
				const sp = sparks[i];
				sp[1] -= 0.35 * sp[3] * s.v.speed;
				sp[0] += Math.sin(sp[2] * 0.3) * 0.4 * s.v.drift * s.v.dir;
				sp[2] += 1;
				if (sp[1] < 0 || sp[2] > 70) {
					sparks.splice(i, 1);
					continue;
				}
				const life = 1 - sp[2] / 70;
				const c = pal[Math.min(pal.length - 1, ((0.55 + life * 0.45) * levels) | 0)];
				plot(s, sp[0], sp[1], c[0], c[1], c[2], life * 0.9);
			}
			if (sparks.length > 40) sparks.splice(0, sparks.length - 40);

			let heat = 0;
			for (let x = 0; x < w; x++) heat += 1 - tips[x] / h;
			s.out = Math.min(1, (heat / w) * 1.6);
			blit(s);
		}
	};
}

function makeFall(
	rows: number,
	stride: number,
	opts: { len: number; wind: number; sway: number; size: number; fall?: number; from?: number; splash?: number }
): FxProgram {
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
			const splashes = ((s as any).splashes ??= [] as number[][]);
			const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.5, 92);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.08;
				p[o] += wind * p[o + 2] + Math.sin(p[o + 3]) * opts.sway;
				p[o + 1] += p[o + 2] * s.v.speed * rate;
				if (p[o + 1] > s.h) {
					if (opts.splash) {
						splashes.push([p[o], 0]);
						if (splashes.length > 14) splashes.shift();
					}
					p[o + 1] = (opts.from ?? 0) * s.h - 2;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o] < -2) p[o] = s.w + 2;
				const a = p[o + 4] * edge(p[o + 1], (opts.from ?? 0) * s.h - 3, s.h + 1, s.h * 0.16);
				const size = opts.size * p[o + 2];
				for (let k = 0; k < opts.len; k++) {
					const t = k / Math.max(1, opts.len);
					plot(s, p[o] - wind * p[o + 2] * k, p[o + 1] - p[o + 2] * s.v.speed * rate * k, r, g, b, a * (1 - t) * 0.9);
				}
				if (size > 0.8) plot(s, p[o] + 1, p[o + 1], r, g, b, a * 0.55);
			}
			for (let k = splashes.length - 1; k >= 0; k--) {
				const sp = splashes[k];
				sp[1] += 1;
				if (sp[1] > 12) {
					splashes.splice(k, 1);
					continue;
				}
				const f = sp[1] / 12;
				const w2 = f * (opts.splash ?? 3);
				for (let d = -w2; d <= w2; d++) plot(s, sp[0] + d, s.h - 1 - Math.sin((1 - Math.abs(d) / (w2 + 0.5)) * 2) * 1.5, r, g, b, (1 - f) * 0.7);
			}
			blit(s);
		}
	};
}

function makeFountain(rows: number, stride: number, gravity: number, spread: number, vent = false): FxProgram {
	const mouth = (sc: FxScene) => {
		const r = mulberry32(sc.v.seed + 7311);
		const cx = sc.w * (0.5 + sc.v.tilt * 0.14);
		const peak = sc.h * (0.3 + r() * 0.14);
		const half = sc.w * (0.2 + r() * 0.12);
		return [cx, peak, half * 0.16] as const;
	};
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		if (vent) {
			const [mx, my, mw] = mouth(sc);
			p[i * P] = mx + (sc.rnd() - 0.5) * mw * 2;
			p[i * P + 1] = my;
		} else {
			p[i * P] = sc.w * 0.5 + (sc.rnd() - 0.5) * sc.w * spread;
			p[i * P + 1] = sc.h - 1;
		}
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
				const a = p[o + 3] * (0.35 + heat * 0.65) * edge(p[o + 1], 0.06, 1.25, 0.24);
				const stretch = Math.max(1, heat * heat * 9);
				for (let t = 0; t < stretch; t++) {
					const back = p[o + 1] + t * 0.012;
					plot(s, cx + Math.cos(p[o] - t * 0.012 * s.v.dir) * rx * back, cy + Math.sin(p[o] - t * 0.012 * s.v.dir) * ry * back, r, g, b, a * (1 - t / stretch));
				}
			}
			blit(s);
		}
	};
}

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
				const rest = s.h * 0.82;
				if (p[o + 1] > rest) p[o + 1] -= (p[o + 1] - rest) * 0.06;
				const tw = Math.max(0, Math.sin(p[o + 3]));
				const [r, g, b] = hsl(s.v.hue + (s.v.hue2 - s.v.hue) * p[o + 2], s.v.sat, 62 + tw * 30);
				const fe = edge(p[o + 1], -2, s.h + 2, s.h * 0.18);
				plot(s, p[o], p[o + 1], r, g, b, tw * 0.95 * fe);
				plot(s, p[o] + 1, p[o + 1], r, g, b, tw * 0.3 * fe);
				plot(s, p[o], p[o + 1] + 1, r, g, b, tw * 0.3 * fe);
			}
			blit(s);
		}
	};
}

export const PROGRAMS: Record<string, FxProgram> = {
	fire: makeFire(52, 3, 0.86, 0.58),
	ember: withGround(makeEmbers(56), 323, 0.1, 0.04, 26),
	volcano: withCone(makeFountain(56, 0.42, 0.028, 0.34, true)),

	snow: withSky(makeSprite(56, 0.16, FLAKE, { fall: 1, sway: 0.2, tumble: 0.04, wind: 0.16, light: 94, spread: 8, settle: 0.16, from: 0.2 }), 3, 88, 0.4),
	blizzard: withSky(makeFall(56, 1.15, { len: 4, wind: 1.35, sway: 0.05, size: 0.6, from: 0.2 }), 4, 80, 2.4),
	rain: withSky(makeFall(56, 1.0, { len: 6, wind: 0.28, sway: 0, size: 0.5, from: 0.2, splash: 3 }), 3, 54, 0.5),
	sandstorm: withGround(makeFall(56, 1.4, { len: 6, wind: 3.4, sway: 0.12, size: 0.5, fall: -0.14 }), 279, 0.22, 0.09, 34),
	earthquake: makeQuake(56),

	aurora: withGround(withGlow(makeCurtain(56), 0.72, 0.7, 56, 1401), 311, 0.24, 0.16, 11, true),
	blackhole: withHorizon(makeSpiral(56, 0.7, 0.006)),
	void: makeMaw(56),
	tornado: withSky(withGround(withFunnel(makeVortex(56, 0.8)), 337, 0.12, 0.05, 16), 4, 48, 1.2),

	milkyway: withGalaxyBand(makeStarfield(56, 0.95, 0.72)),
	eclipse: makeEclipse(56),
	sparkle: withBursts(makeSprite(56, 0.14, STAR, { fall: 0, sway: 0.04, tumble: 0, wind: 0.02, light: 92, spread: 24, twinkle: 0.55 }), 3, 150, 1704),
	fireflies: withGround(makeTwinkle(56, 0.4, 0.05), 211, 0.2, 0.06, 18),
	crystal: withGlow(makeSprite(56, 0.12, SHARD, { fall: -1, sway: 0.22, tumble: 0.03, wind: 0.08, light: 78, spread: 36 }), 0.85, 0.55, 62, 1805),

	meteor: withGround(makeStrike(56, 0.3, 1.5, 9, 0.83), 233, 0.17, 0.1, 16),
	fallingstar: withGround(makeWishNight(56), 257, 0.15, 0.08, 12),
	thunder: withSky(makeBolt(56, 46), 3, 42, 0.3),
	tsunami: makeBreaker(56),
	beach: withShore(makeSunset(56)),
	pulse: makeEcg(56),
	rainbow: withSky(makeArc(56, 7, 2.4), 2, 92, 0.25),

	bubbles: withWater(makeSprite(56, 0.13, BUBBLE, { fall: -1, sway: 0.3, tumble: 0, wind: 0.08, light: 80, spread: 14, from: 0.14 }), 0.12),
	love: withGlow(makeSprite(56, 0.13, HEART, { fall: -1, sway: 0.38, tumble: 0.05, wind: 0.1, light: 70, spread: 18 }), 0.7, 0.62, 62, 1603),

	confetti: makeConfetti(56, 0.7, 300),
	autumn: withCanopy(makeSprite(56, 0.14, LEAF, { fall: 1, sway: 0.55, tumble: 0.12, wind: 0.4, light: 56, spread: 46, source: canopySource })),
	sakura: withBough(makeSprite(56, 0.14, BLOSSOM, { fall: 1, sway: 0.6, tumble: 0.07, wind: 0.3, light: 82, spread: 20, source: boughSource })),

	glass: makeFacets(56, 0.18, false),
	bullethole: makeHoles(56),

	holo: makeFoilLit(56),
	silk: makeWeave(56),
	neon: makeSign(56),
	scanlines: makeCrt(56),
	matrix: withScreen(makeGlyphRain(56), 9, 0.8, 0.55, 0.22),
	bouncer: withScreen(makeIdler(56), 13, 0.86, 0.7, 0.14),
	glitch: makeTear(56),

	grain: makeFilm(56),

	waterfall: withGlow(makeWaterfall(56), 0.82, 0.5, 74, 2101),
	ripple: withGlow(makeRipple(56), 0.5, 0.62, 70, 2203),
	cave: withGround(makeDrip(56), 2307, 0.14, 0.06, 13),
	frost: withGlow(makeFrost(56), 0.3, 0.66, 82, 2411),
	fog: withGround(makeFog(56), 2503, 0.16, 0.07, 15),
	smoke: withGround(makeSmoke(56), 2609, 0.1, 0.04, 12),
	swarm: makeSwarm(56),
	jellyfish: withGlow(makeJelly(56), 0.6, 0.7, 64, 2707),
	meadow: makeMeadow(56),
	circuit: withGlow(makeCircuit(56), 0.5, 0.58, 58, 2803),
	prism: makePrism(56),
	mycelium: makeMycelium(56),
	coral: makeCoral(56),
	lichen: makeLichen(56),
	anthill: makeAnthill(56),
	slime: makeSlime(56),
	culture: makeCulture(56),
	graze: makeGraze(56),
	decay: makeDecay(56),
	bloom: makeBloom(56),
	spore: makeSpore(56),
	money: makeMoney(56),
	candle: makeCandle(56),
	vinyl: makeVinyl(56),
	fishtank: makeFishtank(56),
	popcorn: makePopcorn(56),
	rainglass: makeRainglass(56),
	dice: makeDice(56),
	cupcake: makeCupcake(56),
	gem: makeGem(56),
	crown: makeCrown(56)
};

export const CANVAS_FAMILIES = new Set(Object.keys(PROGRAMS));

export const BLEND: Record<string, 'screen' | 'normal'> = Object.fromEntries(
	Object.entries(PROGRAMS).map(([family, program]) => [family, program.opaque ? 'normal' : 'screen'])
) as Record<string, 'screen' | 'normal'>;
