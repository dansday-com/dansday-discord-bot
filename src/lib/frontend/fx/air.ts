import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Frost = {
	nuclei: number[][];
	branch: number;
	sixth: number;
	clarity: number;
	hills: number[];
	trees: number[][];
	mullion: number;
	moon: number[];
	period: number;
};

function frostIdent(s: FxScene): Frost {
	const r = mulberry32(s.v.seed + 7420);
	const nuclei: number[][] = [];
	for (let i = 0; i < 7; i++) nuclei.push([r(), r(), r()]);
	const branch = 0.3 + r() * 0.4;
	const sixth = r() * Math.PI;
	const clarity = 0.3 + r() * 0.3;
	const hills: number[] = [];
	for (let i = 0; i < 11; i++) hills.push(r());
	const trees: number[][] = [];
	for (let i = 0; i < 9; i++) trees.push([r(), 0.5 + r() * 0.7]);
	const mullion = r() < 0.55 ? 1 : 0;
	const moon = [0.2 + r() * 0.6, 0.12 + r() * 0.14, 0.6 + r() * 0.5];
	const period = 620 + ((r() * 260) | 0);
	return { nuclei, branch, sixth, clarity, hills, trees, mullion, moon, period };
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
			(s as any).runs = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Frost;
			const ice = (s as any).ice as Float32Array;
			const runs = (s as any).runs as number[][];
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.5, 88);
			const [dr, dg, db] = hsl(s.v.hue2, s.v.sat * 0.7, 62);

			const cycle = id.period;
			const phase = (s.t * s.v.speed) % cycle;
			if (phase < 1.4) {
				ice.fill(0);
				runs.length = 0;
			}
			const grow = Math.min(1, phase / (cycle * 0.5));
			const melt = phase > cycle * 0.68 ? (phase - cycle * 0.68) / (cycle * 0.32) : 0;

			const horizon = s.h * 0.62;
			const [skr, skg, skb] = hsl(s.v.hue2, s.v.sat * 0.5, 22);
			const [snr, sng, snb] = hsl(s.v.hue, s.v.sat * 0.3, 58);
			const [trr, trg, trb] = hsl(s.v.hue2, s.v.sat * 0.4, 14);
			for (let y = 0; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const f = 1 - y / s.h;
					paint(s, x, y, skr * (0.5 + f * 1.1), skg * (0.5 + f * 1.1), skb * (0.7 + f * 1.3), 1);
				}
			const mx = id.moon[0] * s.w;
			const my = id.moon[1] * s.h;
			const mrd = id.moon[2] * s.h * 0.08;
			for (let dy = -mrd * 4; dy <= mrd * 4; dy++)
				for (let dx = -mrd * 4; dx <= mrd * 4; dx++) {
					const d = Math.hypot(dx, dy) / mrd;
					if (d < 1) paint(s, mx + dx, my + dy, 236, 240, 248, 1);
					else plot(s, mx + dx, my + dy, 180, 200, 235, Math.max(0, 1 - d / 4) ** 2 * 0.25);
				}
			for (let lay = 0; lay < 2; lay++) {
				const amp = lay ? 0.24 : 0.12;
				const base = horizon - (lay ? s.h * 0.1 : 0);
				const tone = lay ? 0.55 : 1;
				for (let x = 0; x < s.w; x++) {
					const t2 = (x / s.w) * 10 + lay * 3.4;
					const i2 = (t2 | 0) % 10;
					const ff = t2 - (t2 | 0);
					const hz = base - (id.hills[i2] * (1 - ff) + id.hills[(i2 + 1) % 11] * ff) * s.h * amp;
					for (let y = hz; y < s.h; y++) {
						const dep = (y - hz) / Math.max(1, s.h - hz);
						const k = (0.5 + (1 - dep) * 0.65) * tone;
						paint(s, x, y, snr * k, sng * k, snb * k, 1);
					}
					plot(s, x, hz, 255, 255, 255, 0.22 * tone);
				}
			}
			for (const [tx, th] of id.trees) {
				const bx = tx * s.w;
				const bh = th * s.h * 0.3;
				const by = horizon + s.h * 0.05;
				for (let k = 0; k < bh * 0.2; k++) for (let q = -1; q <= 1; q++) paint(s, bx + q, by - k, trr, trg, trb, 0.95);
				for (let k = 0; k < bh; k++) {
					const f = k / bh;
					const tier = (f * 3) % 1;
					const half = (0.25 + f * 0.75) * (0.55 + tier * 0.55) * s.w * 0.028 + 0.5;
					const yy = by - bh * 0.15 - (bh - k);
					for (let q = -half; q <= half; q++) {
						const lit = 0.7 + Math.max(0, q / half) * 0.75;
						paint(s, bx + q, yy, trr * lit, trg * lit, trb * lit, 0.96);
					}
					if (f > 0.1) plot(s, bx - half, yy, snr, sng, snb, 0.3);
				}
			}
			if (id.mullion) {
				const cxm = s.w * 0.5;
				for (let y = 0; y < s.h; y++) for (let q = -1; q <= 1; q++) paint(s, cxm + q, y, trr * 1.6, trg * 1.6, trb * 1.6, 0.9);
				const cym = s.h * 0.45;
				for (let x = 0; x < s.w; x++) for (let q = -1; q <= 1; q++) paint(s, x, cym + q, trr * 1.6, trg * 1.6, trb * 1.6, 0.9);
			}

			const lay = (x: number, y: number, a: number, rad: number) => {
				const ir = Math.ceil(rad);
				for (let dy = -ir; dy <= ir; dy++)
					for (let dx = -ir; dx <= ir; dx++) {
						const d = Math.hypot(dx, dy) / (rad + 0.001);
						if (d > 1) continue;
						const px = (x + dx) | 0;
						const py = (y + dy) | 0;
						if (px < 0 || px >= s.w || py < 0 || py >= s.h) continue;
						const i = py * s.w + px;
						const v = a * (1 - d * 0.62);
						if (v > ice[i]) ice[i] = v;
					}
			};

			for (const [nx, ny, nseed] of id.nuclei) {
				const cx = nx * s.w;
				const cy = ny * s.h;
				const reach = (0.16 + nseed * 0.24) * Math.min(s.w, s.h) * 1.5 * grow;
				lay(cx, cy, 0.95, 1.8 + grow * 1.4);
				for (let arm = 0; arm < 6; arm++) {
					const th = id.sixth + (arm * Math.PI) / 3 + s.v.tilt * 0.2;
					const ct = Math.cos(th);
					const st = Math.sin(th);
					for (let d = 0; d < reach; d += 0.7) {
						const jag = Math.sin(d * 0.5 + nseed * 9) * 0.5 * id.branch;
						const x = cx + ct * d - st * jag;
						const y = cy + st * d + ct * jag;
						const a = Math.max(0, 1 - d / reach) * 0.95;
						lay(x, y, a, 1.5 - (d / reach) * 0.9);
						const bs = d * id.branch;
						if (d > reach * 0.1 && Math.sin(d * 1.1 + nseed * 5) > 0.15) {
							for (let side = -1; side <= 1; side += 2) {
								const bt = th + side * 1.05;
								const bl = bs * 0.46;
								for (let q = 0; q < bl; q += 0.7) {
									const bx = x + Math.cos(bt) * q;
									const by = y + Math.sin(bt) * q;
									const ba = a * Math.max(0, 1 - q / (bl + 0.6)) * 0.88;
									lay(bx, by, ba, 1.15 - (q / (bl + 0.6)) * 0.75);
									if (q > bl * 0.4 && Math.sin(q * 2.3 + d) > 0.4) {
										for (let s2 = -1; s2 <= 1; s2 += 2) {
											const ct2 = bt + s2 * 1.0;
											for (let q2 = 0; q2 < bl * 0.3; q2 += 0.8) lay(bx + Math.cos(ct2) * q2, by + Math.sin(ct2) * q2, ba * 0.7, 0.8);
										}
									}
								}
							}
						}
					}
				}
			}

			if (melt > 0 && runs.length < 7 && s.rnd() < 0.1) runs.push([s.rnd() * s.w, 0, 0.3 + s.rnd() * 0.8, 1.2 + s.rnd() * 1.6]);
			for (let k = runs.length - 1; k >= 0; k--) {
				const q = runs[k];
				q[1] += q[2] * s.v.speed;
				q[0] += Math.sin(q[1] * 0.14 + q[3]) * 0.3;
				if (q[1] > s.h + 4) {
					runs.splice(k, 1);
					continue;
				}
				const w = q[3];
				for (let dy = -w * 3; dy <= w; dy++)
					for (let dx = -w; dx <= w; dx++) {
						const i2 = (((q[1] + dy) | 0) * s.w + ((q[0] + dx) | 0)) | 0;
						if (i2 < 0 || i2 >= ice.length) continue;
						const d = Math.hypot(dx / w, dy / (w * 2));
						if (d > 1) continue;
						ice[i2] *= 1 - (1 - d) * 0.5;
					}
			}

			const shimmer = 0.78 + 0.22 * Math.sin(s.t * 0.05 * s.v.speed);
			let glazed = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = ice[y * s.w + x] * (1 - melt * 0.55);
					if (v < 0.03) continue;
					glazed += v;
					const fog2 = Math.min(1, v * (1.5 + id.clarity));
					paint(s, x, y, dr * 0.55 + 132, dg * 0.55 + 140, db * 0.55 + 152, fog2 * 0.72);
					plot(s, x, y, cr, cg, cb, v * 0.3 * shimmer);
					const lit = Math.sin(x * 0.4 + y * 0.3 + s.t * 0.07 * s.v.dir * s.v.speed);
					if (lit > 0.8) plot(s, x, y, 255, 255, 255, v * 0.6);
				}
			}

			for (const q of runs) {
				const w = q[3];
				for (let dy = -w * 2; dy <= w * 0.5; dy++)
					for (let dx = -w; dx <= w; dx++) {
						const d = Math.hypot(dx / w, dy / (w * 1.5));
						if (d > 1) continue;
						plot(s, q[0] + dx, q[1] + dy, cr, cg, cb, (1 - d) * 0.3);
					}
				plot(s, q[0], q[1], 255, 255, 255, 0.6);
			}

			s.out = Math.min(1, (glazed / (s.w * s.h * 0.3)) * 0.7 + melt * 0.5);
			blit(s);
		}
	};
}

