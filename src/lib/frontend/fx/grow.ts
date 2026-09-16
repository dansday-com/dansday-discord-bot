import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, backdrop, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Nutrient = { spots: number[][]; decay: number; branch: number };

function nutrientIdent(s: FxScene, salt: number, count: number): Nutrient {
	const r = mulberry32(s.v.seed + s.v.salt + salt);
	const spots: number[][] = [];
	for (let i = 0; i < count; i++) spots.push([0.1 + r() * 0.8, 0.1 + r() * 0.8, 0.5 + r() * 0.5]);
	return { spots, decay: 0.986 + r() * 0.011, branch: 0.1 + r() * 0.16 };
}

function field(s: FxScene, spots: number[][], x: number, y: number, out: number[]): number[] {
	let gx = 0;
	let gy = 0;
	let near = 0;
	for (const [nx, ny, mass] of spots) {
		const dx = nx * s.w - x;
		const dy = ny * s.h - y;
		const d2 = dx * dx + dy * dy + 12;
		const pull = (mass * s.w) / d2;
		gx += dx * pull;
		gy += dy * pull;
		near += pull;
	}
	out[0] = gx;
	out[1] = gy;
	out[2] = near;
	return out;
}

export function makeMycelium(rows: number): FxProgram {
	return {
		rows,
		stride: 0.22,
		init(s) {
			const id = nutrientIdent(s, 3301, 5);
			(s as any).id = id;
			(s as any).mat = new Float32Array(s.w * s.h);
			(s as any).g = [0, 0, 0];
			(s as any).food = id.spots.map((p) => [p[0], p[1], p[2]]);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const th = s.rnd() * Math.PI * 2;
				s.parts[o] = s.w * 0.5 + Math.cos(th) * s.w * 0.06;
				s.parts[o + 1] = s.h * 0.5 + Math.sin(th) * s.h * 0.06;
				s.parts[o + 2] = Math.cos(th);
				s.parts[o + 3] = Math.sin(th);
				s.parts[o + 4] = 1;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Nutrient;
			const mat = (s as any).mat as Float32Array;
			const food = (s as any).food as number[][];
			const p = s.parts;
			const [mr, mg, mb] = hsl(s.v.hue, s.v.sat * 0.5, 62);
			const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat, 60);

			for (let i = 0; i < mat.length; i++) mat[i] *= id.decay;

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				if (p[o + 4] < 0.02) {
					const src = food[(i + s.t) % food.length];
					p[o] = src[0] * s.w;
					p[o + 1] = src[1] * s.h;
					const th = s.rnd() * Math.PI * 2;
					p[o + 2] = Math.cos(th);
					p[o + 3] = Math.sin(th);
					p[o + 4] = 1;
					continue;
				}
				const [gx, gy, near] = field(s, food, p[o], p[o + 1], (s as any).g);
				const gl = Math.hypot(gx, gy) + 0.0001;
				const wob = Math.sin(p[o + 5] + s.t * 0.05) * 0.5 * s.v.drift;
				p[o + 2] += (gx / gl) * 0.22 + Math.cos(p[o + 5]) * wob * 0.1;
				p[o + 3] += (gy / gl) * 0.22 + Math.sin(p[o + 5]) * wob * 0.1;
				const sp = Math.hypot(p[o + 2], p[o + 3]) + 0.0001;
				const rate = 0.34 * s.v.speed;
				p[o + 2] = (p[o + 2] / sp) * rate;
				p[o + 3] = (p[o + 3] / sp) * rate;
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				p[o + 5] += 0.07;

				if (p[o] < 1 || p[o] > s.w - 2 || p[o + 1] < 1 || p[o + 1] > s.h - 2) {
					p[o + 4] = 0;
					continue;
				}
				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				mat[cell] = Math.min(1.6, mat[cell] + 0.5);
				p[o + 4] -= 0.0016 + (near > 0.9 ? 0 : 0.004);

				for (const f of food) {
					const dx = f[0] * s.w - p[o];
					const dy = f[1] * s.h - p[o + 1];
					if (dx * dx + dy * dy < 9 && f[2] > 0.05) {
						f[2] -= 0.003;
						p[o + 4] = Math.min(1, p[o + 4] + 0.1);
					}
				}
			}

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const m = mat[y * s.w + x];
					if (m < 0.02) continue;
					const a = Math.min(0.85, m * 0.6);
					plot(s, x, y, mr, mg, mb, a);
					if (m > 0.9) plot(s, x, y, fr, fg, fb, (m - 0.9) * 0.5);
				}
			}
			let ripe = 0;
			for (const f of food) {
				f[2] = Math.min(1, f[2] + 0.004);
				ripe += f[2];
				if (f[2] < 0.04) continue;
				const cx = f[0] * s.w;
				const cy = f[1] * s.h;
				const rad = 1.5 + f[2] * 3;
				for (let dy = -rad; dy <= rad; dy++) {
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > rad) continue;
						plot(s, cx + dx, cy + dy, fr, fg, fb, (1 - d / rad) * 0.5 * f[2]);
					}
				}
			}
			s.out = Math.min(1, ripe / Math.max(1, food.length));
			blit(s);
		}
	};
}

