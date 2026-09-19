import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

function chip(dx: number, dy: number, key: number) {
	return ((((dx + 16) * 73 + (dy + 16) * 151 + key) * 2654435761) >>> 0) % 100;
}

const FROSTS = [340, 350, 4, 286, 196, 164, 40, 318];
const WALLS = [28, 40, 16, 196, 150, 210];

type Cake = {
	pleats: number;
	wide: number;
	turns: number;
	swirlPh: number;
	lhue: number;
	crumb: number;
	doily: number;
	slab: number;
	tiles: number;
	jars: number[][];
	side: number;
	sprPal: number[];
	period: number;
	grain: number;
	topper: number;
	fhue: number;
	chue: number;
	veins: number[][];
};

function cakeIdent(s: FxScene): Cake {
	const r = mulberry32(s.v.seed + 24203);
	const pleats = 7 + ((r() * 5) | 0);
	const wide = 0.112 + r() * 0.026;
	const turns = 2.6 + r() * 0.8;
	const swirlPh = r() * 6.28;
	const lhue = WALLS[(r() * WALLS.length) | 0];
	const crumb = r();
	const doily = 5 + ((r() * 5) | 0);
	const slab = r();
	const tiles = 5 + ((r() * 4) | 0);
	const jars: number[][] = [];
	for (let i = 0; i < 5; i++) jars.push([0.06 + r() * 0.88, 0.05 + r() * 0.04, 0.09 + r() * 0.08, r()]);
	const side = r() < 0.5 ? -1 : 1;
	const sprPal: number[] = [];
	for (let i = 0; i < 4; i++) sprPal.push(r() * 360);
	const period = 440 + ((r() * 210) | 0);
	const grain = (r() * 9999) | 0;
	const topper = (r() * 3) | 0;
	const veins: number[][] = [];
	for (let i = 0; i < 6; i++) veins.push([r(), r(), r(), r()]);
	const fi = (r() * FROSTS.length) | 0;
	const fhue = FROSTS[fi];
	const chue = FROSTS[(fi + 3 + ((r() * 3) | 0)) % FROSTS.length];
	return { pleats, wide, turns, swirlPh, lhue, crumb, doily, slab, tiles, jars, side, sprPal, period, grain, topper, veins, fhue, chue };
}

export function makeCupcake(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = cakeIdent(s);
			(s as any).top = new Float32Array(s.w);
			(s as any).fall = [] as number[][];
			(s as any).stuck = [] as number[][];
			(s as any).spill = [] as number[][];
			(s as any).lastc = 2;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Cake;
			const top = (s as any).top as Float32Array;
			const fall = (s as any).fall as number[][];
			const stuck = (s as any).stuck as number[][];
			const spill = (s as any).spill as number[][];
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			if (cyc < (s as any).lastc) {
				fall.length = 0;
				stuck.length = 0;
				spill.length = 0;
			}
			(s as any).lastc = cyc;

			const fhue = id.fhue;
			const pipe = cyc < 0.14 ? 0 : Math.min(1, (cyc - 0.14) / 0.3);
			const shake = cyc > 0.48 && cyc < 0.64 ? Math.sin(((cyc - 0.48) / 0.16) * Math.PI) : 0;
			const dropT = cyc <= 0.64 ? 0 : Math.min(1, (cyc - 0.64) / 0.13);
			const done = cyc <= 0.79 ? 0 : Math.min(1, (cyc - 0.79) / 0.05);
			let sx = 0;
			if (cyc > 0.9) {
				const f = (cyc - 0.9) / 0.1;
				sx = f * f * s.w * 1.35;
			} else if (cyc < 0.09) {
				const f = 1 - cyc / 0.09;
				sx = -f * f * s.w * 1.35;
			}

			const counterY = Math.round(s.h * 0.72);
			const shelfY = Math.round(counterY * 0.44);
			const [wr, wg, wb] = hsl(id.lhue, 16 + s.v.sat * 0.1, 21);
			const tw = s.w / id.tiles;
			const th = Math.max(5, counterY / 3);
			for (let y = 0; y < counterY; y++) {
				const vy = y / counterY;
				for (let x = 0; x < s.w; x++) {
					const row = (y / th) | 0;
					const gx = (x + (row % 2) * tw * 0.5) % tw;
					const gy = y % th;
					const grout = gx < 1 || gy < 1 ? 0.5 : 1;
					const face = 1 - Math.abs(gx / tw - (s.v.dir > 0 ? 0.28 : 0.72)) * 0.44;
					const n = chip(x, y, id.grain) / 100;
					const k = (0.92 + vy * 0.72 + n * 0.14) * grout * face;
					paint(s, x, y, wr * k, wg * k, wb * k, 1);
				}
			}

			for (const [jx, jw, jh, jt] of id.jars) {
				const bx = jx * s.w;
				const bw = jw * s.w;
				const bh = Math.min(shelfY - 2, s.h * (0.13 + jh));
				for (let y = shelfY - bh; y < shelfY; y++) {
					const f = (shelfY - y) / bh;
					const neck = f > 0.72 ? 0.52 + Math.max(0, 0.86 - f) * 1.7 : 1;
					const base = f < 0.1 ? 0.84 + f * 1.6 : 1;
					const hw = bw * neck * base * (1 - Math.max(0, f - 0.95) * 6);
					for (let x = bx - hw; x <= bx + hw; x++) {
						const u = (x - bx) / hw;
						const glass = 0.68 + Math.max(0, 1 - Math.abs(u + s.v.dir * 0.42) * 3.4) * 0.7;
						const full = f < 0.4 + jt * 0.26;
						const k = glass * (full ? 1.2 : 0.8) * (0.9 + jt * 0.3);
						const [jr, jg2, jb] = full ? hsl(id.sprPal[(jt * 4) | 0], 52, 46 + jt * 12) : hsl(id.lhue + 30, 8, 58);
						paint(s, x, y, jr * k, jg2 * k, jb * k, 1);
					}
					if (f > 0.9) for (let x = bx - bw * 0.62; x <= bx + bw * 0.62; x++) paint(s, x, y, 168, 160, 148, 1);
				}
			}
			for (let x = 0; x < s.w; x++) {
				paint(s, x, shelfY, wr * 2.1, wg * 2.0, wb * 1.8, 1);
				paint(s, x, shelfY + 1, wr * 1.3, wg * 1.25, wb * 1.15, 1);
				paint(s, x, shelfY + 2, wr * 0.55, wg * 0.55, wb * 0.55, 1);
			}

			const [cr, cg, cb] = hsl(id.lhue + 20, 9, 36 + id.slab * 10);
			for (let y = counterY; y < s.h; y++) {
				const f = (y - counterY) / Math.max(1, s.h - counterY);
				for (let x = 0; x < s.w; x++) {
					const n = chip(x >> 1, y, id.grain + 5) / 100;
					let vein = 0;
					for (const [vx, vy2, va, vb2] of id.veins) {
						const cxv = (vx + Math.sin(y * 0.22 + vb2 * 6) * 0.06 + (y / s.h) * (va - 0.5) * 0.5) * s.w;
						vein += Math.max(0, 1 - Math.abs(x - cxv) / (1.2 + vy2 * 1.6)) * 0.3;
					}
					const k = (0.84 + f * 0.5 + n * 0.14 + vein) * (1 + Math.max(0, 1 - Math.abs(y - counterY) / 1.6) * 0.5);
					paint(s, x, y, cr * k, cg * k, cb * k * 0.97, 1);
				}
			}
			for (let x = 0; x < s.w; x++) {
				paint(s, x, s.h - 2, cr * 0.5, cg * 0.5, cb * 0.5, 1);
				paint(s, x, s.h - 1, cr * 0.3, cg * 0.3, cb * 0.3, 1);
			}

			const lampX = s.v.dir > 0 ? s.w * 0.14 : s.w * 0.86;
			const [gr2, gg2, gb2] = hsl(38, 74, 60);
			for (let y = 0; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - lampX) / (s.w * 0.62), (y + s.h * 0.34) / (s.h * 1.1));
					if (d > 1) continue;
					plot(s, x, y, gr2, gg2, gb2, (1 - d) * (1 - d) * (0.3 + done * 0.16));
				}

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05 + sx;
			const half = s.w * id.wide;
			const caseBot = counterY + Math.round(s.h * 0.1);
			const caseTop = caseBot - Math.round(s.h * 0.2);

			const dry = half * 2.6;
			const drx = half * 1.7;
			for (let dy = -3.2; dy <= 3.2; dy++)
				for (let dx = -drx; dx <= drx; dx++) {
					const d = Math.hypot(dx / drx, dy / 3.2);
					if (d > 1) continue;
					const ang = Math.atan2(dy * 2.4, dx);
					const scallop = 1 - Math.max(0, d - 0.82) * (2.4 + Math.sin(ang * id.doily) * 2.6);
					if (scallop <= 0) continue;
					const lace = d > 0.5 && chip((dx * 2) | 0, (dy * 3) | 0, id.grain + 9) < 28 ? 0.6 : 1;
					paint(s, cx + dx, caseBot - 1 + dy * 0.5, 210 * lace, 202 * lace, 196 * lace, Math.min(1, scallop * 1.4) * 0.85);
				}
			void dry;

			const [lr2, lg2, lb2] = hsl(id.chue, 46 + s.v.sat * 0.2, 52);
			for (let y = caseTop; y <= caseBot; y++) {
				const f = (y - caseTop) / (caseBot - caseTop);
				const hw = half * (1 - f * 0.22);
				for (let x = cx - hw; x <= cx + hw; x++) {
					const u = (x - cx) / hw;
					const stripe = Math.abs(((u * id.pleats * 0.5) % 1) - 0.5) < 0.24 ? 0.66 : 1;
					const fold = Math.abs(Math.sin(u * id.pleats * 1.55 + 0.4));
					const round = Math.sqrt(Math.max(0, 1 - u * u));
					const lit = 0.42 + fold * 0.34 + round * 0.4 + Math.max(0, 1 - Math.abs(u + s.v.dir * 0.4) * 2.6) * 0.34;
					const k = lit * (1 - f * 0.2) * stripe;
					paint(s, x, y, lr2 * k, lg2 * k, lb2 * k, 1);
				}
			}
			for (let x = cx - half; x <= cx + half; x++) {
				const u = (x - cx) / half;
				const k = 0.9 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.7;
				paint(s, x, caseTop, lr2 * k * 1.4, lg2 * k * 1.4, lb2 * k * 1.4, 1);
			}

			const [kr, kg, kb] = hsl(28 + id.crumb * 10, 46, 30 + id.crumb * 8);
			const domeH = s.h * 0.1;
			for (let dy = -domeH; dy <= 1; dy++) {
				const f = -dy / domeH;
				const hw = half * 1.08 * Math.sqrt(Math.max(0, 1 - f * f * 0.92));
				for (let x = cx - hw; x <= cx + hw; x++) {
					const u = (x - cx) / Math.max(0.5, hw);
					const round = Math.sqrt(Math.max(0, 1 - u * u));
					const n = chip(x | 0, dy | 0, id.grain + 13) / 100;
					const k = 0.55 + round * 0.4 + f * 0.24 + n * 0.3 + Math.max(0, 1 - Math.abs(u + s.v.dir * 0.4) * 2.4) * 0.3;
					paint(s, x, caseTop + dy, kr * k, kg * k, kb * k, 1);
				}
			}

			top.fill(1e9);
			const swirlTopY = s.h * 0.17;
			const domeY = caseTop - domeH * 0.72;
			const rise = domeY - swirlTopY;
			let crest = domeY;
			let nozX = cx;
			let nozY = domeY;
			let tipR = 3;
			const [fr2, fg2, fb2] = hsl(fhue, 40 + s.v.sat * 0.4, 72);
			if (pipe > 0.002) {
				for (let t2 = 0; t2 <= pipe; t2 += 0.005) {
					const ang = id.swirlPh + t2 * id.turns * 6.28 * s.v.dir;
					const rad = half * 0.94 * (1 - t2 * t2 * 0.74);
					const px2 = cx + Math.cos(ang) * rad;
					const py2 = domeY - t2 * rise + Math.sin(ang) * rad * 0.2;
					const blob = 2.5 + (1 - t2) * 2.3;
					for (let dy = -blob; dy <= blob; dy++)
						for (let dx = -blob; dx <= blob; dx++) {
							const d = Math.hypot(dx, dy) / blob;
							if (d > 1) continue;
							const nx = dx / blob;
							const ny = dy / blob;
							const nz = Math.sqrt(Math.max(0, 1 - d * d));
							const lam = Math.max(0, -ny * 0.78 - nx * s.v.dir * 0.5);
							const seam = ny > 0.52 ? 0.66 : 1;
							const ripple = 0.92 + 0.14 * Math.sin((dx + dy) * 2.1 + ang * 3);
							const k = (0.44 + lam * 0.52 + nz * 0.3) * seam * ripple;
							const yy = py2 + dy;
							paint(s, px2 + dx, yy, fr2 * k, fg2 * k, fb2 * k, 1);
							const xi = Math.round(px2 + dx);
							if (xi >= 0 && xi < s.w && yy < top[xi]) top[xi] = yy;
						}
					if (py2 - blob < crest) crest = py2 - blob;
					nozX = px2;
					nozY = py2;
					tipR = blob;
				}
			}

			for (const q of stuck) {
				const [hr2, hg2, hb2] = hsl(id.sprPal[q[2]], 88, 66);
				const x0 = cx + q[0];
				for (let k = -1.2; k <= 1.2; k += 0.5) {
					const px2 = x0 + Math.cos(q[3]) * k;
					const py2 = q[1] + Math.sin(q[3]) * k * 0.6;
					paint(s, px2, py2 + 0.7, hr2 * 0.5, hg2 * 0.5, hb2 * 0.5, 1);
					paint(s, px2, py2, hr2, hg2, hb2, 1);
					paint(s, px2, py2 - 0.6, hr2 * 1.25 + 40, hg2 * 1.25 + 40, hb2 * 1.25 + 40, 0.8);
				}
			}
			for (const q of spill) {
				const [hr2, hg2, hb2] = hsl(id.sprPal[q[2]], 82, 58);
				const x0 = cx + q[0];
				for (let k = -1.1; k <= 1.1; k += 0.55) {
					paint(s, x0 + Math.cos(q[3]) * k, q[1] + Math.sin(q[3]) * k * 0.35 + 0.8, 0, 0, 0, 0.3);
					paint(s, x0 + Math.cos(q[3]) * k, q[1] + Math.sin(q[3]) * k * 0.35, hr2, hg2, hb2, 1);
				}
			}

			const shX = cx + id.side * half * 1.5;
			const shY = Math.max(s.h * 0.2, crest - s.h * 0.12);
			if (shake > 0.02) {
				const wob = Math.sin(s.t * 0.85) * shake;
				const tilt = id.side * (0.5 + shake * 0.5) + wob * 0.3;
				const sw = half * 0.42;
				const sh2 = s.h * 0.17;
				const ca = Math.cos(tilt);
				const sa = Math.sin(tilt);
				for (let v = -sh2 * 0.5; v <= sh2 * 0.5; v += 0.5)
					for (let u = -sw; u <= sw; u += 0.5) {
						const px2 = shX + u * ca - v * sa;
						const py2 = shY + u * sa + v * ca;
						const f = (v + sh2 * 0.5) / sh2;
						const round = Math.sqrt(Math.max(0, 1 - (u / sw) ** 2));
						const cap = f > 0.78 ? 1 : 0;
						const k = (0.5 + round * 0.55) * (cap ? 1.5 : 1);
						const [mr, mg, mb] = cap ? hsl(46, 22, 78) : hsl(id.fhue + 170, 26, 62);
						paint(s, px2, py2, mr * k, mg * k, mb * k, 1);
					}
				if (s.rnd() < shake * 0.95) {
					const mx = shX + sa * sh2 * 0.5 + (s.rnd() - 0.5) * 3;
					const my = shY + ca * sh2 * 0.5 + 1;
					const tgt = cx + (s.rnd() - 0.5) * half * 1.7;
					const aim = (tgt - mx) / Math.max(4, s.h * 0.5);
					fall.push([
						mx,
						my,
						aim * (0.7 + s.rnd() * 0.9) + (s.rnd() - 0.5) * 0.6,
						0.1 + s.rnd() * 0.2,
						(s.rnd() * 4) | 0,
						s.rnd() * 6.28,
						(s.rnd() - 0.5) * 0.3
					]);
				}
			}

			for (let i = fall.length - 1; i >= 0; i--) {
				const f = fall[i];
				f[3] += 0.055;
				f[0] += f[2] * (0.7 + s.v.drift * 0.6);
				f[1] += f[3] * s.v.speed;
				f[5] += f[6];
				const xi = Math.round(f[0]);
				if (xi >= 0 && xi < s.w && top[xi] < 1e8 && f[1] >= top[xi] - 0.4) {
					stuck.push([f[0] - cx, top[xi] - 0.2, f[4], f[5]]);
					if (stuck.length > 80) stuck.shift();
					fall.splice(i, 1);
					continue;
				}
				if (f[1] >= caseBot + 1) {
					if (Math.abs(f[0] - cx) > half * 0.9) {
						const roll = f[2] * (2 + s.rnd() * 5);
						spill.push([f[0] - cx + roll, caseBot + 0.5 + s.rnd() * 3.5, f[4], f[5]]);
						if (spill.length > 44) spill.shift();
					}
					fall.splice(i, 1);
					continue;
				}
				if (f[1] > s.h + 2) {
					fall.splice(i, 1);
					continue;
				}
				const [hr2, hg2, hb2] = hsl(id.sprPal[f[4]], 88, 70);
				for (let k = -1.1; k <= 1.1; k += 0.55) plot(s, f[0] + Math.cos(f[5]) * k, f[1] + Math.sin(f[5]) * k, hr2, hg2, hb2, 0.95);
			}

			if (dropT > 0 && dropT < 1) {
				const restY = crest - 1.6;
				const b = Math.abs(Math.cos(dropT * 3.35)) * (1 - dropT) ** 1.4;
				const ty = restY - b * (s.h * 0.42);
				const sq = 1 + Math.max(0, 1 - Math.abs(ty - restY) * 0.5) * (1 - dropT) * 0.3;
				drawTopper(s, cx, ty, 2.5 * sq, id.topper, fhue, s.v.dir);
			} else if (dropT >= 1) {
				drawTopper(s, cx, crest - 1.6, 2.5, id.topper, fhue, s.v.dir);
			}

			const bagIn = cyc > 0.085 && cyc < 0.53;
			if (bagIn) {
				let bx = nozX;
				let by = nozY - tipR;
				if (cyc < 0.14) {
					const f = (cyc - 0.085) / 0.055;
					bx = cx + Math.cos(id.swirlPh) * half * 0.94;
					by = -s.h * 0.4 + (domeY - tipR + s.h * 0.4) * (f * f * (3 - 2 * f));
				} else if (cyc > 0.44) {
					const f = Math.min(1, (cyc - 0.44) / 0.09);
					by = nozY - tipR - f * f * s.h * 0.75;
					for (let k = 0; k < 14; k++) {
						const t3 = k / 14;
						const yy = crest + (by + 3 - crest) * t3;
						const wob2 = Math.sin(t3 * 5 + s.t * 0.3) * 0.5 * t3;
						plot(s, cx + (bx - cx) * t3 + wob2, yy, fr2, fg2, fb2, (1 - f) * (1 - t3) * 0.9);
						paint(s, cx + (bx - cx) * t3 + wob2, yy, fr2 * 0.8, fg2 * 0.8, fb2 * 0.8, (1 - f) * (1 - t3 * 0.7) * 0.9);
					}
				}
				const squeeze = cyc > 0.14 && cyc < 0.44 ? 1 + Math.sin(s.t * 0.62) * 0.11 : 1;
				const tipH = s.h * 0.08;
				for (let k = 0; k <= tipH; k++) {
					const f = k / tipH;
					const hw = 1.2 + f * 2.6;
					for (let x = -hw; x <= hw; x++) {
						const u = x / hw;
						const kk = 0.6 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.55 + Math.max(0, 1 - Math.abs(u + s.v.dir * 0.4) * 2.6) * 0.5;
						const notch = Math.abs(Math.sin(u * 4.7)) * 0.26 + 0.8;
						paint(s, bx + x, by - k, 176 * kk * notch, 182 * kk * notch, 196 * kk * notch, 1);
					}
				}
				const bagH = s.h * 0.5;
				for (let k = 0; k <= bagH; k++) {
					const f = k / bagH;
					const lean = id.side * f * f * s.w * 0.09;
					const hw = (3 + f * half * 0.8) * squeeze;
					for (let x = -hw; x <= hw; x++) {
						const u = x / hw;
						const kk = 0.44 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.5 + Math.max(0, 1 - Math.abs(u + s.v.dir * 0.42) * 2.4) * 0.42;
						const crease = Math.abs(Math.sin(u * 3.1 + f * 4)) * 0.16 + 0.88;
						const band = Math.abs(((f * 7 + u * 0.4) % 1) - 0.5) < 0.22 ? 1 : 0;
						const [pr2, pg2, pb2] = band ? hsl(id.fhue, 52, 62) : hsl(44, 20, 86);
						paint(s, bx + x + lean, by - tipH - k, pr2 * kk * crease, pg2 * kk * crease, pb2 * kk * crease, 1);
					}
				}
			}

			if (done > 0) {
				const gy = crest + (caseBot - crest) * 0.4;
				const rr = half * 3.2;
				for (let dy = -rr * 0.8; dy <= rr * 0.8; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx / rr, dy / (rr * 0.8));
						if (d > 1) continue;
						plot(s, cx + dx, gy + dy, 255, 226, 178, (1 - d) ** 2 * done * 0.22);
					}
				for (let k = 0; k < 9; k++) {
					const ph = k * 1.7 + id.swirlPh;
					const t3 = (s.t * 0.012 + k * 0.11) % 1;
					const mx = cx + Math.sin(ph + t3 * 3) * half * 1.5;
					const my = crest - t3 * s.h * 0.3;
					plot(s, mx, my, 255, 244, 214, (1 - t3) * done * 0.6 * Math.max(0, Math.sin(t3 * 3.14)));
				}
			}

			s.out = Math.min(1, (pipe > 0 && pipe < 1 ? 0.3 : 0) + shake * 0.34 + (dropT > 0 && dropT < 0.35 ? 0.4 : 0) + done * 0.7 + 0.08);
			blit(s);
		}
	};
}

