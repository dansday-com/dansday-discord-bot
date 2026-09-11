import { blit, clear, hsl, plot, type FxProgram, type FxScene } from './engine.js';

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
				const centre = ((t + off) % 1.4) * s.w * 1.4 - s.w * 0.2;
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

/** Rings expanding from the centre on a heartbeat. */
export function makeRings(rows: number, count: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const cx = s.w / 2;
			const cy = s.h / 2;
			const [r, g, b] = hsl(s.v.hue, s.v.sat, 62);
			for (let i = 0; i < count; i++) {
				const ph = (s.t * 0.014 * s.v.speed + i / count) % 1;
				const rad = ph * s.w * 0.6;
				const a = (1 - ph) * 0.7;
				for (let k = 0; k < 360; k += 3) {
					const rr = (k * Math.PI) / 180;
					plot(s, cx + Math.cos(rr) * rad, cy + Math.sin(rr) * rad * (s.h / s.w) * 1.6, r, g, b, a);
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

/** Stacked sine swells rolling across, crest picked out in foam. */
export function makeWaves(rows: number, layers: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const t = s.t * 0.03 * s.v.speed;
			for (let l = 0; l < layers; l++) {
				const f = l / layers;
				const [r, g, b] = hsl(s.v.hue + f * 20, s.v.sat, 28 + f * 34);
				const base = s.h * (0.42 + f * 0.2);
				const amp = s.h * (0.16 - f * 0.03);
				for (let x = 0; x < s.w; x++) {
					const u = x / s.w;
					const y = base + Math.sin(u * (5 + l * 2) + t * (1 + f) * s.v.dir) * amp;
					for (let k = y; k < s.h; k++) plot(s, x, k, r, g, b, 0.16);
					const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.5, 92);
					plot(s, x, y, fr, fg, fb, 0.6);
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

/** Things that float upward and pop or fade at the top. */
export function makeRise(rows: number, stride: number, o: { wobble: number; size: number; light: number }): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * P] = sc.rnd() * sc.w;
		p[i * P + 1] = sc.h + sc.rnd() * 6;
		p[i * P + 2] = 0.25 + sc.rnd() * 0.8;
		p[i * P + 3] = sc.rnd() * Math.PI * 2;
		p[i * P + 4] = 0.45 + sc.rnd() * 0.55;
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
				const o2 = i * P;
				const p = s.parts;
				p[o2 + 3] += 0.07;
				p[o2] += Math.sin(p[o2 + 3]) * o.wobble * s.v.drift;
				p[o2 + 1] -= p[o2 + 2] * s.v.speed;
				if (p[o2 + 1] < -2) spawn(s, i);
				const [r, g, b] = hsl(s.v.hue + (s.v.hue2 - s.v.hue) * p[o2 + 2], s.v.sat, o.light);
				const a = p[o2 + 4] * Math.min(1, p[o2 + 1] / s.h + 0.2);
				plot(s, p[o2], p[o2 + 1], r, g, b, a);
				if (o.size > 1) {
					plot(s, p[o2] + 1, p[o2 + 1], r, g, b, a * 0.6);
					plot(s, p[o2], p[o2 + 1] + 1, r, g, b, a * 0.6);
					plot(s, p[o2] + 1, p[o2 + 1] + 1, r, g, b, a * 0.35);
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
				plot(s, p[o], p[o + 1], r, g, b, 0.95);
				if (flat > 0.5) plot(s, p[o] + 1, p[o + 1], r, g, b, 0.95);
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
