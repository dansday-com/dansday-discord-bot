import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

function chip(dx: number, dy: number, key: number) {
	return ((((dx + 16) * 73 + (dy + 16) * 151 + key) * 2654435761) >>> 0) % 100;
}

export function makeMoney(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.34,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 14107);
			(s as any).id = { burstX: 0.3 + r() * 0.4, period: 300 + ((r() * 220) | 0), lean: (r() - 0.5) * 0.6, fan: 0.7 + r() * 0.6 };
			(s as any).pile = new Float32Array(s.w);
			(s as any).coins = [] as number[][];
			(s as any).flash = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = -s.rnd() * s.h * 1.6;
				s.parts[o + 2] = 0;
				s.parts[o + 3] = s.rnd() * 6.28;
				s.parts[o + 4] = 0.7 + s.rnd() * 0.6;
				s.parts[o + 5] = (s.rnd() * 4096) | 0;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { burstX: number; period: number; lean: number; fan: number };
			const pile = (s as any).pile as Float32Array;
			const coins = (s as any).coins as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.3, 8);
			const [nr, ng, nb] = hsl(s.v.hue, s.v.sat * 0.55, 46);
			const [ir, ig, ib] = hsl(s.v.hue, s.v.sat * 0.4, 72);
			const [gr2, gg2, gb2] = hsl(46, 82, 58);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const charge = cyc < 0.62 ? cyc / 0.62 : 0;
			const bx = id.burstX * s.w;
			const by = s.h * 0.3;

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const heat = Math.exp(-Math.hypot((x - bx) / (s.w * 0.4), (y - by) / (s.h * 0.5))) * charge * charge;
					paint(s, x, y, br + heat * 120, bg + heat * 96, bb + heat * 26, 0.24 + f * f * 0.5);
				}
			}

			if (cyc < (s.v.speed / id.period) * 1.2) {
				(s as any).flash = 1;
				for (let i = 0; i < s.n; i++) {
					const o = i * P;
					const th = -Math.PI * 0.5 + (s.rnd() - 0.5) * Math.PI * id.fan;
					const pow = 1.1 + s.rnd() * 1.5;
					p[o] = bx + (s.rnd() - 0.5) * 3;
					p[o + 1] = by + (s.rnd() - 0.5) * 3;
					p[o + 2] = Math.cos(th) * pow;
					p[o + 3] = s.rnd() * 6.28;
					p[o + 4] = 0.7 + s.rnd() * 0.6;
					p[o + 5] = (s.rnd() * 4096) | 0;
					(s as any).vy = 0;
					p[o + 2] = Math.cos(th) * pow;
				}
				for (let q = 0; q < 7; q++) {
					const th = -Math.PI * 0.5 + (s.rnd() - 0.5) * Math.PI * id.fan;
					coins.push([bx, by, Math.sin(th) * (1 + s.rnd()), 0, s.rnd() * 6.28, Math.cos(th) * (1.2 + s.rnd() * 1.4)]);
				}
				if (coins.length > 16) coins.splice(0, coins.length - 16);
			}

			const flash = (s as any).flash as number;
			if (flash > 0) {
				const rad = (1 - flash) * s.w * 0.9;
				for (let a = 0; a < 6.28; a += 0.05) {
					const fx2 = bx + Math.cos(a) * rad;
					const fy = by + Math.sin(a) * rad * 0.7;
					plot(s, fx2, fy, 255, 240, 190, flash * flash * 0.7);
				}
				for (let dy = -10; dy <= 10; dy++)
					for (let dx = -14; dx <= 14; dx++) {
						const d = Math.hypot(dx / 14, dy / 10);
						if (d > 1) continue;
						plot(s, bx + dx, by + dy, 255, 244, 200, (1 - d) * (1 - d) * flash * 0.8);
					}
				(s as any).flash = Math.max(0, flash - 0.06);
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const col = Math.max(0, Math.min(s.w - 1, p[o] | 0));
				const rest = s.h - 1 - pile[col];
				p[o + 3] += 0.09 * p[o + 4];
				p[o + 2] *= 0.985;
				p[o] += p[o + 2] + Math.sin(p[o + 3]) * 0.3 * s.v.drift + id.lean * 0.1 * s.v.dir;
				p[o + 1] += (0.3 + p[o + 4] * 0.34) * s.v.speed;
				if (p[o] < -4) p[o] = s.w + 4;
				if (p[o] > s.w + 4) p[o] = -4;

				if (p[o + 1] >= rest) {
					for (let k = -3; k <= 3; k++) {
						const c = col + k;
						if (c < 0 || c >= s.w) continue;
						pile[c] = Math.min(s.h * 0.44, pile[c] + (k === 0 ? 0.55 : 0.36 - Math.abs(k) * 0.07));
					}
					p[o] = s.rnd() * s.w;
					p[o + 1] = -3 - s.rnd() * s.h * 0.9;
					p[o + 2] = (s.rnd() - 0.5) * 0.3;
					p[o + 4] = 0.7 + s.rnd() * 0.6;
					p[o + 5] = (s.rnd() * 4096) | 0;
					continue;
				}

				const squash = Math.abs(Math.cos(p[o + 3]));
				const hw = 3.4 * p[o + 4];
				const hh = 1.7 * p[o + 4] * (0.25 + squash * 0.75);
				const fade = edge(p[o + 1], -6, s.h + 2, s.h * 0.12);
				for (let dy = -hh; dy <= hh; dy++) {
					for (let dx = -hw; dx <= hw; dx++) {
						const ex = Math.abs(dx) / hw;
						const ey = Math.abs(dy) / Math.max(0.4, hh);
						const rim = ex > 0.78 || ey > 0.72;
						const mid = ex < 0.3 && ey < 0.55;
						const sh = 0.72 + squash * 0.36;
						paint(s, p[o] + dx, p[o + 1] + dy, (mid ? ir : nr) * sh, (mid ? ig : ng) * sh, (mid ? ib : nb) * sh, (rim ? 0.72 : 0.95) * fade);
					}
				}
				if (squash > 0.82) plot(s, p[o], p[o + 1] - hh, 255, 255, 240, fade * 0.4);
			}

			for (let k = coins.length - 1; k >= 0; k--) {
				const c = coins[k];
				c[5] += 0.06 * s.v.speed;
				c[0] += c[2];
				c[1] += c[5];
				c[2] *= 0.99;
				c[4] += 0.32;
				const col = Math.max(0, Math.min(s.w - 1, c[0] | 0));
				const rest = s.h - 1 - pile[col];
				if (c[1] >= rest) {
					if (c[3] < 1) {
						c[3] += 1;
						c[1] = rest - 1;
						c[5] = -c[5] * 0.45;
					} else {
						pile[col] = Math.min(s.h * 0.44, pile[col] + 0.6);
						coins.splice(k, 1);
						continue;
					}
				}
				const wob = Math.abs(Math.cos(c[4]));
				const rad = 1.6 + wob * 0.9;
				for (let dy = -rad; dy <= rad; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx / Math.max(0.35, wob), dy) / rad;
						if (d > 1) continue;
						const lit = 0.65 + (1 - d) * 0.5;
						paint(s, c[0] + dx, c[1] + dy, gr2 * lit, gg2 * lit, gb2 * lit, 0.95);
					}
				if (wob > 0.8) plot(s, c[0], c[1] - rad * 0.5, 255, 250, 210, 0.6);
			}

			let stacked = 0;
			for (let x = 0; x < s.w; x++) {
				const h = pile[x];
				stacked += h;
				if (h < 0.4) continue;
				for (let k = 0; k < h; k++) {
					const y = s.h - 1 - k;
					const band = (k + ((x * 7) % 3)) % 4 === 0;
					const grit = chip(x % 16, k % 16, (x * 31 + k * 17) | 0) / 100;
					const sh = 0.6 + grit * 0.32 + (band ? 0.16 : 0);
					paint(s, x, y, nr * sh, ng * sh, nb * sh, 0.96);
					if (band && grit > 0.72) plot(s, x, y, ir, ig, ib, 0.3);
				}
				plot(s, x, s.h - 1 - h, 255, 245, 214, 0.22);
				pile[x] *= 0.9992;
			}

			s.out = Math.min(1, flash * 0.75 + charge * 0.3 + Math.min(0.4, stacked / (s.w * s.h * 0.08)));
			blit(s);
		}
	};
}