export function makeCoral(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.16,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 4127);
			const bases: number[][] = [];
			for (let i = 0; i < 5; i++) bases.push([0.08 + r() * 0.84, 0.3 + r() * 0.5, r() * 6.28]);
			(s as any).id = { bases, flow: 0.4 + r() * 0.5 };
			(s as any).rock = new Float32Array(s.w * s.h);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const b = bases[i % bases.length];
				s.parts[o] = b[0] * s.w;
				s.parts[o + 1] = s.h - 1;
				s.parts[o + 2] = 0;
				s.parts[o + 3] = -0.2;
				s.parts[o + 4] = 0.3 + s.rnd() * 0.7;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { bases: number[][]; flow: number };
			const rock = (s as any).rock as Float32Array;
			const p = s.parts;
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.6, 16);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat, 58);
			const [br2, bg2, bb2] = hsl(s.v.hue, s.v.sat * 0.2, 78);

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const shade = 0.4 + f * 0.6;
				for (let x = 0; x < s.w; x++) paint(s, x, y, wr * shade, wg * shade, wb, 0.24 + f * f * 0.68);
			}

			const cur = Math.sin(s.t * 0.014 * s.v.speed) * id.flow * s.v.dir;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const b = id.bases[i % id.bases.length];
				const reach = b[1] * s.h;
				if (p[o + 1] < s.h - reach || p[o] < 1 || p[o] > s.w - 2) {
					p[o] = b[0] * s.w + (s.rnd() - 0.5) * 3;
					p[o + 1] = s.h - 1;
					p[o + 4] = 0.3 + s.rnd() * 0.7;
					continue;
				}
				const sway = Math.sin(p[o + 5] + s.t * 0.03) * 0.5;
				p[o + 2] = cur * 0.5 + sway * s.v.drift * 0.4;
				p[o + 3] = -0.16 * s.v.speed * p[o + 4];
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				p[o + 5] += 0.04;
				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				if (cell >= 0 && cell < rock.length) rock[cell] = Math.min(1.4, rock[cell] + 0.42);
			}

			let grown = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const m = rock[y * s.w + x];
					if (m < 0.05) continue;
					grown += m;
					const age = Math.min(1, m / 1.4);
					const live = 1 - age;
					paint(s, x, y, cr * live + br2 * age, cg * live + bg2 * age, cb * live + bb2 * age, Math.min(0.95, 0.3 + m * 0.6));
				}
			}
			for (let i = 0; i < s.n; i += 2) {
				const o = i * P;
				plot(s, p[o], p[o + 1], cr, cg, cb, 0.5 * p[o + 4]);
			}
			for (let k = 0; k < 14; k++) {
				const x = (((k * 37 + s.t * 0.4 * s.v.speed * s.v.dir) % s.w) + s.w) % s.w;
				const y = (k * 11 + Math.sin(s.t * 0.02 + k) * 4) % s.h;
				plot(s, x, y, 255, 255, 255, 0.12 * edge(y, 0, s.h, s.h * 0.2));
			}
			s.out = Math.min(1, grown / (s.w * s.h * 0.1));
			blit(s);
		}
	};
}

export function makeLichen(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 5519);
			const seeds: number[][] = [];
			for (let i = 0; i < 7; i++) seeds.push([0.08 + r() * 0.84, 0.08 + r() * 0.84, r(), 0.4 + r() * 0.8]);
			(s as any).id = { seeds, grain: 0.3 + r() * 0.5 };
			(s as any).age = new Float32Array(s.w * s.h);
			(s as any).own = new Int8Array(s.w * s.h).fill(-1);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { seeds: number[][]; grain: number };
			const age = (s as any).age as Float32Array;
			const own = (s as any).own as Int8Array;
			const [rr, rg, rb] = hsl(s.v.hue2, s.v.sat * 0.25, 30);

			const rx = s.w * 0.5;
			const ry = s.h * 0.5;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const n = Math.sin(x * 0.7 + y * 1.3) * Math.cos(x * 0.31 - y * 0.47);
					const g = 1 + n * id.grain * 0.4;
					const d = Math.min(1, Math.hypot((x - rx) / rx, (y - ry) / ry));
					paint(s, x, y, rr * g, rg * g, rb * g, 0.32 + 0.63 * d * d);
				}
			}

			const grow = s.t * 0.09 * s.v.speed;
			const prev = Math.max(0, (s.t - 1) * 0.09 * s.v.speed);
			for (let i = 0; i < id.seeds.length; i++) {
				const sd = id.seeds[i];
				const cx = sd[0] * s.w;
				const cy = sd[1] * s.h;
				const cap = Math.min(s.w, s.h) * 0.44;
				const rad = Math.min(cap, grow * sd[3]);
				const was = Math.min(cap, prev * sd[3]);
				if (rad < 1) continue;
				const lobes = 5 + ((sd[2] * 6) | 0);
				for (let a = 0; a < 360; a += 2) {
					const th = (a * Math.PI) / 180;
					const wob = 1 + Math.sin(th * lobes + sd[2] * 6.28) * 0.16;
					const from = Math.max(0, was * wob - 1.5);
					const to = rad * wob;
					for (let d = from; d <= to; d += 0.6) {
						const x = (cx + Math.cos(th) * d) | 0;
						const y = (cy + Math.sin(th) * d) | 0;
						if (x < 0 || y < 0 || x >= s.w || y >= s.h) break;
						const cell = y * s.w + x;
						if (own[cell] === -1) own[cell] = i;
						else if (own[cell] !== i) break;
					}
				}
			}
			let taken = 0;
			for (let c = 0; c < own.length; c++)
				if (own[c] >= 0) {
					taken++;
					age[c] = Math.min(1, age[c] + 0.0022);
				}

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const cell = y * s.w + x;
					const o = own[cell];
					if (o < 0) continue;
					const a = age[cell];
					const hue = s.v.hue + o * 11;
					const [lr, lg, lb] = hsl(hue, s.v.sat * (0.4 + (1 - a) * 0.5), 38 + (1 - a) * 26);
					paint(s, x, y, lr, lg, lb, 0.9);
					if (a < 0.12) plot(s, x, y, lr, lg, lb, 0.5);
				}
			}
			s.out = Math.min(1, taken / (own.length * 0.55));
			blit(s);
		}
	};
}

