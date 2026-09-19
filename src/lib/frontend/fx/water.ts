import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Fall = { x: number; w: number; power: number; flare: number };
type Falls = {
	falls: Fall[];
	lip: number;
	pool: number;
	ridge: number[];
	strata: number[];
	moss: number[][];
	period: number;
	grain: number;
};

function hash2(x: number, y: number, g: number) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (g | 0) * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fallIdent(s: FxScene): Falls {
	const r = mulberry32(s.v.seed + 4410);
	const count = 1 + ((r() * 3) | 0);
	const falls: Fall[] = [];
	for (let i = 0; i < 3; i++) {
		const x = 0.16 + i * 0.28 + r() * 0.1;
		const w = 0.075 + r() * 0.085;
		const power = 0.7 + r() * 0.6;
		const flare = 1.4 + r() * 1.2;
		if (i < count) falls.push({ x, w, power, flare });
	}
	const lip = 0.34 + r() * 0.08;
	const pool = 0.74 + r() * 0.08;
	const ridge: number[] = [];
	for (let i = 0; i < 13; i++) ridge.push(r());
	const strata: number[] = [];
	for (let i = 0; i < 7; i++) strata.push(r());
	const moss: number[][] = [];
	for (let i = 0; i < 6; i++) moss.push([r(), r(), 0.06 + r() * 0.09]);
	const period = 230 + ((r() * 150) | 0);
	const grain = (r() * 9999) | 0;
	return { falls, lip, pool, ridge, strata, moss, period, grain };
}

function ridgeAt(ridge: number[], u: number, spread: number) {
	const t = u * (ridge.length - 1);
	const i = Math.min(ridge.length - 2, t | 0);
	const f = t - i;
	return (ridge[i] * (1 - f) + ridge[i + 1] * f - 0.5) * spread;
}

