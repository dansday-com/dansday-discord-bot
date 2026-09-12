import { blit, clear, edge, hsl, plot, stamp, type FxProgram, type FxScene } from './engine.js';
import { LETTER_D, LETTER_V, type Mask } from './sprites.js';
import { funnelAxis } from './structure.js';
import { mulberry32 } from '$lib/effects.js';

const P = 6;

function seed(s: FxScene, fn: (s: FxScene, i: number) => void) {
	for (let i = 0; i < s.n; i++) fn(s, i);
}

/** Bands sweeping across on an angle — foil, scanlines, silk, spectrum. */
export function makeBands(rows: number, o: { count: number; slant: number; soft: number; spread: number; light: number }): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const t = s.t * 0.02 * s.v.speed * s.v.dir;
			for (let i = 0; i < o.count; i++) {
				const off = i / o.count;
				const hue = s.v.hue + (s.v.hue2 - s.v.hue) * off * o.spread;
				const [r, g, b] = hsl(hue, s.v.sat, o.light);
				const margin = o.soft + Math.abs(o.slant) * s.h * 0.5 + 2;
				const centre = ((((t + off) % 1) + 1) % 1) * (s.w + margin * 2) - margin;
				for (let x = 0; x < s.w; x++) {
					for (let y = 0; y < s.h; y++) {
						const d = Math.abs(x - centre - (y - s.h / 2) * o.slant);
						if (d > o.soft) continue;
						plot(s, x, y, r, g, b, (1 - d / o.soft) * 0.34);
					}
				}
			}
			for (let bd = 0; bd < 6; bd++) {
				const bx = (((bd * 0.19 + t * 0.4) % 1.2) - 0.1) * s.w;
				const bw = s.w * (0.02 + (bd % 3) * 0.012);
				for (let x = bx; x < bx + bw; x++) for (let y = 0; y < s.h; y++) plot(s, x + (y - s.h / 2) * o.slant, y, 255, 255, 255, 0.08);
			}
			blit(s);
		}
	};
}

/** Value noise that resettles every frame — film grain, static. */
export function makeNoise(rows: number, amount: number, chunk: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.3, 74);
			const grit = Math.max(1, chunk + ((s.v.drift * 1.6) | 0));
			const bias = s.v.dir * s.v.tilt * 6;
			for (let y = 0; y < s.h; y += grit) {
				for (let x = 0; x < s.w; x += grit) {
					const a = s.rnd() * (0.8 + s.v.speed * 0.3);
					if (a > amount) continue;
					for (let j = 0; j < grit; j++) for (let k = 0; k < grit; k++) plot(s, x + k + bias, y + j, r, g, b, a * 0.5);
				}
			}
			blit(s);
		}
	};
}

/** A random-walk bolt that strikes, holds, then clears. */
export function makeBolt(rows: number, period: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).path = [] as number[][];
			(s as any).until = 0;
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const phase = s.t % period;
			if (phase === 0) {
				const path: number[][] = [];
				let x = s.w * (0.2 + s.rnd() * 0.6);
				for (let y = 0; y < s.h; y++) {
					x += (s.rnd() - 0.5) * 3.4 + s.v.tilt;
					path.push([x, y]);
				}
				st.path = path;
				st.until = s.t + 5 + ((s.rnd() * 4) | 0);
			}
			if (s.t < st.until) {
				const flash = (st.until - s.t) / 8;
				const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.4, 88);
				for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, fr, fg, fb, flash * 0.12);
				const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.5, 94);
				const land = (st.path as number[][])[s.h - 1] ?? [s.w / 2, s.h];
				const gy = s.h - 1;
				const heat = (st.until - s.t) / 8;
				for (let d = 0; d < s.w * 0.3; d++) {
					const fall = 1 - d / (s.w * 0.3);
					plot(s, land[0] - d, gy, r, g, b, fall * heat * 0.8);
					plot(s, land[0] + d, gy, r, g, b, fall * heat * 0.8);
					plot(s, land[0] - d * 0.6, gy - 1, r, g, b, fall * heat * 0.4);
					plot(s, land[0] + d * 0.6, gy - 1, r, g, b, fall * heat * 0.4);
				}
				for (let k = 0; k < 10; k++) {
					const th = Math.PI + (k / 9) * Math.PI;
					const d = (1 - heat) * s.h * 0.45;
					plot(s, land[0] + Math.cos(th) * d * 1.3, gy + Math.sin(th) * d, r, g, b, heat * 0.9);
				}
				for (const [x, y] of st.path as number[][]) {
					plot(s, x, y, r, g, b, 1);
					plot(s, x - 1, y, r, g, b, 0.45);
					plot(s, x + 1, y, r, g, b, 0.45);
				}
			}
			blit(s);
		}
	};
}