export function makeAnthill(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 6113);
			const nest = [0.15 + r() * 0.7, 0.15 + r() * 0.7];
			const piles: number[][] = [];
			for (let i = 0; i < 4; i++) piles.push([0.1 + r() * 0.8, 0.1 + r() * 0.8]);
			(s as any).id = { nest, piles, evap: 0.975 + r() * 0.018 };
			(s as any).food = new Float32Array(4).fill(1);
			(s as any).ph = new Float32Array(s.w * s.h);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = nest[0] * s.w;
				s.parts[o + 1] = nest[1] * s.h;
				const th = s.rnd() * 6.28;
				s.parts[o + 2] = Math.cos(th);
				s.parts[o + 3] = Math.sin(th);
				s.parts[o + 4] = 0;
				s.parts[o + 5] = th;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { nest: number[]; piles: number[][]; evap: number };
			const food = (s as any).food as Float32Array;
			const ph = (s as any).ph as Float32Array;
			const p = s.parts;
			const [gr, gg, gb] = hsl(s.v.hue2, s.v.sat * 0.3, 13);
			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat * 0.8, 52);
			const [ar, ag, ab] = hsl(s.v.hue, s.v.sat * 0.4, 80);

			backdrop(s, gr, gg, gb, 0.94, 0.34);
			for (let i = 0; i < ph.length; i++) ph[i] *= id.evap;

			const nx = id.nest[0] * s.w;
			const ny = id.nest[1] * s.h;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const carry = p[o + 4] > 0.5;
				let bx = 0;
				let by = 0;
				if (carry) {
					bx = nx - p[o];
					by = ny - p[o + 1];
				} else {
					let best = 0;
					for (let a = -2; a <= 2; a++) {
						const th = p[o + 5] + a * 0.5;
						const sx = (p[o] + Math.cos(th) * 3) | 0;
						const sy = (p[o + 1] + Math.sin(th) * 3) | 0;
						if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
						const v = ph[sy * s.w + sx];
						if (v > best) {
							best = v;
							bx = Math.cos(th);
							by = Math.sin(th);
						}
					}
					if (best < 0.02) {
						bx = Math.cos(p[o + 5]);
						by = Math.sin(p[o + 5]);
					}
				}
				const want = Math.atan2(by, bx);
				let turn = want - p[o + 5];
				while (turn > Math.PI) turn -= Math.PI * 2;
				while (turn < -Math.PI) turn += Math.PI * 2;
				p[o + 5] += turn * 0.3 + (s.rnd() - 0.5) * 0.5 * s.v.drift;
				const rate = 0.5 * s.v.speed;
				p[o] += Math.cos(p[o + 5]) * rate;
				p[o + 1] += Math.sin(p[o + 5]) * rate;
				if (p[o] < 1) p[o] = 1;
				if (p[o] > s.w - 2) p[o] = s.w - 2;
				if (p[o + 1] < 1) p[o + 1] = 1;
				if (p[o + 1] > s.h - 2) p[o + 1] = s.h - 2;

				if (carry) {
					const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
					ph[cell] = Math.min(2, ph[cell] + 0.6);
					if (Math.hypot(nx - p[o], ny - p[o + 1]) < 3) p[o + 4] = 0;
				} else {
					for (let k = 0; k < id.piles.length; k++) {
						if (food[k] < 0.05) continue;
						const f = id.piles[k];
						if (Math.hypot(f[0] * s.w - p[o], f[1] * s.h - p[o + 1]) < 3) {
							p[o + 4] = 1;
							food[k] -= 0.004;
							p[o + 5] += Math.PI;
						}
					}
				}
			}

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = ph[y * s.w + x];
					if (v < 0.02) continue;
					plot(s, x, y, tr, tg, tb, Math.min(0.6, v * 0.32));
				}
			}
			for (let k = 0; k < id.piles.length; k++) {
				food[k] = Math.min(1, food[k] + 0.0001);
				if (food[k] < 0.05) continue;
				const cx = id.piles[k][0] * s.w;
				const cy = id.piles[k][1] * s.h;
				for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= 2) plot(s, cx + dx, cy + dy, ar, ag, ab, 0.55 * food[k]);
			}
			for (let dy = -2; dy <= 2; dy++) {
				for (let dx = -2; dx <= 2; dx++) {
					const d = Math.hypot(dx, dy);
					if (d > 2.4) continue;
					paint(s, nx + dx, ny + dy, tr * 0.5, tg * 0.5, tb * 0.5, 0.9);
				}
			}
			let laden = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const carrying = p[o + 4] > 0.5;
				if (carrying) laden++;
				const bright = carrying ? 1 : 0.65;
				paint(s, p[o], p[o + 1], ar * bright, ag * bright, ab * bright, 0.9);
			}
			s.out = Math.min(1, laden / (s.n * 0.055));
			blit(s);
		}
	};
}