export function makeWaterfall(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 1.6,
		init(s) {
			const id = fallIdent(s);
			(s as any).id = id;
			(s as any).splash = [] as number[][];
			(s as any).mist = [] as number[][];
			(s as any).surge = 0;
			for (let i = 0; i < s.n; i++) {
				const k = i % id.falls.length;
				const f = id.falls[k];
				const o = i * P;
				s.parts[o] = (f.x + (s.rnd() - 0.5) * f.w) * s.w;
				s.parts[o + 1] = (id.lip + s.rnd() * (id.pool - id.lip)) * s.h;
				s.parts[o + 2] = 0.5 + s.rnd() * 0.6;
				s.parts[o + 3] = s.rnd() * Math.PI * 2;
				s.parts[o + 4] = 0.45 + s.rnd() * 0.55;
				s.parts[o + 5] = k;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Falls;
			const splash = (s as any).splash as number[][];
			const mist = (s as any).mist as number[][];
			const lipY = id.lip * s.h;
			const poolY = id.pool * s.h;
			const grav = 0.055 * s.v.speed;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const surge = cyc < 0.22 ? Math.sin((cyc / 0.22) * Math.PI) : 0;
			(s as any).surge = surge;
			const flow = 1 + surge * 1.1;

			const [rr, rg, rb] = hsl(s.v.hue2, s.v.sat * 0.24, 16);
			const [er, eg, eb] = hsl(s.v.hue2, s.v.sat * 0.34, 32);
			const [wr, wg, wb] = hsl(s.v.hue, s.v.sat * 0.4, 94);
			const [pr, pg, pb] = hsl(s.v.hue, s.v.sat * 0.6, 24);
			const [mr2, mg2, mb2] = hsl(96 + (s.v.hue % 40), 38, 26);

			for (let x = 0; x < s.w; x++) {
				const u = x / s.w;
				const y0 = lipY + ridgeAt(id.ridge, u, s.h * 0.1);
				for (let y = y0; y < s.h; y++) {
					if (y >= poolY) continue;
					const band = id.strata[((((y - y0) / Math.max(1, poolY - y0)) * 6.99) | 0) % 7];
					const g = hash2(x * 0.5, y, id.grain);
					const dep = (y - y0) / Math.max(1, poolY - y0);
					const lit = 0.5 + band * 0.55 - dep * 0.22 + g * 0.16;
					paint(s, x, y, rr * lit * 1.5, rg * lit * 1.45, rb * lit * 1.35, 1);
				}
				paint(s, x, y0, er * 1.2, eg * 1.2, eb * 1.15, 0.95);
				paint(s, x, y0 + 1, er * 0.5, eg * 0.5, eb * 0.5, 0.8);
			}

			for (const [mxp, myp, mrad] of id.moss) {
				const mx = mxp * s.w;
				const my = lipY + myp * (poolY - lipY);
				const rad = mrad * s.h;
				for (let y = my - rad; y <= my + rad; y++)
					for (let x = mx - rad; x <= mx + rad; x++) {
						if (y < lipY || y >= poolY) continue;
						const d = Math.hypot((x - mx) / rad, (y - my) / (rad * 0.7));
						if (d > 1) continue;
						if (hash2(x, y, id.grain + 7) > 1 - (1 - d) * 0.8) continue;
						paint(s, x, y, mr2, mg2, mb2, 0.5);
					}
			}

			for (const f of id.falls) {
				const cx = f.x * s.w;
				const hw = f.w * s.w * 0.5 * flow;
				const lam = s.h * 0.1 * f.power;
				for (let y = lipY - 2; y < poolY; y++) {
					const g = Math.max(0, (y - lipY) / lam);
					const fall = Math.max(0, (y - lipY) / Math.max(1, poolY - lipY));
					const spread = 1 + Math.min(0.5, fall * fall * f.flare * 0.4);
					const sheetA = g < 1 ? 0.62 + (1 - g) * 0.36 : 0.62 - fall * 0.24;
					if (sheetA <= 0.01) continue;
					for (let x = cx - hw * spread; x <= cx + hw * spread; x++) {
						const e = 1 - Math.abs(x - cx) / (hw * spread + 0.5);
						const streak = 0.84 + 0.16 * Math.sin(x * 1.4 + hash2(x, 0, id.grain) * 6.28 + s.t * 0.3 * s.v.speed);
						paint(s, x, y, wr * 0.78, wg * 0.84, wb, sheetA * Math.pow(e, 0.42) * streak);
					}
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const f = id.falls[p[o + 5]];
				const hw = f.w * s.w * 0.5 * flow;
				p[o + 2] += grav;
				p[o + 1] += p[o + 2];
				p[o + 3] += 0.12;
				const drop = (p[o + 1] - lipY) / Math.max(1, poolY - lipY);
				p[o] += Math.sin(p[o + 3]) * (0.16 + drop * f.flare * 0.5) * s.v.drift;
				if (p[o + 1] >= poolY) {
					splash.push([p[o], 0, (0.6 + s.rnd() * 0.8) * flow]);
					if (splash.length > 26) splash.shift();
					if (mist.length < 70)
						mist.push([p[o] + (s.rnd() - 0.5) * hw * 2, poolY - s.rnd() * 3, (s.rnd() - 0.5) * 0.5, -0.1 - s.rnd() * 0.35, 0, 40 + s.rnd() * 70]);
					p[o + 1] = lipY;
					p[o + 2] = 0.5 + s.rnd() * 0.6;
					p[o] = f.x * s.w + (s.rnd() - 0.5) * hw * 1.8;
					continue;
				}
				const inSheet = Math.abs(p[o] - f.x * s.w) < hw * 0.85;
				const a = p[o + 4] * edge(p[o + 1], lipY - 2, poolY + 2, s.h * 0.1) * (0.45 + drop * 0.55) * (inSheet ? 0.4 : 1);
				const len = 1 + p[o + 2] * 3.2;
				for (let k = 0; k < len; k++) plot(s, p[o], p[o + 1] - k, wr, wg, wb, a * (1 - k / len) * 0.85);
			}

			const surf = 0.5 + 0.5 * Math.sin(s.t * 0.05 * s.v.speed);
			for (let x = 0; x < s.w; x++) {
				const wob = Math.sin(x * 0.19 + s.t * 0.05 * s.v.speed) * 1.3 + Math.sin(x * 0.06 - s.t * 0.03) * 0.9 + surge * 1.6;
				const y0 = poolY + wob;
				for (let y = y0; y < s.h; y++) {
					const dep = (y - y0) / Math.max(1, s.h - y0);
					paint(s, x, y, pr * (1.3 - dep * 0.5), pg * (1.3 - dep * 0.5), pb * (1.35 - dep * 0.4), 0.94);
				}
				plot(s, x, y0, wr, wg, wb, 0.3 + surf * 0.16);
			}

			for (const f of id.falls) {
				const cx = f.x * s.w;
				const hw = f.w * s.w * flow;
				for (let x = cx - hw; x <= cx + hw; x++) {
					const e = 1 - Math.abs(x - cx) / (hw + 0.5);
					const churn = 0.5 + 0.5 * Math.sin(s.t * 0.19 * s.v.speed + x * 0.6);
					for (let y = poolY - 1; y < poolY + 4; y++) plot(s, x, y, wr, wg, wb, e * churn * 0.55);
				}
				for (let k = 0; k < 4; k++) {
					const rad = ((s.t * 0.9 * s.v.speed + k * 22) % 88) / 88;
					const rx = rad * s.w * 0.24;
					const ry = rad * s.h * 0.035;
					for (let a2 = 0; a2 < 22; a2++) {
						const th = (a2 / 22) * 6.283;
						plot(s, cx + Math.cos(th) * rx, poolY + 2 + Math.sin(th) * ry, wr, wg, wb, (1 - rad) * (1 - rad) * 0.4);
					}
				}
			}

			for (let k = splash.length - 1; k >= 0; k--) {
				const sp = splash[k];
				sp[1] += 1;
				if (sp[1] > 18) {
					splash.splice(k, 1);
					continue;
				}
				const life = 1 - sp[1] / 18;
				const rise = Math.sin((sp[1] / 18) * Math.PI) * s.h * 0.18 * sp[2];
				const spread = (sp[1] / 18) * s.w * 0.04;
				for (let d = -2; d <= 2; d++) {
					const x = sp[0] + d * spread * 0.6;
					plot(s, x, poolY - rise + Math.abs(d) * 1.2, wr, wg, wb, life * 0.75);
				}
			}

			for (let k = mist.length - 1; k >= 0; k--) {
				const q = mist[k];
				q[4] += 1;
				if (q[4] > q[5]) {
					mist.splice(k, 1);
					continue;
				}
				q[2] += (Math.sin(q[4] * 0.06 + q[0]) * 0.03 + 0.008 * s.v.dir * s.v.drift) * s.v.speed;
				q[3] *= 0.985;
				q[0] += q[2];
				q[1] += q[3];
				const f = q[4] / q[5];
				const rad = 1.5 + f * s.h * 0.1;
				const a = Math.sin(f * Math.PI) * 0.1;
				for (let dy = -rad; dy <= rad; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx / rad, dy / rad);
						if (d > 1) continue;
						plot(s, q[0] + dx, q[1] + dy, wr, wg, wb, (1 - d) * (1 - d) * a);
					}
			}

			s.out = Math.min(1, surge * 0.7 + (splash.length / 26) * 0.4);
			blit(s);
		}
	};
}

