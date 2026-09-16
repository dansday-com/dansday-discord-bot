import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Flock = { cohere: number; align: number; sep: number; roost: number[]; poles: number[][] };

function flockIdent(s: FxScene): Flock {
	const r = mulberry32(s.v.seed + 1240);
	const cohere = 0.0016 + r() * 0.003;
	const align = 0.04 + r() * 0.07;
	const sep = 1.6 + r() * 1.8;
	const roost = [0.2 + r() * 0.6, 0.25 + r() * 0.4];
	const poles: number[][] = [];
	for (let i = 0; i < 4; i++) poles.push([r(), 0.3 + r() * 0.4]);
	return { cohere, align, sep, roost, poles };
}

export function makeSwarm(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.9,
		init(s) {
			const id = flockIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h * 0.7;
				const th = s.rnd() * Math.PI * 2;
				s.parts[o + 2] = Math.cos(th) * 0.6;
				s.parts[o + 3] = Math.sin(th) * 0.4;
				s.parts[o + 4] = 0.5 + s.rnd() * 0.5;
				s.parts[o + 5] = s.rnd();
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Flock;
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.3, 14);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.4, 72);

			const dusk = s.h * 0.82;
			for (let y = dusk; y < s.h; y++) {
				const f = (y - dusk) / (s.h - dusk);
				for (let x = 0; x < s.w; x++) paint(s, x, y, br, bg, bb, 0.6 + f * 0.35);
			}
			for (const [px, ph] of id.poles) {
				const x = px * s.w;
				const top = dusk - ph * s.h * 0.5;
				for (let y = top; y < dusk; y++) paint(s, x, y, br, bg, bb, 0.95);
				for (let k = 0; k < 3; k++) paint(s, x - 1 + k, top, br, bg, bb, 0.95);
			}

			const rx = id.roost[0] * s.w + Math.sin(s.t * 0.008 * s.v.speed) * s.w * 0.22 * s.v.dir;
			const ry = id.roost[1] * s.h + Math.cos(s.t * 0.011 * s.v.speed) * s.h * 0.14;

			let packed = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				let ax = 0;
				let ay = 0;
				let cx = 0;
				let cy = 0;
				let vx = 0;
				let vy = 0;
				let seen = 0;
				for (let j = 0; j < s.n; j += 2) {
					if (j === i) continue;
					const q = j * P;
					const dx = p[q] - p[o];
					const dy = p[q + 1] - p[o + 1];
					const d2 = dx * dx + dy * dy;
					if (d2 > 90) continue;
					seen++;
					cx += p[q];
					cy += p[q + 1];
					vx += p[q + 2];
					vy += p[q + 3];
					if (d2 < id.sep * id.sep && d2 > 0.0001) {
						const inv = 1 / d2;
						ax -= dx * inv * 0.9;
						ay -= dy * inv * 0.9;
					}
				}
				packed += seen;
				if (seen > 0) {
					ax += (cx / seen - p[o]) * id.cohere;
					ay += (cy / seen - p[o + 1]) * id.cohere;
					ax += (vx / seen - p[o + 2]) * id.align;
					ay += (vy / seen - p[o + 3]) * id.align;
				}
				ax += (rx - p[o]) * 0.0014;
				ay += (ry - p[o + 1]) * 0.0022;
				if (p[o + 1] > dusk - 4) ay -= 0.06;

				p[o + 2] += ax;
				p[o + 3] += ay;
				const sp = Math.hypot(p[o + 2], p[o + 3]);
				const max = 0.85 * s.v.speed * (0.7 + p[o + 4] * 0.5);
				if (sp > max) {
					p[o + 2] = (p[o + 2] / sp) * max;
					p[o + 3] = (p[o + 3] / sp) * max;
				}
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o + 1] < -2) p[o + 1] = 2;

				p[o + 5] += sp * 0.5;
				const flap = Math.sin(p[o + 5]);
				const a = 0.85 * edge(p[o], -2, s.w + 2, s.w * 0.1);
				const dirx = sp > 0.001 ? p[o + 2] / sp : 1;
				const diry = sp > 0.001 ? p[o + 3] / sp : 0;
				paint(s, p[o], p[o + 1], br, bg, bb, a);
				const span = 1 + Math.abs(flap) * 1.6;
				for (let k = 1; k <= span; k++) {
					const fx = -diry * k;
					const fy = dirx * k * (flap > 0 ? 1 : -1) * 0.6;
					const ka = a * (1 - k / (span + 1));
					paint(s, p[o] + fx, p[o + 1] + fy * 0.6 - Math.abs(flap) * 0.4, br, bg, bb, ka);
					paint(s, p[o] - fx, p[o + 1] - fy * 0.6 - Math.abs(flap) * 0.4, br, bg, bb, ka);
				}
				if (p[o + 1] < s.h * 0.3) plot(s, p[o], p[o + 1], wr, wg, wb, a * 0.12);
			}
			s.out = Math.min(1, Math.max(0, (packed / s.n - 3) / 18));
			blit(s);
		}
	};
}

