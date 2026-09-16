import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Frost = { nuclei: number[][]; branch: number; sixth: number; clarity: number };

function frostIdent(s: FxScene): Frost {
	const r = mulberry32(s.v.seed + 7420);
	const nuclei: number[][] = [];
	for (let i = 0; i < 7; i++) nuclei.push([r(), r(), r()]);
	const branch = 0.3 + r() * 0.4;
	const sixth = r() * Math.PI;
	const clarity = 0.3 + r() * 0.3;
	return { nuclei, branch, sixth, clarity };
}

export function makeFrost(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = frostIdent(s);
			(s as any).id = id;
			(s as any).ice = new Float32Array(s.w * s.h);
			(s as any).grow = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Frost;
			const ice = (s as any).ice as Float32Array;
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.5, 88);
			const [dr, dg, db] = hsl(s.v.hue2, s.v.sat * 0.7, 62);

			const cycle = 520;
			const phase = (s.t * s.v.speed) % cycle;
			if (phase < 1.4) ice.fill(0);
			const grow = Math.min(1, phase / (cycle * 0.62));
			const melt = phase > cycle * 0.84 ? (phase - cycle * 0.84) / (cycle * 0.16) : 0;

			for (const [nx, ny, nseed] of id.nuclei) {
				const cx = nx * s.w;
				const cy = ny * s.h;
				const reach = (0.18 + nseed * 0.3) * Math.min(s.w, s.h) * 2.1 * grow;
				for (let arm = 0; arm < 6; arm++) {
					const th = id.sixth + (arm * Math.PI) / 3 + s.v.tilt * 0.2;
					const ct = Math.cos(th);
					const st = Math.sin(th);
					for (let d = 0; d < reach; d += 0.8) {
						const jag = Math.sin(d * 0.5 + nseed * 9) * 0.5 * id.branch;
						const x = cx + ct * d - st * jag;
						const y = cy + st * d + ct * jag;
						const a = Math.max(0, 1 - d / reach) * 0.9;
						const i = ((y | 0) * s.w + (x | 0)) | 0;
						if (i >= 0 && i < ice.length && a > ice[i]) ice[i] = a;
						const bs = d * id.branch;
						if (d > reach * 0.14 && Math.sin(d * 1.1 + nseed * 5) > 0.55) {
							for (let side = -1; side <= 1; side += 2) {
								const bt = th + side * 1.05;
								for (let q = 0; q < bs * 0.32; q += 0.9) {
									const bx = x + Math.cos(bt) * q;
									const by = y + Math.sin(bt) * q;
									const ba = a * Math.max(0, 1 - q / (bs * 0.32 + 0.6)) * 0.8;
									const bi = ((by | 0) * s.w + (bx | 0)) | 0;
									if (bi >= 0 && bi < ice.length && ba > ice[bi]) ice[bi] = ba;
								}
							}
						}
					}
				}
			}

			const shimmer = 0.78 + 0.22 * Math.sin(s.t * 0.05 * s.v.speed);
			let glazed = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = ice[y * s.w + x] * (1 - melt);
					if (v < 0.03) continue;
					glazed += v;
					const haze = v * id.clarity;
					paint(s, x, y, dr * 0.35, dg * 0.35, db * 0.35, haze * 0.5);
					plot(s, x, y, cr, cg, cb, v * 0.55 * shimmer);
					const lit = Math.sin(x * 0.4 + y * 0.3 + s.t * 0.07 * s.v.dir);
					if (lit > 0.8) plot(s, x, y, 255, 255, 255, v * 0.5);
				}
			}

			if (melt > 0) {
				for (let k = 0; k < 4; k++) {
					const x = ((s.rnd() * s.w) | 0) + 0.5;
					const y = melt * s.h * (0.4 + s.rnd() * 0.8);
					plot(s, x, y, cr, cg, cb, (1 - melt) * 0.5);
					plot(s, x, y + 1, cr, cg, cb, (1 - melt) * 0.3);
				}
			}
			s.out = Math.min(1, glazed / (s.w * s.h * 0.18));
			blit(s);
		}
	};
}

type Bank = { rows: number[][]; base: number; ridge: number[] };

function fogIdent(s: FxScene): Bank {
	const r = mulberry32(s.v.seed + 8330);
	const rows: number[][] = [];
	for (let i = 0; i < 5; i++) rows.push([r(), r(), r(), r()]);
	const base = 0.42 + r() * 0.2;
	const ridge: number[] = [];
	for (let i = 0; i < 12; i++) ridge.push(r());
	return { rows, base, ridge };
}