type Pond = { level: number; lightX: number; cadence: number; reeds: number[]; bank: number[]; far: number[]; trees: number[][]; period: number; lamp: number };

function pondIdent(s: FxScene): Pond {
	const r = mulberry32(s.v.seed + 5820);
	const level = 0.36 + r() * 0.14;
	const lightX = 0.2 + r() * 0.6;
	const cadence = 16 + r() * 26;
	const reeds: number[] = [];
	for (let i = 0; i < 14; i++) reeds.push(r());
	const bank: number[] = [];
	for (let i = 0; i < 11; i++) bank.push(r());
	const far: number[] = [];
	for (let i = 0; i < 9; i++) far.push(r());
	const trees: number[][] = [];
	for (let i = 0; i < 6; i++) trees.push([r(), 0.4 + r() * 0.8]);
	const period = 340 + ((r() * 200) | 0);
	const lamp = r() < 0.55 ? 1 : 0;
	return { level, lightX, cadence, reeds, bank, far, trees, period, lamp };
}

export function makeRipple(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.18,
		init(s) {
			const id = pondIdent(s);
			(s as any).id = id;
			(s as any).hf = new Float32Array(s.w * s.h);
			(s as any).src = new Uint8ClampedArray(s.w * s.h * 4);
			(s as any).rings = [] as number[][];
			(s as any).drops = [] as number[][];
			(s as any).crown = [] as number[][];
			(s as any).next = 4;
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
			const id = (s as any).id as Pond;
			const hf = (s as any).hf as Float32Array;
			const src = (s as any).src as Uint8ClampedArray;
			const rings = (s as any).rings as number[][];
			const drops = (s as any).drops as number[][];
			const crown = (s as any).crown as number[][];
			const top = id.level * s.h;
			const depth = s.h - top;
			const squash = 0.34;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.55, 22);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.4, 94);
			const [kr, kg, kb] = hsl(s.v.hue, s.v.sat * 0.3, 12);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const storm = cyc < 0.55 ? Math.sin((cyc / 0.55) * Math.PI) ** 1.4 : 0;
			(s as any).storm = storm;

			const lampX = id.lightX * s.w;
			if (id.lamp) {
				const ly = top - s.h * 0.28;
				for (let dy = -6; dy <= 6; dy++)
					for (let dx = -6; dx <= 6; dx++) {
						const d = Math.hypot(dx / 2.2, dy / 3);
						if (d < 1) paint(s, lampX + dx, ly + dy, 255, 224, 160, 1);
						else plot(s, lampX + dx * 2, ly + dy * 2, 255, 196, 110, Math.max(0, 1 - d / 3) ** 2 * 0.4);
					}
				for (let k = 0; k < s.h * 0.3; k++) for (let q = -1; q <= 0; q++) paint(s, lampX + q, ly + 6 + k, 16, 17, 20, 0.95);
			}

			for (let x = 0; x < s.w; x++) {
				const y0 = top + ridgeAt(id.bank, x / s.w, s.h * 0.05);
				const tall = s.h * (0.022 + hash2(x * 0.3, 3, 771) * 0.026);
				for (let y = y0 - tall; y < y0; y++) {
					const g = hash2(x, y, 771);
					const f = (y0 - y) / tall;
					const lit = 0.7 + g * 0.6 + f * 0.5;
					paint(s, x, y, kr * lit, kg * lit * 1.05, kb * lit, 1);
				}
			}
			for (let i = 0; i < 14; i++) {
				const rx = id.reeds[i] * s.w;
				const rh = s.h * (0.08 + id.reeds[(i + 5) % 14] * 0.16);
				const bend = Math.sin(s.t * 0.024 * s.v.speed + i) * s.w * 0.012 * s.v.drift * s.v.dir;
				const base = top + ridgeAt(id.bank, rx / s.w, s.h * 0.05);
				for (let k = 0; k < rh; k++) {
					const f = k / rh;
					paint(s, rx + bend * f * f, base - k, kr, kg, kb, 0.95);
				}
			}

			for (let y = top | 0; y < s.h; y++) {
				const f = (y - top) / depth;
				const k = (0.66 - f * 0.46) * (1 - storm * 0.22);
				const bk = 0.9 - f * 0.45;
				for (let x = 0; x < s.w; x++) paint(s, x, y, br * bk + k * 40, bg * bk + k * 44, bb * bk + k * 52, 1);
			}

			if (id.lamp) {
				for (let y = top | 0; y < s.h; y++) {
					const f = (y - top) / depth;
					const smear = s.w * (0.012 + f * 0.05);
					const fade = Math.max(0, 1 - f * 1.25) ** 1.6;
					const wob = Math.sin(y * 0.7 + s.t * 0.06 * s.v.speed) * smear * 0.5;
					for (let x = lampX - smear; x <= lampX + smear; x++) {
						const e = 1 - Math.abs(x - lampX - wob) / (smear + 0.5);
						if (e <= 0) continue;
						plot(s, x, y, 255, 198, 112, e * e * fade * 0.55 * (1 - storm * 0.4));
					}
				}
			}

			if (--(s as any).next <= 0) {
				(s as any).next = id.cadence * (0.3 + s.rnd() * 1.2) * (1 - storm * 0.82);
				const squall = 1 + ((s.rnd() * s.rnd() * 4) | 0) + ((storm * 5) | 0);
				for (let q = 0; q < squall; q++) {
					drops.push([s.rnd() * s.w, -2 - s.rnd() * 9, 0.5 + s.rnd() * 0.6, top + s.rnd() * depth]);
					if (drops.length > 70) drops.shift();
				}
			}

			for (let k = drops.length - 1; k >= 0; k--) {
				const dp = drops[k];
				dp[2] += 0.12 * s.v.speed;
				dp[1] += dp[2];
				if (dp[1] >= dp[3]) {
					rings.push([dp[0], dp[3], 0, 0.72 + s.rnd() * 0.68]);
					if (rings.length > 20) rings.shift();
					const bits = 4 + ((s.rnd() * 4) | 0);
					for (let q = 0; q < bits; q++) {
						const th = (q / bits) * Math.PI * 2 + s.rnd() * 0.6;
						crown.push([dp[0], dp[3], Math.cos(th) * (0.45 + s.rnd() * 0.75), -0.65 - s.rnd() * 0.95, dp[3]]);
					}
					if (crown.length > 64) crown.splice(0, crown.length - 64);
					drops.splice(k, 1);
					continue;
				}
			}

			for (let k = crown.length - 1; k >= 0; k--) {
				const c = crown[k];
				c[2] *= 0.985;
				c[3] += 0.085 * s.v.speed;
				c[0] += c[2];
				c[1] += c[3];
				if (c[1] >= c[4] && c[3] > 0) {
					rings.push([c[0], c[4], 0, 0.16 + s.rnd() * 0.18]);
					if (rings.length > 20) rings.shift();
					crown.splice(k, 1);
					continue;
				}
			}

			hf.fill(0);
			for (let k = rings.length - 1; k >= 0; k--) {
				const rg2 = rings[k];
				rg2[2] += 0.9 * s.v.speed;
				const age = rg2[2];
				const amp = rg2[3] * Math.exp(-age / 26);
				if (amp < 0.02) {
					rings.splice(k, 1);
					continue;
				}
				const R = age;
				const y0 = Math.max(top | 0, (rg2[1] - (R + 5) * squash) | 0);
				const y1 = Math.min(s.h - 1, (rg2[1] + (R + 5) * squash) | 0);
				const x0 = Math.max(0, (rg2[0] - R - 5) | 0);
				const x1 = Math.min(s.w - 1, (rg2[0] + R + 5) | 0);
				for (let y = y0; y <= y1; y++) {
					const dy = (y - rg2[1]) / squash;
					for (let x = x0; x <= x1; x++) {
						const dx = x - rg2[0];
						const dd = Math.sqrt(dx * dx + dy * dy);
						const off = dd - R;
						if (off < -5 || off > 5) continue;
						hf[y * s.w + x] += amp * Math.cos(off * 1.15) * (1 - Math.abs(off) / 5);
					}
				}
			}

			src.set(s.px);
			const lo = (top | 0) + 1;
			for (let y = lo; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i = y * s.w + x;
					const gx = hf[i + 1] - hf[i - 1];
					const gy = hf[i + s.w] - hf[i - s.w];
					if (gx * gx + gy * gy < 0.0002) continue;
					const ux = Math.max(0, Math.min(s.w - 1, Math.round(x + gx * 5.5)));
					const uy = Math.max(lo, Math.min(s.h - 1, Math.round(y + gy * 3.2)));
					const a = (uy * s.w + ux) * 4;
					const b = i * 4;
					s.px[b] = src[a];
					s.px[b + 1] = src[a + 1];
					s.px[b + 2] = src[a + 2];
					s.px[b + 3] = src[a + 3];
				}
			}

			const lx = id.lightX * s.w;
			for (let y = lo; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i = y * s.w + x;
					const gx = hf[i + 1] - hf[i - 1];
					const gy = hf[i + s.w] - hf[i - s.w];
					const slope = gx * (x < lx ? 1 : -1) + gy * 0.6;
					if (slope > 0.02) plot(s, x, y, sr, sg, sb, Math.min(0.85, slope * 1.5));
					else if (slope < -0.02) paint(s, x, y, kr, kg, kb, Math.min(0.5, -slope * 0.9));
				}
			}

			for (const dp of drops) {
				const fade = edge(dp[1], -9, s.h, s.h * 0.1);
				for (let t2 = 0; t2 < 5; t2++) plot(s, dp[0], dp[1] - t2 * 0.9, sr, sg, sb, (1 - t2 / 5) * 0.6 * fade);
			}
			for (const c of crown) {
				plot(s, c[0], c[1], sr, sg, sb, 0.75);
				plot(s, c[0], c[1] - 1, sr, sg, sb, 0.3);
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.03 * p[o + 2];
				p[o] += 0.1 * s.v.dir * s.v.drift * p[o + 2];
				if (p[o] > s.w + 1) p[o] = -1;
				if (p[o] < -1) p[o] = s.w + 1;
				const y = top * 0.55 + Math.sin(p[o + 3]) * s.h * 0.05 + p[o + 1] * 0.1;
				const tw = 0.4 + 0.6 * Math.max(0, Math.sin(p[o + 3] * 1.7));
				plot(s, p[o], y, sr, sg, sb, tw * 0.4 * edge(p[o], -1, s.w + 1, s.w * 0.12));
			}
			s.out = Math.min(1, (rings.length + crown.length * 0.15) / 9 + storm * 0.5);
			blit(s);
		}
	};
}