export function makeCat(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 15121);
			const tail: number[][] = [];
			for (let i = 0; i < 9; i++) tail.push([0, 0, 0, 0]);
			(s as any).id = {
				coat: r(),
				sit: 0.3 + r() * 0.36,
				stripes: r() < 0.55,
				tailLen: 0.9 + r() * 0.5,
				blinkEvery: 90 + ((r() * 150) | 0),
				period: 620 + ((r() * 260) | 0)
			};
			(s as any).tail = tail;
			(s as any).prints = [] as number[][];
			(s as any).blink = 40;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { coat: number; sit: number; stripes: boolean; tailLen: number; blinkEvery: number; period: number };
			const tail = (s as any).tail as number[][];
			const prints = (s as any).prints as number[][];
			const dir = s.v.dir;
			const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.3, 9);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.65, 34 + id.coat * 22);
			const [dk, dg2, db2] = hsl(s.v.hue, s.v.sat * 0.7, 18);
			const [er, eg, eb] = hsl(s.v.hue2, s.v.sat, 78);

			const floorY = s.h * 0.86;
			const sunX = s.w * (0.5 + Math.sin(s.t * 0.026 * s.v.speed) * 0.34);
			const sunW = s.w * 0.28;
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const sun = Math.pow(Math.max(0, 1 - Math.abs(x - sunX) / sunW), 0.35) * f * f;
					paint(s, x, y, fr * (0.7 + f * 0.5) + sun * 110, fg * (0.7 + f * 0.5) + sun * 88, fb + sun * 40, 0.26 + f * f * 0.52);
				}
			}
			for (let x = 0; x < s.w; x++) {
				const sun = Math.pow(Math.max(0, 1 - Math.abs(x - sunX) / sunW), 0.35);
				for (let y = Math.round(floorY); y < s.h; y++) paint(s, x, y, fr * 1.5 + sun * 130, fg * 1.5 + sun * 106, fb * 1.4 + sun * 50, 0.9);
			}
			for (let k = 0; k < 14; k++) {
				const life = (((s.t * 0.012 * s.v.speed + k * 0.0714) % 1) + 1) % 1;
				const mx = sunX + Math.sin(k * 2.3 + s.t * 0.02) * sunW * 0.8;
				const my = s.h * (1 - life) * 0.9;
				plot(s, mx, my, 255, 238, 200, Math.max(0, 1 - Math.abs(mx - sunX) / sunW) * life * (1 - life) * 4 * 0.35);
			}

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const walkIn = Math.min(1, cyc / 0.3);
			const settled = cyc > 0.3;
			const startX = dir > 0 ? -s.w * 0.2 : s.w * 1.2;
			const stopX = s.w * id.sit;
			const cx = startX + (stopX - startX) * (walkIn * walkIn * (3 - 2 * walkIn));
			const stride = settled ? 0 : Math.sin(cyc * id.period * 0.16) * 1.6;
			const breath = Math.sin(s.t * 0.055 * s.v.speed) * 0.5 + 0.5;
			const stretch = settled ? Math.max(0, Math.sin((cyc - 0.44) * 9.2)) * (cyc > 0.44 && cyc < 0.78 ? 1 : 0) : 0;
			const bodyY = floorY - s.h * (settled ? 0.12 : 0.1) - Math.abs(stride) * 0.3 - breath * 0.5 - stretch * s.h * 0.02;

			if (!settled && (s.t | 0) % 9 === 0) {
				prints.push([cx - dir * 4, floorY + 1, 0]);
				if (prints.length > 10) prints.shift();
			}
			for (let k = prints.length - 1; k >= 0; k--) {
				const q = prints[k];
				q[2] += 1;
				if (q[2] > 150) {
					prints.splice(k, 1);
					continue;
				}
				const a = (1 - q[2] / 150) * 0.4;
				paint(s, q[0], q[1], dk, dg2, db2, a);
				paint(s, q[0] + dir, q[1] - 1, dk, dg2, db2, a * 0.7);
			}

			const bw = s.w * 0.1 * (1 + stretch * 0.55);
			const bh = s.h * (settled ? 0.16 : 0.12) * (1 + breath * 0.14 - stretch * 0.22);
			for (let dy = -bh; dy <= bh; dy++) {
				for (let dx = -bw; dx <= bw; dx++) {
					const d = (dx * dx) / (bw * bw) + (dy * dy) / (bh * bh);
					if (d > 1) continue;
					const key = ((dx | 0) * 13 + (dy | 0) * 29) | 0;
					if (d > 0.82 && chip(dx | 0, dy | 0, key) < 30) continue;
					const sunlit = Math.max(0, 1 - Math.abs(cx + dx - sunX) / sunW) * 0.55;
					const lit = 0.74 + Math.max(0, -dy / bh) * 0.4 + sunlit;
					const stripe = id.stripes && Math.sin(dx * 0.9 + dy * 0.3) > 0.55;
					paint(s, cx + dx, bodyY + dy, (stripe ? dk : cr) * lit, (stripe ? dg2 : cg) * lit, (stripe ? db2 : cb) * lit, 0.97);
				}
			}

			const legPhase = settled ? 0 : stride;
			for (let leg = 0; leg < 2; leg++) {
				const lx = cx + (leg ? bw * 0.55 : -bw * 0.5) * dir;
				const swing = settled ? 0 : Math.sin(cyc * id.period * 0.16 + leg * Math.PI) * 1.4;
				for (let k = 0; k < bh * 0.9; k++) paint(s, lx + swing * (k / (bh * 0.9)), bodyY + bh * 0.6 + k, dk, dg2, db2, 0.95);
			}

			const look = Math.sin(s.t * 0.031 * s.v.speed) * Math.sin(s.t * 0.013) * 2.4;
			const hx = cx + bw * 0.86 * dir + look + stretch * bw * 0.4 * dir;
			const hy = bodyY - bh * (settled ? 0.86 : 0.62) - breath * 0.9 + Math.sin(s.t * 0.047 * s.v.speed) * 0.8;
			const hr2 = s.h * 0.075;
			for (let dy = -hr2; dy <= hr2; dy++) {
				for (let dx = -hr2; dx <= hr2; dx++) {
					if (dx * dx + dy * dy > hr2 * hr2) continue;
					const lit = 0.76 + Math.max(0, -dy / hr2) * 0.42;
					paint(s, hx + dx, hy + dy, cr * lit, cg * lit, cb * lit, 0.98);
				}
			}
			for (let ear = 0; ear < 2; ear++) {
				const ex2 = hx + (ear ? hr2 * 0.62 : -hr2 * 0.62);
				const tw = Math.sin(s.t * 0.06 + ear * 2) * 0.5;
				for (let k = 0; k < hr2 * 0.9; k++) {
					const w = (1 - k / (hr2 * 0.9)) * hr2 * 0.42;
					for (let q = -w; q <= w; q++) paint(s, ex2 + q + tw * (k / hr2), hy - hr2 * 0.7 - k, cr * 0.8, cg * 0.8, cb * 0.8, 0.95);
				}
			}

			(s as any).blink -= 1;
			if ((s as any).blink < -6) (s as any).blink = id.blinkEvery;
			const shut = (s as any).blink < 0;
			for (let eye = 0; eye < 2; eye++) {
				const ex2 = hx + (eye ? hr2 * 0.42 : -hr2 * 0.3) * dir;
				const ey2 = hy - hr2 * 0.1;
				if (shut) {
					paint(s, ex2, ey2, dk, dg2, db2, 0.9);
					continue;
				}
				plot(s, ex2, ey2, er, eg, eb, 0.95);
				plot(s, ex2, ey2 - 1, er * 0.6, eg * 0.6, eb * 0.6, 0.5);
			}

			const rootX = cx - bw * 0.9 * dir;
			const rootY = bodyY + bh * 0.1;
			const flick = Math.sin(s.t * 0.13 * s.v.speed) * 0.9 + Math.sin(s.t * 0.29) * 0.5 + stretch * 1.8;
			for (let i = 0; i < tail.length; i++) {
				const f = i / (tail.length - 1);
				const seg = tail[i];
				const tx = rootX - dir * f * s.w * 0.1 * id.tailLen;
				const ty = rootY - Math.sin(f * 2.1 + flick) * s.h * 0.1 * id.tailLen - f * s.h * 0.03;
				seg[0] += (tx - seg[0]) * 0.28;
				seg[1] += (ty - seg[1]) * 0.28;
				if (s.t < 3) {
					seg[0] = tx;
					seg[1] = ty;
				}
				const w = 1.5 * (1 - f * 0.55);
				for (let dy = -w; dy <= w; dy++)
					for (let dx = -w; dx <= w; dx++) {
						if (dx * dx + dy * dy > w * w) continue;
						paint(s, seg[0] + dx, seg[1] + dy, cr * 0.9, cg * 0.9, cb * 0.9, 0.96);
					}
			}

			s.out = Math.min(1, Math.abs(flick) * 0.4 + (shut ? 0.3 : 0) + stretch * 0.6);
			blit(s);
		}
	};
}

