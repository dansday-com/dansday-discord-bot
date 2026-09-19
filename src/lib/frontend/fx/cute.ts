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

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05 + sx;
			const half = s.w * id.wide;
			const caseBot = counterY + Math.round(s.h * 0.1);
			const caseTop = caseBot - Math.round(s.h * 0.2);

			const [gr2, gg2, gb2] = hsl(38, 74, 60);
			const poolR = half * 5.2;
			for (let dy = -poolR * 0.62; dy <= poolR * 0.62; dy++)
				for (let dx = -poolR; dx <= poolR; dx++) {
					const d = Math.hypot(dx / poolR, dy / (poolR * 0.62));
					if (d > 1) continue;
					plot(s, cx + dx, caseBot - s.h * 0.08 + dy, gr2, gg2, gb2, (1 - d) * (1 - d) * (0.26 + done * 0.16));
				}

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
				plot(s, p[0], p[1], c[0], c[1], c[2], (0.3 + lf * 0.65) * Math.min(1, lf * 5));
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
				const hwf = s.w * (0.42 + dp * 0.16);
				for (let x = Math.max(0, Math.floor(cx - hwf)); x < Math.min(s.w, Math.ceil(cx + hwf)); x++) {
					const ex = Math.min(1, (hwf - Math.abs(x - cx)) / 3.2);
					if (ex <= 0) continue;
					const tile = (((x + (y - floorY) * 3) / 9) | 0) % 2;
					const seam = (x + (y - floorY) * 3) % 9 === 0 ? -3 : 0;
					const l = 5 + tile * 3 + dp * 3 + seam + reign * Math.max(0, 1 - Math.abs(x - cx) / (s.w * 0.4)) * 6;
					const c = flPal[Math.max(0, Math.min(17, Math.round(l / 1.3)))];
					paint(s, x, y, c[0], c[1], c[2], ex);
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