export function makeSlime(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.6,
		init(s) {
			const id = nutrientIdent(s, 7321, 4);
			(s as any).id = id;
			(s as any).tr = new Float32Array(s.w * s.h);
			(s as any).food = id.spots.map((q) => [q[0], q[1], q[2], q[2]]);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const sp = id.spots[i % id.spots.length];
				s.parts[o] = sp[0] * s.w;
				s.parts[o + 1] = sp[1] * s.h;
				s.parts[o + 2] = 0;
				s.parts[o + 3] = 0;
				s.parts[o + 4] = 0.5;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Nutrient;
			const tr = (s as any).tr as Float32Array;
			const food = (s as any).food as number[][];
			const p = s.parts;
			const [ar, ag, ab] = hsl(s.v.hue2, s.v.sat * 0.3, 13);
			const [sr, sg, sb] = hsl(s.v.hue, s.v.sat * 0.9, 50);
			const [nr, ng, nb] = hsl(s.v.hue2, s.v.sat, 66);
			const [kr, kg, kb] = hsl(s.v.hue, s.v.sat * 0.3, 26);

			backdrop(s, ar, ag, ab, 0.93, 0.3);

			for (let i = 0; i < tr.length; i++) tr[i] *= id.decay;

			const sense = 4 + s.v.drift * 3;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				let best = -1;
				let bth = p[o + 5];
				for (let a = -1; a <= 1; a++) {
					const th = p[o + 5] + a * 0.7;
					const sx = (p[o] + Math.cos(th) * sense) | 0;
					const sy = (p[o + 1] + Math.sin(th) * sense) | 0;
					if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
					let v = tr[sy * s.w + sx];
					for (const f of food) {
						if (f[2] < 0.04) continue;
						const dx = f[0] * s.w - sx;
						const dy = f[1] * s.h - sy;
						v += (f[2] * 40) / (dx * dx + dy * dy + 20);
					}
					if (v > best) {
						best = v;
						bth = th;
					}
				}
				p[o + 5] = bth + (s.rnd() - 0.5) * 0.28;
				const rate = 0.45 * s.v.speed * (0.55 + p[o + 4] * 0.75);
				p[o] += Math.cos(p[o + 5]) * rate;
				p[o + 1] += Math.sin(p[o + 5]) * rate;
				if (p[o] < 1 || p[o] > s.w - 2) {
					p[o + 5] = Math.PI - p[o + 5];
					p[o] = Math.max(1, Math.min(s.w - 2, p[o]));
				}
				if (p[o + 1] < 1 || p[o + 1] > s.h - 2) {
					p[o + 5] = -p[o + 5];
					p[o + 1] = Math.max(1, Math.min(s.h - 2, p[o + 1]));
				}
				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				tr[cell] = Math.min(2.4, tr[cell] + 0.18 + p[o + 4] * 0.34);
				p[o + 4] = Math.max(0, p[o + 4] - 0.0035);
				for (const f of food) {
					if (f[2] < 0.04) continue;
					const dx = f[0] * s.w - p[o];
					const dy = f[1] * s.h - p[o + 1];
					if (dx * dx + dy * dy < 14) {
						f[2] = Math.max(0, f[2] - 0.0015);
						p[o + 4] = Math.min(1, p[o + 4] + 0.16);
					}
				}
			}

			let veins = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = tr[y * s.w + x];
					if (v < 0.03) continue;
					const thick = Math.min(1, v / 2.4);
					paint(s, x, y, sr, sg, sb, Math.min(0.92, 0.22 + v * 0.44));
					if (thick > 0.26) {
						const skirt = (thick - 0.26) * 0.62;
						paint(s, x + 1, y, sr * 0.78, sg * 0.78, sb * 0.78, skirt);
						paint(s, x, y + 1, sr * 0.78, sg * 0.78, sb * 0.78, skirt);
						paint(s, x - 1, y, sr * 0.68, sg * 0.68, sb * 0.68, skirt * 0.7);
						paint(s, x, y - 1, sr * 0.68, sg * 0.68, sb * 0.68, skirt * 0.7);
					}
					if (thick > 0.6) {
						veins++;
						plot(s, x, y, nr, ng, nb, (thick - 0.6) * 0.8);
					}
				}
			}

			for (const f of food) {
				const cx = f[0] * s.w;
				const cy = f[1] * s.h;
				const left = f[2];
				const spent = 1 - Math.min(1, left / Math.max(0.001, f[3]));
				const rad = 1.3 + left * 2.8;
				const husk = rad + 1.4;
				for (let dy = -husk; dy <= husk; dy++) {
					for (let dx = -husk; dx <= husk; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > husk) continue;
						if (d > rad) {
							paint(s, cx + dx, cy + dy, kr, kg, kb, spent * 0.75 * (1 - (d - rad) / 1.9));
							continue;
						}
						const k = 1 - d / (rad + 0.6);
						plot(s, cx + dx, cy + dy, nr, ng, nb, k * k * (0.2 + left * 0.75));
					}
				}
				f[2] = Math.min(f[3], f[2] + 0.0012);
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				if (p[o + 4] < 0.08) continue;
				plot(s, p[o], p[o + 1], 255, 255, 255, p[o + 4] * 0.45);
			}

			s.out = Math.min(1, veins / (s.w * s.h * 0.04));
			blit(s);
		}
	};
}