export function makeCoffee(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 1.6,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 16127);
			(s as any).id = { mug: 0.34 + r() * 0.16, handle: r() < 0.5 ? 1 : -1, curl: 0.5 + r() * 0.8, sips: 420 + ((r() * 260) | 0), tint: r() };
			(s as any).rings = [] as number[][];
			(s as any).next = 60 + ((s.rnd() * 120) | 0);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = 0;
				s.parts[o + 1] = 0;
				s.parts[o + 2] = s.rnd() * 120;
				s.parts[o + 3] = 0.4 + s.rnd() * 0.6;
				s.parts[o + 4] = s.rnd() * 6.28;
				s.parts[o + 5] = 0.6 + s.rnd() * 0.8;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { mug: number; handle: number; curl: number; sips: number; tint: number };
			const rings = (s as any).rings as number[][];
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.25, 10);
			const [mr, mg, mb] = hsl(s.v.hue2, s.v.sat * 0.2, 86);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.8, 20 + id.tint * 10);
			const [fr, fg, fb] = hsl(s.v.hue, s.v.sat * 0.6, 44);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.15, 88);

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) paint(s, x, y, br, bg, bb, 0.24 + f * f * 0.5);
			}

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.06;
			const halfW = s.w * id.mug * 0.5;
			const top = s.h * 0.4;
			const base = s.h * 0.88;
			const drink = ((s.t * s.v.speed) % id.sips) / id.sips;
			const level = top + 3 + drink * (base - top - 8);

			for (let y = top; y < base; y++) {
				const f = (y - top) / (base - top);
				const w = halfW * (1 - f * 0.12);
				for (let x = cx - w; x <= cx + w; x++) {
					const u = (x - cx) / w;
					const lit = 0.66 + (1 - Math.abs(u + 0.3)) * 0.5;
					paint(s, x, y, mr * lit, mg * lit, mb * lit, 0.98);
				}
			}

			const hx = cx + id.handle * halfW;
			for (let a = -1.25; a <= 1.25; a += 0.06) {
				const rr = halfW * 0.44;
				const px = hx + Math.cos(a) * rr * id.handle;
				const py = top + (base - top) * 0.42 + Math.sin(a) * rr;
				for (let k = 0; k < 2; k++) paint(s, px + k * id.handle, py, mr * 0.82, mg * 0.82, mb * 0.82, 0.97);
			}

			if (--(s as any).next <= 0) {
				(s as any).next = 90 + ((s.rnd() * 200) | 0);
				rings.push([cx + (s.rnd() - 0.5) * halfW * 1.2, 0, 0.6 + s.rnd() * 0.5]);
				if (rings.length > 4) rings.shift();
			}

			const surfW = halfW * (1 - ((level - top) / (base - top)) * 0.12) - 1;
			for (let y = level; y < base - 1; y++) {
				const f = (y - level) / Math.max(1, base - level);
				const w = halfW * (1 - ((y - top) / (base - top)) * 0.12) - 1;
				for (let x = cx - w; x <= cx + w; x++) paint(s, x, y, cr * (1 - f * 0.3), cg * (1 - f * 0.3), cb, 0.99);
			}
			for (let x = cx - surfW; x <= cx + surfW; x++) {
				const u = (x - cx) / surfW;
				let lift = Math.sin(u * 5 + s.t * 0.05) * 0.4;
				for (const rg of rings) {
					const d = Math.abs(x - rg[0]);
					const off = d - rg[1];
					if (off > -4 && off < 4) lift += Math.cos(off * 0.9) * rg[2] * Math.exp(-rg[1] / 14) * 1.4;
				}
				const y = level + lift;
				paint(s, x, y, fr, fg, fb, 0.85);
				plot(s, x, y - 1, sr, sg, sb, Math.max(0, lift) * 0.4);
			}
			for (let k = rings.length - 1; k >= 0; k--) {
				rings[k][1] += 0.5 * s.v.speed;
				if (rings[k][1] > surfW + 6) rings.splice(k, 1);
			}

			let steam = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const age = p[o + 2];
				if (age <= 0 || p[o + 1] < top - s.h * 0.34) {
					p[o] = cx + (s.rnd() - 0.5) * surfW * 1.4;
					p[o + 1] = level - 1;
					p[o + 2] = 60 + s.rnd() * 70;
					p[o + 4] = s.rnd() * 6.28;
					p[o + 5] = 0.6 + s.rnd() * 0.8;
					continue;
				}
				p[o + 2] -= 1;
				const life = 1 - p[o + 2] / 130;
				const cu = Math.sin(p[o + 1] * 0.14 + p[o + 4]) * Math.cos(p[o] * 0.09 - s.t * 0.02);
				p[o] += cu * 0.42 * id.curl * s.v.drift;
				p[o + 1] -= (0.22 + p[o + 5] * 0.26) * s.v.speed;
				const a = Math.max(0, 1 - life) * 0.3 * p[o + 3] * edge(p[o + 1], top - s.h * 0.36, level + 2, s.h * 0.12);
				if (a < 0.006) continue;
				steam += a;
				const rad = 0.6 + life * 2.6;
				for (let dy = -rad; dy <= rad; dy++) {
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy) / rad;
						if (d > 1) continue;
						plot(s, p[o] + dx, p[o + 1] + dy, sr, sg, sb, a * (1 - d) * (1 - d));
					}
				}
			}

			let ripple = 0;
			for (const rg of rings) ripple = Math.max(ripple, rg[2] * Math.exp(-rg[1] / 14));
			s.out = Math.min(1, Math.max(0, (steam - 7.4) / 11.2) * 0.35 + ripple * 0.8);
			blit(s);
		}
	};
}

