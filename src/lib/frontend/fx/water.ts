import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Fall = { x: number; w: number; power: number };
type Falls = { falls: Fall[]; lip: number; pool: number; ridge: number[] };

function fallIdent(s: FxScene): Falls {
	const r = mulberry32(s.v.seed + 4410);
	const count = 1 + ((r() * 3) | 0);
	const falls: Fall[] = [];
	for (let i = 0; i < 3; i++) {
		const x = 0.14 + i * 0.28 + r() * 0.12;
		const w = 0.035 + r() * 0.055;
		const power = 0.7 + r() * 0.6;
		if (i < count) falls.push({ x, w, power });
	}
	const lip = 0.13 + r() * 0.07;
	const pool = 0.74 + r() * 0.08;
	const ridge: number[] = [];
	for (let i = 0; i < 13; i++) ridge.push(r());
	return { falls, lip, pool, ridge };
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
			const lipY = id.lip * s.h;
			const poolY = id.pool * s.h;
			const grav = 0.055 * s.v.speed;
			const [rr, rg, rb] = hsl(s.v.hue, s.v.sat * 0.2, 13);
			const [er, eg, eb] = hsl(s.v.hue, s.v.sat * 0.4, 30);
			const [wr, wg, wb] = hsl(s.v.hue, s.v.sat * 0.45, 92);
			const [pr, pg, pb] = hsl(s.v.hue, s.v.sat * 0.6, 26);

			for (let x = 0; x < s.w; x++) {
				const y0 = lipY + ridgeAt(id.ridge, x / s.w, s.h * 0.1);
				for (let y = 0; y < y0; y++) paint(s, x, y, rr, rg, rb, 1);
				paint(s, x, y0, er, eg, eb, 0.9);
			}

			for (const f of id.falls) {
				const cx = f.x * s.w;
				const hw = f.w * s.w * 0.5;
				const lam = s.h * 0.16 * f.power;
				for (let y = lipY; y < lipY + lam; y++) {
					const g = (y - lipY) / lam;
					for (let x = cx - hw; x <= cx + hw; x++) {
						const e = 1 - Math.abs(x - cx) / (hw + 0.5);
						plot(s, x, y, wr, wg, wb, (0.24 + e * 0.4) * (1 - g * 0.45));
					}
				}
				for (let k = 0; k < 3; k++) {
					const x = cx + (k - 1) * hw * 0.55;
					plot(s, x, lipY - 1, wr, wg, wb, 0.5);
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const f = id.falls[p[o + 5]];
				p[o + 2] += grav;
				p[o + 1] += p[o + 2];
				p[o + 3] += 0.12;
				const drop = (p[o + 1] - lipY) / Math.max(1, poolY - lipY);
				p[o] += Math.sin(p[o + 3]) * 0.22 * drop * s.v.drift;
				if (p[o + 1] >= poolY) {
					splash.push([p[o], 0, 0.6 + s.rnd() * 0.8]);
					if (splash.length > 22) splash.shift();
					p[o + 1] = lipY;
					p[o + 2] = 0.5 + s.rnd() * 0.6;
					p[o] = (f.x + (s.rnd() - 0.5) * f.w) * s.w;
					continue;
				}
				const a = p[o + 4] * edge(p[o + 1], lipY - 2, poolY + 2, s.h * 0.12) * (0.4 + drop * 0.6);
				const len = 1 + p[o + 2] * 2.4;
				for (let k = 0; k < len; k++) plot(s, p[o], p[o + 1] - k, wr, wg, wb, a * (1 - k / len) * 0.85);
			}

			const surf = 0.5 + 0.5 * Math.sin(s.t * 0.05 * s.v.speed);
			for (let x = 0; x < s.w; x++) {
				const wob = Math.sin(x * 0.19 + s.t * 0.05 * s.v.speed) * 1.3 + Math.sin(x * 0.06 - s.t * 0.03) * 0.9;
				const y0 = poolY + wob;
				for (let y = y0; y < s.h; y++) paint(s, x, y, pr, pg, pb, 0.72);
				plot(s, x, y0, wr, wg, wb, 0.3 + surf * 0.16);
			}

			for (const f of id.falls) {
				const cx = f.x * s.w;
				const hw = f.w * s.w;
				for (let x = cx - hw; x <= cx + hw; x++) {
					const e = 1 - Math.abs(x - cx) / (hw + 0.5);
					const churn = 0.5 + 0.5 * Math.sin(s.t * 0.19 + x * 0.6);
					for (let y = poolY - 1; y < poolY + 3; y++) plot(s, x, y, wr, wg, wb, e * churn * 0.5);
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
				const rise = Math.sin((sp[1] / 18) * Math.PI) * s.h * 0.16 * sp[2];
				const spread = (sp[1] / 18) * s.w * 0.035;
				for (let d = -2; d <= 2; d++) {
					const x = sp[0] + d * spread * 0.5;
					plot(s, x, poolY - rise + Math.abs(d) * 1.2, wr, wg, wb, life * 0.7);
				}
			}

			for (const f of id.falls) {
				const cx = f.x * s.w;
				const breathe = 0.62 + 0.38 * Math.sin(s.t * 0.021 * s.v.speed + f.x * 9);
				const rx = s.w * 0.1 * f.power;
				const ry = s.h * 0.2 * f.power;
				const my = poolY - ry * 0.35;
				const sway = Math.sin(s.t * 0.014) * s.w * 0.02 * s.v.dir * s.v.drift;
				for (let y = my - ry; y <= my + ry; y++) {
					for (let x = cx - rx + sway; x <= cx + rx + sway; x++) {
						const d = Math.hypot((x - cx - sway) / rx, (y - my) / ry);
						if (d > 1) continue;
						plot(s, x, y, wr, wg, wb, (1 - d) * (1 - d) * 0.16 * breathe);
					}
				}
			}
			s.out = Math.min(1, splash.length / 18);
			blit(s);
		}
	};
}