/** A funnel of debris orbiting a vertical axis. */
export function makeVortex(rows: number, stride: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * Math.PI * 2;
		p[i * P + 1] = sc.rnd() * 0.9;
		p[i * P + 2] = 0.5 + sc.rnd() * 0.9;
		p[i * P + 3] = 0.4 + sc.rnd() * 0.6;
	};
	return {
		rows,
		stride,
		init(s) {
			seed(s, spawn);
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o] += (0.09 + p[o + 1] * 0.07) * s.v.speed * s.v.dir;
				p[o + 1] += 0.004 * p[o + 2] * s.v.speed;
				if (p[o + 1] > 1) {
					p[o + 1] = 0;
					p[o] = s.rnd() * Math.PI * 2;
				}
				const [mid, width] = funnelAxis(s, 1 - p[o + 1]);
				const x = mid + Math.cos(p[o]) * width;
				const y = s.h - p[o + 1] * s.h;
				const front = Math.sin(p[o]) > 0 ? 1 : 0.4;
				const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.6, 40 + p[o + 1] * 34);
				plot(s, x, y, r, g, b, p[o + 3] * front * edge(p[o + 1], 0, 1, 0.16));
			}
			blit(s);
		}
	};
}

/** Bright heads dragging tails on a steep diagonal. */
export function makeStreak(rows: number, stride: number, steep: number, len: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * sc.w * 1.6 - sc.w * 0.3;
		p[i * P + 1] = -sc.rnd() * sc.h;
		p[i * P + 2] = 0.6 + sc.rnd() * 1.2;
		p[i * P + 3] = 0.5 + sc.rnd() * 0.5;
	};
	return {
		rows,
		stride,
		init(s) {
			seed(s, (sc, i) => {
				spawn(sc, i);
				sc.parts[i * P + 1] = sc.rnd() * sc.h;
			});
		},
		frame(s) {
			clear(s);
			const dx = steep * s.v.dir;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o] += dx * p[o + 2] * s.v.speed;
				p[o + 1] += p[o + 2] * s.v.speed * 1.7;
				if (p[o + 1] > s.h + 2) spawn(s, i);
				const [r, g, b] = hsl(s.v.hue, s.v.sat, 88);
				for (let k = 0; k < len; k++) {
					const t = k / len;
					plot(s, p[o] - dx * k * 1.4, p[o + 1] - k * 1.7, r, g, b, p[o + 3] * (1 - t) * edge(p[o + 1], -2, s.h + 2, s.h * 0.2));
				}
			}
			blit(s);
		}
	};
}