export function makeCandle(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 17137);
			(s as any).id = { wax: 0.16 + r() * 0.1, lean: (r() - 0.5) * 0.4, burn: 900 + ((r() * 500) | 0), drips: r() * 6.28, gust: 190 + ((r() * 150) | 0) };
			(s as any).sparks = [] as number[][];
			(s as any).heat = new Float32Array(s.w * s.h);
			(s as any).runs = [] as number[][];
			(s as any).next = 90 + ((s.rnd() * 160) | 0);
			(s as any).pool = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { wax: number; lean: number; burn: number; drips: number; gust: number };
			const sparks = (s as any).sparks as number[][];
			const heat = (s as any).heat as Float32Array;
			const runs = (s as any).runs as number[][];
			const pool = (s as any).pool as Float32Array;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.3, 7);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.2, 80);
			const [fr2, fg2, fb2] = hsl(s.v.hue, s.v.sat, 62);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.08;
			const halfW = s.w * id.wax * 0.5;
			const base = s.h * 0.92;
			const burn = ((s.t * s.v.speed) % id.burn) / id.burn;
			const topY = s.h * 0.44 + burn * s.h * 0.2;

			const gcyc = ((s.t * s.v.speed) % id.gust) / id.gust;
			const gust = gcyc < 0.26 ? Math.sin((gcyc / 0.26) * Math.PI) : 0;
			const guttered = gust > 0.72;
			const sway = Math.sin(s.t * 0.06 * s.v.speed) * 0.5 + Math.sin(s.t * 0.17) * 0.3 + gust * 3.4 * s.v.dir;
			const feed = 1 - gust * 0.72;
			const flick = (0.74 + Math.sin(s.t * 0.23 * s.v.speed) * 0.16 + Math.sin(s.t * 0.61) * 0.12 + Math.sin(s.t * 1.37 + id.drips) * 0.18) * (1 - gust * 0.65);
			const lx = cx + sway * 1.4;
			const ly = topY - s.h * 0.1;

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - lx) / (s.w * 0.55), (y - ly) / (s.h * 0.62));
					const cast = Math.max(0, 1 - d) * flick;
					paint(s, x, y, br + cast * 92, bg + cast * 56, bb + cast * 22, 0.24 + f * f * 0.5);
				}
			}

			for (let y = topY; y < base; y++) {
				const f = (y - topY) / Math.max(1, base - topY);
				for (let x = cx - halfW; x <= cx + halfW; x++) {
					const u = (x - cx) / halfW;
					const fall = Math.max(0, 1 - (y - ly) / (s.h * 0.7));
					const lit = (0.44 + (1 - Math.abs(u + 0.25)) * 0.4 + fall * 0.5 * flick) * (0.72 + flick * 0.42);
					paint(s, x, y, wr * lit, wg * lit, wb * lit, 0.98);
				}
			}
			for (let x = cx - halfW; x <= cx + halfW; x++) {
				const u = (x - cx) / halfW;
				const dip = Math.sqrt(Math.max(0, 1 - u * u)) * 1.6;
				for (let k = 0; k < dip; k++) paint(s, x, topY + k, wr * 1.1, wg * 1.1, wb * 1.1, 0.9);
			}

			if (--(s as any).next <= 0) {
				(s as any).next = 120 + ((s.rnd() * 240) | 0);
				runs.push([cx + (s.rnd() - 0.5) * halfW * 1.7, topY + 1, 0]);
				if (runs.length > 5) runs.shift();
			}
			for (let k = runs.length - 1; k >= 0; k--) {
				const q = runs[k];
				q[2] += 0.012 * s.v.speed;
				q[1] += q[2];
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				if (q[1] >= base - pool[col]) {
					pool[col] = Math.min(4, pool[col] + 0.8);
					const l2 = Math.max(0, col - 1);
					const r2 = Math.min(s.w - 1, col + 1);
					pool[l2] = Math.min(4, pool[l2] + 0.4);
					pool[r2] = Math.min(4, pool[r2] + 0.4);
					runs.splice(k, 1);
					continue;
				}
				for (let d = 0; d < 3; d++) paint(s, q[0], q[1] - d, wr * 1.15, wg * 1.15, wb * 1.15, (1 - d / 3) * 0.95);
			}
			for (let x = 0; x < s.w; x++) {
				if (pool[x] < 0.3) continue;
				for (let k = 0; k < pool[x]; k++) paint(s, x, base - 1 + k, wr * 0.9, wg * 0.9, wb * 0.9, 0.95);
				pool[x] *= 0.9995;
			}

			const wickY = topY - 2;
			for (let k = 0; k < 3; k++) paint(s, cx, wickY + k, 24, 20, 18, 0.95);

			for (let k = 0; k < 5; k++) {
				const fx2 = cx + (sway + id.lean) * (k * 0.5) * s.v.drift;
				const i = ((wickY - k) | 0) * s.w + (fx2 | 0);
				if (i >= 0 && i < heat.length) heat[i] = feed;
			}
			if (guttered && s.rnd() < 0.5) sparks.push([cx + sway * 2, wickY - 3, (s.rnd() - 0.3) * 0.7 * s.v.dir, -0.5 - s.rnd() * 0.6, 0]);
			if (sparks.length > 24) sparks.splice(0, sparks.length - 24);
			for (let k = sparks.length - 1; k >= 0; k--) {
				const q = sparks[k];
				q[4] += 1;
				if (q[4] > 30) {
					sparks.splice(k, 1);
					continue;
				}
				q[0] += q[2] + Math.sin(q[4] * 0.3) * 0.2 * s.v.drift;
				q[1] += q[3];
				q[3] += 0.008;
				const a = 1 - q[4] / 30;
				plot(s, q[0], q[1], 255, 150 + a * 80, 60, a * a * 0.9);
			}
			for (let y = 1; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i = y * s.w + x;
					const v = (heat[i + s.w] + heat[i + s.w - 1] + heat[i + s.w + 1] + heat[i]) * 0.245;
					heat[i] = v * (0.96 - s.rnd() * 0.05);
				}
			}
			let glow = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = heat[y * s.w + x];
					if (v < 0.03) continue;
					glow += v;
					const hot = Math.min(1, v * 1.5);
					const [r2, g2, b2] = hsl(s.v.hue + (1 - hot) * 26, s.v.sat, 40 + hot * 55);
					plot(s, x, y, r2, g2, b2, Math.min(0.95, v * 1.2));
				}
			}
			const halo = (1 - gust * 0.6) * (0.9 + Math.sin(s.t * 0.11 * s.v.speed) * 0.12);
			const hx = cx + sway * 1.2;
			for (let dy = -8; dy <= 8; dy++) {
				for (let dx = -10; dx <= 10; dx++) {
					const d = Math.hypot(dx / 10, dy / 8);
					if (d > 1) continue;
					plot(s, hx + dx, wickY + dy, fr2, fg2, fb2, (1 - d) * (1 - d) * 0.16 * halo);
				}
			}

			s.out = Math.min(1, Math.max(0, (glow - 22) / 3.4) * 0.7 + gust * 0.5);
			blit(s);
		}
	};
}

export function makeVinyl(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.1,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 18149);
			(s as any).id = { grooves: 16 + ((r() * 12) | 0), label: 0.24 + r() * 0.1, rpm: 0.9 + r() * 0.5, arm: r() * 0.3, wobble: r() * 6.28 };
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.2 + s.rnd() * 0.6;
				s.parts[o + 3] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { grooves: number; label: number; rpm: number; arm: number; wobble: number };
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.25, 8);
			const [dr, dg, db] = hsl(s.v.hue2, s.v.sat * 0.12, 10);
			const [lr, lg, lb] = hsl(s.v.hue, s.v.sat * 0.9, 48);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.2, 92);

			for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) paint(s, x, y, br, bg, bb, 0.6);

			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.05;
			const cy = s.h * 0.5;
			const rad = Math.min(s.w, s.h) * 0.44;
			const spin = s.t * 0.05 * s.v.speed * id.rpm * s.v.dir;
			const lit = Math.cos(spin);

			for (let y = cy - rad; y <= cy + rad; y++) {
				for (let x = cx - rad * 1.6; x <= cx + rad * 1.6; x++) {
					const dx = (x - cx) / 1.6;
					const dy = y - cy;
					const d = Math.hypot(dx, dy);
					if (d > rad) continue;
					const f = d / rad;
					if (f < id.label) {
						const ll = 0.7 + Math.cos(Math.atan2(dy, dx) - spin) * 0.3;
						paint(s, x, y, lr * ll, lg * ll, lb * ll, 0.98);
						continue;
					}
					const groove = Math.sin(f * id.grooves * 6.28) * 0.5 + 0.5;
					const sheen = Math.max(0, Math.cos(Math.atan2(dy, dx) * 2 - spin)) ** 3;
					const sh = 0.55 + groove * 0.3 + sheen * 0.9;
					paint(s, x, y, dr * sh + sr * sheen * 0.35, dg * sh + sg * sheen * 0.35, db * sh + sb * sheen * 0.35, 0.98);
				}
			}
			for (let k = -1; k <= 1; k++) for (let q = -1; q <= 1; q++) paint(s, cx + k, cy + q, br * 0.5, bg * 0.5, bb * 0.5, 1);

			const track = id.label + 0.12 + id.arm * (0.5 + 0.5 * Math.sin(s.t * 0.004 * s.v.speed));
			const ax = cx + rad * 1.35;
			const ay = cy - rad * 0.9;
			const tx = cx + Math.cos(-0.5) * rad * track * 1.6;
			const ty = cy + Math.sin(-0.5) * rad * track;
			const len = Math.hypot(tx - ax, ty - ay);
			for (let d = 0; d <= len; d += 0.6) {
				const f = d / len;
				paint(s, ax + (tx - ax) * f, ay + (ty - ay) * f, sr * 0.7, sg * 0.7, sb * 0.7, 0.95);
			}
			for (let k = -1; k <= 1; k++) paint(s, tx + k, ty, sr, sg, sb, 0.95);

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 3] += 0.02 * p[o + 2];
				p[o] += Math.sin(p[o + 3]) * 0.1 * s.v.drift;
				p[o + 1] += 0.04 * p[o + 2];
				if (p[o + 1] > s.h + 1) {
					p[o + 1] = -1;
					p[o] = s.rnd() * s.w;
				}
				const a = 0.24 * (0.4 + 0.6 * Math.max(0, Math.sin(p[o + 3] * 1.6))) * edge(p[o + 1], -1, s.h + 1, s.h * 0.2);
				plot(s, p[o], p[o + 1], sr, sg, sb, a);
			}

			s.out = Math.min(1, Math.max(0, Math.abs(lit) - 0.42) * 1.72);
			blit(s);
		}
	};
}