type Bank = { ridges: number[][]; trees: number[][]; sun: number; water: number; period: number; bands: number[][] };

function fogIdent(s: FxScene): Bank {
	const r = mulberry32(s.v.seed + 8330);
	const ridges: number[][] = [];
	for (let L = 0; L < 3; L++) {
		const row: number[] = [];
		for (let i = 0; i < 9; i++) row.push(r());
		ridges.push(row);
	}
	const trees: number[][] = [];
	for (let i = 0; i < 10; i++) trees.push([r(), 0.45 + r() * 0.75]);
	const sun = 0.2 + r() * 0.6;
	const water = 0.7 + r() * 0.08;
	const period = 620 + ((r() * 240) | 0);
	const bands: number[][] = [];
	for (let i = 0; i < 6; i++) bands.push([r(), r(), r(), r()]);
	return { ridges, trees, sun, water, period, bands };
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
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const burn = cyc < 0.5 ? Math.max(0, (cyc - 0.16) / 0.34) : Math.max(0, 1 - (cyc - 0.5) / 0.3);
			const day = Math.min(1, burn * 1.2);

			const sunX = id.sun * s.w;
			const sunY = s.h * (0.46 - day * 0.32);
			const [skr, skg, skb] = hsl(s.v.hue2, 30 + s.v.sat * 0.4, 20 + day * 26);
			const [wr2, wg2, wb2] = hsl(s.v.hue2, 24 + s.v.sat * 0.3, 18 + day * 14);
			const [fr, fg, fb] = hsl(s.v.hue, 8 + s.v.sat * 0.22, 74 + day * 14);

			for (let y = 0; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const f = 1 - y / s.h;
					const d = Math.hypot((x - sunX) / (s.w * 0.6), (y - sunY) / (s.h * 0.8));
					const warm = Math.max(0, 1 - d) ** 2 * (0.35 + day * 0.9);
					paint(s, x, y, skr * (0.55 + f * 0.9) + warm * 150, skg * (0.55 + f * 0.9) + warm * 116, skb * (0.6 + f * 1) + warm * 70, 1);
				}

			const srd = s.h * 0.075;
			for (let dy = -srd * 5; dy <= srd * 5; dy++)
				for (let dx = -srd * 5; dx <= srd * 5; dx++) {
					const d = Math.hypot(dx, dy) / srd;
					if (d < 1) paint(s, sunX + dx, sunY + dy, 255, 240 - (1 - day) * 60, 205 - (1 - day) * 110, 1);
					else plot(s, sunX + dx, sunY + dy, 255, 214, 150, Math.max(0, 1 - d / 5) ** 2.2 * (0.2 + day * 0.4));
				}

			const waterY = id.water * s.h;
			for (let L = 2; L >= 0; L--) {
				const row = id.ridges[L];
				const amp = 0.1 + L * 0.1;
				const base = waterY - s.h * (0.06 + L * 0.1);
				const veil = 1 - Math.min(0.7, (1 - burn) * (0.28 + L * 0.2));
				const tone = (0.2 + L * 0.22) * (0.5 + day * 0.7);
				for (let x = 0; x < s.w; x++) {
					const t2 = (x / s.w) * 8 + L * 2.7;
					const i2 = t2 | 0;
					const raw = t2 - i2;
					const ff = raw * raw * (3 - 2 * raw);
					const hz = base - (row[i2 % 9] * (1 - ff) + row[(i2 + 1) % 9] * ff) * s.h * amp - Math.sin(x * 0.31 + L * 4.1) * s.h * 0.012;
					for (let y = hz; y < waterY; y++) {
						const dep = (y - hz) / Math.max(1, waterY - hz);
						const k = tone * (1 - dep * 0.35);
						const lit = Math.max(0, 1 - Math.abs(x - sunX) / (s.w * 0.5)) * day * 0.5;
						paint(
							s,
							x,
							y,
							(wr2 * k + lit * 90) * veil + fr * (1 - veil) * 0.8,
							(wg2 * k + lit * 72) * veil + fg * (1 - veil) * 0.8,
							(wb2 * k + lit * 48) * veil + fb * (1 - veil) * 0.8,
							1
						);
					}
					if (L === 2) plot(s, x, hz, 255, 212, 160, day * 0.35 * veil);
				}
			}

			for (const [tx, th] of id.trees) {
				const bx = tx * s.w;
				const bh = th * s.h * 0.2;
				const by = waterY - 1;
				const veil = 1 - Math.min(0.85, (1 - burn) * 0.75);
				for (let k = 0; k < bh; k++) {
					const f = k / bh;
					const tier = (f * 3) % 1;
					const half = (0.2 + f * 0.8) * (0.5 + tier * 0.6) * s.w * 0.018 + 0.4;
					const yy = by - (bh - k);
					for (let q = -half; q <= half; q++) paint(s, bx + q, yy, 16 * veil + fr * (1 - veil), 22 * veil + fg * (1 - veil), 18 * veil + fb * (1 - veil), 0.95);
				}
			}

			for (let y = waterY; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const dep = (y - waterY) / Math.max(1, s.h - waterY);
					const mir = waterY - (y - waterY) * 1.6;
					const k = 0.34 + (1 - dep) * 0.3;
					const glint = Math.max(0, 1 - Math.abs(x - sunX) / (s.w * 0.12)) * day;
					paint(s, x, y, wr2 * k + glint * 120, wg2 * k + glint * 96, wb2 * k + glint * 62, 1);
					const rip = Math.sin(x * 0.7 + mir * 0.4 + s.t * 0.06 * s.v.speed) * Math.sin(y * 1.3 - s.t * 0.04);
					if (rip > 0.6) plot(s, x, y, 255, 226, 186, (rip - 0.6) * (0.3 + day * 0.9) * (1 - dep));
				}

			let cover = 0;
			for (let L = 0; L < 6; L++) {
				const p = id.bands[L];
				const depth = (L + 1) / 6;
				const thick = Math.max(0, 1 - burn) * (0.35 + depth * 0.65);
				if (thick < 0.02) continue;
				const y0 = waterY - s.h * (0.3 - L * 0.055) + Math.sin(s.t * 0.012 * s.v.speed + p[0] * 7) * s.h * 0.035;
				const band = s.h * (0.09 + p[1] * 0.1) * (0.6 + thick * 0.7);
				const t = s.t * 0.008 * s.v.speed * s.v.dir * (0.4 + depth) * (1 + s.v.drift * 0.5);
				for (let y = y0 - band; y < y0 + band; y++) {
					if (y < 0 || y >= s.h) continue;
					const vy = 1 - Math.abs(y - y0) / band;
					for (let x = 0; x < s.w; x++) {
						const u = x / s.w;
						const n = Math.sin(u * 5.3 + t + p[2] * 9) * 0.5 + Math.sin(u * 11.7 - t * 1.4 + p[3] * 9) * 0.28 + Math.sin(u * 2.1 + t * 0.6 + L) * 0.26;
						const a = Math.max(0, vy * vy * (0.42 + n * 0.5)) * thick * 0.45;
						if (a < 0.006) continue;
						cover += a;
						const lit = Math.max(0, 1 - Math.hypot((x - sunX) / (s.w * 0.4), (y - sunY) / (s.h * 0.7))) * day;
						paint(s, x, y, fr + lit * 60, fg + lit * 42, fb + lit * 18, a);
					}
				}
			}

			s.out = Math.min(1, cover / (s.w * s.h * 0.14) + day * 0.25);
			blit(s);
		}
	};
}