/** Chunky tumbling bits in mixed hues. */
export function makeConfetti(rows: number, stride: number, hues: number): FxProgram {
	const POPS = 4;
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		const pops = (sc as any).pops as number[][];
		const from = pops[(sc.rnd() * pops.length) | 0];
		const th = sc.rnd() * Math.PI * 2;
		const push = 0.4 + sc.rnd() * 1.3;
		p[i * P] = from[0] * sc.w;
		p[i * P + 1] = from[1] * sc.h;
		p[i * P + 2] = 0.3 + sc.rnd() * 0.8;
		p[i * P + 3] = sc.rnd() * Math.PI * 2;
		p[i * P + 4] = sc.rnd();
		p[i * P + 5] = Math.cos(th) * push;
		p[i * P + 1] -= Math.abs(Math.sin(th)) * 2;
	};
	return {
		rows,
		stride,
		init(s) {
			(s as any).pops = Array.from({ length: POPS }, () => [0.12 + s.rnd() * 0.76, 0.1 + s.rnd() * 0.5, s.rnd() * 120]);
			seed(s, (sc, i) => {
				spawn(sc, i);
				sc.parts[i * P + 1] = sc.rnd() * sc.h;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.16 * p[o + 2];
				p[o + 5] *= 0.97;
				p[o] += p[o + 5] + Math.sin(p[o + 3]) * 0.5 * s.v.drift + s.v.tilt * 0.3;
				p[o + 1] += p[o + 2] * s.v.speed * 1.2;
				if (p[o + 1] > s.h + 2) spawn(s, i);
				const [r, g, b] = hsl(s.v.hue + p[o + 4] * hues, s.v.sat, 62);
				const flat = Math.abs(Math.cos(p[o + 3]));
				const wide = 1 + Math.round(flat * 2);
				const tall = 1 + Math.round((1 - flat) * 2);
				const ce = edge(p[o + 1], -2, s.h + 2, s.h * 0.14);
				for (let dy = 0; dy < tall; dy++) for (let dx = 0; dx < wide; dx++) plot(s, p[o] + dx, p[o + 1] + dy, r, g, b, (0.95 - dy * 0.12) * ce);
			}
			const pops = (s as any).pops as number[][];
			for (const [px, py, off] of pops) {
				const ph = ((s.t * s.v.speed + off) % 120) / 120;
				if (ph > 0.3) continue;
				const f = ph / 0.3;
				const rad = f * s.w * 0.1;
				const [pr, pg, pb] = hsl(s.v.hue + px * hues, s.v.sat, 80);
				for (let k = 0; k < 360; k += 7) {
					const th = (k * Math.PI) / 180;
					plot(s, px * s.w + Math.cos(th) * rad, py * s.h + Math.sin(th) * rad, pr, pg, pb, (1 - f) * 0.8);
				}
			}
			blit(s);
		}
	};
}

/** Static facets that catch the light in sequence. */
export function makeFacets(rows: number, stride: number, crack: boolean): FxProgram {
	return {
		rows,
		stride,
		init(s) {
			seed(s, (sc, i) => {
				const p = sc.parts;
				p[i * P] = sc.rnd() * sc.w;
				p[i * P + 1] = sc.rnd() * sc.h;
				p[i * P + 2] = 3 + sc.rnd() * (4 + sc.v.drift * 5);
				p[i * P + 3] = sc.rnd() * Math.PI * 2;
				p[i * P + 4] = sc.rnd() * Math.PI * 2;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * s.v.speed * s.v.dir;
				const sweep = ((s.t * 0.6 * s.v.speed * s.v.dir) % (s.w * 1.6)) - s.w * 0.3;
				const hit = Math.max(0, 1 - Math.abs(p[o] - sweep - (p[o + 1] - s.h / 2) * 0.5) / (s.w * 0.16));
				const shine = Math.max(0, Math.sin(p[o + 3])) * 0.35 + hit * hit * 0.9;
				const [r, g, b] = hsl(s.v.hue + shine * 40, s.v.sat, 60 + shine * 34);
				const len = p[o + 2];
				const a = Math.cos(p[o + 4]);
				const bq = Math.sin(p[o + 4] + s.v.tilt);
				for (let k = -len; k <= len; k++) {
					plot(s, p[o] + a * k, p[o + 1] + bq * k, r, g, b, shine * 0.8 * (1 - Math.abs(k) / len));
					if (crack) plot(s, p[o] - bq * k * 0.5, p[o + 1] + a * k * 0.5, r, g, b, shine * 0.4);
				}
			}
			const [pr, pg, pb] = hsl(s.v.hue, s.v.sat * 0.5, 58);
			for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, pr, pg, pb, 0.05 + (y / s.h) * 0.05);
			const gl = ((s.t * 0.6 * s.v.speed * s.v.dir) % (s.w * 1.6)) - s.w * 0.3;
			for (let y = 0; y < s.h; y++) for (let d = -5; d <= 5; d++) plot(s, gl + d + (y - s.h / 2) * 0.5, y, 255, 255, 255, (1 - Math.abs(d) / 5) * 0.22);
			blit(s);
		}
	};
}