export function makeFishtank(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.28,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 19163);
			const weeds: number[][] = [];
			for (let i = 0; i < 7; i++) weeds.push([r(), 0.14 + r() * 0.24, r() * 6.28]);
			(s as any).id = { weeds, stone: 0.2 + r() * 0.6, school: 0.4 + r() * 0.5 };
			(s as any).bub = [] as number[][];
			(s as any).next = 10;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.h * (0.15 + s.rnd() * 0.6);
				s.parts[o + 2] = (s.rnd() < 0.5 ? -1 : 1) * (0.3 + s.rnd() * 0.4);
				s.parts[o + 3] = (s.rnd() - 0.5) * 0.2;
				s.parts[o + 4] = 0.6 + s.rnd() * 0.8;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { weeds: number[][]; stone: number; school: number };
			const bub = (s as any).bub as number[][];
			const p = s.parts;
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.6, 18);
			const [gr2, gg2, gb2] = hsl(140, 46, 30);
			const [fr2, fg2, fb2] = hsl(s.v.hue, s.v.sat, 56);
			const [lr, lg, lb] = hsl(s.v.hue2, s.v.sat * 0.3, 88);

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const caustic = Math.sin(x * 0.12 + s.t * 0.02) * Math.cos(y * 0.09 - s.t * 0.015);
					const lit = 0.8 + caustic * 0.2 * (1 - f);
					paint(s, x, y, wr * lit, wg * lit, wb * (1 + f * 0.3), 0.3 + f * f * 0.6);
				}
			}

			const sand = s.h * 0.9;
			for (let x = 0; x < s.w; x++) {
				const h = 2 + Math.sin(x * 0.2 + id.stone * 9) * 1.4;
				for (let y = sand - h; y < s.h; y++) {
					const g = chip(x % 16, (y | 0) % 16, (x * 13) | 0) / 100;
					paint(s, x, y, 120 + g * 50, 108 + g * 46, 92 + g * 40, 0.95);
				}
			}
			for (const wd of id.weeds) {
				const bx = wd[0] * s.w;
				const bh = wd[1] * s.h;
				for (let k = 0; k < bh; k++) {
					const f = k / bh;
					const bend = Math.sin(s.t * 0.025 * s.v.speed + wd[2] + f * 2) * s.w * 0.02 * s.v.drift;
					const w = 1.2 * (1 - f * 0.6);
					for (let q = -w; q <= w; q++) paint(s, bx + bend * f * f + q, sand - k, gr2 * (0.7 + f * 0.5), gg2 * (0.7 + f * 0.5), gb2, 0.95);
				}
			}

			const stoneX = id.stone * s.w;
			if (--(s as any).next <= 0) {
				(s as any).next = 4 + ((s.rnd() * 10) | 0);
				bub.push([stoneX + (s.rnd() - 0.5) * 3, sand - 2, 0.3 + s.rnd() * 0.5, s.rnd() * 6.28]);
				if (bub.length > 26) bub.shift();
			}
			for (let k = bub.length - 1; k >= 0; k--) {
				const b = bub[k];
				b[3] += 0.1;
				b[1] -= (0.22 + b[2] * 0.3) * s.v.speed;
				b[0] += Math.sin(b[3]) * 0.16 * s.v.drift;
				if (b[1] < 1) {
					bub.splice(k, 1);
					continue;
				}
				const rr = 0.7 + b[2] * 1.4;
				const fade = edge(b[1], 0, s.h, s.h * 0.12);
				for (let dy = -rr; dy <= rr; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx, dy) / rr;
						if (d > 1) continue;
						plot(s, b[0] + dx, b[1] + dy, lr, lg, lb, (d > 0.6 ? 0.5 : 0.16) * fade);
					}
			}

			let shoal = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				let ax = 0;
				let ay = 0;
				let seen = 0;
				for (let j = 0; j < s.n; j += 2) {
					if (j === i) continue;
					const q = j * P;
					const dx = p[q] - p[o];
					const dy = p[q + 1] - p[o + 1];
					const d2 = dx * dx + dy * dy;
					if (d2 > 260 || d2 < 0.01) continue;
					seen++;
					ax += dx * id.school * 0.0016 + (d2 < 26 ? -dx * 0.02 : 0);
					ay += dy * id.school * 0.0016 + (d2 < 26 ? -dy * 0.02 : 0);
				}
				shoal += seen;
				p[o + 5] += 0.05;
				p[o + 2] += ax + Math.cos(p[o + 5]) * 0.006 * s.v.drift;
				p[o + 3] += ay + Math.sin(p[o + 5]) * 0.01;
				if (p[o] < 3) p[o + 2] += 0.06;
				if (p[o] > s.w - 3) p[o + 2] -= 0.06;
				if (p[o + 1] < 4) p[o + 3] += 0.05;
				if (p[o + 1] > sand - 4) p[o + 3] -= 0.06;
				const sp = Math.hypot(p[o + 2], p[o + 3]) || 1;
				const cap = 0.62 * s.v.speed * p[o + 4];
				if (sp > cap) {
					p[o + 2] = (p[o + 2] / sp) * cap;
					p[o + 3] = (p[o + 3] / sp) * cap;
				}
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];

				const face = p[o + 2] >= 0 ? 1 : -1;
				const bl = 2.4 * p[o + 4];
				const bh2 = 1.3 * p[o + 4];
				const key = (i * 37) | 0;
				for (let dy = -bh2; dy <= bh2; dy++) {
					for (let dx = -bl; dx <= bl; dx++) {
						const d = (dx * dx) / (bl * bl) + (dy * dy) / (bh2 * bh2);
						if (d > 1) continue;
						if (d > 0.7 && chip(dx | 0, dy | 0, key) < 26) continue;
						const shade = 0.72 + Math.max(0, -dy / bh2) * 0.44;
						paint(s, p[o] + dx, p[o + 1] + dy, fr2 * shade, fg2 * shade, fb2 * shade, 0.97);
					}
				}
				const tw = Math.sin(s.t * 0.3 + i) * 0.8;
				for (let k = 0; k < 2.4; k++) {
					const w = k * 0.7;
					for (let q = -w; q <= w; q++) paint(s, p[o] - face * (bl + k), p[o + 1] + q + tw * (k / 3), fr2 * 0.8, fg2 * 0.8, fb2 * 0.8, 0.9);
				}
				plot(s, p[o] + face * bl * 0.55, p[o + 1] - bh2 * 0.2, 255, 255, 255, 0.6);
			}

			s.out = Math.min(1, Math.max(0, (shoal / s.n - 2.2) / 12));
			blit(s);
		}
	};
}

