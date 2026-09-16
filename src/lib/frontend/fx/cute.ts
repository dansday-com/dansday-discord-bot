import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

function chip(dx: number, dy: number, key: number) {
	return ((((dx + 16) * 73 + (dy + 16) * 151 + key) * 2654435761) >>> 0) % 100;
}

function backdropSoft(s: FxScene, r: number, g: number, b: number) {
	const mx = s.w * 0.5;
	const my = s.h * 0.5;
	for (let y = 0; y < s.h; y++) {
		for (let x = 0; x < s.w; x++) {
			const d = Math.min(1, Math.hypot((x - mx) / mx, (y - my) / my));
			paint(s, x, y, r, g, b, 0.26 + d * d * 0.56);
		}
	}
}

export function makeCupcake(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.3,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 24203);
			(s as any).id = { turns: 2.4 + r() * 1.4, wide: 0.24 + r() * 0.1, pleats: 6 + ((r() * 5) | 0), cherry: r() < 0.72, swirl: r() * 6.28 };
			(s as any).stuck = [] as number[][];
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = -s.rnd() * s.h;
				s.parts[o + 2] = 0.24 + s.rnd() * 0.3;
				s.parts[o + 3] = s.rnd() * 6.28;
				s.parts[o + 4] = (s.rnd() * 5) | 0;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { turns: number; wide: number; pleats: number; cherry: boolean; swirl: number };
			const stuck = (s as any).stuck as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.4, 12);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.5, 52);
			const [fr2, fg2, fb2] = hsl(s.v.hue, s.v.sat * 0.8, 74);
			const [dr2, dg2, db2] = hsl(s.v.hue, s.v.sat * 0.7, 52);

			backdropSoft(s, br, bg, bb);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05;
			const half = s.w * id.wide;
			const caseTop = s.h * 0.62;
			const caseBot = s.h * 0.92;
			for (let y = caseTop; y < caseBot; y++) {
				const f = (y - caseTop) / (caseBot - caseTop);
				const w = half * (1 - f * 0.26);
				for (let x = cx - w; x <= cx + w; x++) {
					const u = (x - cx) / w;
					const pleat = Math.abs(Math.sin(u * id.pleats * 1.6)) * 0.4 + 0.66;
					paint(s, x, y, wr * pleat, wg * pleat, wb * pleat, 0.98);
				}
			}
			for (let x = cx - half; x <= cx + half; x++) paint(s, x, caseTop, wr * 1.25, wg * 1.25, wb * 1.25, 0.95);

			const swirlTop = s.h * 0.26;
			const rise = caseTop - swirlTop;
			let crest = swirlTop;
			for (let t2 = 0; t2 <= 1; t2 += 0.008) {
				const th = id.swirl + t2 * id.turns * 6.28;
				const rad = half * 0.96 * (1 - t2 * 0.82);
				const px2 = cx + Math.cos(th) * rad;
				const py = caseTop - t2 * rise + Math.sin(th) * rad * 0.26;
				const blob = 2.2 + (1 - t2) * 2.6;
				for (let dy = -blob; dy <= blob; dy++) {
					for (let dx = -blob; dx <= blob; dx++) {
						const d = Math.hypot(dx, dy) / blob;
						if (d > 1) continue;
						const lift = Math.cos(th) * 0.3 + Math.max(0, -dy / blob) * 0.5;
						const sh = 0.72 + lift * 0.45;
						paint(s, px2 + dx, py + dy, fr2 * sh, fg2 * sh, fb2 * sh, 0.98);
					}
				}
				if (py < crest) crest = py;
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 3] += 0.11;
				p[o] += Math.sin(p[o + 3]) * 0.2 * s.v.drift;
				p[o + 1] += p[o + 2] * s.v.speed;
				const onTop = Math.abs(p[o] - cx) < half * 0.9 && p[o + 1] >= crest + 2 + Math.abs(p[o] - cx) * 0.3;
				if (onTop) {
					stuck.push([p[o], p[o + 1], p[o + 4], p[o + 3]]);
					if (stuck.length > 42) stuck.shift();
					p[o + 1] = -2 - s.rnd() * s.h * 0.5;
					p[o] = s.rnd() * s.w;
					p[o + 4] = (s.rnd() * 5) | 0;
					continue;
				}
				if (p[o + 1] > s.h + 2) {
					p[o + 1] = -2;
					p[o] = s.rnd() * s.w;
				}
				const [pr2, pg2, pb2] = hsl(s.v.hue + p[o + 4] * 58, 84, 66);
				const fade = edge(p[o + 1], -3, s.h + 2, s.h * 0.12);
				const ang = p[o + 3];
				for (let k = -1; k <= 1; k++) plot(s, p[o] + Math.cos(ang) * k, p[o + 1] + Math.sin(ang) * k, pr2, pg2, pb2, 0.9 * fade);
			}
			for (const q of stuck) {
				const [pr2, pg2, pb2] = hsl(s.v.hue + q[2] * 58, 84, 68);
				for (let k = -1; k <= 1; k++) paint(s, q[0] + Math.cos(q[3]) * k, q[1] + Math.sin(q[3]) * k, pr2, pg2, pb2, 0.96);
			}

			if (id.cherry) {
				const chy = crest - 2.4;
				for (let dy = -2.6; dy <= 2.6; dy++)
					for (let dx = -2.6; dx <= 2.6; dx++) {
						const d = Math.hypot(dx, dy) / 2.6;
						if (d > 1) continue;
						const sh = 0.7 + Math.max(0, -dy / 2.6) * 0.6;
						paint(s, cx + dx, chy + dy, dr2 * sh * 1.5, dg2 * sh * 0.5, db2 * sh * 0.7, 0.98);
					}
				plot(s, cx - 0.8, chy - 1, 255, 255, 255, 0.7);
			}

			s.out = Math.min(1, stuck.length / 34);
			blit(s);
		}
	};
}