export function makeCulture(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 8219);
			const colonies: number[][] = [];
			for (let i = 0; i < 6; i++) colonies.push([0.12 + r() * 0.76, 0.12 + r() * 0.76, 0.5 + r() * 0.9, r() * 6.28, 0]);
			(s as any).id = { colonies, lag: 0.3 + r() * 0.5, tol: 0.5 + r() * 0.45 };
			(s as any).own = new Int8Array(s.w * s.h).fill(-1);
			(s as any).waste = new Float32Array(s.w * s.h);
			(s as any).swap = new Float32Array(s.w * s.h);
			(s as any).rad = colonies.map(() => 0);
			(s as any).seedAt = 60;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { colonies: number[][]; lag: number; tol: number };
			const own = (s as any).own as Int8Array;
			const waste = (s as any).waste as Float32Array;
			const swap = (s as any).swap as Float32Array;
			const rad = (s as any).rad as number[];
			const [pr, pg, pb] = hsl(s.v.hue2, s.v.sat * 0.4, 20);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.85, 60);
			const [wr, wg, wb] = hsl(s.v.hue + 44, s.v.sat * 0.55, 32);
			const [nr2, ng2, nb2] = hsl(s.v.hue + 26, s.v.sat * 0.3, 14);

			const ax = s.w * 0.5;
			const ay = s.h * 0.5;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const dd = Math.min(1, Math.hypot((x - ax) / ax, (y - ay) / ay));
					paint(s, x, y, pr * (1 - dd * 0.3), pg * (1 - dd * 0.3), pb, 0.3 + 0.65 * dd * dd);
				}
			}

			const span = Math.min(s.w, s.h);
			for (let ci = 0; ci < id.colonies.length; ci++) {
				const c = id.colonies[ci];
				if (c[4] > 1.5) continue;
				const cx = c[0] * s.w;
				const cy = c[1] * s.h;
				const wcell = waste[Math.min(waste.length - 1, Math.max(0, (cy | 0) * s.w + (cx | 0)))];
				const choke = Math.max(0, 1 - wcell / id.tol);
				rad[ci] = Math.min(span * 0.46, rad[ci] + 0.075 * s.v.speed * c[2] * choke);
				const R = rad[ci];
				if (R < 0.8) continue;
				const lobes = 5 + ((c[3] * 3) | 0);
				const y0 = Math.max(0, (cy - R - 1) | 0);
				const y1 = Math.min(s.h - 1, (cy + R + 1) | 0);
				const x0 = Math.max(0, (cx - R - 1) | 0);
				const x1 = Math.min(s.w - 1, (cx + R + 1) | 0);
				for (let y = y0; y <= y1; y++) {
					for (let x = x0; x <= x1; x++) {
						const dx = x - cx;
						const dy = y - cy;
						const dd = Math.hypot(dx, dy);
						const th = Math.atan2(dy, dx);
						const wob = 1 + Math.sin(th * lobes + c[3]) * 0.09 + Math.sin(th * 3 - c[3] * 2) * 0.06;
						if (dd > R * wob) continue;
						const cell = y * s.w + x;
						if (own[cell] === -1) own[cell] = ci;
					}
				}
			}

			let lawn = 0;
			for (let c = 0; c < own.length; c++) {
				if (own[c] < 0) continue;
				lawn++;
				waste[c] += 0.0016;
			}

			for (let y = 1; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i2 = y * s.w + x;
					swap[i2] = waste[i2] + 0.16 * (waste[i2 - 1] + waste[i2 + 1] + waste[i2 - s.w] + waste[i2 + s.w] - 4 * waste[i2]);
				}
			}
			waste.set(swap);

			let dead = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const cell = y * s.w + x;
					const o = own[cell];
					const wv = waste[cell];
					if (o < 0) {
						if (wv > 0.04) paint(s, x, y, nr2, ng2, nb2, Math.min(0.5, wv * 0.5));
						continue;
					}
					if (wv > id.tol) {
						dead++;
						const rot = Math.min(1, (wv - id.tol) * 2.2);
						paint(s, x, y, wr * (1 - rot * 0.55), wg * (1 - rot * 0.55), wb * (1 - rot * 0.6), 0.9);
						continue;
					}
					const vig = 1 - wv / id.tol;
					const hue = s.v.hue + o * 9;
					const [lr3, lg3, lb3] = hsl(hue, s.v.sat * (0.5 + vig * 0.45), 34 + vig * 30);
					paint(s, x, y, lr3, lg3, lb3, 0.92);
					const rim = own[Math.max(0, cell - 1)] !== o || own[Math.min(own.length - 1, cell + 1)] !== o || own[Math.max(0, cell - s.w)] !== o;
					if (rim) plot(s, x, y, lr3, lg3, lb3, 0.45 * vig);
				}
			}

			for (let ci = 0; ci < id.colonies.length; ci++) {
				const c = id.colonies[ci];
				const cx = c[0] * s.w;
				const cy = c[1] * s.h;
				const idx = Math.min(waste.length - 1, Math.max(0, (cy | 0) * s.w + (cx | 0)));
				if (waste[idx] > id.tol * 1.35) c[4] = 2;
			}

			if (--(s as any).seedAt <= 0) {
				(s as any).seedAt = 220 + ((s.rnd() * 420) | 0);
				let pick = -1;
				for (let ci = 0; ci < id.colonies.length; ci++) if (id.colonies[ci][4] > 1.5) pick = ci;
				if (pick >= 0) {
					const c = id.colonies[pick];
					let bx = 0;
					let by = 0;
					let clean = 1e9;
					for (let q = 0; q < 12; q++) {
						const tx = (0.1 + s.rnd() * 0.8) * s.w;
						const ty = (0.1 + s.rnd() * 0.8) * s.h;
						const v = waste[Math.min(waste.length - 1, (ty | 0) * s.w + (tx | 0))];
						if (v < clean) {
							clean = v;
							bx = tx;
							by = ty;
						}
					}
					c[0] = bx / s.w;
					c[1] = by / s.h;
					c[3] = s.rnd() * 6.28;
					c[4] = 0;
					rad[pick] = 0;
					for (let cI = 0; cI < own.length; cI++) if (own[cI] === pick) own[cI] = -1;
				}
			}

			s.out = Math.min(1, (lawn - dead * 0.5) / (s.w * s.h * 0.5));
			blit(s);
		}
	};
}