type Cavern = {
	tips: number[];
	lens: number[];
	offs: number[];
	pool: number;
	shaft: number;
	glow: number[];
	strands: number[][];
	grain: number;
	hero: number;
	period: number;
};

function caveIdent(s: FxScene): Cavern {
	const r = mulberry32(s.v.seed + 6190);
	const tips: number[] = [];
	const lens: number[] = [];
	const offs: number[] = [];
	for (let i = 0; i < 9; i++) {
		tips.push(0.08 + r() * 0.84);
		lens.push(0.16 + r() * 0.3);
		offs.push(r());
	}
	const pool = 0.7 + r() * 0.08;
	const shaft = 0.25 + r() * 0.5;
	const glow: number[] = [];
	for (let i = 0; i < 12; i++) glow.push(r());
	const strands: number[][] = [];
	for (let i = 0; i < 10; i++) strands.push([r(), 0.1 + r() * 0.34, r() * 6.28, 0.5 + r() * 0.8]);
	const grain = (r() * 9999) | 0;
	let hero = (r() * 9) | 0;
	for (let k = 0; k < 9; k++) {
		const c = (hero + k) % 9;
		if (tips[c] > 0.2 && tips[c] < 0.8) {
			hero = c;
			break;
		}
	}
	const period = 640 + ((r() * 300) | 0);
	return { tips, lens, offs, pool, shaft, glow, strands, grain, hero, period };
}