export function makePopcorn(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.4,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 20173);
			(s as any).id = { pan: 0.2 + r() * 0.1, heat: 0.6 + r() * 0.7, tint: r(), period: 150 + ((r() * 110) | 0) };
			(s as any).pile = new Float32Array(s.w);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.w * 0.5 + (s.rnd() - 0.5) * s.w * 0.4;
				s.parts[o + 1] = s.h * 0.86;
				s.parts[o + 2] = 0;
				s.parts[o + 3] = 0;
				s.parts[o + 4] = s.rnd() * 0.5;
				s.parts[o + 5] = (s.rnd() * 4096) | 0;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { pan: number; heat: number; tint: number; period: number };
			const pile = (s as any).pile as Float32Array;
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const surge = 0.35 + Math.pow(Math.max(0, Math.sin(cyc * 6.28)), 2.2) * 2.6;
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.3, 8);
			const [pr2, pg2, pb2] = hsl(s.v.hue2, s.v.sat * 0.2, 26);
			const [kr, kg, kb] = hsl(38, 70, 34);
			const [cr2, cg2, cb2] = hsl(s.v.hue, s.v.sat * 0.35, 88);

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) paint(s, x, y, br, bg, bb, 0.24 + f * f * 0.5);
			}

			const panY = s.h * 0.88;
			const panW = s.w * (0.3 + id.pan);
			const cx = s.w * 0.5;
			for (let x = cx - panW; x <= cx + panW; x++) {
				const u = Math.abs(x - cx) / panW;
				const d = 3 + (1 - u * u) * 2;
				for (let k = 0; k < d; k++) paint(s, x, panY + k, pr2 * (0.7 + k * 0.1), pg2 * (0.7 + k * 0.1), pb2, 0.97);
			}
			const heatGlow = Math.min(1, (0.5 + 0.5 * Math.sin(s.t * 0.06 * s.v.speed)) * 0.5 + surge * 0.35);
			for (let x = cx - panW; x <= cx + panW; x++) {
				const u = Math.abs(x - cx) / panW;
				for (let k = 0; k < 5; k++) plot(s, x, panY + 3 + k, 255, 120, 40, heatGlow * (1 - u * 0.7) * (1 - k / 5) * 0.55);
			}
			for (let k = 0; k < 18; k++) {
				const ph = k * 1.7;
				const life = (((s.t * 0.012 * s.v.speed + k * 0.11) % 1) + 1) % 1;
				const sx = cx + Math.sin(ph + life * 3.4) * panW * 0.8 * (0.3 + life);
				const sy = panY - 4 - life * s.h * 0.72;
				const a = life * (1 - life) * 4 * surge * 0.2;
				for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) plot(s, sx + dx, sy + dy, 240, 225, 205, a * (dx || dy ? 0.4 : 1));
			}

			let popped = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				if (p[o + 4] < 1) {
					p[o + 4] += 0.0022 * id.heat * s.v.speed * surge * (0.6 + s.rnd() * 0.8);
					const rr = 1.1;
					const hot = p[o + 4];
					const shake = hot * hot * 2.4 * surge;
					const jx = Math.sin(s.t * 0.55 * s.v.speed + p[o + 5]) * shake;
					const jy = Math.cos(s.t * 0.71 * s.v.speed + p[o + 5] * 1.7) * shake * 0.7;
					for (let dy = -rr; dy <= rr; dy++)
						for (let dx = -rr; dx <= rr; dx++) {
							if (dx * dx + dy * dy > rr * rr) continue;
							paint(s, p[o] + dx + jx, panY - 1 + dy + jy, kr * (1 + hot * 0.5), kg * (1 - hot * 0.2), kb * (1 - hot * 0.4), 0.95);
						}
					if (p[o + 4] >= 1) {
						p[o + 2] = (s.rnd() - 0.5) * 1.6;
						p[o + 3] = -1.3 - s.rnd() * 1.2;
						p[o + 1] = panY - 2;
					}
					continue;
				}
				popped++;
				p[o + 3] += 0.075 * s.v.speed;
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				const col = Math.max(0, Math.min(s.w - 1, p[o] | 0));
				const rest = s.h - 1 - pile[col];
				if (p[o + 1] >= rest && p[o + 3] > 0) {
					for (let k = -2; k <= 2; k++) {
						const c = col + k;
						if (c < 0 || c >= s.w) continue;
						pile[c] = Math.min(s.h * 0.4, pile[c] + (k === 0 ? 0.9 : 0.5 - Math.abs(k) * 0.12));
					}
					p[o + 4] = 0;
					p[o] = cx + (s.rnd() - 0.5) * panW * 1.4;
					p[o + 1] = panY - 1;
					continue;
				}
				const rr = 2 + (p[o + 5] % 7) * 0.12;
				const key = p[o + 5];
				const fade = edge(p[o + 1], -4, s.h + 2, s.h * 0.1);
				for (let dy = -rr; dy <= rr; dy++) {
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx, dy) / rr;
						if (d > 1) continue;
						if (d > 0.45 && chip(dx | 0, dy | 0, key) < 42) continue;
						const lit = 0.78 + Math.max(0, -dy / rr) * 0.4;
						paint(s, p[o] + dx, p[o + 1] + dy, cr2 * lit, cg2 * lit, cb2 * lit, 0.97 * fade);
					}
				}
			}

			let heap = 0;
			for (let x = 0; x < s.w; x++) {
				const h = pile[x];
				heap += h;
				for (let k = 0; k < h; k++) {
					const y = s.h - 1 - k;
					const g = chip(x % 16, k % 16, (x * 29 + k) | 0) / 100;
					if (g < 0.2) continue;
					paint(s, x, y, cr2 * (0.7 + g * 0.4), cg2 * (0.7 + g * 0.4), cb2 * (0.7 + g * 0.35), 0.96);
				}
				pile[x] *= 0.9994;
			}

			s.out = Math.min(1, (popped / s.n / 0.3) * 0.7 + (heap / (s.w * s.h * 0.1)) * 0.3);
			blit(s);
		}
	};
}