type Bloom = { bells: number[][]; period: number; motes: number };

function jellyIdent(s: FxScene): Bloom {
	const r = mulberry32(s.v.seed + 2350);
	const bells: number[][] = [];
	for (let i = 0; i < 5; i++) bells.push([r(), r(), 0.4 + r() * 0.7, r() * Math.PI * 2, 0.5 + r() * 0.6]);
	const period = 44 + r() * 42;
	const motes = 0.3 + r() * 0.5;
	return { bells, period, motes };
}

export function makeJelly(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = jellyIdent(s);
			(s as any).id = id;
			(s as any).y = id.bells.map((b) => b[1]);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.2 + s.rnd() * 0.6;
				s.parts[o + 3] = s.rnd() * Math.PI * 2;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Bloom;
			const ys = (s as any).y as number[];
			const [dr, dg, db] = hsl(s.v.hue, s.v.sat * 0.7, 10);
			const [br2, bg2, bb2] = hsl(s.v.hue2, s.v.sat, 70);
			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat * 0.8, 58);

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) paint(s, x, y, dr, dg, db, 0.3 + f * 0.5);
			}
			const shaftX = s.w * 0.5 + Math.sin(s.t * 0.006) * s.w * 0.1;
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const half = s.w * (0.04 + f * 0.1);
				for (let x = shaftX - half; x <= shaftX + half; x++) {
					const e = 1 - Math.abs(x - shaftX) / (half + 0.5);
					plot(s, x, y, br2, bg2, bb2, e * e * (1 - f) * 0.07);
				}
			}

			let pump = 0;
			for (let bi = 0; bi < id.bells.length; bi++) {
				const b = id.bells[bi];
				const per = id.period * b[4];
				const ph = ((s.t * s.v.speed + b[3] * per) % per) / per;
				const thrust = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
				const squeeze = thrust;
				pump = Math.max(pump, thrust);
				ys[bi] -= thrust * 0.5 * b[2] * s.v.speed;
				ys[bi] += 0.06 * (1 - thrust) * 0.5;
				if (ys[bi] < -0.25) ys[bi] = 1.25;
				if (ys[bi] > 1.3) ys[bi] = -0.2;

				const cx = b[0] * s.w + Math.sin(s.t * 0.01 + b[3]) * s.w * 0.04 * s.v.drift * s.v.dir;
				const cy = ys[bi] * s.h;
				const rw = s.w * 0.055 * b[2] * (1 + squeeze * 0.22);
				const rh = s.h * 0.1 * b[2] * (1 - squeeze * 0.3);
				const a = edge(cy, -s.h * 0.3, s.h * 1.3, s.h * 0.3);
				if (a <= 0.01) continue;

				for (let y = -rh; y <= 0; y++) {
					const f = -y / rh;
					const half = rw * Math.sqrt(Math.max(0, 1 - f * f * 0.85));
					for (let x = -half; x <= half; x++) {
						const e = 1 - Math.abs(x) / (half + 0.4);
						plot(s, cx + x, cy + y, br2, bg2, bb2, (0.1 + e * 0.2) * a);
					}
					plot(s, cx - half, cy + y, br2, bg2, bb2, 0.5 * a);
					plot(s, cx + half, cy + y, br2, bg2, bb2, 0.5 * a);
				}
				for (let x = -rw; x <= rw; x++) plot(s, cx + x, cy, br2, bg2, bb2, 0.45 * a);

				for (let k = 0; k < 5; k++) {
					const off = (k / 4 - 0.5) * rw * 1.5;
					const len = rh * (1.8 + (k % 2) * 0.9);
					for (let q = 0; q < len; q++) {
						const f = q / len;
						const lag = Math.sin(s.t * 0.06 * s.v.speed - q * 0.28 + b[3] + k) * f * rw * 0.55;
						const drag = thrust * f * f * 2.2;
						plot(s, cx + off + lag, cy + q + drag, tr, tg, tb, (1 - f) * 0.5 * a);
					}
				}
				for (let y = -rh; y <= rh * 0.4; y++)
					for (let x = -rw * 1.6; x <= rw * 1.6; x++) {
						const d = Math.hypot(x / (rw * 1.6), y / (rh * 1.4));
						if (d > 1) continue;
						plot(s, cx + x, cy + y, br2, bg2, bb2, (1 - d) * (1 - d) * 0.12 * a);
					}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * p[o + 2];
				p[o + 1] -= 0.06 * p[o + 2] * id.motes;
				p[o] += Math.sin(p[o + 3]) * 0.1 * s.v.drift;
				if (p[o + 1] < -1) {
					p[o + 1] = s.h + 1;
					p[o] = s.rnd() * s.w;
				}
				const tw = 0.4 + 0.6 * Math.sin(p[o + 3] * 1.3);
				plot(s, p[o], p[o + 1], br2, bg2, bb2, tw * 0.35 * edge(p[o + 1], -1, s.h + 1, s.h * 0.2));
			}
			s.out = pump;
			blit(s);
		}
	};
}