const SPECTRUM = [
	[0, 100, 69],
	[28, 100, 64],
	[50, 100, 62],
	[142, 66, 57],
	[199, 93, 60],
	[229, 91, 64],
	[258, 90, 77]
];

/** Concentric spectrum arcs springing from the bottom edge, light travelling along them. */
export function makeArc(rows: number, bands: number, thick: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const cx = s.w * (0.5 + s.v.tilt * 0.12);
			const cy = s.h * 1.02;
			const t = s.t * 0.016 * s.v.speed;
			const sun = 0.5 + 0.42 * Math.sin(s.t * 0.004 * s.v.speed * s.v.dir);
			for (let i = 0; i < bands; i++) {
				const c = SPECTRUM[i % SPECTRUM.length];
				const [r, g, b] = hsl(c[0] + s.v.hue * 0.06, c[1], c[2]);
				const rx = s.w * 0.47 - i * thick * (s.w / s.h) * 0.6;
				const ry = s.h * 0.94 - i * thick;
				const steps = Math.max(48, s.w * 2);
				for (let k = 0; k <= steps; k++) {
					const u = k / steps;
					const a = Math.PI + u * Math.PI;
					const travel = 0.55 + 0.45 * Math.sin(u * 6.5 - t * 2.2 * s.v.dir + i * 0.5);
					const fade = Math.sin(u * Math.PI) * (0.45 + 0.55 * Math.max(0, 1 - Math.abs(u - sun) * 2.2));
					plot(s, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r, g, b, travel * fade * 0.85);
				}
			}
			blit(s);
		}
	};
}

/** Pixel sprites drifting with tumble — hearts, leaves, petals, flakes. */
export function makeSprite(
	rows: number,
	stride: number,
	m: Mask,
	o: {
		fall: number;
		sway: number;
		tumble: number;
		wind: number;
		light: number;
		spread: number;
		twinkle?: number;
		from?: number;
		settle?: number;
		source?: (sc: FxScene) => [number, number];
	}
): FxProgram {
	const place = (sc: FxScene, i: number, fresh: boolean) => {
		const p = sc.parts;
		const top = (o.from ?? 0) * sc.h;
		if (o.source) {
			const [sx, sy] = o.source(sc);
			p[i * P] = sx;
			p[i * P + 1] = fresh ? sy : sy + sc.rnd() * (sc.h - sy);
		} else {
			p[i * P] = sc.rnd() * sc.w;
			p[i * P + 1] = fresh ? (o.fall > 0 ? top - m.h : sc.h + m.h) : top + sc.rnd() * (sc.h - top);
		}
		p[i * P + 2] = 0.3 + sc.rnd() * 0.8;
		p[i * P + 3] = sc.rnd() * Math.PI * 2;
		p[i * P + 4] = 0.55 + sc.rnd() * 0.45;
		p[i * P + 5] = sc.rnd();
	};
	return {
		rows,
		stride,
		init(s) {
			for (let i = 0; i < s.n; i++) place(s, i, false);
			if (o.settle) (s as any).drift = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const wind = o.wind * s.v.drift * s.v.dir;
			const pile = o.settle ? ((s as any).drift as Float32Array) : null;
			for (let i = 0; i < s.n; i++) {
				const k = i * P;
				const p = s.parts;
				p[k + 3] += o.tumble * (0.4 + p[k + 2]);
				p[k] += wind * p[k + 2] + Math.sin(p[k + 3] * 0.5) * o.sway;
				if (!o.twinkle) p[k + 1] += o.fall * p[k + 2] * s.v.speed;
				if (pile && o.fall > 0) {
					const c = Math.max(0, Math.min(s.w - 1, p[k] | 0));
					if (p[k + 1] >= s.h - pile[c]) {
						if (pile[c] < s.h * (o.settle ?? 0.14)) {
							pile[c] += 0.55;
							if (c > 0) pile[c - 1] += 0.22;
							if (c < s.w - 1) pile[c + 1] += 0.22;
						}
						place(s, i, true);
						continue;
					}
				}
				if (!o.twinkle && (o.fall > 0 ? p[k + 1] > s.h + m.h : p[k + 1] < (o.from ?? 0) * s.h - m.h)) place(s, i, true);
				if (p[k] > s.w + m.w) p[k] = -m.w;
				if (p[k] < -m.w) p[k] = s.w + m.w;
				const [r, g, b] = hsl(s.v.hue + p[k + 5] * o.spread, s.v.sat, o.light);
				const squash = Math.abs(Math.cos(p[k + 3])) * 0.75 + 0.25;
				let alpha = p[k + 4] * 0.9 * (o.twinkle ? 1 : edge(p[k + 1], (o.from ?? 0) * s.h - m.h, s.h + m.h, s.h * 0.16));
				if (o.twinkle) {
					const pulse = Math.sin(p[k + 3] * o.twinkle);
					alpha *= Math.max(0, pulse);
					if (pulse < -0.985) place(s, i, false);
				}
				stamp(s, m, p[k], p[k + 1], r, g, b, alpha, o.tumble > 0 ? squash : 1);
			}
			if (pile) {
				const [dr, dg, db] = hsl(s.v.hue, s.v.sat * 0.4, 96);
				const [er2, eg2, eb2] = hsl(s.v.hue2, s.v.sat * 0.5, 76);
				for (let x = 0; x < s.w; x++) {
					const top = s.h - pile[x];
					for (let y = top; y < s.h; y++) plot(s, x, y, dr, dg, db, 0.94);
					if (pile[x] > 0.5) plot(s, x, top, er2, eg2, eb2, 0.5);
				}
			}
			blit(s);
		}
	};
}