export function makeClock(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 21179);
			const gears: number[][] = [];
			const n = 3 + ((r() * 2) | 0);
			for (let i = 0; i < n; i++) gears.push([0.2 + r() * 0.6, 0.24 + r() * 0.5, 0.1 + r() * 0.1, 8 + ((r() * 8) | 0), r() * 6.28]);
			(s as any).id = { gears, brass: r(), pend: 0.6 + r() * 0.5, hour: 200 + ((r() * 160) | 0) };
			(s as any).ring = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { gears: number[][]; brass: number; pend: number; hour: number };
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.3, 8);
			const [gr2, gg2, gb2] = hsl(42, 58 + id.brass * 20, 44);
			const [hr2, hg2, hb2] = hsl(s.v.hue, s.v.sat * 0.5, 82);

			const hcyc = ((s.t * s.v.speed) % id.hour) / id.hour;
			if (hcyc < 0.012) (s as any).ring = 1;
			const ring = (s as any).ring as number;
			if (ring > 0) (s as any).ring = Math.max(0, ring - 0.028);
			const chime = ring > 0 ? ring * Math.abs(Math.sin(s.t * 0.9 * s.v.speed)) : 0;

			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) paint(s, x, y, br + chime * 70, bg + chime * 52, bb + chime * 18, 0.26 + f * f * 0.48);
			}

			let mesh = 0;
			for (let gi = 0; gi < id.gears.length; gi++) {
				const g = id.gears[gi];
				const cx = g[0] * s.w;
				const cy = g[1] * s.h;
				const rad = g[2] * Math.min(s.w, s.h) * 1.5;
				const teeth = g[3];
				const dirg = gi % 2 === 0 ? 1 : -1;
				const rot = (s.t * 0.04 * s.v.speed * (1 + ring * 4) * s.v.dir * dirg * 12) / teeth + g[4];
				mesh += Math.abs(Math.sin(rot * teeth * 0.5));
				for (let y = -rad - 2; y <= rad + 2; y++) {
					for (let x = -rad - 2; x <= rad + 2; x++) {
						const d = Math.hypot(x, y);
						const th = Math.atan2(y, x);
						const tooth = Math.cos((th - rot) * teeth) > 0.2 ? rad + 1.8 : rad;
						if (d > tooth) continue;
						if (d < rad * 0.24) continue;
						const spokes = Math.abs(Math.cos((th - rot) * 3)) > 0.86 || d < rad * 0.4 || d > rad * 0.76;
						if (!spokes) continue;
						const lit = 0.6 + Math.cos(th - rot * 2) * 0.32 + (d > rad * 0.9 ? 0.2 : 0);
						paint(s, cx + x, cy + y, gr2 * lit, gg2 * lit, gb2 * lit, 0.97);
					}
				}
				for (let k = -1; k <= 1; k++) for (let q = -1; q <= 1; q++) paint(s, cx + k, cy + q, gr2 * 0.4, gg2 * 0.4, gb2 * 0.4, 1);
			}

			const fx2 = s.w * 0.5;
			const fy = s.h * 0.42;
			const frad = Math.min(s.w, s.h) * 0.22;
			for (let a = 0; a < 12; a++) {
				const th = (a / 12) * 6.28;
				for (let k = 0; k < 2; k++) plot(s, fx2 + Math.cos(th) * (frad - k), fy + Math.sin(th) * (frad - k), hr2, hg2, hb2, 0.7);
			}
			const mins = s.t * 0.01 * s.v.speed;
			const ticks = Math.floor(s.t * 0.09 * s.v.speed);
			const tickAge = s.t * 0.09 * s.v.speed - ticks;
			const secs = (ticks / 30) * 6.28 + Math.max(0, 0.22 - tickAge) * 1.6;
			for (const [hand, len, wide] of [
				[mins / 12, 0.55, 1],
				[mins, 0.82, 0.6],
				[secs, 0.92, 0]
			] as number[][]) {
				const th = hand - Math.PI / 2;
				for (let d = 0; d < frad * len; d += 0.6) {
					for (let q = -wide; q <= wide; q += 1) plot(s, fx2 + Math.cos(th) * d + q * 0.4, fy + Math.sin(th) * d, hr2, hg2, hb2, 0.85);
				}
			}
			if (chime > 0) {
				const rr = (1 - ring) * Math.min(s.w, s.h) * 1.1;
				for (let a = 0; a < 6.28; a += 0.05) plot(s, fx2 + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.8, 255, 226, 170, chime * 0.6);
			}

			const swing = Math.sin(s.t * 0.09 * s.v.speed * id.pend) * 0.5;
			const px2 = fx2 + Math.sin(swing) * s.w * 0.14;
			const py = fy + frad + Math.cos(swing) * s.h * 0.28;
			for (let d = 0; d < Math.hypot(px2 - fx2, py - fy - frad); d += 0.8) {
				const f = d / Math.max(1, Math.hypot(px2 - fx2, py - fy - frad));
				paint(s, fx2 + (px2 - fx2) * f, fy + frad + (py - fy - frad) * f, gr2 * 0.7, gg2 * 0.7, gb2 * 0.7, 0.9);
			}
			for (let dy = -2.4; dy <= 2.4; dy++)
				for (let dx = -2.4; dx <= 2.4; dx++) {
					const d = Math.hypot(dx, dy) / 2.4;
					if (d > 1) continue;
					const lit = 0.7 + (1 - d) * 0.5;
					paint(s, px2 + dx, py + dy, gr2 * lit, gg2 * lit, gb2 * lit, 0.97);
				}

			s.out = Math.min(1, 0.22 + Math.abs(Math.sin(swing)) * 0.42 + ring * 0.7);
			blit(s);
		}
	};
}

export function makeRainglass(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 22189);
			(s as any).id = { fogT: 0.3 + r() * 0.4, tilt: (r() - 0.5) * 0.3, rate: 0.4 + r() * 0.8, storm: 210 + ((r() * 170) | 0), boltX: 0.2 + r() * 0.6 };
			(s as any).drops = [] as number[][];
			(s as any).clear = new Float32Array(s.w * s.h);
			(s as any).next = 6;
			(s as any).flash = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { fogT: number; tilt: number; rate: number; storm: number; boltX: number };
			const drops = (s as any).drops as number[][];
			const cl = (s as any).clear as Float32Array;
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.5, 16);
			const [fr2, fg2, fb2] = hsl(s.v.hue, s.v.sat * 0.2, 62);
			const [lr, lg, lb] = hsl(s.v.hue, s.v.sat * 0.35, 92);

			const scyc = ((s.t * s.v.speed) % id.storm) / id.storm;
			if (scyc < 0.012) (s as any).flash = 1;
			const flash = (s as any).flash as number;
			if (flash > 0) (s as any).flash = Math.max(0, flash - 0.13);
			const strobe = flash > 0 ? flash * (0.55 + Math.abs(Math.sin(s.t * 1.9)) * 0.45) : 0;

			const lampX = s.w * (0.28 + Math.sin(s.t * 0.042 * s.v.speed) * 0.16);
			const lampP = 0.78 + Math.sin(s.t * 0.19 * s.v.speed) * 0.3 + Math.sin(s.t * 0.53) * 0.18;
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const glowA = Math.exp(-Math.hypot((x - lampX) / (s.w * 0.3), (y - s.h * 0.3) / (s.h * 0.4))) * lampP;
					paint(s, x, y, br + glowA * 70 + strobe * 120, bg + glowA * 60 + strobe * 128, bb + glowA * 40 + strobe * 150, 0.4 + f * 0.4);
				}
			}
			for (let k = 0; k < 40; k++) {
				const col = ((k * 97) % 1000) / 1000;
				const sp = 0.6 + ((k * 37) % 100) / 100;
				const far = 0.35 + ((k * 53) % 100) / 200;
				const ry = (((s.t * sp * 0.055 * s.v.speed + col * 3.1) % 1) + 1) % 1;
				const rx = col * s.w + id.tilt * ry * s.w * 0.12 * s.v.dir;
				const len = 3 + far * 6;
				for (let d = 0; d < len; d++) plot(s, rx, ry * (s.h + len) - d, lr, lg, lb, far * (1 - d / len) * 0.3 * (0.6 + strobe * 2));
			}
			if (flash > 0.25) {
				let bx = id.boltX * s.w;
				for (let y = 0; y < s.h * 0.72; y += 1.4) {
					bx += (s.rnd() - 0.5) * 3.4 + id.tilt * 1.6;
					for (let q = -1; q <= 1; q++) plot(s, bx + q, y, 220, 232, 255, flash * (q === 0 ? 0.95 : 0.4));
				}
			}
			for (let i = 0; i < cl.length; i++) cl[i] *= 0.9985;
			const fogPhase = s.t * 0.03 * s.v.speed;
			const breathe = 0.82 + Math.sin(s.t * 0.026 * s.v.speed) * 0.18;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const mist = 1 - cl[y * s.w + x];
					if (mist <= 0.02) continue;
					const roll = 0.72 + Math.sin(x * 0.13 + fogPhase) * 0.14 + Math.sin(y * 0.19 - fogPhase * 0.7) * 0.14;
					paint(s, x, y, fr2, fg2, fb2, mist * id.fogT * 0.72 * roll * breathe);
				}
			}

			const squall = 0.5 + Math.pow(Math.max(0, Math.sin(scyc * 6.28 - 0.4)), 1.8) * 2.4 + flash * 1.6;
			if (--(s as any).next <= 0) {
				(s as any).next = Math.max(1, (8 / (id.rate * squall)) | 0) + ((s.rnd() * 8) | 0);
				drops.push([s.rnd() * s.w, -2, 0, 0.7 + s.rnd() * 1.1]);
				if (drops.length > 46) drops.shift();
			}

			for (let k = drops.length - 1; k >= 0; k--) {
				const d = drops[k];
				const grip = 0.055 * d[3] * s.v.speed;
				d[2] = d[2] * 0.94 + grip;
				if (d[3] > 1.3 || s.rnd() < 0.3) d[1] += d[2];
				d[0] += id.tilt * d[2] * 0.5 * s.v.dir;
				if (d[1] > s.h + 3) {
					drops.splice(k, 1);
					continue;
				}
				for (let j = k - 1; j >= 0; j--) {
					const e = drops[j];
					if (Math.abs(e[0] - d[0]) > 2.2 || Math.abs(e[1] - d[1]) > 2.6) continue;
					d[3] = Math.min(2.6, Math.hypot(d[3], e[3]));
					d[0] = (d[0] + e[0]) * 0.5;
					d[1] = Math.max(d[1], e[1]);
					drops.splice(j, 1);
					k--;
				}
				const rr = 0.7 + d[3] * 0.9;
				const cx = Math.max(0, Math.min(s.w - 1, d[0] | 0));
				const cy = Math.max(0, Math.min(s.h - 1, d[1] | 0));
				for (let dy = -rr - 1; dy <= rr + 1; dy++)
					for (let dx = -rr - 1; dx <= rr + 1; dx++) {
						const px2 = cx + dx;
						const py = cy + dy;
						if (px2 < 0 || py < 0 || px2 >= s.w || py >= s.h) continue;
						if (Math.hypot(dx, dy) <= rr + 1) cl[py * s.w + px2] = 1;
					}
				for (let dy = -rr; dy <= rr; dy++) {
					for (let dx = -rr; dx <= rr; dx++) {
						const dd = Math.hypot(dx, dy) / rr;
						if (dd > 1) continue;
						const lit = dd > 0.62 ? 0.5 : 0.2 + (1 - dd) * 0.5;
						plot(s, d[0] + dx, d[1] + dy, lr * lit, lg * lit, lb * lit, 0.5);
					}
				}
				plot(s, d[0] - rr * 0.4, d[1] - rr * 0.4, 255, 255, 255, 0.55);
			}

			s.out = Math.min(1, drops.length / 30 + flash * 0.7);
			blit(s);
		}
	};
}