type Field = { blades: number[][]; gustPeriod: number; horizon: number; seeds: number };

function meadowIdent(s: FxScene): Field {
	const r = mulberry32(s.v.seed + 3460);
	const blades: number[][] = [];
	for (let i = 0; i < 64; i++) blades.push([r(), r(), r(), r()]);
	const gustPeriod = 120 + r() * 110;
	const horizon = 0.3 + r() * 0.16;
	const seeds = 0.3 + r() * 0.5;
	return { blades, gustPeriod, horizon, seeds };
}

export function makeMeadow(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = meadowIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.3 + s.rnd() * 0.7;
				s.parts[o + 3] = s.rnd() * Math.PI * 2;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Field;
			const horizon = id.horizon * s.h;
			const [gr, gg, gb] = hsl(s.v.hue, s.v.sat * 0.6, 26);
			const [lr, lg, lb] = hsl(s.v.hue2, s.v.sat * 0.7, 62);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.5, 88);

			for (let y = 0; y < horizon; y++) {
				const f = y / horizon;
				for (let x = 0; x < s.w; x++) plot(s, x, y, lr, lg, lb, (1 - f) * 0.1);
			}

			const gust = ((s.t * s.v.speed) % id.gustPeriod) / id.gustPeriod;
			const front = gust * (s.w + s.w * 0.9) - s.w * 0.45;

			const count = Math.max(24, (s.w * 1.1) | 0);
			const bstream = mulberry32(s.v.seed + 8888);
			for (let i = 0; i < count; i++) {
				const b = id.blades[i % 64];
				const jx = bstream();
				const x0 = ((i / count) * s.w + (jx - 0.5) * (s.w / count)) % s.w;
				const depth = b[1];
				const base = horizon + depth * (s.h - horizon) * 1.02;
				if (base > s.h + 2) continue;
				const len = (s.h - horizon) * (0.12 + b[0] * 0.3) * (0.5 + depth * 0.7);
				const reach = (x0 - front) / (s.w * 0.28);
				const hit = Math.exp(-reach * reach);
				const bend = (Math.sin(s.t * 0.04 * s.v.speed + b[2] * 9) * 0.12 + hit * (0.55 + b[3] * 0.35)) * s.v.dir * (0.6 + s.v.drift * 0.6);
				const shade = 0.4 + depth * 0.6;
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const x = x0 + bend * f * f * len * 0.9;
					const y = base - k;
					const lit = 0.5 + 0.5 * Math.max(0, bend * s.v.dir);
					const cr = gr * (1 - f * 0.3) + lr * f * 0.3 * lit;
					const cg2 = gg * (1 - f * 0.3) + lg * f * 0.3 * lit;
					const cb2 = gb * (1 - f * 0.3) + lb * f * 0.3 * lit;
					paint(s, x, y, cr, cg2, cb2, (0.55 + f * 0.4) * shade);
				}
				if (b[3] > 0.82) {
					const hx = x0 + bend * len * 0.9;
					const hy = base - len;
					for (let q = 0; q < 5; q++) {
						const a2 = (q / 5) * Math.PI * 2;
						paint(s, hx + Math.cos(a2) * 1.2, hy + Math.sin(a2) * 1.2, sr, sg, sb, 0.6 * shade);
					}
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const reach = (p[o] - front) / (s.w * 0.3);
				const hit = Math.exp(-reach * reach);
				p[o + 3] += 0.04;
				p[o] += (0.1 + hit * 0.8) * s.v.dir * s.v.drift * p[o + 2];
				p[o + 1] += Math.sin(p[o + 3]) * 0.1 - 0.04 * p[o + 2] - hit * 0.1;
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o + 1] < -2) p[o + 1] = s.h * 0.5 + s.rnd() * s.h * 0.5;
				if (p[o + 1] > s.h + 2) p[o + 1] = horizon;
				const a = 0.55 * edge(p[o], -2, s.w + 2, s.w * 0.12) * edge(p[o + 1], -2, s.h + 2, s.h * 0.15);
				plot(s, p[o], p[o + 1], sr, sg, sb, a);
				plot(s, p[o] - 1, p[o + 1], sr, sg, sb, a * 0.3);
				plot(s, p[o], p[o + 1] - 1, sr, sg, sb, a * 0.3);
			}
			s.out = Math.max(0, Math.sin(gust * Math.PI));
			blit(s);
		}
	};
}