type Pond = { level: number; lightX: number; cadence: number; reeds: number[]; bank: number[] };

function pondIdent(s: FxScene): Pond {
	const r = mulberry32(s.v.seed + 5820);
	const level = 0.36 + r() * 0.14;
	const lightX = 0.2 + r() * 0.6;
	const cadence = 16 + r() * 26;
	const reeds: number[] = [];
	for (let i = 0; i < 14; i++) reeds.push(r());
	const bank: number[] = [];
	for (let i = 0; i < 11; i++) bank.push(r());
	return { level, lightX, cadence, reeds, bank };
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
			(s as any).rings = [] as number[][];
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
			const rings = (s as any).rings as number[][];
			const top = id.level * s.h;
			const depth = s.h - top;
			const squash = 0.34;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.55, 22);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.4, 94);
			const [kr, kg, kb] = hsl(s.v.hue, s.v.sat * 0.3, 12);

			for (let x = 0; x < s.w; x++) {
				const y0 = top + ridgeAt(id.bank, x / s.w, s.h * 0.05);
				for (let y = y0 - s.h * 0.07; y < y0; y++) paint(s, x, y, kr, kg, kb, 1);
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
				for (let x = 0; x < s.w; x++) paint(s, x, y, br, bg, bb, 0.5 + f * 0.24);
			}

			if (--(s as any).next <= 0) {
				(s as any).next = id.cadence * (0.6 + s.rnd() * 0.8);
				rings.push([s.rnd() * s.w, top + s.rnd() * depth, 0, 0.7 + s.rnd() * 0.6]);
				if (rings.length > 9) rings.shift();
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
						const d = Math.sqrt(dx * dx + dy * dy);
						const off = d - R;
						if (off < -5 || off > 5) continue;
						hf[y * s.w + x] += amp * Math.cos(off * 1.15) * (1 - Math.abs(off) / 5);
					}
				}
			}

			const lx = id.lightX * s.w;
			for (let y = (top | 0) + 1; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i = y * s.w + x;
					const gx = hf[i + 1] - hf[i - 1];
					const gy = hf[i + s.w] - hf[i - s.w];
					const slope = gx * (x < lx ? 1 : -1) + gy * 0.6;
					if (slope > 0.02) plot(s, x, y, sr, sg, sb, Math.min(0.85, slope * 1.5));
					else if (slope < -0.02) paint(s, x, y, kr, kg, kb, Math.min(0.5, -slope * 0.9));
				}
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
			s.out = Math.min(1, rings.length / 5);
			blit(s);
		}
	};
}