export function makeDice(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + s.v.salt + 23197);
			const dice: number[][] = [];
			const n = 2 + ((r() * 2) | 0);
			for (let i = 0; i < n; i++) dice.push([0.2 + r() * 0.6, -0.4 - r() * 0.8, 0, 0, r() * 6.28, 1 + ((r() * 6) | 0)]);
			(s as any).id = { dice, felt: r(), throwEvery: 150 + ((r() * 120) | 0) };
			(s as any).settled = 0;
			(s as any).dust = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as { dice: number[][]; felt: number; throwEvery: number };
			const dust = (s as any).dust as number[][];
			const [br, bg, bb] = hsl(s.v.hue2, s.v.sat * 0.55, 14 + id.felt * 6);
			const [dr, dg, db] = hsl(s.v.hue, s.v.sat * 0.1, 92);
			const [pr2, pg2, pb2] = hsl(s.v.hue, s.v.sat, 46);

			const spotX = s.w * (0.5 + Math.sin(s.t * 0.045 * s.v.speed * s.v.dir) * 0.42);
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const nap = chip(x % 16, y % 16, (x * 7 + y * 13) | 0) / 100;
					const spot = Math.pow(Math.max(0, 1 - Math.abs(x - spotX) / (s.w * 0.42)), 0.4) * (0.35 + f * 0.65);
					const lift = 0.86 + nap * 0.28;
					paint(s, x, y, br * lift + spot * 52, bg * lift + spot * 60, bb * lift + spot * 44, 0.42 + f * f * 0.5);
				}
			}

			const floorY = s.h * 0.82;
			const cyc = (s.t * s.v.speed) % id.throwEvery;
			if (cyc < 1.2) {
				for (const d of id.dice) {
					d[1] = -0.4 - s.rnd() * 0.7;
					d[2] = (s.rnd() - 0.5) * 1.4;
					d[3] = 0;
					d[4] = s.rnd() * 6.28;
					d[5] = 1 + ((s.rnd() * 6) | 0);
				}
			}

			let still = 0;
			for (const d of id.dice) {
				const y = d[1] * s.h;
				d[3] += 0.075 * s.v.speed;
				let ny = y + d[3];
				let nx = d[0] * s.w + d[2];
				if (ny >= floorY) {
					if (d[3] > 0.55) {
						d[3] = -d[3] * 0.42;
						d[2] *= 0.6;
						d[4] += 1.1;
						d[5] = 1 + ((s.rnd() * 6) | 0);
						ny = floorY;
						for (let k = 0; k < 9; k++) dust.push([nx, floorY, (s.rnd() - 0.5) * 1.8, -s.rnd() * 0.9, 0]);
					} else {
						d[3] = 0;
						d[2] *= 0.7;
						ny = floorY;
						if (Math.abs(d[2]) < 0.05) {
							still++;
							d[4] += Math.sin(s.t * 0.09 * s.v.speed + d[0] * 9) * 0.014;
							ny = floorY - Math.abs(Math.sin(s.t * 0.06 * s.v.speed + d[0] * 5)) * 0.9;
						}
					}
				}
				if (nx < 5) {
					nx = 5;
					d[2] = Math.abs(d[2]) * 0.6;
				}
				if (nx > s.w - 5) {
					nx = s.w - 5;
					d[2] = -Math.abs(d[2]) * 0.6;
				}
				d[0] = nx / s.w;
				d[1] = ny / s.h;
				d[4] += d[2] * 0.14;

				const half = Math.min(s.w, s.h) * 0.075;
				const tilt = Math.sin(d[4]) * 0.3;
				for (let dy = -half; dy <= half; dy++) {
					for (let dx = -half; dx <= half; dx++) {
						const rx = dx * Math.cos(tilt) - dy * Math.sin(tilt);
						const ry = dx * Math.sin(tilt) + dy * Math.cos(tilt);
						if (Math.abs(rx) > half || Math.abs(ry) > half) continue;
						const corner = Math.max(Math.abs(rx), Math.abs(ry)) > half * 0.9 && Math.hypot(Math.abs(rx) - half * 0.9, Math.abs(ry) - half * 0.9) > half * 0.14;
						if (corner && Math.abs(rx) > half * 0.9 && Math.abs(ry) > half * 0.9) continue;
						const lit = 0.76 + Math.max(0, -ry / half) * 0.34;
						paint(s, nx + dx, ny - half + dy, dr * lit, dg * lit, db * lit, 0.98);
					}
				}
				const pips: number[][] = [];
				const q = half * 0.46;
				const face = d[5];
				if (face % 2 === 1) pips.push([0, 0]);
				if (face >= 2) pips.push([-q, -q], [q, q]);
				if (face >= 4) pips.push([-q, q], [q, -q]);
				if (face === 6) pips.push([-q, 0], [q, 0]);
				for (const [ox, oy] of pips) {
					const rx = ox * Math.cos(tilt) - oy * Math.sin(tilt);
					const ry = ox * Math.sin(tilt) + oy * Math.cos(tilt);
					for (let py2 = -1; py2 <= 1; py2++)
						for (let px3 = -1; px3 <= 1; px3++) {
							if (px3 * px3 + py2 * py2 > 1.6) continue;
							paint(s, nx + rx + px3, ny - half + ry + py2, pr2, pg2, pb2, 0.98);
						}
				}
				for (let x = nx - half; x <= nx + half; x++) plot(s, x, floorY + 1, 0, 0, 0, 0.18);
			}

			if (dust.length > 90) dust.splice(0, dust.length - 90);
			for (let k = dust.length - 1; k >= 0; k--) {
				const q = dust[k];
				q[4] += 1;
				if (q[4] > 22) {
					dust.splice(k, 1);
					continue;
				}
				q[0] += q[2];
				q[1] += q[3];
				q[3] += 0.04;
				q[2] *= 0.94;
				const a = 1 - q[4] / 22;
				plot(s, q[0], q[1], br * 2.4, bg * 2.4, bb * 2.2, a * a * 0.5);
			}

			s.out = Math.min(1, still / Math.max(1, id.dice.length));
			blit(s);
		}
	};
}