function drawTopper(s: FxScene, cx: number, cy: number, r: number, kind: number, fhue: number, dir: number) {
	if (kind === 0) {
		for (let dy = -r; dy <= r; dy++)
			for (let dx = -r; dx <= r; dx++) {
				const d = Math.hypot(dx, dy) / r;
				if (d > 1) continue;
				const nz = Math.sqrt(Math.max(0, 1 - d * d));
				const lam = Math.max(0, -(dy / r) * 0.7 - (dx / r) * dir * 0.5);
				const k = 0.36 + lam * 0.6 + nz * 0.3;
				paint(s, cx + dx, cy + dy, 196 * k, 34 * k, 52 * k, 1);
			}
		plot(s, cx - dir * r * 0.4, cy - r * 0.42, 255, 232, 232, 0.85);
		for (let k = 0; k < 5; k++) paint(s, cx + dir * k * 0.5, cy - r - k * 0.8, 92, 132, 58, 1);
	} else if (kind === 1) {
		for (let a = 0; a < 6.283; a += 0.12) {
			const spike = 1 + Math.cos(a * 5) * 0.55;
			for (let q = 0; q <= r * spike; q += 0.5) {
				const f = q / (r * spike + 0.01);
				const [gr3, gg3, gb3] = hsl(46, 88, 54 + (1 - f) * 34);
				paint(s, cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.9, gr3, gg3, gb3, 1);
			}
		}
		plot(s, cx, cy - r * 0.3, 255, 250, 216, 0.9);
	} else {
		const lean = dir * 0.34;
		const len = r * 3.4;
		for (let k = 0; k <= len; k += 0.5) {
			const f = k / len;
			const px2 = cx + lean * k;
			const py2 = cy - k;
			const hw = r * 0.44;
			for (let q = -hw; q <= hw; q += 0.5) {
				const u = q / hw;
				const round = Math.sqrt(Math.max(0, 1 - u * u));
				const dip = f < 0.46 ? 1 : 0;
				const kk = 0.5 + round * 0.55 + Math.max(0, 1 - Math.abs(u + dir * 0.4) * 2.4) * 0.4;
				const [wr3, wg3, wb3] = dip ? hsl(24, 52, 26) : hsl(38, 42, 74);
				paint(s, px2 + q, py2, wr3 * kk, wg3 * kk, wb3 * kk, 1);
			}
			if (f < 0.46 && f > 0.36) for (let q = -hw - 0.6; q <= hw + 0.6; q += 0.5) paint(s, px2 + q, py2, 46, 28, 20, 1);
		}
		for (let k = 0; k < 4; k++) {
			const a = k * 1.57 + 0.4;
			const [sr, sg2, sb] = hsl(fhue, 88, 72);
			paint(s, cx + lean * len * 0.3 + Math.cos(a) * r * 0.7, cy - len * 0.3 + Math.sin(a) * r * 0.5, sr, sg2, sb, 1);
		}
	}
}

const PAPERS = [348, 200, 42, 268, 160, 12, 220, 300];

type Gift = {
	paper: number;
	kind: number;
	stripe: number;
	bw: number;
	bh: number;
	depth: number;
	skew: number;
	rhue: number;
	rw: number;
	bowR: number;
	side: number;
	period: number;
	grain: number;
	wall: number;
	conf: number[];
	tone: number;
	tag: number;
};

function giftIdent(s: FxScene): Gift {
	const r = mulberry32(s.v.seed + 25209);
	const pi = (r() * PAPERS.length) | 0;
	const paper = PAPERS[pi];
	const kind = (r() * 3) | 0;
	const stripe = 3 + r() * 4;
	const bw = 0.15 + r() * 0.05;
	const bh = 0.2 + r() * 0.1;
	const depth = 0.1 + r() * 0.06;
	const skew = 0.2 + r() * 0.2;
	const rhue = PAPERS[(pi + 3 + ((r() * 3) | 0)) % PAPERS.length];
	const rw = 0.018 + r() * 0.01;
	const bowR = 0.055 + r() * 0.022;
	const side = r() < 0.5 ? -1 : 1;
	const period = 400 + ((r() * 200) | 0);
	const grain = (r() * 9999) | 0;
	const wall = 196 + r() * 130;
	const conf: number[] = [];
	for (let i = 0; i < 5; i++) conf.push(r() * 360);
	const tone = r();
	const tag = r() < 0.55 ? 1 : 0;
	return { paper, kind, stripe, bw, bh, depth, skew, rhue, rw, bowR, side, period, grain, wall, conf, tone, tag };
}