/** Pixel cumulus along the top edge, drifting. Seeded lumps, not drawn paths. */
export function clouds(s: FxScene, count: number, light: number, drift: number) {
	const r0 = mulberry32(s.v.seed + 4242);
	const tint = Math.min(16, s.v.sat * 0.28);
	const [r, g, b] = hsl(s.v.hue, tint, light);
	const [dr, dg, db] = hsl(s.v.hue, tint * 1.2, light * 0.62);
	for (let c = 0; c < count; c++) {
		const baseX = (c / count) * s.w + r0() * (s.w / count);
		const baseY = 2 + r0() * s.h * 0.16;
		const span = s.w * (0.1 + r0() * 0.1);
		const shift = ((s.t * 0.05 * drift * s.v.dir + c * 31) % (s.w + span * 2)) - span;
		for (let lump = 0; lump < 5; lump++) {
			const lx = baseX + shift + (lump - 2) * span * 0.34;
			const ly = baseY + Math.abs(lump - 2) * 1.1;
			const rad = span * (0.34 - Math.abs(lump - 2) * 0.06);
			for (let y = -rad; y <= rad * 0.8; y++) {
				for (let x = -rad; x <= rad; x++) {
					if (x * x * 0.5 + y * y * 1.6 > rad * rad) continue;
					const under = y > rad * 0.25;
					plot(s, lx + x, ly + y + rad * 0.5, under ? dr : r, under ? dg : g, under ? db : b, under ? 0.5 : 0.72);
				}
			}
		}
	}
}