export function makeGraze(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.34,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 9127);
			(s as any).id = { regrow: 0.004 + r() * 0.006, patch: 0.3 + r() * 0.5, phase: r() * 6.28 };
			const algae = new Float32Array(s.w * s.h);
			(s as any).algae = algae;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				const th = s.rnd() * 6.28;
				s.parts[o + 2] = Math.cos(th);
				s.parts[o + 3] = Math.sin(th);
				s.parts[o + 4] = 0.4 + s.rnd() * 0.5;
				s.parts[o + 5] = th;
			}
		},
		frame(s) {
			const id = (s as any).id as { regrow: number; patch: number; phase: number };
			const algae = (s as any).algae as Float32Array;
			const p = s.parts;
			clear(s);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.5, 12);
			const [ar, ag, ab] = hsl(s.v.hue, s.v.sat * 0.8, 46);
			const [hr, hg, hb] = hsl(s.v.hue2, s.v.sat * 0.7, 74);

			backdrop(s, wr, wg, wb, 0.95, 0.32);

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const cell = y * s.w + x;
					const fert = 0.6 + Math.sin(x * 0.11 + id.phase) * Math.cos(y * 0.13 - id.phase) * id.patch;
					algae[cell] = Math.min(1, algae[cell] + id.regrow * Math.max(0, fert));
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				if (p[o + 4] <= 0.02) {
					let bx = 0;
					let by = 0;
					let best = -1;
					for (let k = 0; k < 6; k++) {
						const tx = (s.rnd() * s.w) | 0;
						const ty = (s.rnd() * s.h) | 0;
						const v = algae[ty * s.w + tx];
						if (v > best) {
							best = v;
							bx = tx;
							by = ty;
						}
					}
					p[o] = bx;
					p[o + 1] = by;
					p[o + 4] = 0.35;
					continue;
				}
				let bth = p[o + 5];
				let best = -1;
				for (let a = -2; a <= 2; a++) {
					const th = p[o + 5] + a * 0.55;
					const sx = (p[o] + Math.cos(th) * 4) | 0;
					const sy = (p[o + 1] + Math.sin(th) * 4) | 0;
					if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
					const v = algae[sy * s.w + sx];
					if (v > best) {
						best = v;
						bth = th;
					}
				}
				p[o + 5] = bth + (s.rnd() - 0.5) * 0.3 * s.v.drift;
				const rate = 0.42 * s.v.speed * (0.6 + p[o + 4]);
				p[o] += Math.cos(p[o + 5]) * rate;
				p[o + 1] += Math.sin(p[o + 5]) * rate;
				if (p[o] < 0) p[o] += s.w;
				if (p[o] >= s.w) p[o] -= s.w;
				if (p[o + 1] < 0) p[o + 1] += s.h;
				if (p[o + 1] >= s.h) p[o + 1] -= s.h;

				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				const bite = Math.min(algae[cell], 0.09);
				algae[cell] -= bite;
				p[o + 4] += bite * 0.9 - 0.0045;
				p[o + 4] = Math.min(1.2, p[o + 4]);
			}

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = algae[y * s.w + x];
					if (v < 0.03) continue;
					plot(s, x, y, ar, ag, ab, Math.min(0.7, v * 0.7));
				}
			}
			let herd = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const fat = Math.min(1, p[o + 4]);
				herd += fat;
				const len = 1.4 + fat * 1.8;
				const dx = Math.cos(p[o + 5]);
				const dy = Math.sin(p[o + 5]);
				const near = edge(p[o], 0, s.w, s.w * 0.09) * edge(p[o + 1], 0, s.h, s.h * 0.12);
				if (near <= 0.01) continue;
				for (let k = 0; k <= len; k++) {
					const a = 0.85 * (1 - (k / (len + 1)) * 0.6) * (0.4 + fat * 0.6) * near;
					paint(s, p[o] - dx * k, p[o + 1] - dy * k, hr, hg, hb, a);
				}
				plot(s, p[o] + dx, p[o + 1] + dy, hr, hg, hb, 0.5 * fat * near);
			}
			s.out = Math.min(1, Math.max(0, (herd / s.n - 0.65) / 0.35));
			blit(s);
		}
	};
}

export function makeDecay(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.28,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 10711);
			const logs: number[][] = [];
			for (let i = 0; i < 3; i++) logs.push([0.1 + r() * 0.5, 0.25 + r() * 0.55, 0.28 + r() * 0.4, (r() - 0.5) * 0.5]);
			const rots: number[][] = [];
			for (let i = 0; i < 6; i++) rots.push([r(), r(), 0.3 + r() * 0.7]);
			(s as any).id = { logs, rots };
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = (s.rnd() - 0.5) * 0.3;
				s.parts[o + 3] = -0.1 - s.rnd() * 0.2;
				s.parts[o + 4] = s.rnd();
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { logs: number[][]; rots: number[][] };
			const p = s.parts;
			const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.4, 11);
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.5, 30);
			const [mr, mg, mb] = hsl(s.v.hue2, s.v.sat * 0.8, 52);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.7, 72);

			backdrop(s, fr, fg, fb, 0.95, 0.33);

			const rot = Math.min(1, s.t * 0.0016 * s.v.speed);
			let caps = 0;
			for (const lg of id.logs) {
				const x0 = lg[0] * s.w;
				const y0 = lg[1] * s.h;
				const len = lg[2] * s.w;
				const th = lg[3];
				const thick = 3 + s.h * 0.035;
				for (let d = 0; d < len; d++) {
					const x = x0 + Math.cos(th) * d;
					const y = y0 + Math.sin(th) * d;
					const soft = 0.5 + Math.sin(d * 0.3 + lg[0] * 9) * 0.5;
					const eaten = rot * soft;
					for (let k = -thick; k <= thick; k++) {
						const yy = y + k;
						const rim = 1 - Math.abs(k) / thick;
						if (rim <= 0) continue;
						if (rim < eaten * 0.8) continue;
						const dark = 1 - eaten * 0.55;
						paint(s, x, yy, br * dark, bg * dark, bb * dark, 0.95);
						if (rim > 0.75) plot(s, x, yy, br, bg, bb, 0.14 * (1 - eaten));
					}
					if (eaten > 0.45 && (d | 0) % 7 === 0) {
						caps++;
						const cap = 1 + eaten * 2.4;
						const cy = y - thick;
						for (let dx = -cap; dx <= cap; dx++) {
							const hgt = Math.sqrt(Math.max(0, cap * cap - dx * dx)) * 0.7;
							for (let dy = -hgt; dy <= 0; dy++) paint(s, x + dx, cy + dy, mr, mg, mb, 0.92);
						}
						paint(s, x, cy + 1, mr * 0.7, mg * 0.7, mb * 0.7, 0.9);
					}
				}
			}

			for (const rt of id.rots) {
				const cx = rt[0] * s.w;
				const cy = rt[1] * s.h;
				const rad = rot * rt[2] * s.w * 0.12;
				for (let dy = -rad; dy <= rad; dy++) {
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > rad) continue;
						plot(s, cx + dx, cy + dy, mr, mg, mb, (1 - d / rad) * 0.1);
					}
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o] += p[o + 2] * s.v.speed + Math.sin(p[o + 5] + s.t * 0.03) * 0.12 * s.v.drift;
				p[o + 1] += p[o + 3] * s.v.speed;
				p[o + 5] += 0.03;
				if (p[o + 1] < -2) {
					p[o + 1] = s.h + 2;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o] > s.w + 2) p[o] = -2;
				const a = 0.5 * rot * edge(p[o + 1], -2, s.h + 2, s.h * 0.2);
				plot(s, p[o], p[o + 1], cr, cg, cb, a);
			}
			s.out = Math.min(1, caps / (s.w * 0.06));
			blit(s);
		}
	};
}