export function makeRibbon(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 25209);
			const links = 16;
			const chain: number[][] = [];
			for (let i = 0; i < links; i++) chain.push([0, 0, 0, 0]);
			(s as any).id = { links, anchor: 0.2 + r() * 0.6, wind: 0.5 + r() * 0.9, band: 1.6 + r() * 1.4, loops: 0.7 + r() * 0.5 };
			(s as any).chain = chain;
			(s as any).ready = false;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { links: number; anchor: number; wind: number; band: number; loops: number };
			const chain = (s as any).chain as number[][];
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.4, 11);
			const [rr2, rg2, rb2] = hsl(s.v.hue, s.v.sat * 0.85, 66);
			const [sr2, sg2, sb2] = hsl(s.v.hue, s.v.sat * 0.5, 88);

			backdropSoft(s, br, bg, bb);

			const ax = id.anchor * s.w;
			const ay = s.h * 0.26;
			const seg = (s.h * 0.55) / id.links;

			if (!(s as any).ready) {
				for (let i = 0; i < id.links; i++) {
					chain[i][0] = ax;
					chain[i][1] = ay + i * seg;
					chain[i][2] = chain[i][0];
					chain[i][3] = chain[i][1];
				}
				(s as any).ready = true;
			}

			const gust = Math.sin(s.t * 0.024 * s.v.speed) * 0.7 + Math.sin(s.t * 0.058) * 0.3;
			for (let i = 1; i < id.links; i++) {
				const c = chain[i];
				const vx = (c[0] - c[2]) * 0.94;
				const vy = (c[1] - c[3]) * 0.94;
				c[2] = c[0];
				c[3] = c[1];
				c[0] += vx + gust * id.wind * s.v.dir * (i / id.links) * 0.5 * s.v.drift;
				c[1] += vy + 0.06;
			}
			chain[0][0] = ax;
			chain[0][1] = ay;
			for (let pass = 0; pass < 3; pass++) {
				for (let i = 1; i < id.links; i++) {
					const a = chain[i - 1];
					const b = chain[i];
					const dx = b[0] - a[0];
					const dy = b[1] - a[1];
					const d = Math.hypot(dx, dy) || 1;
					const corr = (d - seg) / d / 2;
					const mx = dx * corr;
					const my = dy * corr;
					if (i > 1) {
						a[0] += mx;
						a[1] += my;
					}
					b[0] -= mx;
					b[1] -= my;
				}
			}

			let wave = 0;
			for (let i = 0; i < id.links - 1; i++) {
				const a = chain[i];
				const b = chain[i + 1];
				const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
				const twist = Math.abs(Math.cos(th * 2 + i * 0.4));
				wave += Math.abs(b[0] - ax) / s.w;
				const w = id.band * (0.35 + twist * 0.75) * (1 - (i / id.links) * 0.3);
				const nx = -Math.sin(th);
				const ny = Math.cos(th);
				for (let d = 0; d <= 1; d += 0.24) {
					const px2 = a[0] + (b[0] - a[0]) * d;
					const py = a[1] + (b[1] - a[1]) * d;
					for (let q = -w; q <= w; q += 0.7) {
						const sh = 0.6 + (1 - Math.abs(q) / (w + 0.4)) * 0.6 * twist;
						paint(s, px2 + nx * q, py + ny * q, rr2 * sh, rg2 * sh, rb2 * sh, 0.97);
					}
					if (twist > 0.86) plot(s, px2 + nx * w * 0.2, py + ny * w * 0.2, sr2, sg2, sb2, 0.35);
				}
			}

			for (let side = -1; side <= 1; side += 2) {
				const lr2 = s.w * 0.07 * id.loops;
				for (let a = 0; a < 6.28; a += 0.12) {
					const px2 = ax + side * lr2 * (0.6 + Math.cos(a) * 0.9);
					const py = ay + Math.sin(a) * lr2 * 0.7;
					for (let q = -id.band * 0.55; q <= id.band * 0.55; q += 0.7) {
						const sh = 0.66 + Math.cos(a) * 0.32;
						paint(s, px2, py + q, rr2 * sh, rg2 * sh, rb2 * sh, 0.98);
					}
				}
			}
			for (let dy = -2; dy <= 2; dy++)
				for (let dx = -2.4; dx <= 2.4; dx++) {
					if (dx * dx * 0.5 + dy * dy > 4.4) continue;
					paint(s, ax + dx, ay + dy, rr2 * 1.15, rg2 * 1.15, rb2 * 1.15, 0.99);
				}

			s.out = Math.min(1, (wave / id.links) * 3.4);
			blit(s);
		}
	};
}