export function makeDrip(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = caveIdent(s);
			(s as any).id = id;
			(s as any).drops = [] as number[][];
			(s as any).rings = [] as number[][];
			(s as any).bead = id.offs.map((o) => o);
			(s as any).chunk = null;
			(s as any).spray = [] as number[][];
			(s as any).chip = 0;
			(s as any).last = 9;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Cavern;
			const drops = (s as any).drops as number[][];
			const rings = (s as any).rings as number[][];
			const bead = (s as any).bead as number[];
			const poolY = id.pool * s.h;
			const [rr, rg, rb] = hsl(s.v.hue, 22 + s.v.sat * 0.4, 32);
			const [er, eg, eb] = hsl(s.v.hue, 26 + s.v.sat * 0.4, 52);
			const [wr, wg, wb] = hsl(s.v.hue2, 30 + s.v.sat * 0.4, 90);
			const [pr, pg, pb] = hsl(s.v.hue2, 34 + s.v.sat * 0.5, 26);

			const sx = id.shaft * s.w;
			const beam = 0.6 + 0.4 * Math.sin(s.t * 0.015 * s.v.speed);
			for (let y = 0; y < poolY; y++) {
				const f = y / poolY;
				const half = s.w * (0.03 + f * 0.09);
				for (let x = sx - half + s.v.tilt * f * s.w * 0.1; x <= sx + half + s.v.tilt * f * s.w * 0.1; x++) {
					const e = 1 - Math.abs(x - sx - s.v.tilt * f * s.w * 0.1) / (half + 0.5);
					const mote = 0.9 + 0.35 * Math.sin(x * 1.7 + y * 2.3 - s.t * 0.06 * s.v.speed);
					plot(s, x, y, wr, wg, wb, e * e * (1 - f * 0.55) * 0.3 * beam * mote);
				}
			}

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			if (cyc < (s as any).last) {
				(s as any).chunk = null;
				(s as any).chip = 0;
			}
			(s as any).last = cyc;
			const strain = cyc > 0.62 && cyc < 0.78 ? (cyc - 0.62) / 0.16 : 0;
			const broken = cyc >= 0.78;

			const ceil = s.h * 0.1;
			const bright = (x: number, y: number) => 1 + Math.max(0, 1 - Math.abs(x - sx) / (s.w * 0.3)) * beam * 0.85 * (0.4 + (y / s.h) * 0.8);
			for (let x = 0; x < s.w; x++) {
				const bump = ceil + (hash2(x * 0.14, 0, id.grain) + hash2(x * 0.5, 1, id.grain) * 0.4) * s.h * 0.07;
				for (let y = 0; y < bump; y++) {
					const g = hash2(x, y, id.grain);
					const lit = (0.55 + (1 - y / bump) * 0.6 + g * 0.3) * bright(x, y);
					paint(s, x, y, rr * lit, rg * lit, rb * lit, 1);
				}
				paint(s, x, bump, er * 0.8, eg * 0.8, eb * 0.8, 0.85);
				const wallH = (hash2(x * 0.1, 9, id.grain) * 0.4 + 0.25) * s.h;
				const near = Math.max(0, 1 - Math.min(x, s.w - 1 - x) / (s.w * 0.22));
				const ledge = poolY - wallH * near * near;
				if (near > 0.02)
					for (let y = ledge; y < poolY; y++) {
						const g = hash2(x, y, id.grain + 3);
						const lit = (0.5 + g * 0.35 + (1 - (y - ledge) / Math.max(1, poolY - ledge)) * 0.4) * bright(x, y);
						paint(s, x, y, rr * lit, rg * lit, rb * lit, 1);
					}
			}

			for (const [sxp, slen, sph, sthk] of id.strands) {
				const bx = sxp * s.w;
				const len = slen * s.h;
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const sway = Math.sin(sph + s.t * 0.014 * s.v.speed + f * 2.2) * f * f * s.w * 0.012 * s.v.drift;
					const w = sthk * (1 - f * 0.7);
					for (let q = -w; q <= w; q++) paint(s, bx + sway + q, ceil * 0.6 + k, rr * 0.9, rg * 0.9, rb * 0.95, 0.85);
				}
			}

			for (let i = 0; i < 9; i++) {
				const tx = id.tips[i] * s.w;
				const isHero = i === id.hero;
				const gone = isHero && broken;
				const len = id.lens[i] * s.h * (gone ? 0.38 : 1);
				const shake = isHero ? Math.sin(s.t * 0.9) * strain * 1.2 : 0;
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const half = (1 - f) * (1 - f) * s.w * 0.016 + 0.4 + (isHero ? 0.9 : 0);
					const sw = shake * f;
					for (let x = tx - half + sw; x <= tx + half + sw; x++) {
						const g = hash2(x, ceil + k, id.grain + 5);
						const side = 0.6 + Math.max(0, (x - tx) / (half + 0.5)) * 0.55;
						const lit = (0.75 + g * 0.3 + (1 - f) * 0.15) * side * bright(x, ceil + k);
						paint(s, x, ceil + k, rr * lit, rg * lit, rb * lit, 1);
					}
					paint(s, tx + half + sw, ceil + k, er, eg, eb, 0.5);
				}
				if (isHero && strain > 0.05 && !gone) {
					const cy = ceil + len * 0.3;
					for (let q = -3; q <= 3; q++) {
						const jag = Math.sin(q * 2.1 + id.offs[i] * 9) * 1.2;
						plot(s, tx + q, cy + jag, 255, 236, 208, strain * (0.3 + Math.abs(Math.sin(s.t * 0.4)) * 0.6));
					}
				}
				if (isHero && strain > 0.9 && !(s as any).chunk) {
					(s as any).chunk = [tx, ceil + len * 0.4, 0, 0, 0, id.lens[i] * s.h * 0.55];
				}
				const mound = len * 0.32;
				for (let k = 0; k < mound; k++) {
					const f = k / mound;
					const half = f * f * s.w * 0.014 + 0.4;
					for (let x = tx - half; x <= tx + half; x++) {
						const g = hash2(x, poolY - mound + k, id.grain + 8);
						const lit = (0.8 + g * 0.35) * bright(x, poolY - mound + k);
						paint(s, x, poolY - mound + k, rr * lit, rg * lit, rb * lit, 1);
					}
				}

				const phase = (s.t * 0.012 * s.v.speed + id.offs[i]) % 1;
				bead[i] = phase;
				const tipY = ceil + len;
				if (phase > 0.86) {
					const g = (phase - 0.86) / 0.14;
					const sag = g * 1.8;
					const rad = 0.6 + g * 1.1;
					for (let y = -rad; y <= rad; y++)
						for (let x = -rad; x <= rad; x++) {
							if (x * x + y * y > rad * rad) continue;
							plot(s, tx + x, tipY + sag + y, wr, wg, wb, 0.8);
						}
					if (phase > 0.985 && !drops.some((d) => d[2] === i)) drops.push([tx, tipY + sag, i, 0]);
				}
			}

			for (let x = 0; x < s.w; x++) {
				const wob = Math.sin(x * 0.17 + s.t * 0.03 * s.v.speed) * 0.8 + Math.sin(x * 0.05 - s.t * 0.018) * 0.6;
				const y0 = poolY + wob;
				const lit = Math.max(0, 1 - Math.abs(x - sx) / (s.w * 0.28)) * beam;
				for (let y = y0; y < s.h; y++) {
					const dep = (y - y0) / Math.max(1, s.h - y0);
					const k = 0.55 + (1 - dep) * 0.5 + lit * 0.5;
					paint(s, x, y, pr * k, pg * k, pb * k, 0.95);
					const shimmer = Math.sin(x * 0.9 - y * 1.6 + s.t * 0.07 * s.v.speed) * Math.sin(x * 0.3 + s.t * 0.04);
					if (shimmer > 0.72) plot(s, x, y, wr, wg, wb, (shimmer - 0.72) * (1 - dep) * 0.8);
				}
				plot(s, x, y0, wr, wg, wb, 0.25 + lit * 0.4);
			}

			for (let k = drops.length - 1; k >= 0; k--) {
				const d = drops[k];
				d[3] += 0.09 * s.v.speed;
				d[1] += d[3];
				if (d[1] >= poolY) {
					rings.push([d[0], 0]);
					if (rings.length > 8) rings.shift();
					drops.splice(k, 1);
					continue;
				}
				const stretch = 1 + d[3] * 1.6;
				for (let q = 0; q < stretch; q++) plot(s, d[0], d[1] - q, wr, wg, wb, (1 - q / stretch) * 0.85);
			}

			for (let k = rings.length - 1; k >= 0; k--) {
				const rgn = rings[k];
				rgn[1] += 1;
				if (rgn[1] > 20) {
					rings.splice(k, 1);
					continue;
				}
				const f = rgn[1] / 20;
				const rad = f * s.w * 0.06;
				const a = (1 - f) * 0.7;
				for (let q = 0; q < 26; q++) {
					const th = (q / 26) * Math.PI * 2;
					plot(s, rgn[0] + Math.cos(th) * rad, poolY + Math.sin(th) * rad * 0.32, wr, wg, wb, a);
				}
			}

			const chunk = (s as any).chunk as number[] | null;
			const spray = (s as any).spray as number[][];
			if (chunk) {
				chunk[3] += 0.085 * s.v.speed;
				chunk[1] += chunk[3];
				chunk[4] += 0.05 * s.v.speed;
				if (chunk[1] >= poolY - chunk[5] * 0.4) {
					(s as any).chip = 1;
					for (let k = 0; k < 34; k++) {
						const th = -Math.PI * (0.1 + s.rnd() * 0.8);
						const pw = 0.6 + s.rnd() * 2.2;
						spray.push([chunk[0], poolY - 1, Math.cos(th) * pw, Math.sin(th) * pw, 0, 26 + s.rnd() * 28]);
					}
					rings.push([chunk[0], 0]);
					rings.push([chunk[0], -6]);
					(s as any).chunk = null;
				} else {
					const hl = chunk[5] * 0.5;
					const ca = Math.cos(chunk[4]);
					const sa = Math.sin(chunk[4]);
					const rad = hl + 2;
					for (let dy = -rad; dy <= rad; dy++)
						for (let dx = -rad; dx <= rad; dx++) {
							const lx2 = dx * ca + dy * sa;
							const ly = -dx * sa + dy * ca;
							const f = (ly + hl) / (hl * 2);
							if (f < 0 || f > 1) continue;
							const half = (1 - f) * (1 - f) * s.w * 0.028 + 1;
							if (Math.abs(lx2) > half) continue;
							const g = hash2(dx, dy, id.grain + 11);
							const side = 0.65 + Math.max(0, lx2 / half) * 0.6;
							const lit = (1.2 + g * 0.45) * side;
							paint(s, chunk[0] + dx, chunk[1] + dy, rr * lit, rg * lit, rb * lit, 1);
						}
				}
			}

			for (let k = spray.length - 1; k >= 0; k--) {
				const q = spray[k];
				q[4] += 1;
				if (q[4] > q[5]) {
					spray.splice(k, 1);
					continue;
				}
				q[3] += 0.09 * s.v.speed;
				q[0] += q[2];
				q[1] += q[3];
				plot(s, q[0], q[1], wr, wg, wb, (1 - q[4] / q[5]) * 0.8);
			}

			const chip = (s as any).chip as number;
			if (chip > 0) {
				(s as any).chip = Math.max(0, chip - 0.05);
				for (let y = 0; y < s.h; y++)
					for (let x = 0; x < s.w; x++) {
						const d = Math.hypot((x - s.w * 0.5) / (s.w * 0.5), (y - poolY) / s.h);
						plot(s, x, y, wr, wg, wb, Math.max(0, 1 - d) * chip * chip * 0.12);
					}
			}

			for (let i = 0; i < 12; i++) {
				const gx = id.glow[i] * s.w;
				const gy = ceil * 0.4 + id.glow[(i + 4) % 12] * s.h * 0.5;
				const tw = 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 0.03 * s.v.speed + i * 1.7));
				const [lr, lg, lb] = hsl(s.v.hue2 + i * 4, s.v.sat, 72);
				const rad = 1.6 + tw * 1.2;
				for (let dy = -rad; dy <= rad; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy) / rad;
						if (d > 1) continue;
						plot(s, gx + dx, gy + dy, lr, lg, lb, (1 - d) * (1 - d) * tw * 0.7);
					}
			}
			let young = 0;
			for (const rgn of rings) if (rgn[1] < 7) young++;
			s.out = Math.min(1, chip * 0.8 + strain * 0.4 + young * 0.25);
			blit(s);
		}
	};
}