export function makeFog(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = fogIdent(s);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Bank;
			const [fr, fg, fb] = hsl(s.v.hue, s.v.sat * 0.28, 82);
			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat * 0.3, 16);

			const horizon = id.base * s.h;
			for (let i = 0; i < 12; i++) {
				const tx = (i / 12 + 0.04) * s.w;
				const near = id.ridge[i];
				const th = s.h * (0.1 + near * 0.22);
				const tw = s.w * 0.01 * (0.6 + near);
				const depth = 0.3 + near * 0.6;
				for (let k = 0; k < th; k++) {
					const f = k / th;
					const half = tw * (1 - f * 0.55);
					for (let x = tx - half; x <= tx + half; x++) paint(s, x, horizon - k, tr, tg, tb, 0.85 * depth);
				}
				const crown = th * 0.42;
				for (let q = 0; q < 22; q++) {
					const a = (q / 22) * Math.PI * 2;
					const rr = crown * (0.5 + 0.5 * Math.abs(Math.sin(q * 2.3 + near * 7)));
					paint(s, tx + Math.cos(a) * rr, horizon - th + Math.sin(a) * rr * 0.6, tr, tg, tb, 0.8 * depth);
				}
			}

			for (let L = 0; L < 5; L++) {
				const p = id.rows[L];
				const depth = (L + 1) / 5;
				const y0 = s.h * (id.base - 0.12 + L * 0.13) + Math.sin(s.t * 0.01 + p[0] * 7) * s.h * 0.02;
				const band = s.h * (0.1 + p[1] * 0.12);
				const t = s.t * 0.006 * s.v.speed * s.v.dir * (0.4 + depth) * (1 + s.v.drift * 0.5);
				for (let y = y0 - band; y < y0 + band; y++) {
					if (y < 0 || y >= s.h) continue;
					const vy = 1 - Math.abs(y - y0) / band;
					for (let x = 0; x < s.w; x++) {
						const u = x / s.w;
						const n = Math.sin(u * 5.3 + t + p[2] * 9) * 0.5 + Math.sin(u * 11.7 - t * 1.4 + p[3] * 9) * 0.3 + Math.sin(u * 2.1 + t * 0.6 + L) * 0.25;
						const a = Math.max(0, vy * (0.42 + n * 0.4)) * (0.16 + depth * 0.2);
						if (a > 0.004) paint(s, x, y, fr, fg, fb, a);
					}
				}
			}

			const glowY = s.h * (id.base - 0.24);
			const gx = s.w * (0.3 + id.rows[0][0] * 0.4);
			const halo = 0.6 + 0.4 * Math.sin(s.t * 0.018 * s.v.speed);
			for (let y = 0; y < s.h * 0.6; y++) {
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - gx) / (s.w * 0.22), (y - glowY) / (s.h * 0.3));
					if (d > 1) continue;
					plot(s, x, y, fr, fg, fb, (1 - d) * (1 - d) * 0.2 * halo);
				}
			}
			s.out = Math.min(1, halo * 0.75);
			blit(s);
		}
	};
}

type Plume = { vents: number[][]; curl: number; rise: number };

function smokeIdent(s: FxScene): Plume {
	const r = mulberry32(s.v.seed + 9140);
	const vents: number[][] = [];
	for (let i = 0; i < 3; i++) vents.push([0.2 + r() * 0.6, 0.6 + r() * 0.7, r() * 9]);
	const curl = 0.5 + r() * 0.9;
	const rise = 0.5 + r() * 0.5;
	return { vents, curl, rise };
}

export function makeSmoke(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 2.4,
		init(s) {
			const id = smokeIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const v = id.vents[i % id.vents.length];
				const o = i * P;
				s.parts[o] = v[0] * s.w + (s.rnd() - 0.5) * 2;
				s.parts[o + 1] = s.h * (0.55 + s.rnd() * 0.45);
				s.parts[o + 2] = s.rnd() * 90;
				s.parts[o + 3] = 0.4 + s.rnd() * 0.6;
				s.parts[o + 4] = i % id.vents.length;
				s.parts[o + 5] = 0.6 + s.rnd() * 0.8;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Plume;
			const [mr, mg, mb] = hsl(s.v.hue, s.v.sat * 0.25, 20);
			const [hr, hg, hb] = hsl(s.v.hue2, s.v.sat * 0.5, 66);
			const t = s.t * 0.01 * s.v.speed;

			let thick = 0;
			for (const v of id.vents) {
				const vx = v[0] * s.w;
				const ember = 0.45 + 0.55 * Math.abs(Math.sin(s.t * 0.06 + v[2]));
				for (let k = 0; k < 3; k++) plot(s, vx + k - 1, s.h - 1 - (k === 1 ? 1 : 0), hr, hg, hb, ember * (k === 1 ? 0.8 : 0.4));
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const v = id.vents[p[o + 4]];
				const age = p[o + 2];
				const nx = p[o] * 0.05;
				const ny = p[o + 1] * 0.05;
				const cu = Math.sin(ny * 1.3 + t + v[2]) * Math.cos(nx * 0.9 - t * 0.7) + Math.sin(ny * 2.7 - t * 1.3) * 0.5;
				p[o] += cu * 0.34 * id.curl * s.v.drift * s.v.dir;
				p[o + 1] -= (0.3 + p[o + 5] * 0.38) * id.rise * s.v.speed * v[1];
				p[o + 2] += 1;
				if (p[o + 1] < -2 || age > 150) {
					p[o] = v[0] * s.w + (s.rnd() - 0.5) * 2;
					p[o + 1] = s.h - 1;
					p[o + 2] = 0;
					p[o + 5] = 0.6 + s.rnd() * 0.8;
					continue;
				}
				const life = age / 150;
				const rad = 0.6 + life * 5.2 * p[o + 5];
				const a = p[o + 3] * (1 - life) * (1 - life) * 0.4 * edge(p[o + 1], -3, s.h + 2, s.h * 0.2);
				if (a < 0.005) continue;
				const heat = Math.max(0, 1 - life * 4);
				thick += a;
				for (let y = -rad; y <= rad; y += 1) {
					for (let x = -rad; x <= rad; x += 1) {
						const d = Math.hypot(x, y) / rad;
						if (d > 1) continue;
						const k = (1 - d) * (1 - d);
						paint(s, p[o] + x, p[o + 1] + y, mr, mg, mb, a * k);
						if (heat > 0) plot(s, p[o] + x, p[o + 1] + y, hr, hg, hb, a * k * heat * 0.8);
					}
				}
			}
			s.out = Math.min(1, thick / 6);
			blit(s);
		}
	};
}