function loft(
	s: FxScene,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	dx: number,
	dy: number,
	fn: (x: number, y: number, u: number, v: number) => void
) {
	const su = Math.max(2, Math.ceil(Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - dx, cy - dy)) * 1.7));
	const sv = Math.max(2, Math.ceil(Math.max(Math.hypot(dx - ax, dy - ay), Math.hypot(cx - bx, cy - by)) * 1.7));
	for (let iv = 0; iv <= sv; iv++) {
		const v = iv / sv;
		const p0x = ax + (dx - ax) * v;
		const p0y = ay + (dy - ay) * v;
		const p1x = bx + (cx - bx) * v;
		const p1y = by + (cy - by) * v;
		for (let iu = 0; iu <= su; iu++) {
			const u = iu / su;
			fn(p0x + (p1x - p0x) * u, p0y + (p1y - p0y) * u, u, v);
		}
	}
}

function ribbonRun(s: FxScene, pts: number[][], wFn: (t: number) => number, cFn: (t: number, q: number) => [number, number, number]) {
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i];
		const b = pts[i + 1];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const len = Math.hypot(dx, dy) || 1;
		const nx = -dy / len;
		const ny = dx / len;
		const steps = Math.max(1, Math.ceil(len * 1.6));
		for (let k = 0; k <= steps; k++) {
			const f = k / steps;
			const t = (i + f) / (pts.length - 1);
			const w = wFn(t);
			const px = a[0] + dx * f;
			const py = a[1] + dy * f;
			for (let q = -w; q <= w; q += 0.45) {
				const u = q / (w + 0.001);
				const [r2, g2, b2] = cFn(t, u);
				paint(s, px + nx * q, py + ny * q, r2, g2, b2, 1);
			}
		}
	}
}

export function makeRibbon(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = giftIdent(s);
			(s as any).tails = [[], []] as number[][][];
			(s as any).conf = [] as number[][];
			(s as any).rest = [] as number[][];
			(s as any).lastc = 2;
			(s as any).tied = false;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Gift;
			const tails = (s as any).tails as number[][][];
			const conf = (s as any).conf as number[][];
			const rest = (s as any).rest as number[][];
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const reset = cyc < (s as any).lastc;
			(s as any).lastc = cyc;

			const tableY = Math.round(s.h * 0.78);
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.04;
			const bw = s.w * id.bw;
			const bh = s.h * id.bh;
			const dep = s.h * id.depth;
			const skw = id.side * bw * id.skew;
			const topY = tableY - bh;
			const backY = topY - dep;

			const pull = cyc < 0.3 ? 0 : Math.min(1, (cyc - 0.3) / 0.12);
			const lift = cyc < 0.44 ? 0 : cyc < 0.82 ? Math.min(1, (cyc - 0.44) / 0.1) : Math.max(0, 1 - (cyc - 0.82) / 0.08);
			const glow = cyc < 0.46 ? 0 : cyc < 0.84 ? Math.min(1, (cyc - 0.46) / 0.08) : Math.max(0, 1 - (cyc - 0.84) / 0.06);
			const retie = cyc > 0.92 ? (cyc - 0.92) / 0.08 : 0;
			const loopR = (pull < 1 ? 1 - pull : 0) + retie;
			const thump = cyc > 0.88 && cyc < 0.93 ? 1 - (cyc - 0.88) / 0.05 : 0;

			const anchor = [cx + skw * 0.5, backY + dep * 0.5];
			if (reset || !(s as any).tied) {
				for (let ti = 0; ti < 2; ti++) {
					const ch: number[][] = [];
					const dirx = ti === 0 ? -1 : 1;
					for (let i = 0; i < 9; i++) {
						const f = i / 8;
						const x = anchor[0] + dirx * f * bw * 0.6;
						const y = anchor[1] + f * f * bh * 0.55;
						ch.push([x, y, x, y]);
					}
					tails[ti] = ch;
				}
				conf.length = 0;
				rest.length = 0;
				(s as any).tied = true;
			}

			const [wr, wg, wb] = hsl(id.wall, 14, 17 + id.tone * 6);
			for (let y = 0; y < tableY; y++) {
				const f = y / tableY;
				for (let x = 0; x < s.w; x++) {
					const n = chip(x >> 1, y >> 1, id.grain) / 100;
					const rail = Math.abs(y - tableY * 0.46) < 1.4 ? 1.5 : 1;
					const k = (0.72 + f * 0.6 + n * 0.1) * rail;
					paint(s, x, y, wr * k, wg * k, wb * k, 1);
				}
			}
			const [tr2, tg2, tb2] = hsl(28 + id.tone * 8, 34, 30);
			for (let y = tableY; y < s.h; y++) {
				const f = (y - tableY) / Math.max(1, s.h - tableY);
				for (let x = 0; x < s.w; x++) {
					const g = Math.sin(x * 0.11 + Math.sin(x * 0.03 + y * 0.7) * 2.2) * 0.5 + 0.5;
					const n = chip(x, y, id.grain + 7) / 100;
					const k = 0.88 + f * 0.42 + g * 0.2 + n * 0.12 + Math.max(0, 1 - Math.abs(y - tableY) / 1.6) * 0.55;
					paint(s, x, y, tr2 * k, tg2 * k * 0.94, tb2 * k * 0.86, 1);
				}
			}

			const shR = bw * 2.2;
			for (let dy = -2.4; dy <= 2.4; dy++)
				for (let dx = -shR; dx <= shR; dx++) {
					const d = Math.hypot(dx / shR, dy / 2.4);
					if (d > 1) continue;
					paint(s, cx + skw * 0.4 + dx, tableY + 1 + dy * 0.6, 0, 0, 0, (1 - d) * 0.5);
				}

			const [pr, pg, pb] = hsl(id.paper, 52 + s.v.sat * 0.2, 54);
			const faceShade = (x: number, y: number, u: number, v: number, base: number) => {
				let pat = 1;
				if (id.kind === 0) pat = Math.abs((((u * id.stripe + v * 0.6) % 1) + 1) % 1) < 0.46 ? 1.18 : 0.84;
				else if (id.kind === 1) pat = chip(Math.round(u * id.stripe * 3), Math.round(v * id.stripe * 3), id.grain + 3) < 30 ? 1.22 : 0.9;
				else pat = Math.abs(Math.sin(u * id.stripe * 3.1) * Math.sin(v * id.stripe * 2.4)) > 0.6 ? 1.2 : 0.88;
				const n = chip(x | 0, y | 0, id.grain + 11) / 100;
				return base * pat * (0.94 + n * 0.12);
			};

			loft(s, cx - bw, topY, cx + bw, topY, cx + bw, tableY, cx - bw, tableY, (x, y, u, v) => {
				const lit = 0.62 + Math.max(0, 1 - Math.abs(u - (s.v.dir > 0 ? 0.24 : 0.76)) * 1.9) * 0.5 - v * 0.2;
				const k = faceShade(x, y, u, v, lit);
				paint(s, x, y, pr * k, pg * k, pb * k, 1);
			});
			loft(s, cx + bw, topY, cx + bw + skw, backY, cx + bw + skw, backY + bh, cx + bw, tableY, (x, y, u, v) => {
				const k = faceShade(x, y, u, v, 0.46 + u * 0.12);
				paint(s, x, y, pr * k, pg * k, pb * k, 1);
			});

			const mouthA = [cx - bw, topY];
			const mouthB = [cx + bw, topY];
			const mouthC = [cx + bw + skw, backY];
			const mouthD = [cx - bw + skw, backY];
			if (lift > 0.01) {
				loft(s, mouthA[0], mouthA[1], mouthB[0], mouthB[1], mouthC[0], mouthC[1], mouthD[0], mouthD[1], (x, y, u, v) => {
					const k = 0.14 + v * 0.3;
					paint(s, x, y, pr * k * 0.5, pg * k * 0.5, pb * k * 0.6, 1);
				});
				const inset = 1.4;
				loft(
					s,
					mouthA[0] + inset,
					mouthA[1] - inset * 0.4,
					mouthB[0] - inset,
					mouthB[1] - inset * 0.4,
					mouthC[0] - inset,
					mouthC[1] + inset * 0.4,
					mouthD[0] + inset,
					mouthD[1] + inset * 0.4,
					(x, y, u, v) => {
						const k = 0.06 + v * 0.14;
						paint(s, x, y, 30 * k * 6, 26 * k * 6, 34 * k * 6, 1);
					}
				);
			}

			if (glow > 0.01) {
				const gx = cx + skw * 0.5;
				const gy = topY - dep * 0.4;
				const [lr, lg, lb] = hsl(48, 88, 66);
				for (let y = 0; y < gy; y++) {
					const f = (gy - y) / Math.max(1, gy);
					const half = bw * (0.5 + f * 1.5);
					for (let x = gx - half; x <= gx + half; x++) {
						const u = Math.abs(x - gx) / half;
						plot(s, x, y, lr, lg, lb, (1 - u) ** 2 * (1 - f) * glow * 0.42);
					}
				}
				for (let dy = -dep; dy <= dep * 0.6; dy++)
					for (let dx = -bw; dx <= bw; dx++) {
						const d = Math.hypot(dx / bw, dy / dep);
						if (d > 1) continue;
						plot(s, gx + dx, gy + dy, 255, 236, 190, (1 - d) ** 2 * glow * 0.8);
					}
			}

			if (cyc > 0.46 && cyc < 0.58 && conf.length < 120) {
				for (let k = 0; k < 5; k++) {
					const mx = cx + skw * 0.5 + (s.rnd() - 0.5) * bw * 1.5;
					conf.push([
						mx,
						topY - dep * 0.3,
						(s.rnd() - 0.5) * 1.5,
						-(0.9 + s.rnd() * 1.5),
						(s.rnd() * 5) | 0,
						s.rnd() * 6.28,
						(s.rnd() - 0.5) * 0.45,
						s.rnd() < 0.3 ? 1 : 0
					]);
				}
			}

			const lx = lift * bh * 0.95;
			const hinge = lift * dep * 1.5;
			const la = [cx - bw - lift * 2, topY - lx];
			const lb2 = [cx + bw + lift * 2, topY - lx];
			const lc = [cx + bw + skw, backY - lx * 0.3 - hinge];
			const ld = [cx - bw + skw, backY - lx * 0.3 - hinge];
			const rimH = Math.max(2.4, s.h * 0.055);
			loft(s, la[0], la[1] + rimH, lb2[0], lb2[1] + rimH, lb2[0], lb2[1], la[0], la[1], (x, y, u, v) => {
				const k = (0.34 + v * 0.36) * (0.92 + Math.max(0, 1 - Math.abs(u - 0.3) * 2) * 0.2);
				paint(s, x, y, pr * k, pg * k, pb * k, 1);
			});
			loft(s, lb2[0], lb2[1] + rimH, lc[0], lc[1] + rimH * 0.7, lc[0], lc[1], lb2[0], lb2[1], (x, y, u, v) => {
				const k = (0.22 + v * 0.26) * (1 + u * 0.16);
				paint(s, x, y, pr * k, pg * k, pb * k, 1);
			});
			loft(s, la[0], la[1], lb2[0], lb2[1], lc[0], lc[1], ld[0], ld[1], (x, y, u, v) => {
				const lit = 0.9 + Math.max(0, 1 - Math.abs(u - 0.4) * 1.6) * 0.34 - v * 0.24 + lift * 0.18;
				const k = faceShade(x, y, u, v, lit);
				paint(s, x, y, pr * k, pg * k, pb * k, 1);
			});

			const [rr2, rg2, rb2] = hsl(id.rhue, 62 + s.v.sat * 0.2, 56);
			const bandFade = 1 - pull;
			if (bandFade > 0.02) {
				const slip = pull * bw * 2.6 * id.side;
				const rwp = s.w * id.rw;
				loft(s, cx - rwp + slip, topY - lx, cx + rwp + slip, topY - lx, cx + rwp + slip, tableY, cx - rwp + slip, tableY, (x, y, u) => {
					const k = 0.62 + Math.max(0, 1 - Math.abs(u - 0.3) * 2.4) * 0.66;
					paint(s, x, y, rr2 * k, rg2 * k, rb2 * k, bandFade);
				});
				loft(
					s,
					cx - rwp + slip,
					topY - lx,
					cx + rwp + slip,
					topY - lx,
					cx + rwp + slip + skw,
					backY - lx * 0.25,
					cx - rwp + slip + skw,
					backY - lx * 0.25,
					(x, y, u) => {
						const k = 0.82 + Math.max(0, 1 - Math.abs(u - 0.35) * 2.4) * 0.6;
						paint(s, x, y, rr2 * k, rg2 * k, rb2 * k, bandFade);
					}
				);
			}

			const knotX = anchor[0];
			const knotY = anchor[1] - lx * 0.6;
			for (let ti = 0; ti < 2; ti++) {
				const ch = tails[ti];
				const freed = pull > 0.02 && retie <= 0;
				for (let i = 1; i < ch.length; i++) {
					const c = ch[i];
					const vx = (c[0] - c[2]) * 0.93;
					const vy = (c[1] - c[3]) * 0.93;
					c[2] = c[0];
					c[3] = c[1];
					const yank = freed && pull < 1 ? id.side * (ti === 0 ? 1 : 0.55) * (i / ch.length) * 1.25 : 0;
					c[0] += vx * (freed ? 0.86 : 1) + yank + Math.sin(s.t * 0.09 + i) * 0.1 * s.v.drift;
					c[1] += vy + (freed ? 0.16 : 0.05);
					const floor = tableY - 0.5 + (i % 3) * 0.6;
					if (c[1] > floor) {
						c[1] = floor;
						c[0] -= (c[0] - c[2]) * 0.72;
					}
					if (c[0] < 1) c[0] = 1;
					if (c[0] > s.w - 2) c[0] = s.w - 2;
				}
				if (!freed) {
					ch[0][0] = knotX;
					ch[0][1] = knotY;
				}
				const seg = bw * (pull > 0.02 ? 0.26 : 0.16);
				for (let pass = 0; pass < 3; pass++) {
					for (let i = 1; i < ch.length; i++) {
						const a = ch[i - 1];
						const b = ch[i];
						const ddx = b[0] - a[0];
						const ddy = b[1] - a[1];
						const d = Math.hypot(ddx, ddy) || 1;
						const corr = (d - seg) / d / 2;
						const mx = ddx * corr;
						const my = ddy * corr;
						if (i > 1 || freed) {
							a[0] += mx;
							a[1] += my;
						}
						b[0] -= mx;
						b[1] -= my;
					}
					if (!freed) {
						ch[0][0] = knotX;
						ch[0][1] = knotY;
					}
				}
				ribbonRun(
					s,
					ch,
					(t) => s.w * id.rw * (0.9 - t * 0.45) * (1 - Math.max(0, t - 0.88) * 7),
					(t, q) => {
						const twist = Math.abs(Math.cos(t * 7 + ti * 1.4));
						const k = 0.46 + (1 - Math.abs(q)) * 0.5 * (0.4 + twist * 0.8) + Math.max(0, 1 - Math.abs(q + 0.4) * 2.2) * 0.34;
						return [rr2 * k, rg2 * k, rb2 * k];
					}
				);
			}

			if (loopR > 0.02) {
				const R = s.w * id.bowR * Math.min(1, loopR);
				for (let side = -1; side <= 1; side += 2) {
					const flap = Math.sin(s.t * 0.09 * s.v.speed + side * 1.5) * 0.1 * s.v.drift;
					const pts: number[][] = [];
					for (let k = 0; k <= 22; k++) {
						const a = -2.75 + (k / 22) * 5.5;
						const rr3 = R * (1 - Math.cos(a) * 0.5);
						const px = knotX + side * (Math.sin(a) * rr3 * 1.9 + R * 0.3);
						const py = knotY - (1 - Math.cos(a)) * R * 0.44 + flap * R * Math.abs(Math.sin(a));
						pts.push([px, py]);
					}
					ribbonRun(
						s,
						pts,
						(t) => s.w * id.rw * (0.55 + Math.sin(t * 3.1416) * 0.8) * Math.min(1, loopR),
						(t, q) => {
							const face = 0.35 + Math.abs(Math.sin(t * 3.1416 * 1.1)) * 0.75;
							const k = 0.4 + face * 0.62 + (1 - Math.abs(q)) * 0.3 + Math.max(0, 1 - Math.abs(q + 0.45) * 2.4) * 0.26;
							return [rr2 * k, rg2 * k, rb2 * k];
						}
					);
				}
				const kr = R * 0.4;
				for (let dy = -kr; dy <= kr; dy++)
					for (let dx = -kr * 1.25; dx <= kr * 1.25; dx++) {
						const d = Math.hypot(dx / (kr * 1.25), dy / kr);
						if (d > 1) continue;
						const nz = Math.sqrt(Math.max(0, 1 - d * d));
						const k = 0.55 + nz * 0.7 + Math.max(0, -dy / kr) * 0.3;
						paint(s, knotX + dx, knotY + dy, rr2 * k, rg2 * k, rb2 * k, 1);
					}
			}

			for (let i = conf.length - 1; i >= 0; i--) {
				const c = conf[i];
				c[3] += 0.052;
				c[0] += c[2] * (0.8 + s.v.drift * 0.5);
				c[1] += c[3] * s.v.speed;
				c[5] += c[6];
				c[2] *= 0.992;
				if (c[1] >= tableY - 0.5 && c[3] > 0) {
					rest.push([c[0], tableY - 0.5 + s.rnd() * 2.5, c[4], c[5], c[7]]);
					if (rest.length > 90) rest.shift();
					conf.splice(i, 1);
					continue;
				}
				if (c[0] < -3 || c[0] > s.w + 3 || c[1] > s.h + 2) {
					conf.splice(i, 1);
					continue;
				}
				const [hr, hg, hb] = hsl(id.conf[c[4]], 86, 66);
				if (c[7]) {
					for (let k = 0; k < 5; k++) {
						const a = c[5] + k * 0.9;
						plot(s, c[0] + Math.cos(a) * 1.5, c[1] + k * 0.8, hr, hg, hb, 0.9 - k * 0.1);
					}
				} else {
					const fl = Math.abs(Math.cos(c[5]));
					for (let q = -1.2; q <= 1.2; q += 0.6)
						plot(s, c[0] + Math.cos(c[5]) * q, c[1] + Math.sin(c[5]) * q * 0.4, hr * (0.6 + fl * 0.6), hg * (0.6 + fl * 0.6), hb * (0.6 + fl * 0.6), 0.95);
				}
			}
			for (const q of rest) {
				const [hr, hg, hb] = hsl(id.conf[q[2]], 80, 58);
				for (let k = -1.1; k <= 1.1; k += 0.55) {
					paint(s, q[0] + Math.cos(q[3]) * k, q[1] + Math.sin(q[3]) * k * 0.3 + 0.8, 0, 0, 0, 0.3);
					paint(s, q[0] + Math.cos(q[3]) * k, q[1] + Math.sin(q[3]) * k * 0.3, hr, hg, hb, 1);
				}
			}

			if (id.tag && pull < 1) {
				const tx = cx - bw - 2.4;
				const ty = topY + bh * 0.3 + Math.sin(s.t * 0.06) * 0.6 * (1 - pull);
				for (let dy = -2.4; dy <= 2.4; dy++)
					for (let dx = -2; dx <= 2; dx++) {
						const k = 0.8 + Math.max(0, 1 - Math.abs(dx + 1) / 3) * 0.5;
						paint(s, tx + dx, ty + dy, 226 * k, 216 * k, 198 * k, 1 - pull);
					}
				for (let k = 0; k < 3; k++) paint(s, tx - 1 + k, ty - 1 + k * 1.6, 120, 108, 96, (1 - pull) * 0.8);
			}

			if (thump > 0) {
				for (let x = 0; x < s.w; x++) {
					const d = Math.abs(x - cx) / s.w;
					plot(s, x, tableY, 255, 232, 200, thump * (1 - d) * 0.5);
				}
			}

			s.out = Math.min(1, glow * 0.8 + pull * (1 - pull) * 1.4 + thump * 0.5 + 0.08);
			blit(s);
		}
	};
}