type Plume = {
	vents: number[][];
	curl: number;
	rise: number;
	logs: number[][];
	pitX: number;
	ground: number;
	rocks: number[][];
	period: number;
	grain: number;
};

function smokeIdent(s: FxScene): Plume {
	const r = mulberry32(s.v.seed + 9140);
	const pitX = 0.3 + r() * 0.4;
	const vents: number[][] = [];
	for (let i = 0; i < 3; i++) vents.push([pitX + (r() - 0.5) * 0.08, 0.6 + r() * 0.7, r() * 9]);
	const curl = 0.5 + r() * 0.9;
	const rise = 0.5 + r() * 0.5;
	const logs: number[][] = [];
	for (let i = 0; i < 4; i++) logs.push([r(), r(), r()]);
	const ground = 0.68 + r() * 0.08;
	const rocks: number[][] = [];
	for (let i = 0; i < 7; i++) rocks.push([r(), r(), r()]);
	const period = 260 + ((r() * 160) | 0);
	const grain = (r() * 9999) | 0;
	return { vents, curl, rise, logs, pitX, ground, rocks, period, grain };
}

export function makeSmoke(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 2.4,
		init(s) {
			const id = smokeIdent(s);
			(s as any).id = id;
			(s as any).sparks = [] as number[][];
			const fy0 = id.ground * s.h;
			for (let i = 0; i < s.n; i++) {
				const v = id.vents[i % id.vents.length];
				const o = i * P;
				s.parts[o] = v[0] * s.w + (s.rnd() - 0.5) * 2;
				s.parts[o + 1] = fy0 - s.rnd() * s.h * 0.7;
				s.parts[o + 2] = s.rnd() * 140;
				s.parts[o + 3] = 0.4 + s.rnd() * 0.6;
				s.parts[o + 4] = i % id.vents.length;
				s.parts[o + 5] = 0.6 + s.rnd() * 0.8;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Plume;
			const sparks = (s as any).sparks as number[][];
			const [mr, mg, mb] = hsl(s.v.hue, 6 + s.v.sat * 0.2, 46);
			const [hr, hg, hb] = hsl(s.v.hue2, 70 + s.v.sat * 0.25, 60);
			const t = s.t * 0.01 * s.v.speed;
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const flare = cyc > 0.7 ? Math.sin(((cyc - 0.7) / 0.3) * Math.PI) : 0;

			const fy = id.ground * s.h;
			const px = id.pitX * s.w;
			const blaze = (0.55 + 0.45 * Math.sin(s.t * 0.13) * Math.sin(s.t * 0.071 + 1.3)) * (1 + flare * 1.6);

			const [nr, ng, nb] = hsl(s.v.hue2, 18 + s.v.sat * 0.2, 9);
			for (let y = 0; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const glow = Math.max(0, 1 - Math.hypot((x - px) / (s.w * 0.46), (y - fy) / (s.h * 0.55))) ** 2 * blaze;
					const f = y < fy ? 0.5 + (1 - y / fy) * 0.5 : 0.85;
					paint(s, x, y, nr * f + glow * 128, ng * f + glow * 62, nb * f + glow * 22, 1);
				}

			const [gr, gg, gb] = hsl(s.v.hue, 16 + s.v.sat * 0.2, 17);
			for (let y = fy; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const dep = (y - fy) / Math.max(1, s.h - fy);
					const gn = ((((x * 31 + y * 17 + id.grain) * 2654435761) >>> 12) & 255) / 255;
					const lit = Math.max(0, 1 - Math.abs(x - px) / (s.w * 0.4)) * (1 - dep * 0.5) * blaze;
					const k = 0.7 + gn * 0.5 + dep * 0.3;
					paint(s, x, y, gr * k + lit * 150, gg * k + lit * 70, gb * k + lit * 26, 1);
				}

			for (const [rx, ry, rs] of id.rocks) {
				const ox = px + (rx - 0.5) * s.w * 0.3;
				const oy = fy + s.h * 0.02 + ry * s.h * 0.05;
				const rw = s.w * (0.016 + rs * 0.018);
				for (let dy = -rw * 0.7; dy <= rw * 0.7; dy++)
					for (let dx = -rw; dx <= rw; dx++) {
						if (Math.hypot(dx / rw, dy / (rw * 0.7)) > 1) continue;
						const up = Math.max(0, -dy / (rw * 0.7));
						const lit = Math.max(0, 1 - Math.abs(ox - px) / (s.w * 0.25)) * blaze;
						paint(s, ox + dx, oy + dy, 56 + up * 30 + lit * 130, 52 + up * 28 + lit * 58, 50 + up * 26 + lit * 18, 1);
					}
			}

			for (let i = 0; i < 4; i++) {
				const lg = id.logs[i];
				const ang = -0.9 + i * 0.6 + (lg[0] - 0.5) * 0.5;
				const len = s.w * (0.11 + lg[1] * 0.06);
				const lx = px + (lg[2] - 0.5) * s.w * 0.07;
				const ly = fy + s.h * 0.035;
				const ca = Math.cos(ang);
				const sa2 = Math.sin(ang);
				for (let k = -len; k <= len; k += 0.6) {
					const f = Math.abs(k) / len;
					const half = 2.3 - f * 0.9;
					const bx = lx + ca * k;
					const by = ly + sa2 * k * 0.42;
					const char = Math.max(0, 1 - Math.abs(k) / (len * 0.55));
					for (let q = -half; q <= half; q++) {
						const up = Math.max(0, -q / half);
						const e = char * blaze;
						paint(s, bx, by + q, 30 + up * 20 + e * 190, 22 + up * 14 + e * 76, 18 + up * 10 + e * 22, 1);
					}
				}
			}

			for (let i = 0; i < 80; i++) {
				const ph = (s.t * 0.075 * s.v.speed + i * 0.61) % 1;
				const fx2 = px + Math.sin(i * 2.7 + s.t * 0.1) * s.w * 0.05 * (0.35 + ph * 1.1);
				const fh = s.h * (0.2 + 0.3 * blaze) * (0.5 + ((i * 37) % 9) / 9);
				const fyy = fy + s.h * 0.02 - ph * fh;
				const a = (1 - ph) * (1 - ph) * (0.5 + blaze * 0.5);
				const rad = 3.6 * (1 - ph * 0.5);
				for (let dy = -rad; dy <= rad; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy) / rad;
						if (d > 1) continue;
						const k = (1 - d) * (1 - d) * a;
						plot(s, fx2 + dx, fyy + dy, 255, 150 + (1 - ph) * 95, 40 + (1 - ph) * 110, k * 0.85);
					}
			}

			if (s.rnd() < 0.24 + flare * 0.8)
				sparks.push([px + (s.rnd() - 0.5) * s.w * 0.07, fy, (s.rnd() - 0.5) * 0.7, -0.7 - s.rnd() * 1.3 * (1 + flare), 0, 30 + s.rnd() * 50]);
			for (let k = sparks.length - 1; k >= 0; k--) {
				const q = sparks[k];
				q[4] += 1;
				if (q[4] > q[5]) {
					sparks.splice(k, 1);
					continue;
				}
				q[0] += q[2] + Math.sin(q[1] * 0.2 + t) * 0.28 * id.curl * s.v.drift * s.v.dir;
				q[1] += q[3] * s.v.speed;
				q[3] *= 0.985;
				const f = q[4] / q[5];
				const a = (1 - f) * (1 - f);
				plot(s, q[0], q[1], 255, 190 - f * 110, 90 - f * 80, a * 0.95);
				plot(s, q[0], q[1] + 1, 255, 150 - f * 90, 50 - f * 40, a * 0.4);
			}

			let thick = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const v = id.vents[p[o + 4]];
				const age = p[o + 2];
				const nx = p[o] * 0.05;
				const ny = p[o + 1] * 0.05;
				const cu = Math.sin(ny * 1.3 + t + v[2]) * Math.cos(nx * 0.9 - t * 0.7) + Math.sin(ny * 2.7 - t * 1.3) * 0.5;
				const climb = 1 - Math.min(1, (fy - p[o + 1]) / (s.h * 0.9));
				p[o] += cu * 0.34 * id.curl * s.v.drift * s.v.dir * (1.4 - climb);
				p[o + 1] -= (0.3 + p[o + 5] * 0.38) * id.rise * s.v.speed * v[1] * (1 + flare * 0.9);
				p[o + 2] += 1;
				if (p[o + 1] < -3 || age > 140) {
					p[o] = v[0] * s.w + (s.rnd() - 0.5) * 2;
					p[o + 1] = fy - s.h * 0.02;
					p[o + 2] = 0;
					p[o + 5] = 0.6 + s.rnd() * 0.8;
					continue;
				}
				const life = age / 140;
				const rad = 1.4 + life * 8.5 * p[o + 5];
				const a = p[o + 3] * (1 - life) * (1 - life) * 0.46 * edge(p[o + 1], -4, s.h + 2, s.h * 0.24);
				if (a < 0.005) continue;
				const heat = Math.max(0, 1 - life * 5);
				thick += a;
				for (let y = -rad; y <= rad; y += 1) {
					for (let x = -rad; x <= rad; x += 1) {
						const d = Math.hypot(x, y) / rad;
						if (d > 1) continue;
						const k = (1 - d) * (1 - d);
						const lift = 0.55 + life * 0.6;
						paint(s, p[o] + x, p[o + 1] + y, mr * lift, mg * lift, mb * lift, a * k * 0.9);
						if (heat > 0) plot(s, p[o] + x, p[o + 1] + y, hr, hg, hb, a * k * heat * 0.9);
					}
				}
			}
			s.out = Math.min(1, Math.max(0, (thick - 5) / 22) * 0.6 + flare * 0.6);
			blit(s);
		}
	};
}