export function makeGem(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.12,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 26214);
			const facets = 6 + ((r() * 4) | 0);
			const jag: number[] = [];
			for (let i = 0; i < facets; i++) jag.push(0.82 + r() * 0.3);
			(s as any).id = { facets, jag, spin: 0.5 + r() * 0.8, cut: 0.3 + r() * 0.22, table: 0.3 + r() * 0.16 };
			(s as any).spark = [] as number[][];
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { facets: number; jag: number[]; spin: number; cut: number; table: number };
			const spark = (s as any).spark as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.4, 10);
			const [gr2, gg2, gb2] = hsl(s.v.hue, s.v.sat * 0.9, 62);

			backdropSoft(s, br, bg, bb);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05;
			const cy = s.h * 0.48;
			const rad = Math.min(s.w, s.h) * id.cut;
			const rot = s.t * 0.012 * s.v.speed * id.spin * s.v.dir;
			const lightTh = Math.PI * 1.25;

			let peak = 0;
			let bestX = cx;
			let bestY = cy;
			for (let y = -rad * 1.5; y <= rad * 1.5; y++) {
				for (let x = -rad * 1.4; x <= rad * 1.4; x++) {
					const d = Math.hypot(x / 1.2, y);
					if (d > rad * 1.25) continue;
					const th = Math.atan2(y, x);
					const seg = Math.floor((((th - rot) % 6.28) + 6.28) / (6.28 / id.facets)) % id.facets;
					const lim = rad * id.jag[seg] * (y > rad * 0.2 ? 1 - (y / (rad * 1.5)) * 0.55 : 1);
					if (d > lim) continue;
					const faceTh = (seg / id.facets) * 6.28 + rot;
					const toLight = Math.cos(faceTh - lightTh);
					const inner = d < rad * id.table;
					const bright = inner ? 0.5 + toLight * 0.3 : 0.34 + Math.max(0, toLight) ** 2 * 1.5 + (seg % 2) * 0.12;
					const hue = s.v.hue + seg * 7 - toLight * 14;
					const [r2, g2, b2] = hsl(hue, s.v.sat * (inner ? 0.5 : 0.85), Math.min(94, 32 + bright * 46));
					paint(s, cx + x, cy + y, r2, g2, b2, 0.98);
					if (bright > peak) {
						peak = bright;
						bestX = cx + x;
						bestY = cy + y;
					}
				}
			}

			if (peak > 1.4 && s.rnd() < 0.16) {
				spark.push([bestX, bestY, 0]);
				if (spark.length > 6) spark.shift();
			}
			for (let k = spark.length - 1; k >= 0; k--) {
				const q = spark[k];
				q[2] += 1;
				if (q[2] > 16) {
					spark.splice(k, 1);
					continue;
				}
				const a = 1 - q[2] / 16;
				const len = 1.5 + a * 4;
				for (let d = -len; d <= len; d += 0.6) {
					plot(s, q[0] + d, q[1], 255, 255, 255, a * (1 - Math.abs(d) / len) * 0.9);
					plot(s, q[0], q[1] + d, 255, 255, 255, a * (1 - Math.abs(d) / len) * 0.9);
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 2] += 0.05;
				const tw = Math.max(0, Math.sin(p[o + 2]));
				plot(s, p[o], p[o + 1], gr2, gg2, gb2, tw * tw * 0.4);
			}

			s.out = Math.min(1, Math.max(0, (peak - 1.42) / 0.5));
			blit(s);
		}
	};
}