export function makeBloom(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 11311);
			(s as any).id = {
				cx: 0.3 + r() * 0.4,
				cy: 0.26 + r() * 0.3,
				angle: 2.399 + (r() - 0.5) * 0.06,
				petals: 3 + ((r() * 4) | 0),
				spread: 0.5 + r() * 0.5,
				lit: r() * 6.28,
				swayT: 150 + r() * 160,
				live: 96 + ((r() * 70) | 0)
			};
			(s as any).top = (s as any).id.live * 0.6;
			(s as any).base = 0;
			(s as any).fall = [] as number[][];
			(s as any).litter = new Float32Array(s.w);
			(s as any).gust = 40 + ((s.rnd() * 90) | 0);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { cx: number; cy: number; angle: number; petals: number; spread: number; lit: number; swayT: number; live: number };
			const fall = (s as any).fall as number[][];
			const litter = (s as any).litter as Float32Array;
			const [dr, dg, db] = hsl(s.v.hue2, s.v.sat * 0.35, 10);
			const [stR, stG, stB] = hsl(s.v.hue2 + 90, s.v.sat * 0.5, 26);
			const span = Math.min(s.w, s.h) * 0.42 * id.spread;

			const mx = s.w * 0.5;
			const my = s.h * 0.5;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const e = Math.min(1, Math.hypot((x - mx) / mx, (y - my) / my));
					paint(s, x, y, dr, dg, db, 0.3 + 0.62 * e * e);
				}
			}

			const sway = Math.sin((s.t * 6.28) / id.swayT) * 0.5 + Math.sin((s.t * 6.28) / (id.swayT * 0.41)) * 0.28;
			const lean = sway * s.w * 0.035 * s.v.drift * s.v.dir;
			const cx = id.cx * s.w + lean;
			const cy = id.cy * s.h;

			const rootX = id.cx * s.w;
			for (let y = Math.round(cy); y < s.h; y++) {
				const f = (y - cy) / Math.max(1, s.h - cy);
				const x = cx + (rootX - cx) * f * f;
				const thick = 0.6 + f * 1.4;
				for (let k = -thick; k <= thick; k++) {
					const sh = 1 - Math.abs(k) / (thick + 0.8);
					paint(s, x + k, y, stR * (0.55 + sh * 0.6), stG * (0.55 + sh * 0.6), stB * (0.55 + sh * 0.6), 0.92);
				}
			}

			(s as any).top += 0.24 * s.v.speed;
			const top = (s as any).top as number;
			let base = (s as any).base as number;

			if (--(s as any).gust <= 0) {
				(s as any).gust = 50 + ((s.rnd() * 130) | 0);
				(s as any).shake = 3 + ((s.rnd() * 5) | 0);
			}
			let shake = ((s as any).shake ?? 0) as number;

			const shedTo = Math.floor(top) - id.live;
			while (base <= shedTo || (shake > 0 && base < Math.floor(top) - 8)) {
				const age = top - base;
				const rad = Math.sqrt(Math.max(0, age) / id.live) * span;
				const th = base * id.angle + s.t * 0.003 * s.v.dir * s.v.drift;
				fall.push([
					cx + Math.cos(th) * rad,
					cy + Math.sin(th) * rad * 0.82,
					(s.rnd() - 0.5) * 0.5 + sway * 0.3,
					-0.15 - s.rnd() * 0.2,
					s.rnd() * 6.28,
					base & 4095
				]);
				if (fall.length > 26) fall.shift();
				base++;
				if (shake > 0) shake--;
				else break;
			}
			(s as any).base = base;
			(s as any).shake = shake;

			const hi = Math.floor(top);
			for (let k = base; k <= hi; k++) {
				const age = top - k;
				const f = Math.max(0, Math.min(1, age / id.live));
				const rad = Math.sqrt(f) * span;
				const th = k * id.angle + s.t * 0.003 * s.v.dir * s.v.drift;
				const px = cx + Math.cos(th) * rad;
				const py = cy + Math.sin(th) * rad * 0.82;
				const size = 0.8 + (1 - f) * 2.3;
				const key = (k * 2654435761) >>> 0;
				const toLit = Math.cos(th - id.lit);
				const [br, bg, bb] = hsl(s.v.hue + f * 52, s.v.sat * (0.5 + f * 0.5), 34 + (1 - f) * 30 + toLit * 12);
				for (let a = 0; a < id.petals; a++) {
					const pa = th + (a / id.petals) * 6.28;
					const ox = px + Math.cos(pa) * size * 0.72;
					const oy = py + Math.sin(pa) * size * 0.72;
					for (let dy = -size; dy <= size; dy++) {
						for (let dx = -size; dx <= size; dx++) {
							const dd = Math.hypot(dx, dy) / size;
							if (dd > 1) continue;
							const bite = ((((dx + 8) * 73 + (dy + 8) * 151 + key + a * 37) * 2654435761) >>> 0) % 100;
							if (dd > 0.52 && bite < 36) continue;
							const face = (dx * Math.cos(id.lit) + dy * Math.sin(id.lit)) / size;
							const sh = 0.72 + Math.max(0, face) * 0.42;
							paint(s, ox + dx, oy + dy, br * sh, bg * sh, bb * sh, 0.92 * (1 - dd * 0.22));
						}
					}
				}
				if (f < 0.22) plot(s, px, py, br, bg, bb, (0.22 - f) * 2);
			}

			for (let k = fall.length - 1; k >= 0; k--) {
				const q = fall[k];
				q[3] += 0.014 * s.v.speed;
				q[2] += Math.sin(q[4]) * 0.035 * s.v.drift;
				q[2] *= 0.985;
				q[4] += 0.12 + Math.abs(q[2]) * 0.2;
				q[0] += q[2];
				q[1] += q[3];
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				const rest = s.h - 1 - litter[col] * 0.6;
				if (q[1] >= rest) {
					litter[col] = Math.min(4, litter[col] + 1);
					const l2 = Math.max(0, col - 1);
					const r2 = Math.min(s.w - 1, col + 1);
					litter[l2] = Math.min(4, litter[l2] + 0.4);
					litter[r2] = Math.min(4, litter[r2] + 0.4);
					fall.splice(k, 1);
					continue;
				}
				const squash = Math.abs(Math.cos(q[4]));
				const size = 1.1 + squash * 1.3;
				const [pr2, pg2, pb2] = hsl(s.v.hue + 46, s.v.sat * 0.8, 44 + squash * 22);
				for (let dy = -size; dy <= size; dy++) {
					for (let dx = -size; dx <= size; dx++) {
						const dd = Math.hypot(dx / Math.max(0.4, squash), dy) / size;
						if (dd > 1) continue;
						const bite = ((((dx + 8) * 73 + (dy + 8) * 151 + q[5]) * 2654435761) >>> 0) % 100;
						if (dd > 0.5 && bite < 40) continue;
						paint(s, q[0] + dx, q[1] + dy, pr2, pg2, pb2, 0.9 * edge(q[1], -2, s.h + 1, s.h * 0.1));
					}
				}
			}

			const [lr2, lg2, lb2] = hsl(s.v.hue + 40, s.v.sat * 0.6, 30);
			for (let x = 0; x < s.w; x++) {
				const hgt = litter[x] * 0.6;
				if (hgt < 0.3) continue;
				for (let k = 0; k < hgt; k++) paint(s, x, s.h - 1 - k, lr2, lg2, lb2, 0.85 * (1 - k / (hgt + 1.4)));
				litter[x] *= 0.99955;
			}

			s.out = Math.min(1, (hi - base) / id.live);
			blit(s);
		}
	};
}

