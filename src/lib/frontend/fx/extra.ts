import { blit, clear, hsl, plot, stamp, type FxProgram, type FxScene } from './engine.js';
import type { Mask } from './sprites.js';
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
			for (let y = 0; y < s.h; y += chunk) {
				for (let x = 0; x < s.w; x += chunk) {
					const a = s.rnd();
					if (a > amount) continue;
					for (let j = 0; j < chunk; j++) for (let k = 0; k < chunk; k++) plot(s, x + k, y + j, r, g, b, a * 0.5);
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
		p[i * P + 1] = sc.rnd();
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
			const cx = s.w * 0.5;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o] += (0.09 + p[o + 1] * 0.07) * s.v.speed * s.v.dir;
				p[o + 1] -= 0.004 * p[o + 2];
				if (p[o + 1] < 0) p[o + 1] = 1;
				const width = s.w * 0.06 + p[o + 1] * s.w * 0.38;
				const x = cx + Math.cos(p[o]) * width + s.v.tilt * (1 - p[o + 1]) * s.w * 0.1;
				const y = s.h - p[o + 1] * s.h;
				const front = Math.sin(p[o]) > 0 ? 1 : 0.4;
				const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.6, 40 + p[o + 1] * 34);
				plot(s, x, y, r, g, b, p[o + 3] * front);
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
					plot(s, p[o] - dx * k * 1.4, p[o + 1] - k * 1.7, r, g, b, p[o + 3] * (1 - t));
				}
			}
			blit(s);
		}
	};
}

/** Chunky tumbling bits in mixed hues. */
export function makeConfetti(rows: number, stride: number, hues: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * sc.w;
		p[i * P + 1] = -sc.rnd() * sc.h;
		p[i * P + 2] = 0.3 + sc.rnd() * 0.8;
		p[i * P + 3] = sc.rnd() * Math.PI * 2;
		p[i * P + 4] = sc.rnd();
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
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.16 * p[o + 2];
				p[o] += Math.sin(p[o + 3]) * 0.5 * s.v.drift + s.v.tilt * 0.3;
				p[o + 1] += p[o + 2] * s.v.speed * 1.2;
				if (p[o + 1] > s.h + 2) spawn(s, i);
				const [r, g, b] = hsl(s.v.hue + p[o + 4] * hues, s.v.sat, 62);
				const flat = Math.abs(Math.cos(p[o + 3]));
				const wide = 1 + Math.round(flat * 2);
				const tall = 1 + Math.round((1 - flat) * 2);
				for (let dy = 0; dy < tall; dy++) for (let dx = 0; dx < wide; dx++) plot(s, p[o] + dx, p[o + 1] + dy, r, g, b, 0.95 - dy * 0.12);
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
				p[i * P + 2] = 3 + sc.rnd() * 7;
				p[i * P + 3] = sc.rnd() * Math.PI * 2;
				p[i * P + 4] = sc.rnd() * Math.PI * 2;
			});
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * s.v.speed;
				const shine = Math.max(0, Math.sin(p[o + 3]));
				const [r, g, b] = hsl(s.v.hue + shine * 40, s.v.sat, 60 + shine * 34);
				const len = p[o + 2];
				const a = Math.cos(p[o + 4]);
				const bq = Math.sin(p[o + 4]);
				for (let k = -len; k <= len; k++) {
					plot(s, p[o] + a * k, p[o + 1] + bq * k, r, g, b, shine * 0.8 * (1 - Math.abs(k) / len));
					if (crack) plot(s, p[o] - bq * k * 0.5, p[o + 1] + a * k * 0.5, r, g, b, shine * 0.4);
				}
			}
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
					const fade = Math.sin(u * Math.PI);
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
	o: { fall: number; sway: number; tumble: number; wind: number; light: number; spread: number }
): FxProgram {
	const place = (sc: FxScene, i: number, fresh: boolean) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * sc.w;
		p[i * P + 1] = fresh ? (o.fall > 0 ? -m.h : sc.h + m.h) : sc.rnd() * sc.h;
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
		},
		frame(s) {
			clear(s);
			const wind = o.wind * s.v.drift * s.v.dir;
			for (let i = 0; i < s.n; i++) {
				const k = i * P;
				const p = s.parts;
				p[k + 3] += o.tumble * (0.4 + p[k + 2]);
				p[k] += wind * p[k + 2] + Math.sin(p[k + 3] * 0.5) * o.sway;
				p[k + 1] += o.fall * p[k + 2] * s.v.speed;
				if (o.fall > 0 ? p[k + 1] > s.h + m.h : p[k + 1] < -m.h) place(s, i, true);
				if (p[k] > s.w + m.w) p[k] = -m.w;
				if (p[k] < -m.w) p[k] = s.w + m.w;
				const [r, g, b] = hsl(s.v.hue + p[k + 5] * o.spread, s.v.sat, o.light);
				const squash = Math.abs(Math.cos(p[k + 3])) * 0.75 + 0.25;
				stamp(s, m, p[k], p[k + 1], r, g, b, p[k + 4] * 0.9, o.tumble > 0 ? squash : 1);
			}
			blit(s);
		}
	};
}

/** Pixel cumulus along the top edge, drifting. Seeded lumps, not drawn paths. */
export function clouds(s: FxScene, count: number, light: number, drift: number) {
	const r0 = mulberry32(s.v.seed + 4242);
	const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.28, light);
	const [dr, dg, db] = hsl(s.v.hue, s.v.sat * 0.34, light * 0.62);
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

/** A dark disc crossing a bright corona — an actual eclipse. */
export function makeEclipse(rows: number): FxProgram {
	return {
		rows,
		stride: 0.5,
		init(s) {
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * P] = s.rnd() * s.w;
				p[i * P + 1] = s.rnd() * s.h;
				p[i * P + 2] = s.rnd() * Math.PI * 2;
			}
		},
		frame(s) {
			clear(s);
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * P + 2] += 0.03;
				const tw = 0.4 + 0.6 * Math.sin(p[i * P + 2]);
				plot(s, p[i * P], p[i * P + 1], 210, 220, 255, tw * 0.5);
			}
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.1;
			const cy = s.h * 0.44;
			const rad = s.h * 0.3;
			const cover = 0.72 + 0.26 * Math.sin(s.t * 0.008 * s.v.speed);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat, 74);
			for (let ring = 0; ring < 26; ring++) {
				const rr = rad * (1 + ring * 0.07);
				const a = (1 - ring / 26) * 0.3 * cover;
				for (let k = 0; k < 360; k += 4) {
					const th = (k * Math.PI) / 180;
					const flare = 0.7 + 0.3 * Math.sin(th * 6 + s.t * 0.05);
					plot(s, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, cr, cg, cb, a * flare);
				}
			}
			for (let y = -rad; y <= rad; y++) {
				for (let x = -rad; x <= rad; x++) {
					if (x * x + y * y > rad * rad) continue;
					const i = (((cy + y) | 0) * s.w + ((cx + x * cover) | 0)) * 4;
					if (i < 0 || i >= s.px.length) continue;
					s.px[i] = s.px[i + 1] = s.px[i + 2] = 0;
					s.px[i + 3] = 235;
				}
			}
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
			const mid = s.h * 0.52;
			const amp = s.h * 0.36;
			const head = ((s.t * 0.9 * s.v.speed) | 0) % s.w;
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