const GEMS = [352, 208, 146, 44, 282, 14, 186, 320];
const FELTS = [232, 348, 150, 258, 20, 200];

type Jewel = {
	hue: number;
	hue2: number;
	facets: number;
	ang: number[];
	dep: number[];
	jag: number[];
	wood: number;
	felt: number;
	lamp: number;
	side: number;
	spokes: number;
	period: number;
	grain: number;
	table: number;
	tilt: number;
	planks: number;
};

function gemIdent(s: FxScene): Jewel {
	const r = mulberry32(s.v.seed + 27311);
	const gi = (r() * GEMS.length) | 0;
	const hue = GEMS[gi];
	const hue2 = GEMS[(gi + 2 + ((r() * 4) | 0)) % GEMS.length];
	const facets = 5 + ((r() * 4) | 0);
	const ang: number[] = [];
	const dep: number[] = [];
	for (let i = 0; i < 9; i++) {
		ang.push(r());
		dep.push(r());
	}
	const jag: number[] = [];
	for (let i = 0; i < 16; i++) jag.push(r());
	const wood = 16 + r() * 18;
	const felt = FELTS[(r() * FELTS.length) | 0];
	const lamp = 32 + r() * 16;
	const side = r() < 0.5 ? -1 : 1;
	const spokes = 4 + ((r() * 4) | 0);
	const period = 430 + ((r() * 190) | 0);
	const grain = (r() * 60) | 0;
	const table = 0.28 + r() * 0.16;
	const tilt = (r() - 0.5) * 1.2;
	const planks = 3 + ((r() * 3) | 0);
	return { hue, hue2, facets, ang, dep, jag, wood, felt, lamp, side, spokes, period, grain, table, tilt, planks };
}

