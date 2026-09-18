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
			(s as any).id = {
				turns: 2.4 + r() * 1.4,
				wide: 0.24 + r() * 0.1,
				pleats: 6 + ((r() * 5) | 0),
				cherry: r() < 0.72,
				swirl: r() * 6.28,
				period: 200 + ((r() * 150) | 0)
			};
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
			const id = (s as any).id as { turns: number; wide: number; pleats: number; cherry: boolean; swirl: number; period: number };
			const stuck = (s as any).stuck as number[][];
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const burst = cyc < 0.2 ? Math.sin((cyc / 0.2) * Math.PI) : 0;
			if (cyc < 0.008) stuck.length = 0;
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
				const th = id.swirl + t2 * id.turns * 6.28 + s.t * 0.022 * s.v.speed * s.v.dir;
				const rad = half * 0.96 * (1 - t2 * 0.82);
				const px2 = cx + Math.cos(th) * rad;
				const py = caseTop - t2 * rise * (1 + burst * 0.12) + Math.sin(th) * rad * 0.26;
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
				p[o + 3] += 0.11 + burst * 0.3;
				p[o] += Math.sin(p[o + 3]) * 0.2 * s.v.drift;
				p[o + 1] += p[o + 2] * s.v.speed * (1 + burst * 4.2);
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

			if (burst > 0) {
				const rr = (1 - burst) * s.w * 0.5 + 2;
				for (let a = 0; a < 6.28; a += 0.08) plot(s, cx + Math.cos(a) * rr, crest + Math.sin(a) * rr * 0.6, 255, 245, 250, burst * 0.5);
			}

			s.out = Math.min(1, (stuck.length / 42) * 0.3 + burst * 0.7);
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

			const gcyc = ((s.t * s.v.speed) % 170) / 170;
			const blast = gcyc < 0.22 ? Math.sin((gcyc / 0.22) * Math.PI) : 0;
			const gust = Math.sin(s.t * 0.07 * s.v.speed) * 0.7 + Math.sin(s.t * 0.16) * 0.34 + blast * 2.6;
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
					const sweep = ((((s.t * 0.02 * s.v.speed) % 1) + 1) % 1) * 1.4 - 0.2;
					const glint = Math.max(0, 1 - Math.abs(i / id.links - sweep) * 7);
					for (let q = -w; q <= w; q += 0.7) {
						const sh = 0.6 + (1 - Math.abs(q) / (w + 0.4)) * 0.6 * twist + glint * 0.55;
						paint(s, px2 + nx * q, py + ny * q, rr2 * sh, rg2 * sh, rb2 * sh, 0.97);
					}
					if (twist > 0.86) plot(s, px2 + nx * w * 0.2, py + ny * w * 0.2, sr2, sg2, sb2, 0.35);
				}
			}

			for (let side = -1; side <= 1; side += 2) {
				const lr2 = s.w * 0.07 * id.loops * (1 + blast * 0.3);
				const flap = Math.sin(s.t * 0.12 * s.v.speed + side * 1.6) * 0.3 + blast * 0.8 * side;
				for (let a = 0; a < 6.28; a += 0.12) {
					const px2 = ax + side * lr2 * (0.6 + Math.cos(a + flap) * 0.9);
					const py = ay + Math.sin(a + flap * 0.5) * lr2 * 0.7;
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

			s.out = Math.min(1, (wave / id.links) * 2.4 + blast * 0.6);
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
			(s as any).id = { facets, jag, spin: 0.5 + r() * 0.8, cut: 0.3 + r() * 0.22, table: 0.3 + r() * 0.16, period: 280 + ((r() * 200) | 0) };
			(s as any).shards = [] as number[][];
			(s as any).boom = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { facets: number; jag: number[]; spin: number; cut: number; table: number; period: number };
			const shards = (s as any).shards as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.4, 10);
			const [gr2, gg2, gb2] = hsl(s.v.hue, s.v.sat * 0.9, 62);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const charge = cyc < 0.72 ? Math.pow(cyc / 0.72, 2.2) : 0;
			const fire = cyc >= 0.72 && cyc < 0.72 + (s.v.speed / id.period) * 1.2;
			const boomPre = (s as any).boom as number;

			backdropSoft(s, br, bg, bb);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05;
			const cy = s.h * 0.48 + Math.sin(s.t * 0.04 * s.v.speed) * s.h * 0.02;
			const rad = Math.min(s.w, s.h) * id.cut * (1 + charge * 0.12 + boomPre * 0.25);
			const rot = s.t * 0.032 * s.v.speed * id.spin * s.v.dir;
			const lightTh = Math.PI * 1.25 + Math.sin(s.t * 0.017 * s.v.speed) * 0.5;

			for (let k = 0; k < 7; k++) {
				const a = (k / 7) * 6.28 + rot * 0.6;
				const reach = rad * (1.5 + Math.sin(s.t * 0.05 * s.v.speed + k * 1.7) * 0.5) + charge * rad * 1.4;
				const [cr3, cg3, cb3] = hsl(s.v.hue + k * 11, s.v.sat, 66);
				for (let d = rad * 1.1; d < reach; d += 0.9) {
					const f = 1 - (d - rad * 1.1) / Math.max(1, reach - rad * 1.1);
					plot(s, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.78, cr3, cg3, cb3, f * f * (0.2 + charge * 0.5));
				}
			}

			if (fire) {
				(s as any).boom = 1;
				for (let k = 0; k < 26; k++) {
					const th = (k / 26) * 6.28 + s.rnd() * 0.24;
					const pow = 0.9 + s.rnd() * 1.8;
					shards.push([cx, cy, Math.cos(th) * pow, Math.sin(th) * pow * 0.8, 0, s.v.hue + k * 13]);
				}
				if (shards.length > 60) shards.splice(0, shards.length - 60);
			}
			const boom = (s as any).boom as number;
			if (boom > 0) (s as any).boom = Math.max(0, boom - 0.05);

			let peak = 0;
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
					const core = Math.max(0, 1 - d / (rad * 0.8)) * charge;
					const caustic = Math.max(0, Math.sin((d / rad) * 9 - s.t * 0.14 * s.v.speed + seg * 1.3)) ** 3;
					const bright = (inner ? 0.5 + toLight * 0.3 : 0.34 + Math.max(0, toLight) ** 2 * 1.5) + core * 2.2 + boom * 1.6 + caustic * 0.7;
					const hue = s.v.hue + seg * 7 - toLight * 14 + charge * 26;
					const [r2, g2, b2] = hsl(hue, s.v.sat * (inner ? 0.5 : 0.85), Math.min(97, 32 + bright * 46));
					paint(s, cx + x, cy + y, r2, g2, b2, 0.98);
					if (bright > peak) peak = bright;
				}
			}

			if (boom > 0) {
				const ring = (1 - boom) * s.w * 0.85;
				for (let a = 0; a < 6.28; a += 0.04) {
					plot(s, cx + Math.cos(a) * ring, cy + Math.sin(a) * ring * 0.72, 255, 255, 255, boom * boom * 0.7);
				}
			}

			for (let k = shards.length - 1; k >= 0; k--) {
				const q = shards[k];
				q[4] += 1;
				if (q[4] > 34) {
					shards.splice(k, 1);
					continue;
				}
				q[3] += 0.05;
				q[0] += q[2];
				q[1] += q[3];
				q[2] *= 0.985;
				const a = 1 - q[4] / 34;
				const [r2, g2, b2] = hsl(q[5], 92, 60 + a * 30);
				const len = 1.4 + a * 2.6;
				const th = Math.atan2(q[3], q[2]);
				for (let d = 0; d < len; d += 0.7) plot(s, q[0] - Math.cos(th) * d, q[1] - Math.sin(th) * d, r2, g2, b2, a * (1 - d / len) * 0.95);
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 2] += 0.11;
				p[o] += Math.cos(p[o + 2] * 0.5) * 0.24 * s.v.speed * s.v.dir;
				p[o + 1] -= 0.18 * s.v.speed;
				if (p[o + 1] < 0) {
					p[o + 1] = s.h;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] < 0) p[o] += s.w;
				if (p[o] >= s.w) p[o] -= s.w;
				const tw = Math.max(0, Math.sin(p[o + 2]));
				plot(s, p[o], p[o + 1], gr2, gg2, gb2, tw * tw * edge(p[o + 1], 0, s.h, 5) * (0.42 + charge * 0.5));
			}

			s.out = Math.min(1, boom * 0.85 + charge * 0.55);
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
			(s as any).id = { scoops, waffle: 5 + ((r() * 4) | 0), melt: 280 + ((r() * 160) | 0) };
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
			const fresh = Math.max(0, 1 - melt * 7);
			const heat = Math.pow(melt, 1.6);
			if (fresh > 0.86) for (let x = 0; x < s.w; x++) pool[x] *= 0.82;

			for (let k = 0; k < 10; k++) {
				const life = (((s.t * 0.016 * s.v.speed + k * 0.1) % 1) + 1) % 1;
				const hx = cx + Math.sin(k * 2.1 + life * 3.2) * s.w * 0.2;
				const hy = coneTop - life * s.h * 0.55;
				const a = life * (1 - life) * 4 * heat * 0.3;
				for (let d = 0; d < 3; d++) plot(s, hx + Math.sin(life * 9 + d) * 1.2, hy - d, 255, 220, 190, a * (1 - d / 3));
			}

			let lowest = coneTop;
			for (let i = 0; i < id.scoops.length; i++) {
				const sc = id.scoops[i];
				const slump = heat * Math.min(s.w, s.h) * 0.045 * (i + 1);
				const sx = cx + sc[0] * s.w + Math.sin(s.t * 0.03 * s.v.speed + i) * heat * 1.4;
				const sy = coneTop - i * Math.min(s.w, s.h) * 0.14 - 2 + slump;
				const rad = Math.min(s.w, s.h) * sc[1] * (1 - melt * 0.16 + fresh * 0.14);
				const squash = 1 + heat * 0.42;
				const [fr2, fg2, fb2] = hsl(s.v.hue + sc[2], s.v.sat * 0.85, 74 - i * 4 + fresh * 12);
				for (let y = -rad; y <= rad; y++) {
					for (let x = -rad * squash; x <= rad * squash; x++) {
						const d = Math.hypot(x / squash, y * (0.85 + heat * 0.35)) / rad;
						if (d > 1) continue;
						if (d > 0.72 && chip(x | 0, y | 0, sc[3]) < 34) continue;
						const gl =
							Math.max(0, 1 - Math.abs((x / rad) * 2.2 - Math.sin(s.t * 0.13 * s.v.speed * s.v.dir + i * 1.3) * 1.5)) +
							Math.max(0, Math.sin(s.t * 0.09 * s.v.speed + (x + y) * 0.4 + sc[2])) * 0.22;
						const sh = 0.72 + Math.max(0, -y / rad) * 0.46 + Math.max(0, -x / rad) * 0.14 + gl * 0.3 + fresh * 0.5;
						paint(s, sx + x, sy + y, fr2 * sh, fg2 * sh, fb2 * sh, 0.98);
					}
				}
				if (fresh > 0) {
					for (let k = 0; k < 12; k++) {
						const a2 = (k / 12) * 6.28;
						const rr = rad * (1.2 + (1 - fresh) * 2.4);
						plot(s, sx + Math.cos(a2) * rr, sy + Math.sin(a2) * rr * 0.7, 255, 255, 255, fresh * fresh * 0.8);
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
			(s as any).id = { points, stones, arch: 0.5 + r() * 0.4, period: 360 + ((r() * 240) | 0) };
			(s as any).rays = [] as number[][];
			(s as any).land = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { points: number; stones: number[][]; arch: number; period: number };
			const rays = (s as any).rays as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.45, 11);
			const [mr, mg, mb] = hsl(46, 72, 56);
			const [sr2, sg2, sb2] = hsl(s.v.hue, s.v.sat * 0.6, 86);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const drop = cyc < 0.34 ? 1 - Math.pow(cyc / 0.34, 2.4) : 0;
			const justLanded = cyc >= 0.34 && cyc < 0.34 + (s.v.speed / id.period) * 1.2;

			backdropSoft(s, br, bg, bb);

			const bob = Math.sin(s.t * 0.034 * s.v.speed) * s.h * 0.022;
			const sway = Math.sin(s.t * 0.021 * s.v.speed + 1.1) * s.w * 0.018 * s.v.drift;
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.04 + sway * (1 - drop);
			const restY = s.h * 0.64 + bob * (1 - drop);
			const baseY = restY - drop * s.h * 0.85;
			const halfW = Math.min(s.w, s.h) * 0.34;
			const bandH = s.h * 0.08;
			const settle = (s as any).land as number;

			if (justLanded) {
				(s as any).land = 1;
				for (let k = 0; k < 14; k++) rays.push([cx, restY, (k / 14) * 6.28 + s.rnd() * 0.2, 0]);
				if (rays.length > 28) rays.splice(0, rays.length - 28);
			}
			const halo = settle;
			if (settle > 0) (s as any).land = Math.max(0, settle - 0.035);

			for (let k = rays.length - 1; k >= 0; k--) {
				const q = rays[k];
				q[3] += 1;
				if (q[3] > 26) {
					rays.splice(k, 1);
					continue;
				}
				const a = 1 - q[3] / 26;
				const near = q[3] * 1.7;
				const far = near + 5 + a * 9;
				for (let d = near; d < far; d += 0.8) {
					plot(s, q[0] + Math.cos(q[2]) * d, q[1] + Math.sin(q[2]) * d * 0.6, 255, 238, 190, a * a * 0.85);
				}
			}
			if (halo > 0) {
				for (let dy = -14; dy <= 14; dy++)
					for (let dx = -20; dx <= 20; dx++) {
						const d = Math.hypot(dx / 20, dy / 14);
						if (d > 1) continue;
						plot(s, cx + dx, restY + dy, 255, 236, 186, (1 - d) * (1 - d) * halo * 0.6);
					}
			}

			const shine = drop > 0 ? 0.5 : (((s.t * 0.028 * s.v.speed * s.v.dir) % 1) + 1) % 1;
			for (let y = baseY; y < baseY + bandH; y++) {
				const f = (y - baseY) / bandH;
				for (let x = cx - halfW; x <= cx + halfW; x++) {
					const u = (x - cx) / halfW;
					const sw = Math.max(0, 1 - Math.abs(u - (shine * 2 - 1)) * 3.2);
					const eng = Math.max(0, Math.sin(u * 11 - s.t * 0.09 * s.v.speed * s.v.dir)) ** 3;
					const sh = 0.6 + (1 - Math.abs(f - 0.3)) * 0.4 + sw * 0.8 + halo * 0.5 + eng * 0.45;
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
						const sw = Math.max(0, 1 - Math.abs((px2 + q - cx) / halfW - (shine * 2 - 1)) * 3.2);
						const eng = Math.max(0, Math.sin(f * 9 - s.t * 0.12 * s.v.speed + i * 1.1)) ** 3;
						const sh = 0.58 + (1 - f) * 0.24 + sw * 0.85 + halo * 0.5 + eng * 0.5;
						paint(s, px2 + q, baseY - k, mr * sh, mg * sh, mb * sh, 0.98);
					}
				}
				const st = id.stones[i];
				const sy = baseY - tall - 1.6;
				const glint = Math.max(0, Math.sin(s.t * 0.19 * s.v.speed + st[1])) * (1 - drop * 0.5) + halo;
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++) {
						const d = Math.hypot(dx, dy) / 2;
						if (d > 1) continue;
						const [r2, g2, b2] = hsl(s.v.hue + st[0] * 50, s.v.sat * 0.9, Math.min(96, 56 + glint * 38));
						paint(s, px2 + dx, sy + dy, r2, g2, b2, 0.98);
					}
				if (glint > 0.82) for (let d = -4; d <= 4; d++) plot(s, px2 + d, sy, 255, 255, 255, (1 - Math.abs(d) / 4) * 0.75);
			}

			let shimmer = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 2] += 0.16;
				p[o + 1] -= 0.22 * s.v.speed + halo * 0.8;
				p[o] += Math.sin(p[o + 2] * 0.6) * 0.14 * s.v.drift;
				if (p[o + 1] < -1) {
					p[o + 1] = s.h + 1;
					p[o] = s.rnd() * s.w;
				}
				const tw = Math.max(0, Math.sin(p[o + 2]));
				shimmer += tw;
				plot(s, p[o], p[o + 1], sr2, sg2, sb2, tw * tw * (0.5 + halo * 0.6));
			}

			s.out = Math.min(1, halo * 0.8 + drop * 0.35 + (shimmer / Math.max(1, s.n)) * 0.3);
			blit(s);
		}
	};
}