/** Corona, chromosphere rim and flares. The disc is the hole where no light is drawn. */
export function makeEclipse(rows: number): FxProgram {
	return {
		rows,
		stride: 0.7,
		init(s) {
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * P] = s.rnd() * s.w;
				p[i * P + 1] = s.rnd() * s.h;
				p[i * P + 2] = s.rnd() * Math.PI * 2;
				p[i * P + 3] = 0.3 + s.rnd() * 0.7;
			}
		},
		frame(s) {
			clear(s);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.4, 88);
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * P + 2] += 0.02 + p[i * P + 3] * 0.02 * s.v.speed;
				const tw = 0.35 + 0.65 * Math.sin(p[i * P + 2]);
				plot(s, p[i * P], p[i * P + 1], sr, sg, sb, tw * p[i * P + 3] * 0.8);
			}

			const cx = s.w * (0.5 + s.v.tilt * 0.18);
			const cy = s.h * (0.42 + s.v.drift * 0.06);
			const rad = s.h * 0.28;
			const cover = 0.5 + 0.5 * Math.sin(s.t * 0.006 * s.v.speed * s.v.dir);
			s.out = cover;
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat, 76);

			for (let ring = 0; ring < 30; ring++) {
				const rr = rad * (1.04 + ring * 0.075);
				const fall = 1 - ring / 30;
				for (let k = 0; k < 360; k += 3) {
					const th = (k * Math.PI) / 180;
					const streamer = 0.55 + 0.45 * Math.sin(th * 7 + s.t * 0.03 + ring * 0.2);
					plot(s, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, cr, cg, cb, fall * fall * streamer * 0.34 * cover);
				}
			}

			const [rr2, rg2, rb2] = hsl(s.v.hue, s.v.sat * 0.5, 98);
			for (let k = 0; k < 360; k += 1) {
				const th = (k * Math.PI) / 180;
				const bead = 0.25 + 0.75 * Math.max(0, Math.sin(th * 11 + s.t * 0.02));
				plot(s, cx + Math.cos(th) * rad, cy + Math.sin(th) * rad, rr2, rg2, rb2, bead * cover * 0.9);
			}
			const dth = s.t * 0.01 * s.v.dir;
			for (let g = 0; g < 8; g++)
				for (let d = 0; d < s.h * 0.4; d++)
					plot(s, cx + Math.cos(dth) * (rad + d), cy + Math.sin(dth) * (rad + d), rr2, rg2, rb2, (1 - d / (s.h * 0.4)) * cover * 0.5);
			blit(s);
		}
	};
}

/** A heartbeat trace sweeping left to right, leaving a decaying tail. */
export function makeEcg(rows: number): FxProgram {
	const WAVE = (u: number) => {
		if (u < 0.36 || u > 0.62) return 0;
		const t = (u - 0.36) / 0.26;
		if (t < 0.18) return Math.sin((t / 0.18) * Math.PI) * 0.16;
		if (t < 0.34) return -0.18;
		if (t < 0.46) return 1;
		if (t < 0.58) return -0.42;
		if (t < 0.82) return Math.sin(((t - 0.58) / 0.24) * Math.PI) * 0.26;
		return 0;
	};
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).trail = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const trail = (s as any).trail as Float32Array;
			const mid = s.h * (0.52 + s.v.tilt * 0.08);
			const amp = s.h * (0.26 + s.v.drift * 0.14);
			const head = s.v.dir > 0 ? ((s.t * 0.9 * s.v.speed) | 0) % s.w : s.w - 1 - (((s.t * 0.9 * s.v.speed) | 0) % s.w);
			const [gr, gg, gb] = hsl(s.v.hue, s.v.sat * 0.4, 30);
			for (let x = 0; x < s.w; x += 6) for (let y = 0; y < s.h; y += 5) plot(s, x, y, gr, gg, gb, 0.35);
			trail[head] = WAVE((head / s.w + 1) % 1);
			const [r, g, b] = hsl(s.v.hue, s.v.sat, 62);
			for (let x = 0; x < s.w; x++) {
				const age = ((head - x + s.w) % s.w) / s.w;
				const a = Math.max(0, 1 - age * 1.6);
				if (a <= 0.02) continue;
				const y = mid - trail[x] * amp;
				plot(s, x, y, r, g, b, a);
				plot(s, x, y + 1, r, g, b, a * 0.5);
				if (x === head) for (let k = -2; k <= 2; k++) plot(s, x, y + k, 255, 255, 255, 0.9);
			}
			const beat = trail[head];
			if (beat > 0.8) {
				const [br2, bg2, bb2] = hsl(s.v.hue, s.v.sat, 70);
				for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, br2, bg2, bb2, (beat - 0.8) * 0.5);
			}
			for (let x = 0; x < s.w; x++) {
				const gy2 = mid - trail[x] * amp * 0.72;
				plot(s, x, gy2 + 3, r, g, b, 0.12);
			}
			blit(s);
		}
	};
}