export function makeGem(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = gemIdent(s);
			(s as any).spark = [] as number[][];
			(s as any).dust = new Float32Array(s.w);
		},
		frame(s) {
			const id = (s as any).id as Jewel;
			const spark = (s as any).spark as number[][];
			const dust = (s as any).dust as Float32Array;
			clear(s);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			if (cyc > 0.94) for (let x = 0; x < s.w; x++) dust[x] *= 0.9;

			const nf = id.facets;
			const g0 = 0.08;
			const g1 = 0.66;
			const slot = (g1 - g0) / nf;
			let cur = -1;
			let sub = 0;
			if (cyc >= g0 && cyc < g1) {
				cur = Math.min(nf - 1, Math.floor((cyc - g0) / slot));
				sub = (cyc - g0) / slot - cur;
			}
			const cutN = cyc < g0 ? 0 : cyc >= g1 ? nf : cur;
			const plunge = cur < 0 ? 0 : sub < 0.32 ? 0 : sub < 0.84 ? Math.min(1, (sub - 0.32) / 0.14) : Math.max(0, 1 - (sub - 0.84) / 0.16);
			const cutT = cur < 0 ? 0 : sub < 0.32 ? 0 : Math.min(1, (sub - 0.32) / 0.46);
			const flash = cyc < 0.7 ? 0 : cyc < 0.76 ? (cyc - 0.7) / 0.06 : cyc < 0.87 ? 1 : Math.max(0, 1 - (cyc - 0.87) / 0.06);
			const swap = cyc > 0.94 ? (cyc - 0.94) / 0.06 : cyc < 0.05 ? 1 - cyc / 0.05 : 0;

			const benchY = Math.round(s.h * 0.72);
			const cx = s.w * 0.5;
			const gy = s.h * 0.4;
			const R = s.h * 0.225;
			const cy = gy - swap * s.h * 0.72;
			const lx = cx - id.side * s.w * 0.33;
			const ly = s.h * 0.08;

			const wallPal: number[][] = [];
			for (let i = 0; i < 24; i++) wallPal.push(hsl(id.lamp - 16, 28, 2 + i * 0.9));
			for (let y = 0; y < benchY; y++) {
				for (let x = 0; x < s.w; x++) {
					const d = Math.min(1, Math.hypot((x - lx) / (s.w * 0.6), (y - ly) / (s.h * 1.05)));
					const l = 1 + (1 - d) * (1 - d) * 15 + (chip(x, y, 31) % 6) * 0.22;
					const c = wallPal[Math.max(0, Math.min(23, Math.round(l / 0.9)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const shelfY = Math.round(s.h * 0.2);
			const shPal: number[][] = [];
			for (let i = 0; i < 14; i++) shPal.push(hsl(id.wood - 4, 34, 3 + i * 1.1));
			for (let y = shelfY; y < shelfY + 3; y++) {
				for (let x = 0; x < s.w; x++) {
					const lf = Math.max(0, 1 - Math.abs(x - lx) / (s.w * 0.7));
					const c = shPal[Math.max(0, Math.min(13, Math.round((y === shelfY ? 7 : y === shelfY + 1 ? 4 : 1) + lf * 5)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}
			for (let j = 0; j < 5; j++) {
				const jr = mulberry32(s.v.seed + 5100 + j * 77);
				const jx = (0.08 + jr() * 0.84) * s.w;
				if (Math.abs(jx - cx) < s.w * 0.1) continue;
				const jh = 3 + jr() * 6;
				const jw = 1.6 + jr() * 1.8;
				const jhue = GEMS[(jr() * GEMS.length) | 0];
				for (let y = shelfY - jh; y < shelfY; y++) {
					const t2 = (y - (shelfY - jh)) / jh;
					const hw2 = jw * (0.4 + t2 * 0.6);
					for (let x = -hw2; x <= hw2; x++) {
						const lfc = Math.max(0, 1 - Math.abs(jx - lx) / (s.w * 0.8));
						const c = hsl(jhue, 44, 10 + (1 - Math.abs(x) / (hw2 + 0.4)) * 14 + lfc * 12 + t2 * 5);
						paint(s, jx + x, y, c[0], c[1], c[2], 1);
					}
				}
			}

			const woodPal: number[][] = [];
			for (let i = 0; i < 22; i++) woodPal.push(hsl(id.wood, 40, 5 + i * 1.1));
			const ph = Math.max(4, Math.round((s.h - benchY) / id.planks));
			for (let y = benchY; y < s.h; y++) {
				const dp = (y - benchY) / Math.max(1, s.h - benchY);
				const seam = (y - benchY) % ph === 0 ? -3.4 : 0;
				for (let x = 0; x < s.w; x++) {
					const gr = chip(x * 2, (y / 2) | 0, id.grain) % 100;
					const lf = Math.max(0, 1 - Math.abs(x - lx) / (s.w * 0.8)) * (1 - dp * 0.5);
					const l = 2 + dp * 4 + gr * 0.05 + seam + lf * 5;
					const c = woodPal[Math.max(0, Math.min(21, Math.round(l / 1.1)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const padY = benchY + 3;
			const padH = Math.max(5, (s.h - benchY) * 0.62);
			const feltPal: number[][] = [];
			for (let i = 0; i < 22; i++) feltPal.push(hsl(id.felt, 26, 8 + i * 1.5));
			for (let y = padY; y < padY + padH; y++) {
				const v = (y - padY) / padH;
				const hw = s.w * (0.17 + v * 0.11);
				const px0 = Math.max(0, Math.floor(cx - hw));
				const px1 = Math.min(s.w, Math.ceil(cx + hw));
				for (let x = px0; x < px1; x++) {
					const u = (x - cx) / hw;
					const ex = Math.min(1, (hw - Math.abs(x - cx)) / 2.2);
					if (ex <= 0) continue;
					const n = chip(x, y, 57) % 100;
					const nap = (chip((x / 2) | 0, (y / 2) | 0, 91) % 100) / 100;
					let l = 10 + n * 0.05 + nap * 5 + v * 7 + (1 - u * u) * 6;
					if (v > 0.82) l -= 8 + (v - 0.82) * 22;
					if (v < 0.1) l += 7 - v * 30;
					if (Math.abs(u) > 0.84) l -= (Math.abs(u) - 0.84) * 34;
					const sh = Math.max(0, 1 - Math.abs(x - cx) / 9) * Math.max(0, 1 - v * 2.4);
					l -= sh * 7;
					const c = feltPal[Math.max(0, Math.min(21, Math.round((l - 8) / 1.5)))];
					paint(s, x, y, c[0], c[1], c[2], ex);
				}
			}

			for (let yy = -4; yy <= 4; yy++) {
				const t = (yy + 4) / 8;
				const hw = 3.5 + t * 6;
				for (let xx = -hw; xx <= hw; xx++) {
					const l = 30 - (Math.abs(xx) / hw) * 15 + (1 - t) * 8;
					const c = hsl(id.lamp + 8, 26, l);
					paint(s, lx + xx, ly + yy, c[0], c[1], c[2], 1);
				}
			}
			const [bur, bug, bub] = hsl(id.lamp + 14, 78, 88);
			for (let yy = 3; yy <= 7; yy++) {
				for (let xx = -5; xx <= 5; xx++) {
					const a = Math.max(0, 1 - Math.hypot(xx / 5, (yy - 4) / 4));
					plot(s, lx + xx, ly + yy, bur, bug, bub, a * a * 0.85);
				}
			}

			const coneBot = benchY + 5;
			const [cnr, cng, cnb] = hsl(id.lamp, 72, 78);
			const flick = 1 + Math.sin(s.t * 0.11) * 0.1 * s.v.drift;
			for (let y = ly + 5; y < coneBot; y++) {
				const t = (y - ly - 5) / Math.max(1, coneBot - ly - 5);
				const mxc = lx + (cx - lx) * t;
				const hw = 4 + t * s.w * 0.19;
				const px0 = Math.max(0, Math.floor(mxc - hw));
				const px1 = Math.min(s.w, Math.ceil(mxc + hw));
				for (let x = px0; x < px1; x++) {
					const u = 1 - Math.abs(x - mxc) / hw;
					if (u <= 0) continue;
					plot(s, x, y, cnr, cng, cnb, u * u * 0.075 * flick * (1 - t * 0.4));
				}
			}

			const steel: number[][] = [];
			for (let i = 0; i < 48; i++) steel.push(hsl(206, 9, 3 + i * 1.1));
			const sid = (l: number) => steel[Math.max(0, Math.min(47, Math.round((l - 3) / 1.1)))];

			const ca = id.side > 0 ? -0.2 : Math.PI + 0.2;
			const Rw = s.h * 0.3;
			const dist = R + Rw + 2.2 - plunge * 2.4;
			const wcx = cx + Math.cos(ca) * dist;
			const wcy = gy + Math.sin(ca) * dist;
			const whA = s.t * 0.44 * s.v.speed * s.v.dir;
			const rimW = 4.2;
			for (let y = Math.max(0, Math.floor(wcy - Rw)); y < Math.min(s.h, Math.ceil(wcy + Rw + 1)); y++) {
				for (let x = Math.max(0, Math.floor(wcx - Rw)); x < Math.min(s.w, Math.ceil(wcx + Rw + 1)); x++) {
					const dx = x + 0.5 - wcx;
					const dy = y + 0.5 - wcy;
					const d = Math.hypot(dx, dy);
					if (d > Rw) continue;
					const a2 = Math.atan2(dy, dx) + whA;
					let l;
					if (d > Rw - rimW) {
						const grit = chip((Math.cos(a2) * 52) | 0, (Math.sin(a2) * 52) | 0, 11) % 100;
						l = 16 + grit * 0.46 + Math.max(0, rimW - (Rw - d)) * 2.2;
					} else if (d < Rw * 0.16) {
						l = 30 - d * 3;
					} else {
						const sp = Math.abs(Math.sin(a2 * id.spokes * 0.5));
						l = 5 + sp * sp * 7 + (1 - d / Rw) * 3;
					}
					const c = sid(l);
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const rodTop = cy + R * 0.78;
			const mastTop = Math.max(0, Math.floor(gy + R * 0.78));
			for (let y = mastTop; y < benchY; y++) {
				for (let dx = -1; dx <= 1; dx++) paint(s, cx + dx, y, ...(sid(dx === -1 ? 28 : dx === 0 ? 18 : 10) as [number, number, number]), 1);
			}
			for (let dx = -6; dx <= 6; dx++) {
				for (let dy = -2; dy <= 3; dy++) {
					const l = 22 - Math.abs(dx) * 0.8 - dy * 2.4;
					const c = sid(l);
					paint(s, cx + dx, benchY + dy, c[0], c[1], c[2], 1);
				}
			}
			if (swap < 0.5) {
				for (let dy = 0; dy < 3; dy++) {
					const hw = 2.6 - dy * 0.6;
					for (let dx = -hw; dx <= hw; dx++) {
						const c = sid(30 - dy * 4 - Math.abs(dx) * 2);
						paint(s, cx + dx, rodTop + dy, c[0], c[1], c[2], 1 - swap * 2);
					}
				}
			}

			const laF = (i: number) => (i / nf) * 6.28318 + (id.ang[i] - 0.5) * 0.4 + id.tilt + s.v.tilt * 0.4;
			let rot;
			if (cur < 0) rot = ca - laF(cyc < g0 ? 0 : nf - 1);
			else {
				const e = sub < 0.32 ? sub / 0.32 : 1;
				const sm = e * e * (3 - 2 * e);
				const from = cur === 0 ? laF(0) : laF(cur - 1);
				rot = ca - (from + (laF(cur) - from) * sm);
			}
			if (cyc >= g1) rot += (cyc - g1) * 9 * s.v.dir;

			const lightA = Math.atan2(ly - cy, lx - cx);
			const dpF = (i: number) => 0.58 + id.dep[i] * 0.28;
			const gx0 = Math.max(0, Math.floor(cx - R * 1.6));
			const gx1 = Math.min(s.w, Math.ceil(cx + R * 1.6));
			const gy0 = Math.max(0, Math.floor(cy - R * 1.6));
			const gy1 = Math.min(s.h, Math.ceil(cy + R * 1.6));
			for (let y = gy0; y < gy1; y++) {
				for (let x = gx0; x < gx1; x++) {
					const dx = (x + 0.5 - cx) / R;
					const dy = (y + 0.5 - cy) / (R * 0.94);
					const rr = Math.hypot(dx, dy);
					if (rr > 1.6) continue;
					const th = Math.atan2(dy, dx);
					const k = (((((th - rot) / 6.28318) % 1) + 1) % 1) * 16;
					const k0 = k | 0;
					const kf = k - k0;
					const j = id.jag[k0] + (id.jag[(k0 + 1) % 16] - id.jag[k0]) * kf;
					let lim = 1 + (j - 0.5) * 0.34;
					let lim2 = 9;
					let best = -1;
					for (let i = 0; i < nf; i++) {
						const d = i < cutN ? dpF(i) : i === cur ? 1.35 + (dpF(i) - 1.35) * cutT : 9;
						if (d > 1.6) continue;
						const c2 = Math.cos(th - (laF(i) + rot));
						if (c2 < 0.14) continue;
						const v = d / c2;
						if (v < lim) {
							lim2 = lim;
							lim = v;
							best = i;
						} else if (v < lim2) lim2 = v;
					}
					if (rr > lim) continue;
					let hue = id.hue;
					let sat = 60;
					let l;
					if (best >= 0) {
						const face = Math.max(0, Math.cos(laF(best) + rot - lightA));
						const sq = face * face;
						l = 14 + sq * 48 + (1 - rr / lim) * 14;
						hue = id.hue + (id.hue2 - id.hue) * (id.dep[best] * 0.45);
						sat = 56 + id.dep[best] * 22;
						l += flash * (20 + sq * 48);
						hue += flash * (((best * 53) % 90) - 45);
					} else {
						const bx = dx * Math.cos(-rot) - dy * Math.sin(-rot);
						const by = dx * Math.sin(-rot) + dy * Math.cos(-rot);
						const cell = Math.floor(bx * 3.4 + 8) * 7 + Math.floor(by * 3.4 + 8) * 19;
						const fz = (chip(Math.floor(bx * 3.4), Math.floor(by * 3.4), 41 + id.grain) % 100) / 100;
						const shade = Math.max(0, Math.cos(th - lightA));
						l = 16 + fz * 13 + shade * shade * 20 + (1 - rr / lim) * 10 + ((cell % 3) - 1) * 2.4;
						sat = 22 + fz * 14;
						hue = id.hue + fz * 12;
					}
					if (rr < id.table) {
						l = Math.max(l, 32 + flash * 32 + Math.max(0, Math.cos(th - lightA)) * 12);
						sat *= 0.66;
					}
					if (rr > lim - 0.1) l *= 0.58;
					if (best < 0 && rr > lim - 0.22) l += 14;
					if (best >= 0 && lim2 - lim < 0.07) l += 28;
					const c = hsl(hue, Math.min(92, sat), Math.max(2, Math.min(96, l)));
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const [hlr, hlg, hlb] = hsl(id.hue, 70, 72 - (1 - cutN / nf) * 22);
			const hR = R * 1.72;
			for (let y = Math.max(0, Math.floor(cy - hR)); y < Math.min(s.h, Math.ceil(cy + hR)); y++) {
				for (let x = Math.max(0, Math.floor(cx - hR)); x < Math.min(s.w, Math.ceil(cx + hR)); x++) {
					const d = Math.hypot((x + 0.5 - cx) / R, (y + 0.5 - cy) / (R * 0.94));
					if (d < 0.96 || d > 1.72) continue;
					const f = 1 - (d - 0.96) / 0.76;
					plot(s, x, y, hlr, hlg, hlb, f * f * (0.2 + flash * 0.5));
				}
			}

			const contX = cx + Math.cos(ca) * R * 0.94;
			const contY = cy + Math.sin(ca) * R * 0.94;
			if (cutT > 0 && cutT < 1 && plunge > 0.35 && swap === 0) {
				const hx = contX - wcx;
				const hy = contY - wcy;
				const hn = Math.max(0.001, Math.hypot(hx, hy));
				const tx = (-hy / hn) * s.v.dir;
				const ty = (hx / hn) * s.v.dir;
				for (let i = 0; i < 3; i++) {
					const sp = 0.9 + s.rnd() * 2.2;
					spark.push([contX, contY, tx * sp + (s.rnd() - 0.5) * 0.9, ty * sp + (s.rnd() - 0.5) * 0.9 - 0.35, 0, 24 + s.rnd() * 24]);
				}
				for (let k = 0; k < 8; k++) {
					const a4 = s.rnd() * 6.28318;
					const rr3 = s.rnd() * 3.6;
					plot(s, contX + Math.cos(a4) * rr3, contY + Math.sin(a4) * rr3, 255, 228, 156, (1 - rr3 / 3.6) * 0.75 * plunge);
				}
			}
			if (plunge > 0) {
				for (let k = 0; k < 12; k++) {
					const a5 = ca + Math.PI + (s.rnd() - 0.5) * 0.55;
					const rr4 = Rw - s.rnd() * 3.4;
					plot(s, wcx + Math.cos(a5) * rr4, wcy + Math.sin(a5) * rr4, 255, 204, 128, plunge * 0.55 * s.rnd());
				}
			}

			for (let i = spark.length - 1; i >= 0; i--) {
				const p = spark[i];
				p[4] += 1;
				p[3] += 0.11;
				p[0] += p[2];
				p[1] += p[3];
				p[2] *= 0.985;
				if (p[1] >= benchY - 0.5 && p[3] > 0) {
					const xi = Math.round(p[0]);
					if (xi >= 0 && xi < s.w) dust[xi] = Math.min(3.3, dust[xi] + 0.45);
					if (s.rnd() < 0.55 || p[4] > 30) {
						spark.splice(i, 1);
						continue;
					}
					p[1] = benchY - 0.7;
					p[3] = -p[3] * 0.34;
					p[2] *= 0.6;
				}
				if (p[4] > p[5] || p[0] < -2 || p[0] > s.w + 2 || p[1] < -3) {
					spark.splice(i, 1);
					continue;
				}
				const lf = 1 - p[4] / p[5];
				const hot = lf * lf;
				const c = hsl(16 + hot * 36, 96, 46 + hot * 48);
				plot(s, p[0], p[1], c[0], c[1], c[2], 0.3 + lf * 0.65);
				plot(s, p[0] - p[2] * 0.7, p[1] - p[3] * 0.7, c[0], c[1], c[2], lf * 0.34);
			}
			if (spark.length > 130) spark.splice(0, spark.length - 130);

			for (let x = 0; x < s.w; x++) {
				const d = dust[x];
				if (d < 0.1) continue;
				const hgt = Math.min(3.2, d);
				for (let k = 0; k < hgt; k++) {
					const c = hsl(id.hue, 26, 30 + k * 6);
					paint(s, x, benchY - 1 - k, c[0], c[1], c[2], (1 - k / (hgt + 0.5)) * 0.85);
				}
			}

			if (flash > 0) {
				for (let i = 0; i < nf; i++) {
					const ra = laF(i) + rot;
					const sy = Math.sin(ra);
					if (sy < 0.14) continue;
					const sx = Math.cos(ra);
					const len = (benchY + 3 - cy) / sy;
					if (len <= R) continue;
					const [br, bg, bb] = hsl((i / nf) * 320 + 10, 92, 62);
					for (let t = R * 0.9; t < len; t += 0.7) {
						const px = cx + sx * t;
						const py = cy + sy * t;
						const spread = 0.4 + (t / len) * 2.6;
						const fade = flash * (1 - (t / len) * 0.4);
						for (let o = -spread; o <= spread; o += 0.8) {
							plot(s, px - sy * o, py + sx * o, br, bg, bb, (1 - Math.abs(o) / (spread + 0.3)) * 0.17 * fade);
						}
					}
					const hitX = cx + sx * len;
					for (let o = -4; o <= 4; o++) {
						for (let v = 0; v < 5; v++) {
							plot(s, hitX + o, benchY + 2 + v, br, bg, bb, (1 - Math.abs(o) / 5) * (1 - v / 5) * flash * 0.55);
						}
					}
				}
				const [pr, pg, pb] = hsl(id.hue, 82, 72);
				for (let y = benchY; y < s.h; y++) {
					for (let x = 0; x < s.w; x++) {
						const d = Math.hypot((x - cx) / (s.w * 0.3), (y - benchY) / Math.max(2, s.h - benchY));
						if (d > 1) continue;
						plot(s, x, y, pr, pg, pb, (1 - d) * (1 - d) * 0.28 * flash);
					}
				}
				for (let k = 0; k < 24; k++) {
					const a6 = s.rnd() * 6.28318;
					const rr5 = R * (1 + s.rnd() * 2.3);
					plot(s, cx + Math.cos(a6) * rr5, cy + Math.sin(a6) * rr5 * 0.8, 255, 250, 242, flash * Math.max(0, 1 - rr5 / (R * 3.4)) * 0.7);
				}
			}

			s.out = Math.min(1, flash * 0.95 + plunge * 0.4 + cutT * (1 - cutT) * 0.5 + 0.08);
			blit(s);
		}
	};
}

const FLAVS = [
	[344, 70, 78],
	[32, 62, 80],
	[142, 40, 72],
	[268, 46, 76],
	[196, 52, 78],
	[18, 48, 52],
	[54, 66, 82],
	[308, 56, 80]
];
const PARLOUR = [178, 340, 44, 156, 202, 22];

type Sundae = {
	scoops: number[][];
	waffle: number;
	wall: number;
	counter: number;
	side: number;
	topping: number;
	sauce: number;
	period: number;
	grain: number;
	blinds: number;
	tilt: number;
	stripe: number;
};

function iceIdent(s: FxScene): Sundae {
	const r = mulberry32(s.v.seed + 28309);
	const n = 2 + ((r() * 2) | 0);
	const used: number[] = [];
	const scoops: number[][] = [];
	for (let i = 0; i < 3; i++) {
		let fi = (r() * FLAVS.length) | 0;
		let guard = 0;
		while (used.indexOf(fi) >= 0 && guard++ < 8) fi = (fi + 1) % FLAVS.length;
		used.push(fi);
		scoops.push([fi, (r() - 0.5) * 0.16, 0.9 + r() * 0.24, (r() * 4096) | 0]);
	}
	scoops.length = n;
	return {
		scoops,
		waffle: 4 + ((r() * 4) | 0),
		wall: PARLOUR[(r() * PARLOUR.length) | 0],
		counter: 24 + r() * 16,
		side: r() < 0.5 ? -1 : 1,
		topping: (r() * 3) | 0,
		sauce: FLAVS[(r() * FLAVS.length) | 0][0],
		period: 420 + ((r() * 200) | 0),
		grain: (r() * 64) | 0,
		blinds: 4 + ((r() * 4) | 0),
		tilt: (r() - 0.5) * 0.5,
		stripe: 5 + ((r() * 5) | 0)
	};
}

export function makeIcecream(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = iceIdent(s);
			(s as any).drips = [] as number[][];
			(s as any).spray = [] as number[][];
			(s as any).pool = new Float32Array(s.w);
			(s as any).phue = new Float32Array(s.w);
			(s as any).next = 30;
		},
		frame(s) {
			const id = (s as any).id as Sundae;
			const drips = (s as any).drips as number[][];
			const spray = (s as any).spray as number[][];
			const pool = (s as any).pool as Float32Array;
			const phue = (s as any).phue as Float32Array;
			clear(s);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const heat = cyc < 0.08 ? 0 : cyc < 0.62 ? Math.pow((cyc - 0.08) / 0.54, 1.5) : cyc < 0.9 ? 1 : Math.max(0, 1 - (cyc - 0.9) / 0.1);
			const tipT = cyc < 0.62 ? 0 : Math.min(1, (cyc - 0.62) / 0.16);
			const splat = cyc > 0.78 && cyc < 0.86 ? 1 - (cyc - 0.78) / 0.08 : 0;
			const wipe = cyc > 0.9 ? (cyc - 0.9) / 0.1 : 0;
			const fresh = cyc < 0.06 ? 1 - cyc / 0.06 : 0;
			if (wipe > 0) {
				for (let x = 0; x < s.w; x++) pool[x] *= 0.86;
				if (wipe > 0.5) {
					drips.length = 0;
					spray.length = 0;
				}
			}

			const counterY = Math.round(s.h * 0.78);
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.04;
			const sunA = id.side;

			const wallPal: number[][] = [];
			for (let i = 0; i < 26; i++) wallPal.push(hsl(id.wall, 26, 8 + i * 1.5));
			const sunX = cx - sunA * s.w * 0.36;
			const beamSlope = sunA * 0.7;
			const beamW = s.w * 0.17;
			for (let y = 0; y < counterY; y++) {
				const bcen = sunX + (y - 0) * beamSlope;
				for (let x = 0; x < s.w; x++) {
					const st = Math.floor(x / id.stripe) % 2;
					const bl = Math.max(0, 1 - Math.abs(x - bcen) / beamW);
					const slat = ((y + x * beamSlope * 0.4) / id.blinds) % 1;
					const louvre = slat < 0.62 ? 1 : 0.14;
					let l = 8 + st * 1.6 + (chip(x, y, 19) % 5) * 0.2 + (1 - y / counterY) * 3;
					l += bl * bl * louvre * (13 + heat * 15);
					const c = wallPal[Math.max(0, Math.min(25, Math.round(l / 1.5)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const ctPal: number[][] = [];
			for (let i = 0; i < 24; i++) ctPal.push(hsl(id.counter, 22, 6 + i * 1.6));
			for (let y = counterY; y < s.h; y++) {
				const dp = (y - counterY) / Math.max(1, s.h - counterY);
				const bcen = sunX + counterY * beamSlope + (y - counterY) * beamSlope * 2.4;
				for (let x = 0; x < s.w; x++) {
					const vein = chip(((x + y / 3) | 0) * 2, (y / 5) | 0, id.grain) % 100;
					const bl = Math.max(0, 1 - Math.abs(x - bcen) / (beamW * 1.5));
					let l = 9 + dp * 5 + (vein > 88 ? 5 : 0) + (vein % 9) * 0.22;
					if (y === counterY) l += 9;
					if (y === counterY + 1) l += 4;
					l += bl * bl * (6 + heat * 9);
					const c = ctPal[Math.max(0, Math.min(23, Math.round(l / 1.6)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const coneBot = counterY - 1;
			const coneTop = s.h * 0.4;
			const coneW = Math.min(s.w, s.h) * 0.2;
			const [cr2, cg2, cb2] = hsl(30, 56, 52);
			for (let y = coneTop; y < coneBot; y++) {
				const f = (y - coneTop) / (coneBot - coneTop);
				const wq = coneW * (1 - f * 0.92);
				for (let x = cx - wq; x <= cx + wq; x++) {
					const u = (x - cx) / Math.max(0.6, wq);
					const grid = Math.abs(Math.sin((x - y * 0.8) * id.waffle * 0.26)) * Math.abs(Math.sin((x + y * 0.8) * id.waffle * 0.26));
					const bl = Math.max(0, 1 - Math.abs(x - (sunX + y * beamSlope)) / beamW);
					const sh = 0.5 + (1 - Math.abs(u + sunA * 0.3)) * 0.4 + grid * 0.34 + bl * bl * 0.3;
					paint(s, x, y, cr2 * sh, cg2 * sh, cb2 * sh, 1);
				}
			}
			for (let dx = -coneW - 1.4; dx <= coneW + 1.4; dx++) {
				const u = Math.abs(dx) / (coneW + 1.4);
				const l = 58 - u * 22;
				const c = hsl(36, 40, l);
				for (let dy = 0; dy < 2; dy++) paint(s, cx + dx, coneTop - 1 + dy, c[0], c[1], c[2], 1);
			}

			const scN = id.scoops.length;
			const spacing = Math.min(s.w, s.h) * 0.165;
			let topCx = cx;
			let topCy = coneTop;
			let topRad = 0;
			for (let i = 0; i < scN; i++) {
				const sc = id.scoops[i];
				const fl = FLAVS[sc[0]];
				const isTop = i === scN - 1;
				const slump = heat * spacing * 0.3 * (scN - i);
				const rad = Math.min(s.w, s.h) * 0.12 * sc[2] * (1 + fresh * 0.18);
				let sxp = cx + sc[1] * coneW * 1.4;
				let syp = coneTop - 1 - i * spacing + slump;
				let roll = 0;
				let squash = 1 + heat * 0.34;
				if (isTop && tipT > 0) {
					const lean = tipT * tipT;
					sxp += sunA * lean * s.w * 0.11;
					syp += lean * lean * (counterY - syp - rad * 0.6);
					roll = sunA * tipT * 3.4;
					squash = 1 + heat * 0.34 + (splat > 0 ? splat * 1.5 : 0);
					if (syp > counterY - rad * 0.5) syp = counterY - rad * 0.5;
				}
				if (isTop && tipT >= 1 && splat <= 0) {
					const col = Math.max(0, Math.min(s.w - 1, sxp | 0));
					for (let d = -8; d <= 8; d++) {
						const ci = Math.max(0, Math.min(s.w - 1, col + d));
						pool[ci] = Math.min(7, pool[ci] + (1 - Math.abs(d) / 9) * 0.9);
						phue[ci] = fl[0];
					}
					continue;
				}
				const yS = 0.86 + heat * 0.3;
				for (let y = -rad * 1.2; y <= rad * 1.2; y++) {
					for (let x = -rad * squash - 1; x <= rad * squash + 1; x++) {
						const rx = x * Math.cos(roll) - y * Math.sin(roll);
						const ry = x * Math.sin(roll) + y * Math.cos(roll);
						const d = Math.hypot(rx / squash, ry * yS) / rad;
						if (d > 1) continue;
						if (d > 0.7 && chip(rx | 0, ry | 0, sc[3]) < 30) continue;
						const nx = rx / rad;
						const ny = ry / rad;
						const face = Math.max(0, -nx * sunA * 0.6 - ny * 0.8);
						const bl = Math.max(0, 1 - Math.abs(sxp + x - (sunX + (syp + y) * beamSlope)) / beamW);
						const spec = Math.max(0, 1 - Math.hypot(nx + sunA * 0.4, ny + 0.45) * 2.4);
						let l = fl[2] * (0.5 + face * 0.42 + (1 - d) * 0.12) + bl * bl * 14 + spec * 28 + fresh * 10;
						if (d > 0.9) l *= 0.82;
						const c = hsl(fl[0] + (chip(rx | 0, ry | 0, sc[3] + 7) % 9) - 4, fl[1] * (0.86 + heat * 0.1), Math.max(6, Math.min(96, l)));
						paint(s, sxp + x, syp + y, c[0], c[1], c[2], 1);
					}
				}
				if (isTop) {
					topCx = sxp;
					topCy = syp;
					topRad = rad;
					const co = Math.cos(roll);
					const si = Math.sin(roll);
					const put = (ox: number, oy: number, r3: number, g3: number, b3: number, al: number) => {
						paint(s, sxp + (ox * co + oy * si) * squash, syp + (-ox * si + oy * co), r3, g3, b3, al);
					};
					if (id.topping === 0) {
						for (let k = 0; k < 15; k++) {
							const rr = mulberry32(id.grain + k * 131);
							const a2 = rr() * 6.28318;
							const dd = 0.2 + rr() * 0.56;
							const ox = Math.cos(a2) * rad * dd;
							const oy = Math.sin(a2) * rad * dd * 0.72 - rad * 0.3;
							const c = FLAVS[(k + id.grain) % FLAVS.length];
							const cc = hsl(c[0], 86, 70);
							const dk = hsl(c[0], 74, 44);
							for (let q = 0; q < 2; q++) put(ox + q * 0.9, oy, cc[0], cc[1], cc[2], 1);
							put(ox + 1.8, oy + 0.9, dk[0], dk[1], dk[2], 0.7);
						}
					} else if (id.topping === 1) {
						const [sr2, sg2, sb2] = hsl(id.sauce, 72, 40);
						const [sl2, sm2, sn2] = hsl(id.sauce, 68, 62);
						for (let k = 0; k <= 34; k++) {
							const t2 = k / 34;
							const a2 = -2.4 + t2 * 4.8;
							const ox = Math.sin(a2 * 1.5) * rad * 0.76;
							const oy = -rad * 0.86 + t2 * rad * 1.5;
							for (let q = -1.2; q <= 1.2; q += 0.6) put(ox + q, oy, sr2, sg2, sb2, 1 - Math.abs(q) * 0.2);
							put(ox - 0.6, oy - 0.6, sl2, sm2, sn2, 0.5);
						}
					} else {
						const [br3, bg3, bb3] = hsl(26, 48, 34);
						const [hr3, hg3, hb3] = hsl(30, 44, 56);
						for (let k = 0; k < 11; k++) {
							const ox = rad * 0.4 + k * 0.22;
							const oy = -rad * 0.62 - k * 1.2;
							for (let q = -1; q <= 1; q++) put(ox + q, oy, br3, bg3, bb3, 1);
							put(ox - 1.4, oy, hr3, hg3, hb3, 0.85);
						}
					}
				}
			}

			if ((s as any).next-- <= 0 && heat > 0.12 && wipe === 0) {
				(s as any).next = Math.max(4, 26 - heat * 22) + ((s.rnd() * 10) | 0);
				const sc = id.scoops[(s.rnd() * scN) | 0];
				const fl = FLAVS[sc[0]];
				const rad = Math.min(s.w, s.h) * 0.12 * sc[2];
				drips.push([cx + sc[1] * coneW * 1.4 + (s.rnd() - 0.5) * rad * 1.8, coneTop - 2 + (s.rnd() - 0.5) * 3, 0, fl[0], 0.9 + s.rnd() * 0.8]);
			}
			for (let k = drips.length - 1; k >= 0; k--) {
				const q = drips[k];
				q[2] += 0.02 * s.v.speed;
				q[1] += q[2];
				const onCone = q[1] < coneBot;
				if (onCone) {
					const f = (q[1] - coneTop) / (coneBot - coneTop);
					const wq = coneW * (1 - f * 0.92);
					if (q[0] > cx + wq) q[0] -= 0.22;
					if (q[0] < cx - wq) q[0] += 0.22;
					q[2] *= 0.94;
				}
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				if (q[1] >= counterY - pool[col]) {
					pool[col] = Math.min(7, pool[col] + 0.9 * q[4]);
					for (let d = -3; d <= 3; d++) {
						if (!d) continue;
						const ci = Math.max(0, Math.min(s.w - 1, col + d));
						pool[ci] = Math.min(7, pool[ci] + (1 - Math.abs(d) / 4) * 0.5);
						if (!phue[ci]) phue[ci] = q[3];
					}
					phue[col] = q[3];
					drips.splice(k, 1);
					continue;
				}
				const [dr2, dg2, db2] = hsl(q[3], 62, 74);
				const len = Math.min(4, 1.4 + q[2] * 9);
				for (let d = 0; d < len; d++) paint(s, q[0], q[1] - d, dr2, dg2, db2, 1 - d / (len + 0.8));
				plot(s, q[0] - 0.7, q[1] - 1, 255, 255, 255, 0.45);
			}

			if (splat > 0.88) {
				const fl = FLAVS[id.scoops[scN - 1][0]];
				for (let k = 0; k < 26; k++) {
					spray.push([topCx, counterY - 1, (s.rnd() - 0.5) * 4.4, -(0.4 + s.rnd() * 1.9), 0, fl[0]]);
				}
			}
			for (let k = spray.length - 1; k >= 0; k--) {
				const q = spray[k];
				q[4] += 1;
				q[3] += 0.16;
				q[0] += q[2];
				q[1] += q[3];
				q[2] *= 0.97;
				if (q[1] >= counterY - 1 && q[3] > 0) {
					const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
					pool[col] = Math.min(6, pool[col] + 0.45);
					phue[col] = q[5];
					spray.splice(k, 1);
					continue;
				}
				if (q[4] > 60 || q[0] < -2 || q[0] > s.w + 2) {
					spray.splice(k, 1);
					continue;
				}
				const c = hsl(q[5], 66, 76);
				paint(s, q[0], q[1], c[0], c[1], c[2], 1);
			}

			for (let pass = 0; pass < 2; pass++) {
				for (let x = 1; x < s.w - 1; x++) {
					const d1 = pool[x] - pool[x - 1];
					if (d1 > 0.35) {
						const mv = (d1 - 0.35) * 0.26;
						pool[x] -= mv;
						pool[x - 1] += mv;
						if (!phue[x - 1]) phue[x - 1] = phue[x];
					}
					const d2 = pool[x] - pool[x + 1];
					if (d2 > 0.35) {
						const mv = (d2 - 0.35) * 0.26;
						pool[x] -= mv;
						pool[x + 1] += mv;
						if (!phue[x + 1]) phue[x + 1] = phue[x];
					}
				}
			}

			let puddle = 0;
			let lip = 0;
			for (let x = 0; x < s.w; x++) {
				const hgt = pool[x];
				puddle += hgt;
				if (hgt < 0.14) continue;
				if (x < 3 || x > s.w - 4) lip = Math.max(lip, hgt);
				const hu = phue[x] || FLAVS[id.scoops[0][0]][0];
				const bl = Math.max(0, 1 - Math.abs(x - (sunX + counterY * beamSlope)) / (beamW * 1.5));
				const rows2 = Math.max(1, Math.ceil(hgt));
				for (let k = 0; k < rows2; k++) {
					const fk = k / rows2;
					const c = hsl(hu, 60, 50 + fk * 18 + bl * 14);
					paint(s, x, counterY - 1 - k, c[0], c[1], c[2], k + 1 > hgt ? hgt - k : 1);
				}
				const c2 = hsl(hu, 44, 88);
				paint(s, x, counterY - rows2, c2[0], c2[1], c2[2], Math.min(0.7, hgt * 0.5));
				if (hgt > 1.1) {
					for (let d = 0; d < Math.min(5, hgt * 1.4); d++) {
						const c3 = hsl(hu, 52, 34 - d * 5);
						paint(s, x, counterY + d, c3[0], c3[1], c3[2], (1 - d / 4) * 0.7);
					}
				}
				pool[x] *= 0.99955;
			}

			for (let k = 0; k < 16; k++) {
				const rr = mulberry32(id.grain * 3 + k * 211);
				const ph2 = rr() * 6.28318;
				const sp = 0.2 + rr() * 0.5;
				const yy = ((rr() * s.h + s.t * sp * 0.08) % (counterY + 6)) - 3;
				const xx = sunX + yy * beamSlope + Math.sin(s.t * 0.02 * sp + ph2) * beamW * 0.75;
				plot(s, xx, yy, 255, 244, 216, (0.16 + heat * 0.3) * (0.4 + 0.6 * Math.sin(s.t * 0.05 + ph2)));
			}

			s.out = Math.min(1, heat * 0.4 + tipT * (1 - tipT) * 1.2 + splat * 0.8 + Math.min(1, puddle / (s.w * 1.2)) * 0.5 + lip * 0.06);
			blit(s);
		}
	};
}

const VELVET = [352, 268, 208, 148, 22, 312];
const JEWELS = [352, 146, 216, 44, 286, 12];

type Regalia = {
	points: number;
	stones: number[][];
	arch: number;
	gold: number;
	velvet: number;
	stone: number;
	banner: number;
	bandH: number;
	wide: number;
	period: number;
	grain: number;
	side: number;
	pillars: number;
	fur: number;
};

function crownIdent(s: FxScene): Regalia {
	const r = mulberry32(s.v.seed + 29317);
	const points = 3 + ((r() * 3) | 0);
	const stones: number[][] = [];
	for (let i = 0; i < 6; i++) stones.push([JEWELS[(r() * JEWELS.length) | 0], r() * 6.28318, 0.8 + r() * 0.5]);
	return {
		points,
		stones,
		arch: 0.62 + r() * 0.4,
		gold: 42 + r() * 10,
		velvet: VELVET[(r() * VELVET.length) | 0],
		stone: 28 + r() * 180,
		banner: VELVET[(r() * VELVET.length) | 0],
		bandH: 0.085 + r() * 0.03,
		wide: 0.3 + r() * 0.08,
		period: 440 + ((r() * 200) | 0),
		grain: (r() * 64) | 0,
		side: r() < 0.5 ? -1 : 1,
		pillars: 2 + ((r() * 3) | 0),
		fur: r() < 0.5 ? 1 : 0
	};
}

export function makeCrown(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = crownIdent(s);
			(s as any).motes = [] as number[][];
			(s as any).squash = 0;
		},
		frame(s) {
			const id = (s as any).id as Regalia;
			const motes = (s as any).motes as number[][];
			clear(s);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const fall = cyc < 0.34 ? 1 - Math.pow(cyc / 0.34, 2.6) : 0;
			const land = cyc >= 0.34 && cyc < 0.42 ? 1 - (cyc - 0.34) / 0.08 : 0;
			const reign = cyc < 0.34 ? 0 : cyc < 0.82 ? Math.min(1, (cyc - 0.34) / 0.07) : Math.max(0, 1 - (cyc - 0.82) / 0.06);
			const rise = cyc < 0.88 ? 0 : (cyc - 0.88) / 0.12;
			const hit = cyc >= 0.335 && cyc < 0.35;

			const floorY = Math.round(s.h * 0.86);
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.03;

			const wallPal: number[][] = [];
			for (let i = 0; i < 22; i++) wallPal.push(hsl(id.stone, 14, 3 + i * 1.2));
			const bh2 = Math.max(4, Math.round(s.h * 0.13));
			for (let y = 0; y < floorY; y++) {
				const row = (y / bh2) | 0;
				const off = (row % 2) * 7;
				for (let x = 0; x < s.w; x++) {
					const mortar = y % bh2 === 0 || (x + off) % 13 === 0 ? -3.4 : 0;
					const vig = Math.max(0, 1 - Math.hypot((x - cx) / (s.w * 0.62), (y - s.h * 0.35) / (s.h * 0.9)));
					const l = 4 + vig * vig * 7 + (chip(x, y, 23 + id.grain) % 5) * 0.28 + mortar + reign * vig * 5;
					const c = wallPal[Math.max(0, Math.min(21, Math.round(l / 1.2)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			for (let k = 0; k < id.pillars * 2; k++) {
				const sd = k % 2 === 0 ? -1 : 1;
				const idx = k >> 1;
				const bx = cx + sd * s.w * (0.27 + idx * 0.19);
				if (bx < -2 || bx > s.w + 2) continue;
				const bw = Math.max(1.6, s.w * 0.022);
				const by = s.h * 0.04;
				const bl = s.h * (0.3 + ((chip(idx, k, id.grain) % 30) / 100) * 0.22);
				const hue = idx % 2 === 0 ? id.banner : id.velvet;
				for (let y = by; y < by + bl; y++) {
					const f = (y - by) / bl;
					const wv = Math.sin(y * 0.26 + s.t * 0.028 * s.v.speed + k) * s.v.drift * 0.8 * f;
					const notch = f > 0.78 ? (f - 0.78) / 0.22 : 0;
					for (let x = -bw; x <= bw; x++) {
						const u = x / bw;
						if (notch > 0 && 1 - Math.abs(u) < notch) continue;
						const fold = 0.58 + 0.42 * Math.cos(u * 2.6 + wv * 0.4);
						const l = 7 + fold * 15 + reign * 5 + (1 - f) * 4;
						const c = hsl(hue, 46, l);
						paint(s, bx + x + wv, y, c[0], c[1], c[2], 1);
					}
					if (y < by + 2) {
						const c = hsl(id.gold, 62, 38);
						for (let x = -bw - 1; x <= bw + 1; x++) paint(s, bx + x, y, c[0], c[1], c[2], 1);
					}
					if (f > 0.3 && f < 0.62 && Math.abs(bw) > 1.4) {
						const c = hsl(id.gold, 58, 34 + reign * 8);
						const em = Math.max(0, 1 - Math.abs(f - 0.46) / 0.16);
						for (let x = -bw * em; x <= bw * em; x++) if (Math.abs(x) > bw * em - 1.1) paint(s, bx + x + wv, y, c[0], c[1], c[2], 0.9);
					}
				}
			}

			const flPal: number[][] = [];
			for (let i = 0; i < 18; i++) flPal.push(hsl(id.stone, 10, 4 + i * 1.3));
			for (let y = floorY; y < s.h; y++) {
				const dp = (y - floorY) / Math.max(1, s.h - floorY);
				for (let x = 0; x < s.w; x++) {
					const tile = (((x + (y - floorY) * 3) / 9) | 0) % 2;
					const seam = (x + (y - floorY) * 3) % 9 === 0 ? -3 : 0;
					const l = 5 + tile * 3 + dp * 3 + seam + reign * Math.max(0, 1 - Math.abs(x - cx) / (s.w * 0.4)) * 6;
					const c = flPal[Math.max(0, Math.min(17, Math.round(l / 1.3)))];
					paint(s, x, y, c[0], c[1], c[2], 1);
				}
			}

			const steps = 3;
			const stepH = Math.max(2, Math.round(s.h * 0.055));
			const daisTop = floorY - steps * stepH;
			for (let i = 0; i < steps; i++) {
				const y0 = floorY - (i + 1) * stepH;
				const hw = s.w * (0.34 - i * 0.06);
				for (let y = y0; y < y0 + stepH; y++) {
					for (let x = Math.max(0, Math.floor(cx - hw)); x < Math.min(s.w, Math.ceil(cx + hw)); x++) {
						const ex = Math.min(1, (hw - Math.abs(x - cx)) / 1.6);
						if (ex <= 0) continue;
						const face = y === y0 ? 10 : 4 - (y - y0) * 0.5;
						const l = face + reign * 5 + (chip(x, y, 47) % 4) * 0.3;
						const c = flPal[Math.max(0, Math.min(17, Math.round(l / 1.3)))];
						paint(s, x, y, c[0], c[1], c[2], ex);
					}
				}
				const runner = Math.round(s.w * 0.1);
				for (let y = y0; y < y0 + stepH; y++) {
					for (let x = cx - runner; x <= cx + runner; x++) {
						const u = (x - cx) / runner;
						const l = 11 + (1 - u * u) * 9 + (y === y0 ? 7 : 0) + reign * 5;
						const c = hsl(id.velvet, 46, l);
						paint(s, x, y, c[0], c[1], c[2], 1);
					}
				}
			}

			const sq = (s as any).squash as number;
			if (hit) (s as any).squash = 1;
			else if (sq > 0) (s as any).squash = Math.max(0, sq - 0.055);
			const cushH = Math.max(3, s.h * 0.075) * (1 - sq * 0.34);
			const cushW = Math.min(s.w, s.h) * 0.3;
			const cushTop = daisTop - cushH;
			for (let y = cushTop; y < daisTop; y++) {
				const v = (y - cushTop) / cushH;
				const hw = cushW * (0.72 + Math.sin(v * 3.14159) * 0.3);
				for (let x = -hw; x <= hw; x++) {
					const u = x / hw;
					const dome = Math.sqrt(Math.max(0, 1 - u * u));
					const dent = Math.max(0, 1 - Math.abs(u) / 0.62) * sq * 7;
					const lift = Math.max(0, -Math.cos(v * 3.14159)) * 0.3;
					let l = 10 + dome * 12 + (1 - v) * 7 + lift * 6 + reign * 7;
					l -= dent;
					if (v > 0.84) l -= 7;
					const nap = (chip(x | 0, y | 0, 71) % 100) / 100;
					const c = hsl(id.velvet, 48, Math.max(3, l + nap * 3));
					paint(s, cx + x, y - dent * 0.22, c[0], c[1], c[2], 1);
				}
			}
			for (let sd = -1; sd <= 1; sd += 2) {
				const tx = cx + sd * cushW * 0.74;
				const ty = daisTop - 1;
				const c = hsl(id.gold, 66, 46);
				for (let k = 0; k < 4; k++) {
					for (let q = -1; q <= 1; q++) paint(s, tx + q + sd * k * 0.3, ty + k, c[0], c[1], c[2], 1 - k * 0.12);
				}
			}

			const halfW = Math.min(s.w, s.h) * id.wide;
			const bandH = s.h * id.bandH;
			const bob = Math.sin(s.t * 0.03 * s.v.speed) * s.h * 0.012;
			const restY = cushTop - bandH * 0.1;
			const baseY = restY - fall * s.h * 1.05 - rise * rise * s.h * 1.05 + (fall > 0 || rise > 0 ? 0 : bob * 0.4);
			const tiltA = (fall + rise) * id.side * 0.22 + Math.sin(s.t * 0.02) * 0.02;

			if (fall > 0 || rise > 0) {
				const [lr, lg, lb] = hsl(id.gold + 8, 76, 86);
				for (let y = 0; y < baseY; y++) {
					const t2 = y / Math.max(1, baseY);
					const hw = halfW * (0.3 + t2 * 0.85);
					for (let x = Math.max(0, Math.floor(cx - hw)); x < Math.min(s.w, Math.ceil(cx + hw)); x++) {
						const u = 1 - Math.abs(x - cx) / hw;
						if (u <= 0) continue;
						plot(s, x, y, lr, lg, lb, u * u * 0.1 * Math.max(fall, rise));
					}
				}
			}

			const co = Math.cos(tiltA);
			const si = Math.sin(tiltA);
			const put = (ox: number, oy: number, r2: number, g2: number, b2: number): void => {
				paint(s, cx + ox * co - oy * si, baseY + ox * si + oy * co, r2, g2, b2, 1);
			};
			const shine = (((s.t * 0.02 * s.v.speed * s.v.dir) % 1) + 1) % 1;
			const gleam = (u: number) => Math.max(0, 1 - Math.abs(u - (shine * 2 - 1)) * 3.4);

			if (id.fur) {
				for (let x = -halfW - 1.6; x <= halfW + 1.6; x++) {
					const puff = 1.6 + Math.abs(Math.sin(x * 0.9 + id.grain)) * 1.4 + Math.abs(Math.sin(x * 2.3)) * 0.7;
					for (let k = 0; k < puff; k++) {
						const dome = Math.sqrt(Math.max(0, 1 - (k / puff) ** 2));
						const l = 58 + dome * 26 - Math.abs(Math.sin(x * 2.1 + k)) * 9 + reign * 7;
						const spot = chip(x | 0, k | 0, 83 + id.grain) % 100 < 6 ? -40 : 0;
						const c = hsl(36, 9, Math.max(14, Math.min(94, l + spot)));
						put(x, k + 0.3, c[0], c[1], c[2]);
					}
				}
			}

			for (let oy = 0; oy > -bandH; oy--) {
				const f = -oy / bandH;
				for (let ox = -halfW; ox <= halfW; ox++) {
					const u = ox / halfW;
					const curve = Math.sqrt(Math.max(0.02, 1 - u * u * 0.55));
					const eng = Math.max(0, Math.sin(u * 13 + 1.2)) ** 4;
					const l = 22 + curve * 16 + gleam(u) * 26 + eng * 12 + (1 - f) * 5 + reign * 9 + land * 22;
					const c = hsl(id.gold + eng * 6, 66, Math.max(6, Math.min(96, l)));
					put(ox, oy - 0.5, c[0], c[1], c[2]);
				}
			}
			const rimC = hsl(id.gold + 6, 50, 74 + reign * 12);
			for (let ox = -halfW; ox <= halfW; ox++) put(ox, -bandH, rimC[0], rimC[1], rimC[2]);
			for (let k = 0; k < id.points + 1; k++) {
				const u = id.points === 0 ? 0 : (k / id.points) * 2 - 1;
				const st = id.stones[k % 6];
				const ox = u * halfW * 0.84;
				const c = hsl(st[0], 74, 42 + Math.max(0, Math.sin(s.t * 0.12 + st[1])) * 16 + reign * 10);
				for (let dy = -1; dy <= 1; dy++)
					for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) < 2) put(ox + dx, -bandH * 0.5 + dy, c[0], c[1], c[2]);
			}

			const n = id.points;
			for (let i = 0; i < n; i++) {
				const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
				const ox0 = u * halfW * 0.84;
				const tall = s.h * (0.13 + (1 - Math.abs(u)) * 0.11) * id.arch;
				for (let k = 0; k < tall; k++) {
					const f = k / tall;
					const wq = halfW * 0.15 * (1 - f * f) + 0.7;
					for (let q = -wq; q <= wq; q++) {
						const ux = (ox0 + q) / halfW;
						const curve = Math.sqrt(Math.max(0.05, 1 - (q / (wq + 0.3)) ** 2));
						const l = 20 + curve * 15 + gleam(ux) * 26 + (1 - f) * 8 + reign * 9 + land * 22;
						const c = hsl(id.gold, 66, Math.max(6, Math.min(96, l)));
						put(ox0 + q, -bandH - k, c[0], c[1], c[2]);
					}
				}
				const st = id.stones[i];
				const sy = -bandH - tall - 1.8;
				const glint = Math.max(0, Math.sin(s.t * 0.15 * s.v.speed + st[1]));
				const rr = 1.9 * st[2];
				for (let dy = -rr; dy <= rr; dy++) {
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx, dy) / rr;
						if (d > 1) continue;
						const fac = Math.max(0, 1 - Math.hypot(dx / rr + 0.4, dy / rr + 0.45) * 1.8);
						const c = hsl(st[0], 78, Math.min(96, 44 + (1 - d) * 16 + fac * 34 + glint * 18 + reign * 10 + land * 20));
						put(ox0 + dx, sy + dy, c[0], c[1], c[2]);
					}
				}
				if (glint > 0.86 || land > 0.3) {
					const [wr, wg, wb] = hsl(st[0], 40, 96);
					for (let d = -5; d <= 5; d++) {
						const a2 = (1 - Math.abs(d) / 5) * (0.4 + land * 0.6);
						plot(s, cx + (ox0 + d) * co - sy * si, baseY + (ox0 + d) * si + sy * co, wr, wg, wb, a2);
						plot(s, cx + ox0 * co - (sy + d) * si, baseY + ox0 * si + (sy + d) * co, wr, wg, wb, a2 * 0.8);
					}
				}
			}

			if (hit) {
				for (let k = 0; k < 40; k++) {
					const a2 = s.rnd() * 6.28318;
					const sp = 0.7 + s.rnd() * 2.6;
					motes.push([
						cx + Math.cos(a2) * halfW * 0.9,
						cushTop + 1,
						Math.cos(a2) * sp,
						-Math.abs(Math.sin(a2)) * sp * 0.8 - 0.5,
						0,
						40 + s.rnd() * 40,
						id.stones[(s.rnd() * 6) | 0][0]
					]);
				}
			}
			if (reign > 0.2 && s.rnd() < 0.3) {
				motes.push([
					cx + (s.rnd() - 0.5) * halfW * 2.4,
					cushTop - s.rnd() * s.h * 0.2,
					(s.rnd() - 0.5) * 0.3,
					-0.12 - s.rnd() * 0.2,
					0,
					50 + s.rnd() * 40,
					id.gold
				]);
			}
			for (let k = motes.length - 1; k >= 0; k--) {
				const q = motes[k];
				q[4] += 1;
				q[3] += 0.045;
				q[0] += q[2];
				q[1] += q[3];
				q[2] *= 0.98;
				if (q[1] >= daisTop - 0.5 && q[3] > 0) {
					if (s.rnd() < 0.5 || q[4] > 30) {
						motes.splice(k, 1);
						continue;
					}
					q[1] = daisTop - 0.8;
					q[3] = -q[3] * 0.4;
				}
				if (q[4] > q[5] || q[0] < -2 || q[0] > s.w + 2) {
					motes.splice(k, 1);
					continue;
				}
				const lf = 1 - q[4] / q[5];
				const c = hsl(q[6], 70, 62 + lf * 30);
				plot(s, q[0], q[1], c[0], c[1], c[2], lf * (0.45 + land * 0.5));
			}
			if (motes.length > 150) motes.splice(0, motes.length - 150);

			if (land > 0) {
				const [gr2, gg2, gb2] = hsl(id.gold + 6, 82, 88);
				const rr2 = (1 - land) * Math.min(s.w, s.h) * 1.1 + 3;
				for (let k = 0; k < 90; k++) {
					const a2 = (k / 90) * 6.28318;
					for (let d = -1.4; d <= 1.4; d += 0.7) {
						plot(s, cx + Math.cos(a2) * (rr2 + d), cushTop + Math.sin(a2) * (rr2 + d) * 0.44, gr2, gg2, gb2, land * land * 0.5);
					}
				}
				for (let k = 0; k < 20; k++) {
					const a2 = (k / 20) * 6.28318 + s.t * 0.02;
					for (let d = halfW * 0.7; d < halfW * 3.2; d += 0.8) {
						plot(s, cx + Math.cos(a2) * d, cushTop + Math.sin(a2) * d * 0.5, gr2, gg2, gb2, land * (1 - d / (halfW * 3.4)) * 0.4);
					}
				}
			}
			if (reign > 0) {
				const [hr2, hg2, hb2] = hsl(id.gold + 4, 70, 78);
				const R2 = halfW * 2.1;
				for (let y = Math.max(0, Math.floor(baseY - R2)); y < Math.min(s.h, Math.ceil(cushTop + R2 * 0.5)); y++) {
					for (let x = Math.max(0, Math.floor(cx - R2)); x < Math.min(s.w, Math.ceil(cx + R2)); x++) {
						const d = Math.hypot((x - cx) / R2, (y - (baseY - bandH * 0.6)) / (R2 * 0.8));
						if (d > 1) continue;
						plot(s, x, y, hr2, hg2, hb2, (1 - d) * (1 - d) * 0.24 * reign);
					}
				}
			}

			s.out = Math.min(1, land * 0.95 + reign * 0.38 + fall * 0.3 + rise * 0.3 + 0.08);
			blit(s);
		}
	};
}