export function makeIcecream(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 27217);
			const scoops: number[][] = [];
			const n = 2 + ((r() * 2) | 0);
			for (let i = 0; i < n; i++) scoops.push([(r() - 0.5) * 0.1, 0.1 + r() * 0.06, r() * 140, (r() * 4096) | 0]);
			(s as any).id = { scoops, waffle: 5 + ((r() * 4) | 0), melt: 700 + ((r() * 400) | 0) };
			(s as any).drips = [] as number[][];
			(s as any).pool = new Float32Array(s.w);
			(s as any).next = 40;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { scoops: number[][]; waffle: number; melt: number };
			const drips = (s as any).drips as number[][];
			const pool = (s as any).pool as Float32Array;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.4, 11);
			const [cr2, cg2, cb2] = hsl(32, 62, 46);

			backdropSoft(s, br, bg, bb);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05;
			const coneTop = s.h * 0.52;
			const coneBot = s.h * 0.92;
			const coneW = Math.min(s.w, s.h) * 0.21;
			for (let y = coneTop; y < coneBot; y++) {
				const f = (y - coneTop) / (coneBot - coneTop);
				const w = coneW * (1 - f);
				for (let x = cx - w; x <= cx + w; x++) {
					const u = (x - cx) / Math.max(0.6, w);
					const grid = Math.abs(Math.sin((x - y) * id.waffle * 0.1)) * Math.abs(Math.sin((x + y) * id.waffle * 0.1));
					const sh = 0.62 + (1 - Math.abs(u + 0.25)) * 0.42 + grid * 0.28;
					paint(s, x, y, cr2 * sh, cg2 * sh, cb2 * sh, 0.98);
				}
			}

			const melt = ((s.t * s.v.speed) % id.melt) / id.melt;
			let lowest = coneTop;
			for (let i = 0; i < id.scoops.length; i++) {
				const sc = id.scoops[i];
				const sx = cx + sc[0] * s.w;
				const sy = coneTop - i * Math.min(s.w, s.h) * 0.14 - 2;
				const rad = Math.min(s.w, s.h) * sc[1] * (1 - melt * 0.16);
				const [fr2, fg2, fb2] = hsl(s.v.hue + sc[2], s.v.sat * 0.85, 74 - i * 4);
				for (let y = -rad; y <= rad; y++) {
					for (let x = -rad; x <= rad; x++) {
						const d = Math.hypot(x, y) / rad;
						if (d > 1) continue;
						if (d > 0.72 && chip(x | 0, y | 0, sc[3]) < 34) continue;
						const sh = 0.72 + Math.max(0, -y / rad) * 0.46 + Math.max(0, -x / rad) * 0.14;
						paint(s, sx + x, sy + y, fr2 * sh, fg2 * sh, fb2 * sh, 0.98);
					}
				}
				if (sy + rad > lowest) lowest = sy + rad;
				if (--(s as any).next <= 0) {
					(s as any).next = Math.max(8, 34 - melt * 24) + ((s.rnd() * 18) | 0);
					drips.push([sx + (s.rnd() - 0.5) * rad * 1.5, sy + rad * 0.8, 0, s.v.hue + sc[2]]);
					if (drips.length > 18) drips.shift();
				}
			}

			for (let k = drips.length - 1; k >= 0; k--) {
				const q = drips[k];
				q[2] += 0.015 * s.v.speed;
				q[1] += q[2];
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				if (q[1] >= s.h - 1 - pool[col]) {
					pool[col] = Math.min(5, pool[col] + 0.7);
					const l2 = Math.max(0, col - 1);
					const r2 = Math.min(s.w - 1, col + 1);
					pool[l2] = Math.min(5, pool[l2] + 0.45);
					pool[r2] = Math.min(5, pool[r2] + 0.45);
					drips.splice(k, 1);
					continue;
				}
				const [dr2, dg2, db2] = hsl(q[3], s.v.sat * 0.8, 76);
				for (let d = 0; d < 3; d++) paint(s, q[0], q[1] - d, dr2, dg2, db2, (1 - d / 3.4) * 0.96);
				plot(s, q[0] - 0.6, q[1] - 1, 255, 255, 255, 0.4);
			}
			let puddle = 0;
			for (let x = 0; x < s.w; x++) {
				const h = pool[x];
				puddle += h;
				if (h < 0.3) continue;
				const [dr2, dg2, db2] = hsl(s.v.hue + 10, s.v.sat * 0.7, 72);
				for (let k = 0; k < h; k++) paint(s, x, s.h - 1 - k, dr2 * 0.95, dg2 * 0.95, db2, 0.95);
				plot(s, x, s.h - 1 - h, 255, 255, 255, 0.16);
				pool[x] *= 0.9994;
			}

			s.out = Math.min(1, melt * 0.5 + Math.min(1, puddle / (s.w * 1.6)) * 0.5);
			blit(s);
		}
	};
}