/** Compose a weather program with a cloud deck above it. */
export function withSky(inner: FxProgram, count: number, light: number, drift: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			clouds(s, count, light, drift);
			blit(s);
		}
	};
}

/** The idler: a wordmark on a disc that bounces off the walls, takes a new colour from every wall it hits, and burns its path into the screen. */
export function makeIdler(rows: number): FxProgram {
	const PAD = 3;
	return {
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + 5281);
			const st = s as any;
			const bw = Math.max(18, Math.round(s.w * (0.17 + r() * 0.07)));
			const bh = Math.max(9, Math.round(s.h * (0.24 + r() * 0.09) * (1 + s.v.tilt * 0.2)));
			const gw = bw + PAD * 2;
			const gh = bh + PAD * 2;
			const mark = new Uint8Array(gw * gh);

			const ex = PAD + bw / 2;
			const ey = PAD + bh * 0.74;
			const erx = bw * 0.48;
			const ery = bh * 0.26;
			for (let y = 0; y < gh; y++) {
				for (let x = 0; x < gw; x++) {
					const dx = (x + 0.5 - ex) / erx;
					const dy = (y + 0.5 - ey) / ery;
					if (dx * dx + dy * dy <= 1) mark[y * gw + x] = 1;
				}
			}

			const word = [LETTER_D, LETTER_V, LETTER_D];
			const cell = bw / word.length;
			const inset = cell * 0.09;
			const sx = (cell - inset * 2) / word[0].w;
			const sy = (bh * 0.64) / word[0].h;
			for (let i = 0; i < word.length; i++) {
				const g = word[i];
				const base = PAD + i * cell + inset;
				for (let gy = 0; gy < g.h; gy++) {
					const y0 = PAD + Math.round(gy * sy);
					const y1 = Math.max(y0 + 1, PAD + Math.round((gy + 1) * sy));
					for (let gx = 0; gx < g.w; gx++) {
						if (!g.bits[gy * g.w + gx]) continue;
						const x0 = Math.round(base + gx * sx);
						const x1 = Math.max(x0 + 1, Math.round(base + (gx + 1) * sx));
						for (let y = y0; y < y1; y++) {
							for (let x = x0; x < x1; x++) {
								if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
								mark[y * gw + x] = 2;
							}
						}
					}
				}
			}

			const halo = new Uint8Array(gw * gh);
			for (let y = 0; y < gh; y++) {
				for (let x = 0; x < gw; x++) {
					if (mark[y * gw + x]) continue;
					let near = 0;
					for (let k = 1; k <= PAD && !near; k++) {
						if (x - k >= 0 && mark[y * gw + x - k]) near = k;
						else if (x + k < gw && mark[y * gw + x + k]) near = k;
						else if (y - k >= 0 && mark[(y - k) * gw + x]) near = k;
						else if (y + k < gh && mark[(y + k) * gw + x]) near = k;
					}
					halo[y * gw + x] = near;
				}
			}

			const count = 4 + ((r() * 4) | 0);
			const hues: number[] = [];
			for (let i = 0; i < count; i++) hues.push(s.v.hue + (i / count) * 360 + (r() - 0.5) * 24);
			const ang = (0.21 + r() * 0.23) * Math.PI * (r() < 0.5 ? 1 : -1);

			st.bw = bw;
			st.bh = bh;
			st.gw = gw;
			st.gh = gh;
			st.crown = PAD + Math.max(1, Math.round(bh * 0.08));
			st.mark = mark;
			st.halo = halo;
			st.hues = hues;
			st.ci = (r() * count) | 0;
			st.x = bw + r() * Math.max(1, s.w - bw * 3);
			st.y = bh + r() * Math.max(1, s.h - bh * 3);
			st.vx = Math.cos(ang) * 0.55 * s.v.dir;
			st.vy = Math.sin(ang) * 0.55;
			st.burn = new Float32Array(s.w * s.h);
			st.scuffs = [] as number[][];
			st.flash = 0;
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const bw = st.bw as number;
			const bh = st.bh as number;
			const gw = st.gw as number;
			const gh = st.gh as number;
			const crown = st.crown as number;
			const mark = st.mark as Uint8Array;
			const halo = st.halo as Uint8Array;
			const burn = st.burn as Float32Array;
			const scuffs = st.scuffs as number[][];
			const hues = st.hues as number[];

			st.x += st.vx * s.v.speed * 1.15;
			st.y += st.vy * s.v.speed * 1.15;

			let hitX = false;
			let hitY = false;
			if (st.x <= 0) {
				st.x = 0;
				st.vx = -st.vx;
				hitX = true;
			} else if (st.x + bw >= s.w) {
				st.x = s.w - bw;
				st.vx = -st.vx;
				hitX = true;
			}
			if (st.y <= 0) {
				st.y = 0;
				st.vy = -st.vy;
				hitY = true;
			} else if (st.y + bh >= s.h) {
				st.y = s.h - bh;
				st.vy = -st.vy;
				hitY = true;
			}

			if (hitX || hitY) {
				st.ci = (st.ci + 1) % hues.length;
				const tol = Math.max(1.5, s.h * 0.08);
				const nearY = st.y <= tol || st.y + bh >= s.h - tol;
				const nearX = st.x <= tol || st.x + bw >= s.w - tol;
				if ((hitX && nearY) || (hitY && nearX)) st.flash = 1;
				scuffs.push([hitX ? (st.x <= 0 ? 0 : s.w - 1) : st.x + bw / 2, hitY ? (st.y <= 0 ? 0 : s.h - 1) : st.y + bh / 2, 0]);
				if (scuffs.length > 18) scuffs.shift();
			}
			st.flash *= 0.9;
			s.out = st.flash;

			const hue = hues[st.ci];
			const [cr, cg, cb] = hsl(hue, s.v.sat, 58);
			const [lr, lg, lb] = hsl(hue, s.v.sat * 0.55, 90);
			const [dr, dg, db] = hsl(hue, s.v.sat, 34);
			const [er, eg, eb] = hsl(s.v.hue2, s.v.sat * 0.3, 40);

			for (let i = 0; i < burn.length; i++) {
				burn[i] *= 0.9982;
				const b = burn[i];
				if (b < 0.02) continue;
				plot(s, i % s.w, (i / s.w) | 0, er, eg, eb, Math.min(0.42, b) * 0.6);
			}

			for (let k = scuffs.length - 1; k >= 0; k--) {
				const sc = scuffs[k];
				sc[2] += 1;
				if (sc[2] > 46) {
					scuffs.splice(k, 1);
					continue;
				}
				const life = 1 - sc[2] / 46;
				const vertical = sc[0] <= 0 || sc[0] >= s.w - 1;
				for (let d = -3; d <= 3; d++) {
					plot(s, sc[0] + (vertical ? 0 : d), sc[1] + (vertical ? d : 0), lr, lg, lb, life * 0.5 * (1 - Math.abs(d) / 4));
				}
			}

			const ox = (st.x as number) - PAD;
			const oy = (st.y as number) - PAD;
			const gain = 0.0035 * (0.5 + s.v.drift * 0.7);
			for (let y = 0; y < gh; y++) {
				for (let x = 0; x < gw; x++) {
					const px = ox + x;
					const py = oy + y;
					if (px < 0 || py < 0 || px >= s.w || py >= s.h) continue;
					const kind = mark[y * gw + x];
					const bi = (py | 0) * s.w + (px | 0);
					if (kind === 2) {
						const top = y < crown;
						plot(s, px, py, top ? lr : cr, top ? lg : cg, top ? lb : cb, 0.96);
						burn[bi] = Math.min(1, burn[bi] + gain);
					} else if (kind === 1) {
						plot(s, px, py, dr, dg, db, 0.9);
						burn[bi] = Math.min(1, burn[bi] + gain * 0.6);
					} else {
						const near = halo[y * gw + x];
						if (near) plot(s, px, py, cr, cg, cb, (0.3 / near) * (0.55 + st.flash * 0.85));
					}
				}
			}

			if (st.flash > 0.02) {
				for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, lr, lg, lb, st.flash * 0.22 * edge(y, -1, s.h + 1, s.h * 0.5));
			}
			blit(s);
		}
	};
}