export function makeSpore(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 12401);
			const feed = 0.032 + r() * 0.024;
			const kill = 0.058 + r() * 0.008;
			const blobs: number[][] = [];
			for (let i = 0; i < 6; i++) blobs.push([0.1 + r() * 0.8, 0.1 + r() * 0.8, 0.4 + r() * 0.6]);
			(s as any).id = { feed, kill, blobs };
			const a = new Float32Array(s.w * s.h).fill(1);
			const b = new Float32Array(s.w * s.h);
			for (const bl of blobs) {
				const cx = bl[0] * s.w;
				const cy = bl[1] * s.h;
				const rad = 2 + bl[2] * 4;
				for (let y = cy - rad; y <= cy + rad; y++) {
					for (let x = cx - rad; x <= cx + rad; x++) {
						if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
						if (Math.hypot(x - cx, y - cy) > rad) continue;
						b[(y | 0) * s.w + (x | 0)] = 1;
					}
				}
			}
			(s as any).ga = a;
			(s as any).gb = b;
			(s as any).na = new Float32Array(a);
			(s as any).nb = new Float32Array(b);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { feed: number; kill: number };
			const a = (s as any).ga as Float32Array;
			const b = (s as any).gb as Float32Array;
			const na = (s as any).na as Float32Array;
			const nb = (s as any).nb as Float32Array;
			const w = s.w;
			const steps = 1 + (s.v.speed > 1.1 ? 1 : 0);

			for (let it = 0; it < steps; it++) {
				for (let y = 1; y < s.h - 1; y++) {
					for (let x = 1; x < w - 1; x++) {
						const i = y * w + x;
						const la = a[i - 1] + a[i + 1] + a[i - w] + a[i + w] - 4 * a[i];
						const lb = b[i - 1] + b[i + 1] + b[i - w] + b[i + w] - 4 * b[i];
						const abb = a[i] * b[i] * b[i];
						na[i] = Math.max(0, Math.min(1, a[i] + (0.21 * la - abb + id.feed * (1 - a[i])) * 0.95));
						nb[i] = Math.max(0, Math.min(1, b[i] + (0.105 * lb + abb - (id.kill + id.feed) * b[i]) * 0.95));
					}
				}
				a.set(na);
				b.set(nb);
			}

			const [lo1, lo2, lo3] = hsl(s.v.hue2, s.v.sat * 0.4, 12);
			const [hi1, hi2, hi3] = hsl(s.v.hue, s.v.sat, 62);
			const qx = s.w * 0.5;
			const qy = s.h * 0.5;
			let spotted = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < w; x++) {
					const v = Math.min(1, b[y * w + x] * 3.4);
					const e = Math.min(1, Math.hypot((x - qx) / qx, (y - qy) / qy));
					paint(s, x, y, lo1 + (hi1 - lo1) * v, lo2 + (hi2 - lo2) * v, lo3 + (hi3 - lo3) * v, Math.min(0.95, 0.18 + v * 0.62 + e * e * 0.42));
					if (v > 0.55) {
						spotted++;
						plot(s, x, y, hi1, hi2, hi3, (v - 0.55) * 0.55);
					}
				}
			}
			s.out = Math.min(1, spotted / (s.w * s.h * 0.3));
			blit(s);
		}
	};
}