export function makeCrown(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.1,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 28219);
			const points = 3 + ((r() * 3) | 0);
			const stones: number[][] = [];
			for (let i = 0; i < points + 2; i++) stones.push([r(), r() * 220]);
			(s as any).id = { points, stones, arch: 0.5 + r() * 0.4, bob: 0.6 + r() * 0.7 };
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { points: number; stones: number[][]; arch: number; bob: number };
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.45, 11);
			const [mr, mg, mb] = hsl(46, 72, 56);
			const [sr2, sg2, sb2] = hsl(s.v.hue, s.v.sat * 0.6, 86);

			backdropSoft(s, br, bg, bb);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.04;
			const bob = Math.sin(s.t * 0.02 * s.v.speed * id.bob) * s.h * 0.012;
			const baseY = s.h * 0.66 + bob;
			const halfW = Math.min(s.w, s.h) * 0.34;
			const bandH = s.h * 0.08;
			const sweep = (((s.t * 0.01 * s.v.speed * s.v.dir) % 1) + 1) % 1;

			for (let y = baseY; y < baseY + bandH; y++) {
				const f = (y - baseY) / bandH;
				for (let x = cx - halfW; x <= cx + halfW; x++) {
					const u = (x - cx) / halfW;
					const shine = Math.max(0, 1 - Math.abs(u - (sweep * 2 - 1)) * 3.2);
					const sh = 0.6 + (1 - Math.abs(f - 0.3)) * 0.4 + shine * 0.8;
					paint(s, x, y, mr * sh, mg * sh, mb * sh, 0.98);
				}
			}

			const n = id.points;
			for (let i = 0; i < n; i++) {
				const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
				const px2 = cx + u * halfW * 0.86;
				const tall = s.h * (0.16 + (1 - Math.abs(u)) * 0.1) * id.arch;
				for (let k = 0; k < tall; k++) {
					const f = k / tall;
					const w = halfW * 0.16 * (1 - f) + 0.6;
					for (let q = -w; q <= w; q++) {
						const shine = Math.max(0, 1 - Math.abs((px2 + q - cx) / halfW - (sweep * 2 - 1)) * 3.2);
						const sh = 0.58 + (1 - f) * 0.24 + shine * 0.85;
						paint(s, px2 + q, baseY - k, mr * sh, mg * sh, mb * sh, 0.98);
					}
				}
				const st = id.stones[i];
				const sy = baseY - tall - 1.6;
				const glint = Math.max(0, Math.sin(s.t * 0.05 * s.v.speed + st[1]));
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++) {
						const d = Math.hypot(dx, dy) / 2;
						if (d > 1) continue;
						const [r2, g2, b2] = hsl(s.v.hue + st[0] * 50, s.v.sat * 0.9, 56 + glint * 34);
						paint(s, px2 + dx, sy + dy, r2, g2, b2, 0.98);
					}
				if (glint > 0.82) for (let d = -3; d <= 3; d++) plot(s, px2 + d, sy, 255, 255, 255, (1 - Math.abs(d) / 3) * 0.7);
			}

			for (let i = 0; i < 4; i++) {
				const st = id.stones[(i + n) % id.stones.length];
				const px2 = cx + (st[0] * 2 - 1) * halfW * 0.8;
				const py = baseY + bandH * 0.5;
				const glint = Math.max(0, Math.sin(s.t * 0.06 * s.v.speed + st[1] * 1.3));
				for (let dy = -1.4; dy <= 1.4; dy++)
					for (let dx = -1.4; dx <= 1.4; dx++) {
						if (dx * dx + dy * dy > 2) continue;
						const [r2, g2, b2] = hsl(s.v.hue + st[0] * 40, s.v.sat, 58 + glint * 32);
						paint(s, px2 + dx, py + dy, r2, g2, b2, 0.98);
					}
			}

			let shimmer = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 2] += 0.06;
				const tw = Math.max(0, Math.sin(p[o + 2]));
				shimmer += tw;
				plot(s, p[o], p[o + 1], sr2, sg2, sb2, tw * tw * 0.36);
			}

			s.out = Math.min(1, Math.max(0, (sweep < 0.5 ? sweep * 2 : 2 - sweep * 2) * 0.6 + (shimmer / Math.max(1, s.n)) * 0.6));
			blit(s);
		}
	};
}