type Cavern = { tips: number[]; lens: number[]; offs: number[]; pool: number; shaft: number; glow: number[] };

function caveIdent(s: FxScene): Cavern {
	const r = mulberry32(s.v.seed + 6190);
	const tips: number[] = [];
	const lens: number[] = [];
	const offs: number[] = [];
	for (let i = 0; i < 9; i++) {
		tips.push(r());
		lens.push(0.1 + r() * 0.26);
		offs.push(r());
	}
	const pool = 0.78 + r() * 0.08;
	const shaft = 0.2 + r() * 0.6;
	const glow: number[] = [];
	for (let i = 0; i < 12; i++) glow.push(r());
	return { tips, lens, offs, pool, shaft, glow };
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
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Cavern;
			const drops = (s as any).drops as number[][];
			const rings = (s as any).rings as number[][];
			const bead = (s as any).bead as number[];
			const poolY = id.pool * s.h;
			const [rr, rg, rb] = hsl(s.v.hue, s.v.sat * 0.22, 11);
			const [er, eg, eb] = hsl(s.v.hue, s.v.sat * 0.35, 26);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.45, 88);
			const [pr, pg, pb] = hsl(s.v.hue, s.v.sat * 0.55, 20);

			const sx = id.shaft * s.w;
			const beam = 0.6 + 0.4 * Math.sin(s.t * 0.015 * s.v.speed);
			for (let y = 0; y < poolY; y++) {
				const f = y / poolY;
				const half = s.w * (0.03 + f * 0.09);
				for (let x = sx - half + s.v.tilt * f * s.w * 0.1; x <= sx + half + s.v.tilt * f * s.w * 0.1; x++) {
					const e = 1 - Math.abs(x - sx - s.v.tilt * f * s.w * 0.1) / (half + 0.5);
					plot(s, x, y, wr, wg, wb, e * e * (1 - f * 0.7) * 0.15 * beam);
				}
			}

			const ceil = s.h * 0.1;
			for (let x = 0; x < s.w; x++) {
				for (let y = 0; y < ceil; y++) paint(s, x, y, rr, rg, rb, 1);
			}
			for (let i = 0; i < 9; i++) {
				const tx = id.tips[i] * s.w;
				const len = id.lens[i] * s.h;
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const half = (1 - f) * (1 - f) * s.w * 0.016 + 0.4;
					for (let x = tx - half; x <= tx + half; x++) paint(s, x, ceil + k, rr, rg, rb, 1);
					paint(s, tx + half, ceil + k, er, eg, eb, 0.5);
				}
				const mound = len * 0.32;
				for (let k = 0; k < mound; k++) {
					const f = k / mound;
					const half = f * f * s.w * 0.014 + 0.4;
					for (let x = tx - half; x <= tx + half; x++) paint(s, x, poolY - mound + k, rr, rg, rb, 1);
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
				const wob = Math.sin(x * 0.17 + s.t * 0.03) * 0.8;
				for (let y = poolY + wob; y < s.h; y++) paint(s, x, y, pr, pg, pb, 0.8);
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

			for (let i = 0; i < 12; i++) {
				const gx = id.glow[i] * s.w;
				const gy = ceil * 0.4 + id.glow[(i + 4) % 12] * s.h * 0.5;
				const tw = 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 0.03 * s.v.speed + i * 1.7));
				const [lr, lg, lb] = hsl(s.v.hue2 + i * 4, s.v.sat, 72);
				plot(s, gx, gy, lr, lg, lb, tw * 0.8);
				plot(s, gx + 1, gy, lr, lg, lb, tw * 0.3);
				plot(s, gx, gy + 1, lr, lg, lb, tw * 0.3);
			}
			let young = 0;
			for (const rgn of rings) if (rgn[1] < 7) young++;
			s.out = Math.min(1, young * 0.6);
			blit(s);
		}
	};
}
