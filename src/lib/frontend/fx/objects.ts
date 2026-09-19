import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

function hash2m(x: number, y: number, g: number) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (g | 0) * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function chip(dx: number, dy: number, key: number) {
	return ((((dx + 16) * 73 + (dy + 16) * 151 + key) * 2654435761) >>> 0) % 100;
}

type Vault = {
	panels: number[];
	rivets: number[][];
	stacks: number[][];
	chuteX: number;
	lampX: number;
	dial: number;
	period: number;
	burst: number;
	wind: number;
	grain: number;
};

function vaultIdent(s: FxScene): Vault {
	const r = mulberry32(s.v.seed + 13109);
	const panels: number[] = [];
	for (let i = 0; i < 5; i++) panels.push(r());
	const rivets: number[][] = [];
	for (let i = 0; i < 16; i++) rivets.push([r(), r()]);
	const stacks: number[][] = [];
	for (let i = 0; i < 5; i++) stacks.push([0.06 + r() * 0.86, 0.5 + r() * 0.5, (r() * 4) | 0]);
	const chuteX = 0.24 + r() * 0.5;
	const lampX = 0.2 + r() * 0.6;
	const dial = r();
	const period = 240 + ((r() * 180) | 0);
	const burst = 16 + ((r() * 18) | 0);
	const wind = (r() - 0.5) * 1.6;
	const grain = (r() * 9999) | 0;
	return { panels, rivets, stacks, chuteX, lampX, dial, period, burst, wind, grain };
}

function drawBill(s: FxScene, x: number, y: number, flip: number, sz: number, tone: number, key: number) {
	const hw = sz * 2 * Math.max(0.12, Math.abs(Math.cos(flip)));
	const hh = sz;
	const edgeOn = Math.abs(Math.cos(flip)) < 0.34;
	const back = Math.cos(flip) < 0;
	const [pr, pg, pb] = hsl(96 + tone * 34, 26 + s.v.sat * 0.18, back ? 34 : 46);
	for (let dy = -hh; dy <= hh; dy++)
		for (let dx = -hw; dx <= hw; dx++) {
			const ux = Math.abs(dx) / (hw + 0.4);
			const uy = Math.abs(dy) / (hh + 0.4);
			if (ux > 1 || uy > 1) continue;
			const fibre = chip(dx | 0, dy | 0, key) / 100;
			let k = 0.82 + fibre * 0.3 + (1 - uy) * 0.16;
			if (ux > 0.82 || uy > 0.7) k *= 0.86;
			paint(s, x + dx, y + dy, pr * k, pg * k, pb * k, 1);
			if (!edgeOn && !back && ux < 0.34 && uy < 0.66) {
				const oval = Math.hypot(dx / (hw * 0.34), dy / (hh * 0.7));
				if (oval < 1) paint(s, x + dx, y + dy, 226, 230, 214, (1 - oval) * 0.5);
			}
			if (!edgeOn && ux > 0.7 && ux < 0.9 && uy < 0.82) plot(s, x + dx, y + dy, 200, 226, 190, 0.22);
		}
	if (!edgeOn) {
		for (let dx = -hw; dx <= hw; dx++) {
			paint(s, x + dx, y - hh, 236, 240, 222, 0.35);
			paint(s, x + dx, y + hh, 12, 22, 12, 0.35);
		}
	}
}

export function makeMoney(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const id = vaultIdent(s);
			(s as any).id = id;
			(s as any).bills = [] as number[][];
			(s as any).pile = new Float32Array(s.w);
			(s as any).coins = [] as number[][];
			(s as any).motes = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Vault;
			const bills = (s as any).bills as number[][];
			const coins = (s as any).coins as number[][];
			const pile = (s as any).pile as Float32Array;
			const fy = Math.round(s.h * 0.82);
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const open = cyc > 0.3 && cyc < 0.78 ? Math.min(1, (cyc - 0.3) / 0.08) * Math.min(1, (0.78 - cyc) / 0.08) : 0;
			const charge = cyc < 0.3 ? cyc / 0.3 : 0;
			const wind = id.wind * s.v.drift * s.v.dir;

			const lx = id.lampX * s.w;
			const glow = 0.4 + charge * 0.4 + open * 0.6;
			const lampY = s.h * 0.1;
			for (let dx = -5; dx <= 5; dx++) {
				const e = 1 - Math.abs(dx) / 5.6;
				for (let k = 0; k < 3; k++) paint(s, lx + dx, lampY + k, 32 + e * 30, 30 + e * 26, 28 + e * 22, e > 0.1 ? 1 : 0);
			}
			for (let dx = -4; dx <= 4; dx++) plot(s, lx + dx, lampY + 3, 255, 218 - charge * 30, 140, (1 - Math.abs(dx) / 5) * (0.4 + glow * 0.6));
			for (let k = 0; k < 4; k++) paint(s, lx, lampY - k, 40, 38, 34, 1);
			for (let y = 0; y < fy; y++) {
				const f = y / fy;
				const half = s.w * (0.06 + f * 0.24);
				for (let x = lx - half; x <= lx + half; x++) {
					const e = 1 - Math.abs(x - lx) / (half + 0.5);
					plot(s, x, y, 255, 214, 132, e * e * (1 - f * 0.6) * 0.3 * glow);
				}
			}

			const cw = s.w * 0.11;
			const cx = id.chuteX * s.w;
			const cyT = 0;
			const cyB = s.h * 0.24;
			for (let y = cyT; y <= cyB; y++) {
				const f = (y - cyT) / (cyB - cyT);
				const half = cw * (1.7 - f * 0.72);
				for (let x = cx - half; x <= cx + half; x++) {
					const rim = 1 - Math.abs(x - cx) / (half + 0.5);
					const k = 0.44 + rim * 0.46 + f * 0.24 + hash2m(x | 0, y | 0, id.grain + 7) * 0.22;
					paint(s, x, y, 118 * k, 122 * k, 130 * k, 1);
					if (rim > 0.94) plot(s, x, y, 210, 216, 226, 0.4);
				}
				if (f > 0.86) for (let x = cx - half * 0.72; x <= cx + half * 0.72; x++) paint(s, x, y, 8, 9, 11, 1);
			}
			const mouth = cw * 0.98;
			const lip = 1 - open;
			for (let x = cx - mouth; x <= cx + mouth; x++) {
				const e = 1 - Math.abs(x - cx) / (mouth + 0.5);
				const shut = Math.max(0, lip * mouth - Math.abs(x - cx));
				for (let k = 0; k < 3; k++) paint(s, x, cyB - 1 + k, 8, 9, 11, e > 0 ? 1 : 0);
				if (shut > 0)
					for (let k = 0; k < 3; k++) {
						const lit = k === 0 ? 1.4 : k === 2 ? 0.6 : 1;
						paint(s, x, cyB - 1 + k, 112 * lit, 116 * lit, 124 * lit, 1);
					}
				if (open > 0.02) {
					plot(s, x, cyB + 1, 255, 226, 150, e * open * 0.55);
					plot(s, x, cyB + 2, 255, 206, 120, e * open * 0.3);
				}
			}
			for (let k = -2; k <= 4; k++) {
				paint(s, cx - mouth - 1, cyB + k - 1, 156, 160, 168, 1);
				paint(s, cx + mouth + 1, cyB + k - 1, 156, 160, 168, 1);
			}

			const [flr, flg, flb] = hsl(s.v.hue2 + 20, 10 + s.v.sat * 0.1, 19);
			for (let y = fy; y < s.h; y++) {
				const d = (y - fy) / Math.max(1, s.h - fy);
				for (let x = 0; x < s.w; x++) {
					const tile = Math.min(1, Math.abs(((x / 9 + y / 4) % 1) - 0.5) * 5);
					const k = 0.66 + d * 0.5 + tile * 0.3 + hash2m(x, y, id.grain + 11) * 0.16;
					paint(s, x, y, flr * k, flg * k, flb * k, 0.92);
				}
			}

			for (const [sx2, sy2, st] of id.stacks) {
				const x = sx2 * s.w;
				const y = fy + sy2 * (s.h - fy) * 0.7;
				const n = 3 + st;
				const hw = 4;
				for (let dx = -hw - 1; dx <= hw + 1; dx++) paint(s, x + dx, y + 2, 0, 0, 0, (1 - Math.abs(dx) / (hw + 2)) * 0.34);
				for (let k = 0; k < n; k++) {
					const oy = y - k * 1.4;
					for (let dx = -hw; dx <= hw; dx++) {
						const rim = 1 - Math.abs(dx) / (hw + 0.5);
						const g = hash2m(x + dx, oy, id.grain + 17 + k) * 0.3;
						const kk = 0.7 + rim * 0.3 + g;
						const [br2, bg2, bb2] = hsl(96 + st * 12, 26 + s.v.sat * 0.16, 40);
						paint(s, x + dx, oy, br2 * kk, bg2 * kk, bb2 * kk, 1);
					}
					paint(s, x - hw, y - k * 1.4, 18, 30, 20, 0.5);
					paint(s, x + hw, y - k * 1.4, 18, 30, 20, 0.5);
				}
				for (let dx = -hw; dx <= hw; dx++) paint(s, x + dx, y - n * 1.4, 200, 60, 54, 0.9);
			}

			if (open > 0.4 && s.rnd() < 0.55 * open) {
				const n = 1 + ((s.rnd() * 2) | 0);
				for (let q = 0; q < n; q++) {
					bills.push([
						cx + (s.rnd() - 0.5) * cw * 1.5,
						cyB + 1,
						(s.rnd() - 0.5) * 0.7 + wind * 0.3,
						0.1 + s.rnd() * 0.3,
						s.rnd() * 6.28,
						0.06 + s.rnd() * 0.16,
						s.rnd(),
						(s.rnd() * 4096) | 0
					]);
				}
				if (bills.length > 70) bills.splice(0, bills.length - 70);
				if (s.rnd() < 0.3) coins.push([cx + (s.rnd() - 0.5) * cw, cyB + 1, (s.rnd() - 0.5) * 1.1, 0.2, s.rnd() * 6.28, 0]);
			}

			for (let k = coins.length - 1; k >= 0; k--) {
				const q = coins[k];
				q[3] += 0.05 * s.v.speed;
				q[0] += q[2];
				q[1] += q[3];
				q[4] += 0.34;
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				const rest = s.h - 2 - pile[col] * 0.4;
				if (q[1] >= rest) {
					if (q[5] > 2 || Math.abs(q[3]) < 0.4) {
						coins.splice(k, 1);
						continue;
					}
					q[1] = rest;
					q[3] *= -0.42;
					q[2] *= 0.6;
					q[5]++;
				}
				if (q[0] < -2 || q[0] > s.w + 2) {
					coins.splice(k, 1);
					continue;
				}
				const sq = Math.abs(Math.cos(q[4]));
				const rr = 1.6;
				for (let dy = -rr; dy <= rr; dy++)
					for (let dx = -rr * sq - 0.5; dx <= rr * sq + 0.5; dx++) {
						const d = Math.hypot(dx / Math.max(0.5, rr * sq), dy / rr);
						if (d > 1) continue;
						const lit = 0.66 + (1 - d) * 0.5 + (dy < 0 ? 0.3 : 0);
						paint(s, q[0] + dx, q[1] + dy, 236 * lit, 190 * lit, 74 * lit, 1);
					}
				plot(s, q[0], q[1] - 1, 255, 240, 190, 0.6 * sq);
			}

			for (let k = bills.length - 1; k >= 0; k--) {
				const q = bills[k];
				q[3] += 0.011 * s.v.speed;
				q[3] = Math.min(q[3], 0.9);
				q[4] += q[5] * s.v.speed;
				q[2] += (wind * 0.012 + Math.sin(q[4] * 0.8) * 0.05) * s.v.speed;
				q[2] *= 0.985;
				q[0] += q[2] + Math.sin(q[4]) * 0.5;
				q[1] += q[3] * (0.4 + Math.abs(Math.cos(q[4])) * 0.8);
				if (q[0] < -5 || q[0] > s.w + 5) {
					bills.splice(k, 1);
					continue;
				}
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				const rest = s.h - 1.5 - pile[col] * 0.5;
				if (q[1] >= rest) {
					pile[col] = Math.min(6, pile[col] + 1);
					const l2 = Math.max(0, col - 2);
					const r3 = Math.min(s.w - 1, col + 2);
					pile[l2] = Math.min(6, pile[l2] + 0.5);
					pile[r3] = Math.min(6, pile[r3] + 0.5);
					bills.splice(k, 1);
					continue;
				}
				drawBill(s, q[0], q[1], q[4], 1.5, q[6], q[7]);
			}

			for (let x = 0; x < s.w; x++) {
				const hgt = pile[x] * 0.5;
				if (hgt < 0.3) continue;
				for (let k = 0; k < hgt; k++) {
					const g = hash2m(x, k, id.grain + 29);
					const [lr, lg2, lb] = hsl(96 + g * 30, 24 + s.v.sat * 0.14, 34 + g * 12 - k * 2);
					paint(s, x, s.h - 1 - k, lr, lg2, lb, 1);
					if (g > 0.82) plot(s, x, s.h - 1 - k, 210, 224, 190, 0.3);
				}
				pile[x] *= 0.99975;
			}

			if (open > 0.05) {
				for (let i = 0; i < 4; i++) {
					const yy = ((i * 61 + id.grain + s.t * 0.3) % 100) / 100;
					const x = cx + (yy - 0.5) * cw * 2.4;
					const y = cyB + yy * s.h * 0.4;
					plot(s, x, y, 255, 232, 170, open * 0.2 * (1 - yy));
				}
			}

			let full = 0;
			for (let x = 0; x < s.w; x++) full += pile[x];
			s.out = Math.min(1, open * 0.7 + bills.length / 50 + full / (s.w * 5));
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
			for (let i = 0; i < 18; i++) tail.push([0, 0, 0, 0]);
			const frond: number[][] = [];
			for (let i = 0; i < 6; i++) frond.push([r() * 6.28, 0.6 + r() * 0.7, (r() - 0.5) * 1.4]);
			(s as any).id = {
				coat: r(),
				stripes: r() < 0.55,
				tailLen: 0.9 + r() * 0.5,
				blinkEvery: 90 + ((r() * 150) | 0),
				period: 330 + ((r() * 130) | 0),
				shelfY: 0.4 + r() * 0.07,
				shelfSpan: 0.3 + r() * 0.12,
				kind: (r() * 3) | 0,
				objHue: r() * 360,
				frond
			};
			(s as any).tail = tail;
			(s as any).prints = [] as number[][];
			(s as any).dust = [] as number[][];
			(s as any).obj = null;
			(s as any).blink = 40;
			(s as any).kick = 0;
			(s as any).flash = null;
			(s as any).last = 9;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as {
				coat: number;
				stripes: boolean;
				tailLen: number;
				blinkEvery: number;
				period: number;
				shelfY: number;
				shelfSpan: number;
				kind: number;
				objHue: number;
				frond: number[][];
			};
			const tail = (s as any).tail as number[][];
			const prints = (s as any).prints as number[][];
			const dust = (s as any).dust as number[][];
			const dir = s.v.dir;
			const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.34, 26);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.65, 34 + id.coat * 22);
			const [dk, dg2, db2] = hsl(s.v.hue, s.v.sat * 0.7, 18);
			const [er, eg, eb] = hsl(s.v.hue2, s.v.sat, 78);

			const floorY = s.h * 0.85;
			const sunX = s.w * (0.5 + Math.sin(s.t * 0.026 * s.v.speed) * 0.34);
			const sunW = s.w * 0.28;
			const lamp = (x: number) => Math.pow(Math.max(0, 1 - Math.abs(x - sunX) / sunW), 0.4);
			for (let x = 0; x < s.w; x++) {
				const sun = lamp(x);
				for (let y = Math.round(floorY); y < s.h; y++) {
					const f = (y - floorY) / Math.max(1, s.h - floorY);
					const k = 1.3 - f * 0.4;
					paint(s, x, y, fr * k + sun * 120, fg * k + sun * 96, fb * k + sun * 44, 0.94);
				}
				plot(s, x, floorY, 255, 240, 214, 0.1 + sun * 0.4);
			}
			for (let k = 0; k < 14; k++) {
				const life = (((s.t * 0.012 * s.v.speed + k * 0.0714) % 1) + 1) % 1;
				const mx = sunX + Math.sin(k * 2.3 + s.t * 0.02) * sunW * 0.8;
				const my = s.h * (1 - life) * 0.9;
				plot(s, mx, my, 255, 238, 200, Math.max(0, 1 - Math.abs(mx - sunX) / sunW) * life * (1 - life) * 4 * 0.35);
			}

			const shelfY = s.h * id.shelfY;
			const edgeX = dir > 0 ? s.w * id.shelfSpan : s.w * (1 - id.shelfSpan);
			const perch = dir > 0 ? edgeX - s.w * 0.11 : edgeX + s.w * 0.11;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			if (cyc < (s as any).last) {
				(s as any).obj = [edgeX - dir * s.w * 0.05, shelfY - s.h * 0.085, 0, 0, 0, 1];
				(s as any).kick = 0;
				dust.length = 0;
			}
			(s as any).last = cyc;
			const obj = (s as any).obj as number[] | null;

			const walkIn = Math.min(1, cyc / 0.26);
			const settled = cyc > 0.26;
			const startX = dir > 0 ? -s.w * 0.2 : s.w * 1.2;
			const cx = startX + (perch - startX) * (walkIn * walkIn * (3 - 2 * walkIn));
			const stride = settled ? 0 : Math.sin(cyc * id.period * 0.16) * 1.6;
			const breath = Math.sin(s.t * 0.055 * s.v.speed) * 0.5 + 0.5;

			const stare = settled ? Math.min(1, (cyc - 0.26) / 0.18) : 0;
			const reach = cyc > 0.5 && cyc < 0.66 ? Math.sin(((cyc - 0.5) / 0.16) * Math.PI) : 0;
			const paw = cyc > 0.5 && cyc < 0.66 ? Math.min(1, (cyc - 0.5) / 0.05) : 0;
			const smug = cyc > 0.66 ? Math.min(1, (cyc - 0.66) / 0.1) : 0;
			const stretch = cyc > 0.8 ? Math.max(0, Math.sin(((cyc - 0.8) / 0.16) * Math.PI)) : 0;
			const crouch = stare * 0.5 + reach * 0.3;
			const bodyY = floorY - s.h * (settled ? 0.13 : 0.11) - Math.abs(stride) * 0.3 - breath * 0.5 - stretch * s.h * 0.02 + crouch * s.h * 0.012;

			const [wr, wg2, wb] = hsl(s.v.hue2, s.v.sat * 0.5, 26);
			const sx0 = dir > 0 ? 0 : edgeX;
			const sx1 = dir > 0 ? edgeX : s.w;
			for (let x = sx0; x < sx1; x++) {
				const sunl = Math.pow(Math.max(0, 1 - Math.abs(x - sunX) / sunW), 0.35) * 0.5;
				for (let k = 0; k < 3; k++) paint(s, x, shelfY + k, wr * (1.3 - k * 0.2) + sunl * 90, wg2 * (1.3 - k * 0.2) + sunl * 72, wb * 1.2 + sunl * 34, 0.96);
				paint(s, x, shelfY + 3, wr * 0.4, wg2 * 0.4, wb * 0.4, 0.5);
			}

			if (obj) {
				const grav = 0.07 * s.v.speed;
				if (obj[5] < 1.5) {
					if (paw > 0) {
						obj[2] += dir * 0.05 * paw * s.v.speed;
						obj[0] += obj[2];
						obj[4] = Math.sin(s.t * 0.3) * 0.3 * paw;
					}
					const past = dir > 0 ? obj[0] > edgeX : obj[0] < edgeX;
					if (past) obj[5] = 2;
				} else if (obj[5] < 2.5) {
					obj[3] += grav;
					obj[0] += obj[2];
					obj[1] += obj[3];
					obj[4] += 0.14 * s.v.speed;
					if (obj[1] >= floorY - s.h * 0.02) {
						obj[5] = 3;
						(s as any).kick = 1;
						(s as any).flash = [obj[0], floorY - 1, 0];
						for (let k = 0; k < 30; k++) {
							const th = -Math.PI * (0.06 + s.rnd() * 0.88);
							const pw = (0.35 + s.rnd() * 1.05) * (k < 10 ? 1.5 : 1);
							dust.push([obj[0], floorY - 1, Math.cos(th) * pw, Math.sin(th) * pw * 0.55, 0, s.rnd(), 0.6 + s.rnd() * 1.5]);
						}
					}
				}
				if (obj[5] < 2.5) {
					const os = s.h * 0.08;
					const [or2, og2, ob2] = hsl(id.objHue, 62, 58);
					const [oh, ohg, ohb] = hsl(id.objHue, 40, 84);
					for (let dy = -os; dy <= os; dy++) {
						for (let dx = -os; dx <= os; dx++) {
							const rx = dx * Math.cos(obj[4]) - dy * Math.sin(obj[4]);
							const ry = dx * Math.sin(obj[4]) + dy * Math.cos(obj[4]);
							let inside: boolean;
							if (id.kind === 0) inside = rx * rx + ry * ry * 1.7 < os * os;
							else if (id.kind === 1) inside = Math.abs(rx) < os * 0.6 && Math.abs(ry) < os;
							else inside = Math.abs(rx) / (os * 0.7) + Math.abs(ry) / os < 1;
							if (!inside) continue;
							const hi = Math.max(0, -ry / os) * 0.5 + Math.max(0, -rx / os) * 0.2;
							paint(s, obj[0] + dx, obj[1] + dy, or2 + (oh - or2) * hi, og2 + (ohg - og2) * hi, ob2 + (ohb - ob2) * hi, 0.97);
						}
					}
				}
			}

			for (let k = dust.length - 1; k >= 0; k--) {
				const q = dust[k];
				q[4] += 1;
				q[3] += 0.06 * s.v.speed;
				q[0] += q[2];
				q[1] += q[3];
				if (q[1] > floorY) {
					q[1] = floorY;
					q[3] *= -0.36;
					q[2] *= 0.7;
				}
				if (q[4] > 110) {
					dust.splice(k, 1);
					continue;
				}
				const a = (1 - q[4] / 110) * 0.85;
				const [pr2, pg2, pb2] = hsl(id.objHue, 58, 62 + q[5] * 22);
				const sw = q[6] ?? 1;
				for (let dy = -sw; dy <= sw; dy++)
					for (let dx = -sw; dx <= sw; dx++) {
						if (dx * dx + dy * dy > sw * sw) continue;
						paint(s, q[0] + dx, q[1] + dy, pr2, pg2, pb2, a);
					}
			}

			const flash = (s as any).flash as number[] | null;
			if (flash) {
				flash[2] += 1;
				if (flash[2] > 16) (s as any).flash = null;
				else {
					const f = flash[2] / 16;
					const ring = f * s.w * 0.14;
					for (let a2 = 0; a2 < 26; a2++) {
						const th = Math.PI + (a2 / 25) * Math.PI;
						plot(s, flash[0] + Math.cos(th) * ring, flash[1] + Math.sin(th) * ring * 0.42, 255, 238, 206, (1 - f) * 0.55);
					}
					for (let dy = -6; dy <= 2; dy++)
						for (let dx = -9; dx <= 9; dx++) {
							const d = Math.hypot(dx / 9, dy / 5);
							if (d > 1) continue;
							plot(s, flash[0] + dx, flash[1] + dy, 255, 240, 210, (1 - d) * (1 - f) * (1 - f) * 0.8);
						}
				}
			}

			const kick = (s as any).kick as number;
			if (kick > 0) (s as any).kick = Math.max(0, kick - 0.045);

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

			const un = s.h;
			const sit = settled ? Math.min(1, (cyc - 0.26) / 0.14) : 0;
			const L = (a: number, b: number) => a + (b - a) * sit;
			const fur = (x: number, y: number, lx: number, ly: number, top: number, k: number) => {
				const sunlit = Math.max(0, 1 - Math.abs(x - sunX) / sunW) * 0.46;
				const lit = (0.58 + top * 0.46 + sunlit) * k;
				const band = id.stripes && Math.sin(lx * 1.15 + ly * 0.12) > 0.62;
				paint(s, x, y, (band ? dk : cr) * lit, (band ? dg2 : cg) * lit, (band ? db2 : cb) * lit, 0.97);
			};
			const blob = (ox: number, oy: number, rx: number, ry: number, k: number, ragged: number) => {
				for (let dy = -ry - 1; dy <= ry + 1; dy++)
					for (let dx = -rx - 1; dx <= rx + 1; dx++) {
						const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
						if (d > 1) continue;
						if (ragged > 0 && d > 0.76 && chip(dx | 0, dy | 0, ((ox * 3) | 0) + ((oy * 7) | 0)) < ragged) continue;
						fur(ox + dx, oy + dy, ox - cx + dx, dy, Math.max(0, -dy / ry), k);
					}
			};
			const limb = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, k: number) => {
				const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0)));
				for (let i = 0; i <= n; i++) {
					const f = i / n;
					const w = w0 + (w1 - w0) * f;
					const px = x0 + (x1 - x0) * f;
					const py = y0 + (y1 - y0) * f;
					for (let dy = -w; dy <= w; dy++)
						for (let dx = -w; dx <= w; dx++) {
							if (dx * dx + dy * dy > w * w) continue;
							fur(px + dx, py + dy, px - cx + dx, py - bodyY + dy, Math.max(0, (-dx * dir) / (w + 0.5)) * 0.6, k);
						}
				}
			};

			const lift = Math.abs(stride) * 0.3 + breath * 0.4 + stretch * un * 0.02 - crouch * un * 0.012;
			const hipX = cx - dir * un * L(0.088, 0.078);
			const hipY = floorY - un * L(0.155, 0.112) - lift;
			const hipRX = un * L(0.086, 0.104);
			const hipRY = un * L(0.07, 0.104);
			const chestX = cx + dir * un * L(0.062, 0.054) + dir * stretch * un * 0.03;
			const chestY = floorY - un * L(0.162, 0.176) - lift - breath * 0.5;
			const chestRX = un * L(0.078, 0.07);
			const chestRY = un * L(0.062, 0.112) * (1 + breath * 0.06);
			const track = obj && obj[5] > 1.5 ? Math.max(-3, Math.min(3, (obj[0] - cx) * 0.06)) : 0;
			const look = Math.sin(s.t * 0.031 * s.v.speed) * Math.sin(s.t * 0.013) * 1.8 * (1 - stare) + track;
			const hr2 = un * 0.076;
			const hx = chestX + dir * un * L(0.088, 0.024) + look + dir * stretch * un * 0.04;
			const hy = chestY - un * L(0.062, 0.128) + stretch * un * 0.03 + Math.sin(s.t * 0.047 * s.v.speed) * 0.5;

			const flick = Math.sin(s.t * 0.13 * s.v.speed) * 0.9 + Math.sin(s.t * 0.29) * 0.5 + stretch * 1.8 + stare * Math.sin(s.t * 0.34 * s.v.speed) * 2.2;
			const trX = hipX - dir * hipRX * 0.8;
			const trY = hipY + hipRY * L(0.1, 0.5);
			for (let i = tail.length - 1; i >= 0; i--) {
				const f = i / (tail.length - 1);
				const seg = tail[i];
				const wkX = trX - dir * f * un * 0.19 * id.tailLen;
				const wkY = trY - Math.sin(f * 2.2 + flick) * un * 0.105 * id.tailLen - f * un * 0.05;
				const back = Math.min(1, f / 0.34);
				const fwd = Math.max(0, (f - 0.34) / 0.66);
				const stX = trX - dir * un * 0.12 * id.tailLen * back + dir * un * 0.33 * id.tailLen * fwd * fwd;
				const stY = trY + (floorY - 1.5 - trY) * Math.min(1, f / 0.42) - Math.max(0, (f - 0.78) / 0.22) * Math.abs(Math.sin(flick)) * un * 0.07;
				const tx = wkX + (stX - wkX) * sit;
				const ty = wkY + (stY - wkY) * sit;
				seg[0] += (tx - seg[0]) * 0.26;
				seg[1] += (ty - seg[1]) * 0.26;
				if (s.t < 3) {
					seg[0] = tx;
					seg[1] = ty;
				}
				const w = un * 0.042 * (1 - f * 0.48) + (f > 0.9 ? 0.5 : 0);
				for (let dy = -w; dy <= w; dy++)
					for (let dx = -w; dx <= w; dx++) {
						if (dx * dx + dy * dy > w * w) continue;
						fur(seg[0] + dx, seg[1] + dy, f * 14 + dx, dy, Math.max(0, -dy / (w + 0.4)) * 0.6, 0.88);
					}
			}

			const rearY = floorY - 0.5;
			for (let leg = 0; leg < 2; leg++) {
				const k = leg ? 0.94 : 0.66;
				const rx0 = hipX + dir * hipRX * (leg ? 0.3 : -0.06) + (leg ? 0 : -dir * 1.6);
				const ph = Math.sin(cyc * id.period * 0.16 + leg * 3.14) * 1.5 * (1 - sit);
				const kneeX = rx0 - dir * un * L(0.014, 0.038);
				const kneeY = hipY + hipRY * L(0.5, 0.62);
				const footX = rx0 + ph + dir * un * L(0.012, 0.072);
				limb(rx0, hipY + hipRY * 0.2, kneeX, kneeY, 2, 1.7, k);
				limb(kneeX, kneeY, footX, rearY, 1.7, 1.25, k);
				limb(footX - dir * 1.2, rearY, footX + dir * 2.6, rearY, 1.25, 1.15, k);
			}
			blob(hipX, hipY, hipRX, hipRY, 0.96, 26);
			blob((hipX + chestX) / 2, (hipY + chestY) / 2 - un * L(0.006, 0.012), Math.abs(chestX - hipX) * 0.62 + 2, un * L(0.058, 0.082), 1, 0);
			blob(chestX, chestY, chestRX, chestRY, 1.04, 18);

			for (let leg = 0; leg < 2; leg++) {
				const k = leg ? 1 : 0.7;
				const fx0 = chestX + dir * chestRX * (leg ? 0.26 : -0.06) + (leg ? 0 : -dir * 1.6);
				const ph = Math.sin(cyc * id.period * 0.16 + leg * 3.14 + 1.57) * 1.5 * (1 - sit);
				const raise = leg === 1 ? reach : 0;
				const fy1 = floorY - 0.5 - raise * (floorY - (shelfY + 1));
				const fx1 = fx0 + ph + dir * raise * un * 0.06;
				limb(fx0, chestY + chestRY * 0.24, fx1, fy1, 1.8, 1.2, k);
				if (raise < 0.2) limb(fx1 - dir * 1.2, fy1, fx1 + dir * 2.6, fy1, 1.2, 1.1, k);
			}

			blob(hx, hy, hr2 * 1.06, hr2 * 0.94, 1.06, 12);
			for (let ear = 0; ear < 2; ear++) {
				const sd = ear ? 1 : -1;
				const ebx = hx + sd * hr2 * 0.56;
				const eby = hy - hr2 * 0.66;
				const tipx = ebx + sd * hr2 * 0.2 + Math.sin(s.t * 0.06 + ear * 2) * 0.5;
				const tipy = eby - hr2 * 0.78;
				const hgt = Math.max(2, eby - tipy);
				for (let k = 0; k <= hgt; k++) {
					const f = k / hgt;
					const bx = ebx + (tipx - ebx) * f;
					const half = hr2 * 0.44 * (1 - f * f * 0.9);
					for (let q = -half; q <= half; q++) fur(bx + q, eby - k, q * 3, -k, 0.4 + f * 0.3, sd * dir > 0 ? 0.92 : 0.7);
					if (f < 0.66 && sd * dir > 0) plot(s, bx + sd * 0.4, eby - k, 222, 144, 156, (0.66 - f) * 0.7);
				}
			}

			const mzx = hx + dir * hr2 * 0.72;
			const mzy = hy + hr2 * 0.3;
			for (let dy = -hr2 * 0.4; dy <= hr2 * 0.4; dy++)
				for (let dx = -hr2 * 0.46; dx <= hr2 * 0.46; dx++) {
					if ((dx * dx) / (hr2 * 0.46) ** 2 + (dy * dy) / (hr2 * 0.4) ** 2 > 1) continue;
					fur(mzx + dx, mzy + dy, 40, dy, 0.5 + Math.max(0, -dy / hr2), 1.14);
				}
			paint(s, mzx + dir * hr2 * 0.32, mzy - hr2 * 0.1, 208, 124, 138, 0.92);
			paint(s, mzx + dir * hr2 * 0.28, mzy + hr2 * 0.2, dk * 0.7, dg2 * 0.7, db2 * 0.7, 0.75);
			for (let wk = 0; wk < 3; wk++) {
				const wy = mzy - 1 + wk;
				const bend = Math.sin(s.t * 0.04 + wk) * 0.6;
				for (let k = 1; k < hr2 * 1.5; k++)
					plot(s, mzx + dir * (hr2 * 0.3 + k), wy + (wk - 1) * k * 0.14 + bend * (k / 8), 236, 232, 226, 0.3 * (1 - k / (hr2 * 1.6)));
			}

			(s as any).blink -= 1;
			if ((s as any).blink < -6) (s as any).blink = id.blinkEvery;
			const shut = (s as any).blink < 0 || smug > 0.4;
			for (let eye = 0; eye < 2; eye++) {
				const ex2 = hx + (eye ? hr2 * 0.42 : -hr2 * 0.1) * dir;
				const ey2 = hy - hr2 * 0.18;
				if (shut) {
					for (let q = -1; q <= 1; q++) paint(s, ex2 + q, ey2 + Math.abs(q) * 0.5, dk, dg2, db2, 0.9);
					continue;
				}
				const eh = 0.9 + stare * 0.8;
				const ew = 0.7 + stare * 0.8;
				for (let dy = -eh; dy <= eh; dy++)
					for (let dx = -ew; dx <= ew; dx++) {
						if ((dx * dx) / (ew * ew + 0.2) + (dy * dy) / (eh * eh + 0.2) > 1) continue;
						plot(s, ex2 + dx, ey2 + dy, er, eg, eb, 0.95);
					}
				paint(s, ex2 + dir * 0.3, ey2, 22, 18, 24, 0.8 - stare * 0.35);
			}

			s.out = Math.min(1, kick * 0.85 + stare * 0.25 + reach * 0.4 + stretch * 0.3);
			blit(s);
		}
	};
}

type Brew = {
	cx: number;
	mugW: number;
	mugH: number;
	handle: number;
	lightSide: number;
	tableY: number;
	winX: number;
	winW: number;
	roast: number;
	period: number;
	planks: number[];
	beans: number[][];
	steamPh: number[];
	foam: number[][];
	cubeAt: number;
	grain: number;
};

function brewIdent(s: FxScene): Brew {
	const r = mulberry32(s.v.seed + 16127);
	const cx = 0.38 + r() * 0.24;
	const mugW = 0.25 + r() * 0.08;
	const mugH = 0.32 + r() * 0.08;
	const handle = r() < 0.5 ? -1 : 1;
	const winX = handle > 0 ? 0.03 + r() * 0.12 : 0.68 + r() * 0.14;
	const lightSide = winX < 0.5 ? -1 : 1;
	const winW = 0.16 + r() * 0.12;
	const tableY = 0.6 + r() * 0.06;
	const roast = r();
	const period = 420 + ((r() * 240) | 0);
	const planks: number[] = [];
	for (let i = 0; i < 4; i++) planks.push(r());
	const beans: number[][] = [];
	for (let i = 0; i < 6; i++) beans.push([r(), r(), r() * 3.14, r()]);
	const steamPh: number[] = [];
	for (let i = 0; i < 9; i++) steamPh.push(r() * 6.28);
	const foam: number[][] = [];
	for (let i = 0; i < 9; i++) foam.push([r() * 6.28, 0.16 + r() * 0.62, 0.7 + r() * 1.3, r()]);
	const cubeAt = 0.38 + r() * 0.08;
	const grain = (r() * 9999) | 0;
	return { cx, mugW, mugH, handle, lightSide, tableY, winX, winW, roast, period, planks, beans, steamPh, foam, cubeAt, grain };
}

export function makeCoffee(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = brewIdent(s);
			(s as any).rings = [] as number[][];
			(s as any).drops = [] as number[][];
			(s as any).cubes = [] as number[][];
			(s as any).lastCube = -1;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Brew;
			const rings = (s as any).rings as number[][];
			const drops = (s as any).drops as number[][];
			const cubes = (s as any).cubes as number[][];

			const ty = Math.round(s.h * id.tableY);
			const cx = s.w * id.cx + s.v.tilt * s.w * 0.04;
			const halfW = s.w * id.mugW * 0.5;
			const mugH = s.h * id.mugH;
			const mugBot = Math.round(ty + s.h * 0.13);
			const mugTop = mugBot - mugH;
			const ry = halfW * 0.3;
			const halfAt = (y: number) => halfW * (1 - 0.15 * Math.min(1, Math.max(0, (y - mugTop) / mugH)));

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);
			const rampIn = Math.min(1, Math.max(0, (cyc - 0.05) / 0.2));
			let drain = 0;
			if (cyc > 0.66) {
				const u = Math.min(1, (cyc - 0.66) / 0.28);
				const g = u * 3;
				const gi = Math.min(2, g | 0);
				const gf = Math.min(1, (g - gi) * 2.4);
				drain = ((gi + gf * gf * (3 - 2 * gf)) / 3) * 0.88;
			}
			const level = Math.min(1, Math.max(0.05, rampIn - drain));
			const pouring = cyc > 0.05 && cyc < 0.25;
			const heat = Math.max(0.16, 1 - Math.max(0, cyc - 0.24) * 1.3) * (0.35 + level * 0.65);
			const depth = (1 - level) * mugH * 0.58;
			const ly = mugTop + ry * 0.2 + depth;
			const lrx = halfAt(ly) - 1.6;
			const lry = ry * (lrx / halfW) * 0.96;

			const wx0 = id.winX * s.w;
			const wx1 = wx0 + id.winW * s.w;
			const wcx = (wx0 + wx1) * 0.5;
			const [glr, glg, glb] = hsl(38 + (s.v.hue % 30), 26 + s.v.sat * 0.22, 54);

			const [tr2, tg2, tb2] = hsl(26 + (s.v.hue % 18), 32 + s.v.sat * 0.2, 21);
			for (let y = ty; y < s.h; y++) {
				const f = (y - ty) / Math.max(1, s.h - ty);
				let seam = 0;
				for (let i = 0; i < 4; i++) seam = Math.max(seam, Math.max(0, 1 - Math.abs(f - (0.08 + id.planks[i] * 0.86)) * 16));
				for (let x = 0; x < s.w; x++) {
					const ring = Math.sin(x * 0.07 + Math.sin(x * 0.017 + id.grain) * 2.4 + f * 5) * 0.5 + 0.5;
					const gr2 = ring * 0.26 + hash2m(x, y, id.grain + 9) * 0.14;
					const near = Math.max(0, 1 - Math.abs(x - wcx) / (s.w * 0.7));
					let k = 0.8 + gr2 + f * 0.22 + near * 0.34 - seam * 0.5;
					if (y - ty < 2) k += 0.75;
					paint(s, x, y, tr2 * k, tg2 * k * 0.94, tb2 * k * 0.86, 1);
					const pane = Math.max(0, 1 - Math.abs(x - wcx - f * (wx1 - wx0) * 0.3) / ((wx1 - wx0) * 0.55));
					if (pane > 0) plot(s, x, y, glr, glg, glb, pane * pane * (1 - f * 0.55) * 0.3);
				}
			}

			for (const [bx, by, ba, bt] of id.beans) {
				const x0 = bx * s.w;
				const y0 = ty + 3 + by * Math.max(2, s.h - ty - 5);
				const rr = 1.5 + bt * 0.9;
				const ca0 = Math.cos(ba);
				const sa0 = Math.sin(ba);
				for (let dy = -rr - 2; dy <= rr + 2; dy++)
					for (let dx = -rr - 3; dx <= rr + 3; dx++) {
						const px2 = dx * ca0 + dy * sa0;
						const py2 = -dx * sa0 + dy * ca0;
						const d = Math.hypot(px2 / (rr * 1.6), py2 / rr);
						if (d > 1) continue;
						const lit = 0.55 + Math.max(0, -py2 / rr) * 0.6 - Math.abs(px2) / (rr * 4);
						const crease = Math.abs(px2) < 0.7 ? 0.5 : 1;
						const [br2, bg2, bb2] = hsl(22 + id.roast * 14, 48 + s.v.sat * 0.14, 20 + lit * 18);
						paint(s, x0 + dx, y0 + dy, br2 * crease, bg2 * crease, bb2 * crease, 1);
					}
			}

			const sy = mugBot + 1;
			const srx = halfW * 1.62;
			const sry = Math.max(2, srx * 0.3);
			for (let dy = -sry - 3; dy <= sry + 5; dy++)
				for (let dx = -srx - 5; dx <= srx + 6; dx++) {
					const d = Math.hypot((dx - id.lightSide * 3) / (srx + 5), (dy - 2) / (sry + 3));
					if (d > 1) continue;
					paint(s, cx + dx, sy + dy, 0, 0, 0, (1 - d) * (1 - d) * 0.55);
				}
			const [cr2, cg2, cb2] = hsl(34 + (s.v.hue % 30), 8 + s.v.sat * 0.1, 58);
			for (let dy = -sry; dy <= sry + 2; dy++)
				for (let dx = -srx; dx <= srx; dx++) {
					const d = Math.hypot(dx / srx, dy / sry);
					if (d > 1) continue;
					const lip = d > 0.82 ? 1.24 : 1;
					const k = (0.58 + (1 - d) * 0.3 + id.lightSide * (dx / srx) * 0.22 - Math.max(0, dy / sry) * 0.2) * lip;
					paint(s, cx + dx, sy + dy, cr2 * k, cg2 * k, cb2 * k, 1);
				}

			const hx = cx + id.handle * halfW * 0.9;
			const hy = (mugTop + mugBot) * 0.5 + mugH * 0.04;
			const hr = mugH * 0.3;
			for (let dy = -hr - 3; dy <= hr + 3; dy++)
				for (let dx = -hr - 3; dx <= hr + 3; dx++) {
					if (id.handle > 0 ? dx < 0 : dx > 0) continue;
					const d = Math.hypot(dx, dy * 1.05);
					const t2 = Math.abs(d - hr);
					if (t2 > 2.2) continue;
					const rim = 1 - t2 / 2.4;
					const k = 0.5 + rim * 0.5 + ((id.lightSide * dx) / (hr + 1)) * 0.3 - (dy / (hr + 1)) * 0.12;
					paint(s, hx + dx, hy + dy, cr2 * k, cg2 * k, cb2 * k, 1);
				}

			for (let y = mugTop; y <= mugBot; y++) {
				const ha = halfAt(y);
				const f = (y - mugTop) / mugH;
				for (let x = cx - ha; x <= cx + ha; x++) {
					const u = (x - cx) / ha;
					const curve = Math.sqrt(Math.max(0, 1 - u * u));
					const spec = Math.max(0, 1 - Math.abs(u - id.lightSide * 0.48) / 0.55);
					const bounce = Math.max(0, 1 - (1 - f) / 0.16) * 0.24;
					const foot = f > 0.96 ? -0.28 : 0;
					const k = 0.42 + curve * 0.4 + spec * spec * 0.55 + bounce + foot - Math.max(0, Math.abs(u) - 0.82) * 1.2;
					paint(s, x, y, cr2 * k, cg2 * k * 0.99, cb2 * k * 0.95, 1);
				}
			}

			for (let dy = -ry - 2; dy <= ry + 2; dy++)
				for (let dx = -halfW - 2; dx <= halfW + 2; dx++) {
					const d = Math.hypot(dx / halfW, dy / ry);
					if (d > 1.05) continue;
					if (d > 0.82) {
						const front = dy > 0 ? 1.3 : 0.76;
						const k = (0.64 + ((id.lightSide * dx) / halfW) * 0.24) * front;
						paint(s, cx + dx, mugTop + dy, cr2 * k, cg2 * k, cb2 * k, 1);
					}
				}
			for (let y = mugTop - ry; y <= ly + lry; y++) {
				let ha = halfAt(y) - 1.4;
				if (y < mugTop + ry) {
					const v = (y - mugTop) / ry;
					if (Math.abs(v) > 0.82) continue;
					ha = Math.min(ha, halfW * 0.82 * Math.sqrt(Math.max(0, 0.6724 - v * v) / 0.6724));
				}
				if (ha <= 0) continue;
				for (let x = cx - ha; x <= cx + ha; x++) {
					const u = (x - cx) / ha;
					const back = Math.max(0, -u * id.lightSide);
					const lip = Math.max(0, 1 - (y - (mugTop - ry * 0.8)) / (ry * 1.4));
					const k = 0.16 + back * 0.18 + Math.max(0, 1 - (ly - y) / (mugH * 0.45)) * 0.12 + lip * 0.1;
					paint(s, x, y, cr2 * k * 0.55, cg2 * k * 0.5, cb2 * k * 0.44, 1);
				}
			}

			for (let k = rings.length - 1; k >= 0; k--) {
				const rg = rings[k];
				rg[2] += 0.028 * s.v.speed;
				rg[3] *= 0.972;
				if (rg[2] > 1.6 || rg[3] < 0.02) rings.splice(k, 1);
			}

			const [lqr, lqg, lqb] = hsl(20 + id.roast * 12 + (s.v.hue % 16), 54 + s.v.sat * 0.2, 13 + id.roast * 5);
			for (let dy = -lry - 1; dy <= lry + 1; dy++)
				for (let dx = -lrx - 1; dx <= lrx + 1; dx++) {
					const d = Math.hypot(dx / lrx, dy / lry);
					if (d > 1) continue;
					let wave = 0;
					for (const rg of rings) {
						const rd = Math.hypot(dx / lrx - rg[0], dy / lry - rg[1]);
						const band = 1 - Math.abs(rd - rg[2]) / 0.3;
						if (band > 0) wave += band * band * rg[3] * Math.cos((rd - rg[2]) * 9);
					}
					const swirl = Math.sin(dx * 0.5 + dy * 1.7 + s.t * 0.05 * s.v.speed) * 0.05;
					const k = 0.68 + (1 - d) * 0.36 + wave * 2.1 + swirl;
					const sh = Math.max(0, 1 - Math.hypot(dx / lrx - id.lightSide * 0.44, dy / lry + 0.32) / 0.52);
					paint(s, cx + dx, ly + dy, lqr * k + sh * sh * 130, lqg * k + sh * sh * 104, lqb * k + sh * sh * 74, 1);
				}

			const spin = s.t * 0.004 * s.v.speed * s.v.dir;
			for (const fm of id.foam) {
				const a = fm[0] + spin * (0.5 + fm[3]);
				const rr = fm[1] * 0.74;
				const bx = Math.cos(a) * rr * lrx;
				const by = Math.sin(a) * rr * lry;
				const sz = fm[2] * (0.5 + level * 0.8);
				const [fr2, fg2, fb2] = hsl(30 + id.roast * 10, 42 + s.v.sat * 0.2, 34);
				for (let dy = -sz; dy <= sz; dy++)
					for (let dx = -sz * 1.5; dx <= sz * 1.5; dx++) {
						const dd = Math.hypot(dx / (sz * 1.5), dy / sz);
						if (dd > 1) continue;
						const px2 = bx + dx;
						const py2 = by + dy;
						if (Math.hypot(px2 / lrx, py2 / lry) > 0.93) continue;
						plot(s, cx + px2, ly + py2, fr2, fg2, fb2, (1 - dd) * 0.8 * heat);
					}
			}

			if (pouring) {
				const ease = Math.min(1, (cyc - 0.05) / 0.03) * Math.min(1, (0.25 - cyc) / 0.03);
				const sw = 1.1 + ease * 0.9;
				const stop = Math.min(ly, mugTop + ry * 0.4);
				for (let y = 0; y < stop; y++) {
					const wob = Math.sin(y * 0.09 + s.t * 0.12 * s.v.speed) * 0.7 * s.v.drift;
					const px2 = cx + wob + s.v.tilt * 2;
					for (let dx = -sw; dx <= sw; dx++) {
						const e = 1 - Math.abs(dx) / (sw + 0.4);
						const [pr2, pg2, pb2] = hsl(22 + id.roast * 12, 56 + s.v.sat * 0.2, 16 + e * 20 + Math.max(0, id.lightSide * dx) * 5);
						paint(s, px2 + dx, y, pr2, pg2, pb2, Math.min(1, e * 2.6) * ease);
					}
				}
				if (s.rnd() < 0.5) {
					rings.push([(s.rnd() - 0.5) * 0.3, (s.rnd() - 0.5) * 0.3, 0.05, 0.5 + s.rnd() * 0.5]);
					if (rings.length > 9) rings.shift();
				}
				if (s.rnd() < 0.6) drops.push([cx + (s.rnd() - 0.5) * lrx * 0.9, ly - 1, (s.rnd() - 0.5) * 1.5, -(0.5 + s.rnd() * 1.2), 0]);
			}

			if (cyc > id.cubeAt && cyc < id.cubeAt + 0.2 && (s as any).lastCube !== cycle) {
				(s as any).lastCube = cycle;
				cubes.push([cx + (s.rnd() - 0.5) * lrx * 0.6, mugTop - s.h * 0.62, 0, s.rnd() * 6.28]);
			}
			for (let k = cubes.length - 1; k >= 0; k--) {
				const cb = cubes[k];
				cb[2] += 0.062 * s.v.speed;
				cb[1] += cb[2];
				cb[3] += 0.09 * s.v.speed;
				if (cb[1] >= ly) {
					rings.push([(cb[0] - cx) / lrx, 0, 0.02, 2.6]);
					if (rings.length > 10) rings.shift();
					for (let q = 0; q < 16; q++) {
						const aa = -1.57 + (s.rnd() - 0.5) * 2.6;
						const sp2 = 0.9 + s.rnd() * 1.9;
						drops.push([cb[0], ly - 1, Math.cos(aa) * sp2, Math.sin(aa) * sp2 * 1.5, 0]);
					}
					cubes.splice(k, 1);
					continue;
				}
				const cs = 3.4;
				const ca1 = Math.cos(cb[3]);
				const sa1 = Math.sin(cb[3]);
				for (let dy = -cs - 2; dy <= cs + 2; dy++)
					for (let dx = -cs - 2; dx <= cs + 2; dx++) {
						const ux2 = dx * ca1 + dy * sa1;
						const uy2 = -dx * sa1 + dy * ca1;
						if (Math.abs(ux2) > cs || Math.abs(uy2) > cs) continue;
						const face = 0.62 + Math.max(0, -uy2 / cs) * 0.42 + Math.max(0, (id.lightSide * ux2) / cs) * 0.3;
						paint(s, cb[0] + dx, cb[1] + dy, 228 * face, 224 * face, 214 * face, 1);
					}
			}

			const [dr2, dg2, db2] = hsl(24 + id.roast * 12, 54, 28);
			for (let k = drops.length - 1; k >= 0; k--) {
				const d2 = drops[k];
				d2[3] += 0.13 * s.v.speed;
				d2[0] += d2[2];
				d2[1] += d2[3];
				d2[4] += 1;
				if (d2[3] > 0 && d2[1] >= ly && Math.abs(d2[0] - cx) < lrx) {
					rings.push([(d2[0] - cx) / lrx, 0, 0.04, 0.45]);
					if (rings.length > 10) rings.shift();
					drops.splice(k, 1);
					continue;
				}
				if (d2[4] > 70 || d2[1] > mugBot || d2[0] < 0 || d2[0] > s.w) {
					drops.splice(k, 1);
					continue;
				}
				const df = Math.min(1, (70 - d2[4]) / 16);
				paint(s, d2[0], d2[1], dr2, dg2, db2, 0.92 * df);
				plot(s, d2[0], d2[1] - 1, 190, 160, 124, 0.3 * df);
			}

			const [str2, stg2, stb2] = hsl(34 + (s.v.hue % 30), 16, 84);
			for (let i = 0; i < id.steamPh.length; i++) {
				const ph = id.steamPh[i];
				const bx = cx + ((i + 0.5) / id.steamPh.length - 0.5) * lrx * 1.8;
				const rise = s.h * (0.44 + (i % 3) * 0.07);
				for (let k = 0; k < rise; k++) {
					const y = ly - 2 - k;
					if (y < 0) break;
					const f = k / rise;
					const wob = Math.sin(f * 4.2 + ph + s.t * 0.035 * s.v.speed) * f * 7 * s.v.drift * s.v.dir;
					const puff = 0.5 + 0.5 * Math.sin(f * 9 - s.t * 0.06 * s.v.speed + ph);
					const a = (1 - f) ** 1.6 * puff * heat * 0.32 * Math.min(1, f * 6);
					if (a < 0.006) continue;
					const wdt = 0.6 + f * 2.6;
					for (let dx = -wdt; dx <= wdt; dx++) plot(s, bx + wob + dx, y, str2, stg2, stb2, a * (1 - Math.abs(dx) / (wdt + 0.6)));
				}
			}

			s.out = Math.min(1, heat * 0.5 + (pouring ? 0.42 : 0) + rings.length * 0.05 + cubes.length * 0.2);
			blit(s);
		}
	};
}

type Wax = {
	cx: number;
	bodyW: number;
	bodyH: number;
	tableY: number;
	lean: number;
	ridges: number[][];
	motes: number[][];
	grain: number;
	period: number;
	gustAt: number;
	gustLen: number;
	tone: number;
	wickBend: number;
	rim: number[];
};

function waxIdent(s: FxScene): Wax {
	const r = mulberry32(s.v.seed + 17209);
	const cx = 0.36 + r() * 0.28;
	const bodyW = 0.17 + r() * 0.09;
	const bodyH = 0.34 + r() * 0.14;
	const tableY = 0.74 + r() * 0.06;
	const lean = (r() - 0.5) * 0.1;
	const ridges: number[][] = [];
	for (let i = 0; i < 6; i++) ridges.push([r() < 0.5 ? -1 : 1, r(), 0.14 + r() * 0.5, 0.5 + r() * 0.8]);
	const motes: number[][] = [];
	for (let i = 0; i < 14; i++) motes.push([r(), r(), 0.3 + r() * 0.9, r() * 6.28]);
	const rim: number[] = [];
	for (let i = 0; i < 12; i++) rim.push(r());
	const grain = (r() * 9999) | 0;
	const period = 300 + ((r() * 220) | 0);
	const gustAt = 0.44 + r() * 0.16;
	const gustLen = 0.1 + r() * 0.08;
	const tone = r();
	const wickBend = (r() - 0.5) * 1.4;
	return { cx, bodyW, bodyH, tableY, lean, ridges, motes, grain, period, gustAt, gustLen, tone, wickBend, rim };
}

export function makeCandle(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = waxIdent(s);
			(s as any).drips = [] as number[][];
			(s as any).frozen = [] as number[][];
			(s as any).embers = [] as number[][];
			(s as any).puffs = [] as number[][];
			(s as any).bend = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Wax;
			const drips = (s as any).drips as number[][];
			const frozen = (s as any).frozen as number[][];
			const embers = (s as any).embers as number[][];
			const puffs = (s as any).puffs as number[][];

			const ty = Math.round(s.h * id.tableY);
			const cx = s.w * id.cx + s.v.tilt * s.w * 0.03;
			const halfW = s.w * id.bodyW * 0.5;
			const bodyH = s.h * id.bodyH;
			const topY = Math.round(ty - bodyH);
			const ry = halfW * 0.34;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const inGust = cyc > id.gustAt && cyc < id.gustAt + id.gustLen;
			const gu = inGust ? (cyc - id.gustAt) / id.gustLen : 0;
			const gust = inGust ? Math.sin(gu * Math.PI) ** 0.6 : 0;
			const flare = cyc > id.gustAt + id.gustLen && cyc < id.gustAt + id.gustLen + 0.09 ? 1 - (cyc - id.gustAt - id.gustLen) / 0.09 : 0;
			const near = Math.max(0, gust - 0.62) / 0.38;
			const life = Math.max(0.1, 1 - near * 0.92) * (1 + flare * 0.7);
			const flick = 0.86 + 0.14 * Math.sin(s.t * 0.31 + id.grain) + 0.08 * Math.sin(s.t * 0.77);
			const heat = life * flick;
			const dir = s.v.dir > 0 ? 1 : -1;
			(s as any).bend += (gust * 2.6 * dir * s.v.drift + Math.sin(s.t * 0.06) * 0.22 - (s as any).bend) * 0.22;
			const bend = (s as any).bend as number;

			const wy = topY - 1;
			const glowR = s.h * (0.62 + heat * 0.34);
			for (let y = 0; y < ty; y++)
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - cx) / glowR, (y - wy) / (glowR * 0.82));
					if (d >= 1) continue;
					const fall = (1 - d) ** 2.1;
					plot(s, x, y, 255, 176, 88, fall * heat * 0.4);
				}

			const [tbr, tbg, tbb] = hsl(24 + (s.v.hue % 16), 34 + s.v.sat * 0.18, 17);
			for (let y = ty; y < s.h; y++) {
				const f = (y - ty) / Math.max(1, s.h - ty);
				const hwt = s.w * (0.34 + f * 0.2);
				for (let x = Math.max(0, Math.floor(cx - hwt)); x < Math.min(s.w, Math.ceil(cx + hwt)); x++) {
					const ex = Math.min(1, (hwt - Math.abs(x - cx)) / 3.4);
					if (ex <= 0) continue;
					const pool = Math.max(0, 1 - Math.hypot((x - cx) / (s.w * 0.44 * (0.6 + heat * 0.5)), f / 1.05)) ** 1.7;
					const ring = Math.sin(x * 0.08 + Math.sin(x * 0.02 + id.grain) * 2.2 + f * 4) * 0.5 + 0.5;
					const gr2 = ring * 0.24 + hash2m(x, y, id.grain + 7) * 0.14;
					let k = 0.62 + gr2 - f * 0.18 + pool * 2.4 * heat;
					if (y - ty < 2) k += 0.5;
					paint(s, x, y, tbr * k + pool * heat * 40, tbg * k + pool * heat * 22, tbb * k + pool * heat * 7, ex);
				}
			}

			const [sr, sg, sb] = hsl(34, 12 + s.v.sat * 0.1, 84 - id.tone * 14);
			const shw = halfW * 2.1;
			for (let dy = 0; dy < 5; dy++)
				for (let dx = -shw; dx <= shw; dx++) {
					const d = Math.hypot(dx / shw, dy / 4.4);
					if (d > 1) continue;
					paint(s, cx - bend * 2.4 + dx, ty + dy, 0, 0, 0, (1 - d) * (1 - d) * 0.5);
				}

			const leanAt = (y: number) => cx + id.lean * (ty - y);
			for (let y = topY; y <= ty; y++) {
				const bx = leanAt(y);
				const f = (y - topY) / Math.max(1, ty - topY);
				for (let x = bx - halfW; x <= bx + halfW; x++) {
					const u = (x - bx) / halfW;
					const curve = Math.sqrt(Math.max(0, 1 - u * u));
					const spec = Math.max(0, 1 - Math.abs(u + 0.42) / 0.5);
					const glowIn = Math.max(0, 1 - (y - topY) / (bodyH * 0.55)) * heat;
					const grain2 = hash2m(x, y >> 1, id.grain + 3) * 0.08;
					const k = 0.4 + curve * 0.34 + spec * spec * 0.4 + glowIn * 0.5 + grain2 - Math.max(0, Math.abs(u) - 0.8) * 1.1 - f * 0.06;
					paint(s, x, y, sr * k + glowIn * 70, sg * k + glowIn * 34, sb * k + glowIn * 10, 1);
				}
			}

			for (const fr of frozen) {
				const side = fr[0];
				const x0 = leanAt(fr[2]) + side * halfW * 0.9;
				for (let y = fr[1]; y <= fr[2]; y++) {
					const f = (y - fr[1]) / Math.max(1, fr[2] - fr[1]);
					const wdt = fr[3] * (0.8 - f * 0.3) * (1 + Math.sin(f * 7 + fr[4]) * 0.22);
					for (let dx = -wdt - 1; dx <= wdt + 1; dx++) {
						const e = 1 - Math.abs(dx) / (wdt + 1.2);
						if (e <= 0) continue;
						const lit = Math.max(0, 1 - (y - topY) / (bodyH * 0.6)) * heat;
						const k = 0.5 + e * 0.6 + lit * 0.45;
						paint(s, leanAt(y) + side * halfW * 0.9 + dx, y, sr * k + lit * 55, sg * k + lit * 26, sb * k + lit * 8, 1);
					}
					if (y > fr[2] - 2) {
						const bulb = fr[3] * 1.2;
						for (let ddy = -bulb; ddy <= bulb; ddy++)
							for (let ddx = -bulb; ddx <= bulb; ddx++) {
								if (Math.hypot(ddx, ddy) > bulb) continue;
								paint(s, x0 + ddx, fr[2] + ddy, sr * 1.15, sg * 1.15, sb * 1.12, 1);
							}
					}
				}
			}

			const pool = ry * (0.85 + heat * 0.3);
			for (let dy = -ry - 2; dy <= ry + 2; dy++)
				for (let dx = -halfW - 1; dx <= halfW + 1; dx++) {
					const d = Math.hypot(dx / halfW, dy / ry);
					if (d > 1.02) continue;
					const rimN = id.rim[(((Math.atan2(dy, dx) / 6.28 + 1) * 12) | 0) % 12];
					if (d > 0.78) {
						const k = 0.72 + 0.4 * (1 - Math.abs(dx + halfW * 0.4) / halfW) + rimN * 0.22 + (dy > 0 ? 0.28 : -0.1);
						paint(s, cx + dx, topY + dy, sr * k, sg * k, sb * k, 1);
					} else {
						const melt = Math.max(0, 1 - d / 0.78);
						const shim = 0.5 + 0.5 * Math.sin(dx * 0.9 + dy * 2.2 + s.t * 0.07 * s.v.speed);
						const k = 0.5 + melt * 0.5 + shim * 0.14;
						plot(s, cx + dx, topY + dy, 255 * k * heat, (150 + rimN * 40) * k * heat, 48 * k * heat, Math.min(1, 0.4 + melt * 0.8));
						paint(s, cx + dx, topY + dy, sr * 0.5 * k, sg * 0.46 * k, sb * 0.4 * k, 0.55);
					}
				}

			if ((flare > 0.4 || s.rnd() < 0.006) && drips.length < 5) {
				const side = s.rnd() < 0.5 ? -1 : 1;
				drips.push([side, topY + ry * 0.6, 0, 0.9 + s.rnd() * 0.9, s.rnd() * 6.28, 0]);
			}
			for (let k = drips.length - 1; k >= 0; k--) {
				const dp = drips[k];
				dp[5] += 1;
				dp[2] += 0.012 * s.v.speed;
				dp[1] += dp[2];
				const chill = dp[5] * 0.006 + Math.max(0, (dp[1] - topY) / bodyH) * 0.9;
				if (dp[1] >= ty - 1 || s.rnd() < chill * 0.05) {
					frozen.push([dp[0], topY + ry * 0.6, Math.min(ty - 1, dp[1]), dp[3], dp[4]]);
					if (frozen.length > 7) frozen.shift();
					drips.splice(k, 1);
					continue;
				}
				const x0 = leanAt(dp[1]) + dp[0] * halfW * 0.9;
				const bulb = dp[3] * 1.2;
				for (let dy = -bulb; dy <= bulb * 1.4; dy++)
					for (let dx = -bulb; dx <= bulb; dx++) {
						if (Math.hypot(dx / bulb, dy / (bulb * 1.3)) > 1) continue;
						const lit = Math.max(0, 1 - (dp[1] - topY) / (bodyH * 0.7)) * heat;
						const k2 = 0.8 + Math.max(0, -dx / bulb) * 0.4 + lit * 0.5;
						paint(s, x0 + dx, dp[1] + dy, sr * k2 + lit * 60, sg * k2 + lit * 26, sb * k2 + lit * 8, 1);
					}
			}

			const wickH = 3.4;
			for (let k = 0; k <= wickH; k++) {
				const f = k / wickH;
				const x = cx + id.wickBend * f * 1.6 + bend * f * 0.5;
				const char = near > 0.3 ? 1 : 0.5 + heat * 0.3;
				paint(s, x, topY - k, 26 * char, 20 * char, 16 * char, 1);
				if (k < 1.6) plot(s, x, topY - k, 255, 120 + heat * 60, 40, heat * 0.8);
			}

			const tipY = topY - wickH;
			const fh = s.h * (0.26 + heat * 0.2) * life;
			const fw = halfW * (0.52 + heat * 0.16);
			for (let k = 0; k < fh; k++) {
				const f = k / fh;
				const taper = Math.sin(Math.min(1, 0.1 + f * 0.94) * Math.PI) ** 0.5;
				const wob = Math.sin(f * 3.4 - s.t * 0.14 * s.v.speed + id.grain) * f * 1.3 * (0.4 + gust * 2.2);
				const fx = cx + id.wickBend * 0.6 + wob + bend * f * f * 5.4;
				const half = fw * taper * (1 + flare * 0.4);
				for (let dx = -half; dx <= half; dx++) {
					const u = Math.abs(dx) / (half + 0.3);
					const core = Math.max(0, 1 - u / 0.45);
					const body = 1 - u;
					const blue = Math.max(0, 1 - f / 0.2) * (1 - core * 0.4);
					const a = body * body * heat * (1 - f * 0.18);
					if (blue > 0.1) plot(s, fx + dx, tipY - k, 90, 150, 255, blue * a * 0.7);
					plot(s, fx + dx, tipY - k, 255, 150 + core * 90 - f * 44, 40 + core * 150 - f * 30, a * 0.9);
					if (core > 0.5) plot(s, fx + dx, tipY - k, 255, 250, 220, (core - 0.5) * 2 * heat * (1 - f * 1.5) * 0.9);
				}
			}

			const hr = fw * 5 * (0.6 + heat * 0.7);
			for (let dy = -hr * 1.3; dy <= hr * 0.8; dy++)
				for (let dx = -hr; dx <= hr; dx++) {
					const d = Math.hypot(dx / hr, dy / (hr * 1.2));
					if (d > 1) continue;
					plot(s, cx + bend * 1.6 + dx, tipY - fh * 0.35 + dy, 255, 170, 70, (1 - d) ** 2.4 * heat * 0.42);
				}

			if (near > 0.2 && s.rnd() < near * 0.7) embers.push([cx + bend * 2, tipY - fh * 0.5, bend * 0.5 + (s.rnd() - 0.5), -(0.3 + s.rnd() * 0.8), 0]);
			for (let k = embers.length - 1; k >= 0; k--) {
				const em = embers[k];
				em[4] += 1;
				em[0] += em[2] * 0.6;
				em[1] += em[3];
				em[3] += 0.014;
				if (em[4] > 46 || em[1] > ty) {
					embers.splice(k, 1);
					continue;
				}
				const a = (1 - em[4] / 46) ** 1.5;
				plot(s, em[0], em[1], 255, 150 + a * 80, 50, a * 0.95);
				plot(s, em[0], em[1] + 1, 255, 110, 30, a * 0.4);
			}

			if (s.rnd() < 0.5 + near) puffs.push([cx + bend * 2.2, tipY - fh * 0.9, (s.rnd() - 0.5) * 0.3, 0, 0, 0.6 + s.rnd() * 0.8]);
			for (let k = puffs.length - 1; k >= 0; k--) {
				const pf = puffs[k];
				pf[4] += 1;
				pf[0] += pf[2] + bend * 0.1 + Math.sin(pf[4] * 0.07 + pf[5] * 6) * 0.22 * s.v.drift;
				pf[1] -= 0.4 + pf[5] * 0.2;
				if (pf[4] > 70 || pf[1] < -4) {
					puffs.splice(k, 1);
					continue;
				}
				const f = pf[4] / 70;
				const rr = 0.6 + f * 3.4 * pf[5];
				const a = (1 - f) ** 1.7 * (0.1 + near * 0.55) * 0.5;
				if (a < 0.006) continue;
				for (let dy = -rr; dy <= rr; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx, dy) / rr;
						if (d > 1) continue;
						plot(s, pf[0] + dx, pf[1] + dy, 190, 186, 180, (1 - d) * a);
					}
			}
			if (puffs.length > 60) puffs.splice(0, puffs.length - 60);

			for (const [mx, my, msp, mph] of id.motes) {
				const y = ((my + s.t * 0.0004 * msp * s.v.speed) % 1) * ty;
				const x = mx * s.w + Math.sin(s.t * 0.02 * msp + mph) * 4 * s.v.drift;
				const d = Math.hypot((x - cx) / (glowR * 0.8), (y - wy) / (glowR * 0.7));
				const tw = 0.4 + 0.6 * Math.max(0, Math.sin(s.t * 0.06 * msp + mph));
				plot(s, x, y, 255, 210, 150, Math.max(0, 1 - d) ** 2 * tw * heat * 0.7 * edge(y, 0, ty, ty * 0.2));
			}

			s.out = Math.min(1, heat * 0.6 + flare * 0.5 + gust * 0.4);
			blit(s);
		}
	};
}

type Deck = {
	cx: number;
	cy: number;
	rad: number;
	tilt: number;
	pivotX: number;
	pivotY: number;
	armLen: number;
	label: number;
	sleeve: number;
	period: number;
	skipAt: number;
	bands: number[][];
	dust: number[][];
	feet: number[];
	grain: number;
	strobe: number;
};

function deckIdent(s: FxScene): Deck {
	const r = mulberry32(s.v.seed + 18211);
	const cx = 0.38 + r() * 0.12;
	const cy = 0.5 + r() * 0.06;
	const rad = 0.3 + r() * 0.06;
	const tilt = 0.32 + r() * 0.1;
	const pivotX = 0.84 + r() * 0.1;
	const pivotY = 0.2 + r() * 0.12;
	const armLen = 0.52 + r() * 0.1;
	const label = r();
	const sleeve = r();
	const period = 420 + ((r() * 260) | 0);
	const skipAt = 0.5 + r() * 0.16;
	const bands: number[][] = [];
	for (let i = 0; i < 5; i++) bands.push([0.24 + i * 0.14 + r() * 0.05, 0.02 + r() * 0.02]);
	const dust: number[][] = [];
	for (let i = 0; i < 16; i++) dust.push([r(), r(), 0.3 + r() * 0.9, r() * 6.28]);
	const feet: number[] = [r(), r()];
	const grain = (r() * 9999) | 0;
	const strobe = 40 + ((r() * 20) | 0);
	return { cx, cy, rad, tilt, pivotX, pivotY, armLen, label, sleeve, period, skipAt, bands, dust, feet, grain, strobe };
}

export function makeVinyl(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = deckIdent(s);
			(s as any).spin = 0;
			(s as any).rpm = 0;
			(s as any).jolt = 0;
			(s as any).kick = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Deck;
			const kick = (s as any).kick as number[][];
			const cx = Math.max(s.w * 0.33, s.w * id.cx + s.v.tilt * s.w * 0.02);
			const cy = s.h * id.cy;
			const sq = 0.46 + id.tilt * 0.22;
			const R = Math.min(s.w * 0.3, (s.h * 0.37) / sq);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cueIn = Math.min(1, Math.max(0, (cyc - 0.06) / 0.1));
			const cueOut = Math.min(1, Math.max(0, (cyc - 0.9) / 0.07));
			const onRecord = Math.max(0, cueIn - cueOut);
			const play = Math.min(1, Math.max(0, (cyc - 0.1) / 0.06)) * (1 - Math.min(1, Math.max(0, (cyc - 0.9) / 0.04)));
			const skip = cyc > id.skipAt && cyc < id.skipAt + 0.03 ? 1 - (cyc - id.skipAt) / 0.03 : 0;
			(s as any).rpm += (play - (s as any).rpm) * 0.045;
			const rpm = (s as any).rpm as number;
			(s as any).spin += rpm * 0.085 * s.v.speed * s.v.dir;
			const spin = (s as any).spin as number;
			(s as any).jolt = Math.max((s as any).jolt * 0.82, skip);
			const jolt = (s as any).jolt as number;
			const shake = jolt * Math.sin(s.t * 2.3) * 2.2;

			const px = Math.min(s.w - 5, cx + R * 1.24);
			const py = Math.max(5, cy - R * sq * 1.5);

			const [pl, plg, plb] = hsl(220 + (s.v.hue % 30), 8 + s.v.sat * 0.12, 11);
			const plx0 = Math.min(cx - R * 1.42, px - 7);
			const plx1 = Math.max(cx + R * 1.42, px + 7);
			const pcx = (plx0 + plx1) * 0.5;
			const phw = (plx1 - plx0) * 0.5;
			const ply0 = Math.max(0, py - 8);
			const ply1 = Math.min(s.h - 1, s.h * 0.94 + 2);
			for (let y = Math.floor(ply0); y <= ply1; y++) {
				const fy = (y - ply0) / Math.max(1, ply1 - ply0);
				const hw = phw * (0.94 + fy * 0.06);
				for (let x = Math.max(0, Math.floor(pcx - hw)); x < Math.min(s.w, Math.ceil(pcx + hw)); x++) {
					const ex = Math.min(1, (hw - Math.abs(x - pcx)) / 2.6) * Math.min(1, (y - ply0 + 1) / 2.4);
					if (ex <= 0) continue;
					const g2 = hash2m(x >> 1, y >> 1, id.grain) * 0.2;
					const sheen = Math.max(0, 1 - Math.abs((x - pcx) / (phw * 2) + 0.3 - fy * 0.2) / 0.34) ** 2;
					const k = 1.5 + g2 + sheen * 1.1 + (1 - fy) * 0.4;
					paint(s, x, y, pl * k + sheen * 26, plg * k + sheen * 28, plb * k + sheen * 34, ex);
				}
			}
			for (let x = Math.max(0, Math.floor(pcx - phw)); x < Math.min(s.w, Math.ceil(pcx + phw)); x++) {
				const ex = Math.min(1, (phw - Math.abs(x - pcx)) / 2.6);
				if (ex <= 0) continue;
				const yb = s.h * 0.94 + Math.sin(x * 0.02 + id.grain) * 0.6;
				for (let k = 0; k < 3; k++) paint(s, x, yb + k, 30, 32, 38, ex);
			}
			for (const f of id.feet) {
				const fx = pcx + (f - 0.5) * phw * 1.7;
				for (let dy = 0; dy < 4; dy++)
					for (let dx = -3; dx <= 3; dx++) {
						if (Math.hypot(dx / 3.4, dy / 4) > 1) continue;
						paint(s, fx + dx, s.h * 0.94 + dy, 18, 19, 22, 1);
					}
			}
			for (let dy = -4; dy <= 5; dy++)
				for (let dx = -4; dx <= 4; dx++) {
					const d = Math.hypot(dx / 4.2, dy / 4.6);
					if (d > 1) continue;
					const k = 0.6 + (1 - d) * 0.5 - dy / 9;
					paint(s, px + dx, py + dy, 96 * k, 100 * k, 110 * k, 1);
				}

			const shR = R * 1.06;
			for (let dy = -shR * sq; dy <= shR * sq + 5; dy++)
				for (let dx = -shR; dx <= shR; dx++) {
					const d = Math.hypot(dx / shR, (dy - 3) / (shR * sq + 3));
					if (d > 1) continue;
					paint(s, cx + dx, cy + dy, 0, 0, 0, (1 - d) * (1 - d) * 0.6);
				}

			const [mr, mg2, mb] = hsl(210 + (s.v.hue % 30), 6 + s.v.sat * 0.06, 22);
			const platR = R * 1.1;
			for (let dy = -platR * sq - 1; dy <= platR * sq + 4; dy++)
				for (let dx = -platR - 1; dx <= platR + 1; dx++) {
					const d = Math.hypot(dx / platR, dy / (platR * sq));
					if (d > 1.02) continue;
					const side = 1 + Math.max(0, -dy / (platR * sq)) * 0.5 - Math.max(0, dy / (platR * sq)) * 0.3;
					const k = (1.5 + (1 - d) * 0.5 - (dx / platR) * 0.3) * side;
					paint(s, cx + dx, cy + dy, mr * k, mg2 * k, mb * k, 1);
				}
			for (let a = 0; a < id.strobe * 2; a++) {
				const th = (a / (id.strobe * 2)) * 6.28 + spin * 0.4;
				const x = cx + Math.cos(th) * platR * 0.96;
				const y = cy + Math.sin(th) * platR * sq * 0.96;
				const bl = (a & 1) === 0 ? 1 : 0.18;
				paint(s, x, y, 70 + bl * 70, 74 + bl * 72, 86 + bl * 78, 0.8);
			}

			const [vr, vg, vb] = hsl(s.v.hue, 8 + s.v.sat * 0.1, 6);
			for (let dy = -R * sq - 1; dy <= R * sq + 1; dy++)
				for (let dx = -R - 1; dx <= R + 1; dx++) {
					const u = dx / R;
					const v = dy / (R * sq);
					const d = Math.hypot(u, v);
					if (d > 1) continue;
					const th = Math.atan2(v, u);
					const grooveN = Math.sin(d * 78 + id.grain * 0.01) * 0.5 + 0.5;
					let band = 0;
					for (const bd of id.bands) band = Math.max(band, Math.max(0, 1 - Math.abs(d - bd[0]) / bd[1]));
					const lit = Math.max(0, Math.cos(th - 0.5)) ** 6 + Math.max(0, Math.cos(th - 0.5 + 3.14)) ** 6;
					const wear = hash2m((dx * 3) | 0, (dy * 3) | 0, id.grain + 4) * 0.1;
					const k = 0.72 + grooveN * 0.3 + band * 0.55 + lit * 1.5 * (0.4 + rpm * 0.6) + wear;
					if (d < 0.3) continue;
					paint(s, cx + dx, cy + dy, vr * k + lit * 40, vg * k + lit * 40, vb * k + lit * 44, 1);
				}

			const [lr2, lg2, lb2] = hsl(id.label * 340, Math.max(58, s.v.sat), 44);
			for (let dy = -R * sq * 0.3 - 1; dy <= R * sq * 0.3 + 1; dy++)
				for (let dx = -R * 0.3 - 1; dx <= R * 0.3 + 1; dx++) {
					const d = Math.hypot(dx / (R * 0.3), dy / (R * sq * 0.3));
					if (d > 1) continue;
					const th = Math.atan2(dy / sq, dx) - spin;
					const print = Math.sin(th * 5) * 0.5 + 0.5;
					const ring = Math.max(0, 1 - Math.abs(d - 0.62) / 0.08);
					const k = 0.78 + (1 - d) * 0.3 + print * 0.22 * (d > 0.3 && d < 0.85 ? 1 : 0) + ring * 0.5;
					paint(s, cx + dx, cy + dy, lr2 * k, lg2 * k, lb2 * k, 1);
				}
			for (let dy = -2; dy <= 2; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					if (Math.hypot(dx / 1.4, dy / 2.2) > 1) continue;
					paint(s, cx + dx, cy + dy, 14, 14, 16, 1);
				}
			for (let k = 0; k < 6; k++) paint(s, cx, cy - k, 176 - k * 8, 180 - k * 8, 190 - k * 8, 1);

			const trackF = Math.min(1, Math.max(0, (cyc - 0.16) / 0.74));
			const restX = cx + R * 1.2;
			const restY = cy + R * sq * 0.5;
			const onX = cx + R * (0.9 - trackF * 0.62);
			const onY = cy + R * sq * (0.1 + trackF * 0.12);
			const tgX = restX + onRecord * (onX - restX);
			const tgY = restY + onRecord * (onY - restY);
			const lift = (1 - onRecord) * R * sq * 0.5;
			const tipX = tgX + jolt * 1.4;
			const tipY = tgY - lift + shake * 0.4;
			const AL = Math.hypot(px - tipX, py - tipY);
			const armA = Math.atan2(py - tipY, px - tipX);
			const cbX = px + Math.cos(armA) * AL * 0.26;
			const cbY = py + Math.sin(armA) * AL * 0.26;
			const steps = Math.ceil(AL * 2.4);
			for (let q = 0; q <= steps; q++) {
				const f = q / steps;
				const x = px + (tipX - px) * f;
				const y = py + (tipY - py) * f;
				for (let t = -1; t <= 1; t++) {
					const k = 0.5 + (t < 0 ? 0.42 : t > 0 ? -0.18 : 0.12);
					paint(s, x, y + t, 130 * k, 134 * k, 144 * k, 1);
				}
			}
			for (let q = 0; q <= 40; q++) {
				const f = q / 40;
				const x = px + (cbX - px) * f;
				const y = py + (cbY - py) * f;
				for (let t = -1; t <= 1; t++) paint(s, x, y + t, 108 + t * -18, 112 + t * -18, 122 + t * -18, 1);
			}
			for (let dy = -2.6; dy <= 2.6; dy++)
				for (let dx = -2.6; dx <= 2.6; dx++) {
					if (Math.hypot(dx / 2.6, dy / 2.6) > 1) continue;
					const k = 0.6 + Math.max(0, -dy / 2.6) * 0.5;
					paint(s, cbX + dx, cbY + dy, 62 * k, 64 * k, 70 * k, 1);
				}
			const hdx = tipX + Math.cos(armA) * 4;
			for (let dy = -2; dy <= 3; dy++)
				for (let dx = -3; dx <= 3; dx++) {
					const k = 0.7 + Math.max(0, -dy / 3) * 0.5;
					paint(s, hdx + dx, tipY + dy - 1, 34 * k + id.sleeve * 26, 36 * k, 42 * k, 1);
				}
			for (let k = 0; k < 3; k++) paint(s, tipX, tipY + 1 + k, 190 - k * 40, 192 - k * 40, 200 - k * 40, 1);

			if (onRecord > 0.5 && rpm > 0.3) {
				const gl = 1 + jolt * 3;
				for (let dy = -3; dy <= 3; dy++)
					for (let dx = -3; dx <= 3; dx++) {
						const d = Math.hypot(dx, dy) / 3;
						if (d > 1) continue;
						plot(s, tipX, tipY + 2, 255, 240, 210, 0.3);
						plot(s, tipX + dx, tipY + 2 + dy, 255, 230, 190, (1 - d) * 0.14 * gl);
					}
				if (s.rnd() < 0.18 + jolt) kick.push([tipX, tipY + 2, (s.rnd() - 0.5) * 1.4, -(0.2 + s.rnd() * 0.7), 0]);
			}
			for (let k = kick.length - 1; k >= 0; k--) {
				const kk = kick[k];
				kk[4] += 1;
				kk[0] += kk[2] * 0.5;
				kk[1] += kk[3];
				kk[3] += 0.008;
				if (kk[4] > 50) {
					kick.splice(k, 1);
					continue;
				}
				plot(s, kk[0], kk[1], 220, 216, 206, (1 - kk[4] / 50) ** 1.6 * 0.6);
			}

			if (jolt > 0.03) {
				const yb = cy - R * sq - 3;
				for (let q = 0; q < 3; q++) {
					const rr = R * (0.4 + q * 0.3) * (1 + jolt);
					for (let a2 = 0; a2 < 6.28; a2 += 0.14) {
						const x = tipX + Math.cos(a2) * rr;
						const y = tipY + Math.sin(a2) * rr * sq;
						plot(s, x, y, 255, 200, 160, jolt * (1 - q / 3) * 0.28);
					}
				}
				for (let x = 0; x < s.w; x++) {
					const wv = Math.sin(x * 0.3 + s.t * 0.9) * jolt * 4;
					plot(s, x, yb + wv, 255, 210, 170, jolt * 0.5);
				}
			}

			for (const [dx0, dy0, dsp, dph] of id.dust) {
				const x = ((dx0 + s.t * 0.0004 * dsp * s.v.speed * s.v.dir) % 1) * s.w;
				const y = dy0 * s.h + Math.sin(s.t * 0.02 * dsp + dph) * 5 * s.v.drift;
				const tw = 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 0.05 * dsp + dph));
				plot(s, x, y, 230, 230, 236, tw * 0.3 * edge(x, 0, s.w, s.w * 0.14));
			}

			s.out = Math.min(1, rpm * 0.55 + jolt * 0.7 + onRecord * 0.2);
			blit(s);
		}
	};
}

type Tank = {
	surface: number;
	bedY: number;
	plants: number[][];
	rocks: number[][];
	pebbles: number[][];
	stoneX: number;
	period: number;
	feedAt: number;
	school: number[][];
	tone: number;
	rockX: number;
	rockW: number;
	grain: number;
};

function tankIdent(s: FxScene): Tank {
	const r = mulberry32(s.v.seed + 19207);
	const surface = 0.1 + r() * 0.06;
	const bedY = 0.78 + r() * 0.06;
	const plants: number[][] = [];
	for (let i = 0; i < 7; i++) plants.push([r(), 0.2 + r() * 0.36, 3 + ((r() * 4) | 0), r() * 6.28, 0.6 + r() * 0.8]);
	const rocks: number[][] = [];
	for (let i = 0; i < 4; i++) rocks.push([r(), 0.02 + r() * 0.05, r() * 6.28, r()]);
	const pebbles: number[][] = [];
	for (let i = 0; i < 26; i++) pebbles.push([r(), r(), r(), r()]);
	const stoneX = 0.1 + r() * 0.8;
	const period = 400 + ((r() * 240) | 0);
	const feedAt = 0.3 + r() * 0.2;
	const school: number[][] = [];
	for (let i = 0; i < 9; i++) school.push([r(), 0.2 + r() * 0.5, r() < 0.5 ? -1 : 1, 0.6 + r() * 0.8, r() * 6.28, r()]);
	const tone = r();
	const rockX = 0.14 + r() * 0.66;
	const rockW = 0.1 + r() * 0.07;
	const grain = (r() * 9999) | 0;
	return { surface, bedY, plants, rocks, pebbles, stoneX, period, feedAt, school, tone, rockX, rockW, grain };
}

function drawFish(s: FxScene, x: number, y: number, dir: number, sz: number, wag: number, tone: number, lit: number) {
	const bl = sz * 3.2;
	const bh = sz * 1.5;
	const [fr, fg, fb] = hsl(14 + tone * 44, 72, 42 + lit * 16);
	const [dr2, dg2, db2] = hsl(14 + tone * 44, 66, 22 + lit * 10);
	for (let dy = -bh - 2; dy <= bh + 2; dy++)
		for (let dx = -bl - 3; dx <= bl + 3; dx++) {
			const u = dx / bl;
			const v = dy / bh;
			let inside = false;
			let shade = 0;
			if (u > -1 && u < 0.72) {
				const prof = Math.sqrt(Math.max(0, 1 - ((u - 0.05) / 0.82) ** 2)) * (u < 0 ? 1 : 1 - u * 0.3);
				if (Math.abs(v) <= prof) {
					inside = true;
					shade = 0.4 + (1 - Math.abs(v) / (prof + 0.01)) * 0.4 + Math.max(0, -v) * 0.45;
				}
			}
			if (!inside && u > 0.6) {
				const tu = (u - 0.6) / 0.55;
				const swing = Math.sin(wag) * tu * 0.7;
				if (tu <= 1 && Math.abs(v - swing) <= 0.25 + tu * 1.05) {
					inside = true;
					shade = 0.3 + (1 - tu) * 0.4;
				}
			}
			if (!inside) continue;
			const stripe = Math.sin(u * 9 + tone * 6) > 0.62 ? 0.78 : 1;
			const k = shade * stripe;
			paint(s, x - dx * dir, y + dy, fr * k + dr2 * (1 - k) * 0.5, fg * k + dg2 * (1 - k) * 0.5, fb * k + db2 * (1 - k) * 0.5, 1);
		}
	const fy = y + bh * 0.72;
	for (let dx = -bl * 0.2; dx <= bl * 0.4; dx++) {
		const h = (1 - Math.abs(dx - bl * 0.1) / (bl * 0.34)) * bh * 0.7;
		for (let dy = 0; dy < h; dy++) paint(s, x - dx * dir, fy + dy, dr2 * 1.3, dg2 * 1.3, db2 * 1.3, 0.85);
	}
	for (let dx = -bl * 0.1; dx <= bl * 0.35; dx++) {
		const h = (1 - Math.abs(dx - bl * 0.1) / (bl * 0.3)) * bh * 0.85;
		for (let dy = 0; dy < h; dy++) paint(s, x - dx * dir, y - bh * 0.72 - dy, dr2 * 1.15, dg2 * 1.15, db2 * 1.15, 0.85);
	}
	const ex = x + bl * 0.58 * dir;
	paint(s, ex, y - bh * 0.18, 244, 240, 236, 1);
	paint(s, ex + 0.6 * dir, y - bh * 0.18, 18, 16, 20, 1);
}

export function makeFishtank(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = tankIdent(s);
			(s as any).id = id;
			(s as any).fish = id.school.map((f) => [f[0] * s.w, f[1] * s.h, f[2] * (0.3 + f[3] * 0.4), 0, f[3], f[4], f[5], 0]);
			(s as any).flakes = [] as number[][];
			(s as any).bub = [] as number[][];
			(s as any).ripples = [] as number[][];
			(s as any).lastFeed = -1;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Tank;
			const fish = (s as any).fish as number[][];
			const flakes = (s as any).flakes as number[][];
			const bub = (s as any).bub as number[][];
			const ripples = (s as any).ripples as number[][];

			const surf = Math.round(s.h * id.surface);
			const bed = Math.round(s.h * id.bedY);
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);
			const feeding = cyc > id.feedAt && cyc < id.feedAt + 0.06;

			for (let y = surf; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const dep = Math.max(0, (y - surf) / Math.max(1, bed - surf));
					const caus =
						Math.sin(x * 0.18 + s.t * 0.035 * s.v.speed + Math.sin(y * 0.1) * 1.4) * 0.5 +
						0.5 +
						(Math.sin(x * 0.07 - s.t * 0.021 * s.v.speed + y * 0.05) * 0.5 + 0.5) * 0.6;
					const beam = Math.max(0, 1 - dep * 1.15) * Math.max(0, caus - 0.72);
					if (beam > 0.01) plot(s, x, y, 90, 180, 220, beam * 0.5);
				}

			const [gr2, gg2, gb2] = hsl(34 + (s.v.hue % 20), 18 + s.v.sat * 0.14, 34);
			for (let y = bed; y < s.h; y++) {
				const f = (y - bed) / Math.max(1, s.h - bed);
				for (let x = 0; x < s.w; x++) {
					const n = hash2m(x, y, id.grain + 3);
					const n2 = hash2m(x >> 1, y >> 1, id.grain + 8);
					const k = 0.66 + n * 0.5 + n2 * 0.3 - f * 0.3;
					paint(s, x, y, gr2 * k, gg2 * k * 0.96, gb2 * k * 0.82, 1);
				}
			}
			for (let x = 0; x < s.w; x++) {
				const hgt = Math.sin(x * 0.2 + id.grain) * 1.2 + Math.sin(x * 0.07) * 1.4;
				for (let k = 0; k < 3; k++) {
					const n = hash2m(x, k, id.grain + 11);
					paint(s, x, bed + hgt - k, gr2 * (1.2 + n * 0.5), gg2 * (1.2 + n * 0.5), gb2 * (1.1 + n * 0.4), 1);
				}
			}
			for (const [px0, py0, pz, pk] of id.pebbles) {
				const x = px0 * s.w;
				const y = bed + 1 + py0 * Math.max(2, s.h - bed - 2);
				const rr = 0.8 + pz * 1.4;
				for (let dy = -rr; dy <= rr; dy++)
					for (let dx = -rr - 1; dx <= rr + 1; dx++) {
						if (Math.hypot(dx / (rr * 1.3), dy / rr) > 1) continue;
						const lit = 0.7 + Math.max(0, -dy / rr) * 0.6 + pk * 0.3;
						paint(s, x + dx, y + dy, gr2 * lit * 1.1, gg2 * lit * 1.05, gb2 * lit, 1);
					}
			}

			const rx = id.rockX * s.w;
			const rw = id.rockW * s.w;
			const rh = (bed - surf) * 0.3;
			for (let dy = 0; dy <= rh; dy++) {
				const f = dy / rh;
				const half = rw * (0.3 + f * 0.7) * (1 + Math.sin(f * 6 + id.grain) * 0.1);
				for (let dx = -half; dx <= half; dx++) {
					const u = dx / half;
					const n = hash2m(rx + dx, bed - dy, id.grain + 21);
					const k = 0.24 + Math.max(0, -u) * 0.4 + n * 0.26 + (1 - f) * 0.16;
					paint(s, rx + dx, bed - rh + dy, 74 + 96 * k, 76 + 96 * k, 78 + 100 * k, 1);
				}
			}

			const sway = Math.sin(s.t * 0.018 * s.v.speed) * 0.5 + Math.sin(s.t * 0.031) * 0.3;
			for (const [px0, ph, blades, pph, pk] of id.plants) {
				const bx = px0 * s.w;
				const H = ph * (bed - surf);
				const [plr, plg, plb] = hsl(92 + pk * 22 + (s.v.hue % 14), 46 + s.v.sat * 0.16, 22 + pk * 9);
				for (let b = 0; b < blades; b++) {
					const off = (b / blades - 0.5) * rw * 0.6;
					const lean = (b / blades - 0.5) * 2;
					const len = H * (0.6 + (((b * 37) % 11) / 11) * 0.5);
					for (let k = 0; k < len; k += 0.5) {
						const f = k / len;
						const bend = (sway * s.v.drift * 0.9 + Math.sin(pph + b) * 0.3) * f * f * 3.2 + lean * f * 1.8;
						const x = bx + off + bend;
						const y = bed - k;
						const wdt = Math.max(0.6, 1.5 * (1 - f * 0.6));
						for (let dx = -wdt; dx <= wdt; dx++) {
							const e = 1 - Math.abs(dx) / (wdt + 0.4);
							const shine = Math.max(0, 1 - Math.abs(dx + 0.6) / 1.2);
							const kk = 0.6 + e * 0.5 + shine * 0.4 + f * 0.24;
							paint(s, x + dx, y, plr * kk, plg * kk, plb * kk, 1);
						}
					}
				}
			}

			if (feeding && (s as any).lastFeed !== cycle) {
				(s as any).lastFeed = cycle;
				for (let q = 0; q < 12; q++) flakes.push([s.rnd() * s.w * 0.7 + s.w * 0.15, surf + 1, (s.rnd() - 0.5) * 0.2, 0.1 + s.rnd() * 0.12, s.rnd() * 6.28, 1]);
			}

			const sx = id.stoneX * s.w;
			if (s.rnd() < 0.55) bub.push([sx + (s.rnd() - 0.5) * 3, bed - 1, 0.3 + s.rnd() * 0.5, s.rnd() * 6.28]);
			for (let k = bub.length - 1; k >= 0; k--) {
				const b = bub[k];
				b[1] -= 0.36 + b[2] * 0.4;
				b[3] += 0.13;
				if (b[1] <= surf + 1) {
					ripples.push([b[0], 0, 1]);
					if (ripples.length > 8) ripples.shift();
					bub.splice(k, 1);
					continue;
				}
				const x = b[0] + Math.sin(b[3]) * 1.5 * s.v.drift;
				const rr = 0.6 + b[2] * 1.4;
				for (let dy = -rr; dy <= rr; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx, dy) / rr;
						if (d > 1) continue;
						plot(s, x + dx, b[1] + dy, 180, 228, 244, (d > 0.66 ? 0.6 : 0.16) * edge(b[1], surf, s.h, 8));
					}
				plot(s, x - rr * 0.4, b[1] - rr * 0.4, 255, 255, 255, 0.55);
			}
			for (let k = 0; k < 4; k++) {
				const n = hash2m(k, 0, id.grain + 30);
				for (let dx = -2; dx <= 2; dx++) paint(s, sx + dx + (n - 0.5) * 2, bed - k, 40 + n * 30, 42 + n * 26, 44 + n * 24, 1);
			}

			for (let k = flakes.length - 1; k >= 0; k--) {
				const fl = flakes[k];
				fl[4] += 0.2;
				fl[0] += fl[2] + Math.sin(fl[4]) * 0.22 * s.v.drift;
				fl[1] += fl[3];
				if (fl[1] > bed - 1) {
					flakes.splice(k, 1);
					continue;
				}
				const sz = 0.9 + Math.abs(Math.sin(fl[4])) * 0.7;
				const [flr, flg, flb] = hsl(46, 34, 66);
				for (let dy = -sz; dy <= sz; dy++)
					for (let dx = -sz * 1.4; dx <= sz * 1.4; dx++) {
						if (Math.hypot(dx / (sz * 1.4), dy / sz) > 1) continue;
						paint(s, fl[0] + dx, fl[1] + dy, flr, flg, flb * 0.86, 1);
					}
			}

			let excite = 0;
			for (let i = 0; i < fish.length; i++) {
				const f = fish[i];
				const sd = id.school[i];
				let tx = -1;
				let tyy = 0;
				let best = 1e9;
				for (const fl of flakes) {
					const d = Math.hypot(fl[0] - f[0], fl[1] - f[1]);
					if (d < best) {
						best = d;
						tx = fl[0];
						tyy = fl[1];
					}
				}
				const hungry = tx >= 0 && best < s.w * 0.9;
				if (hungry) {
					excite += 1;
					const ax = (tx - f[0]) / (best + 1);
					const ay = (tyy - f[1]) / (best + 1);
					f[2] += ax * 0.16;
					f[3] += ay * 0.14;
					if (best < 3) {
						for (let k = flakes.length - 1; k >= 0; k--) if (Math.abs(flakes[k][0] - tx) < 0.01 && Math.abs(flakes[k][1] - tyy) < 0.01) flakes.splice(k, 1);
						f[7] = 8;
						for (let q = 0; q < 4; q++) bub.push([f[0], f[1], 0.1 + s.rnd() * 0.2, s.rnd() * 6.28]);
					}
				} else {
					const cruise = sd[2] * (0.24 + sd[3] * 0.34) * s.v.speed;
					f[2] += (cruise - f[2]) * 0.03;
					const home = s.h * (0.24 + sd[1] * 0.46);
					f[3] += ((home - f[1]) * 0.004 + Math.sin(s.t * 0.02 * sd[3] + sd[4]) * 0.02 - f[3] * 0.06) * 1.2;
				}
				f[2] = Math.max(-1.7, Math.min(1.7, f[2]));
				f[3] = Math.max(-1.1, Math.min(1.1, f[3]));
				f[0] += f[2];
				f[1] += f[3];
				if (f[0] < 3) {
					f[0] = 3;
					f[2] = Math.abs(f[2]);
				}
				if (f[0] > s.w - 3) {
					f[0] = s.w - 3;
					f[2] = -Math.abs(f[2]);
				}
				const lo = surf + 4;
				const hi = bed - 4;
				if (f[1] < lo) {
					f[1] = lo;
					f[3] = Math.abs(f[3]) * 0.4;
				}
				if (f[1] > hi) {
					f[1] = hi;
					f[3] = -Math.abs(f[3]) * 0.4;
				}
				if (f[7] > 0) f[7] -= 1;
				const spd = Math.abs(f[2]) + Math.abs(f[3]);
				const wag = s.t * (0.2 + spd * 0.5) * s.v.speed + sd[4];
				const dep = Math.max(0, 1 - (f[1] - surf) / Math.max(1, bed - surf));
				const shY = Math.min(s.h - 1, bed + 1);
				const shR = sd[3] * 4;
				for (let dx = -shR; dx <= shR; dx++) {
					const e = 1 - Math.abs(dx) / (shR + 0.5);
					paint(s, f[0] + dx, shY, 0, 0, 0, e * e * 0.3);
					paint(s, f[0] + dx, shY + 1, 0, 0, 0, e * e * 0.15);
				}
				drawFish(s, f[0], f[1], f[2] >= 0 ? 1 : -1, sd[3] * 1.5, wag, sd[5], dep * 0.6 + (f[7] > 0 ? 0.5 : 0));
			}

			for (let k = ripples.length - 1; k >= 0; k--) {
				const rp = ripples[k];
				rp[1] += 0.9 * s.v.speed;
				rp[2] *= 0.93;
				if (rp[2] < 0.04 || rp[1] > s.w) {
					ripples.splice(k, 1);
					continue;
				}
				for (let q = -1; q <= 1; q += 2) {
					const x = rp[0] + q * rp[1];
					for (let dy = 0; dy < 2; dy++) plot(s, x, surf + dy, 200, 240, 255, rp[2] * (1 - dy * 0.5) * 0.7);
				}
			}
			for (let x = 0; x < s.w; x++) {
				const w2 = Math.sin(x * 0.22 + s.t * 0.05 * s.v.speed) * 0.7 + Math.sin(x * 0.09 - s.t * 0.03) * 0.6;
				for (let k = 0; k < 2; k++) plot(s, x, surf + w2 + k, 200, 244, 255, (0.4 - k * 0.2) * 0.8);
				for (let k = 1; k < 4; k++) plot(s, x, surf + w2 - k, 140, 210, 240, 0.12 * (1 - k / 4));
			}

			for (let y = surf; y < s.h; y++) {
				const f = 1 - (y - surf) / Math.max(1, s.h - surf);
				for (let q = 0; q < 2; q++) {
					plot(s, q, y, 150, 200, 220, (0.16 - q * 0.08) * f);
					plot(s, s.w - 1 - q, y, 150, 200, 220, (0.16 - q * 0.08) * f);
				}
			}

			s.out = Math.min(1, excite / 5 + flakes.length * 0.05 + 0.18);
			blit(s);
		}
	};
}

type Pop = {
	panL: number;
	panR: number;
	rimY: number;
	panBot: number;
	handle: number;
	kernels: number[][];
	burners: number[][];
	tiles: number[];
	period: number;
	tone: number;
	grain: number;
};

function popIdent(s: FxScene): Pop {
	const r = mulberry32(s.v.seed + 20359);
	const wide = 0.3 + r() * 0.12;
	const mid = 0.46 + r() * 0.1;
	const panL = mid - wide;
	const panR = mid + wide;
	const rimY = 0.5 + r() * 0.08;
	const panBot = 0.66 + r() * 0.04;
	const handle = r() < 0.5 ? -1 : 1;
	const kernels: number[][] = [];
	for (let i = 0; i < 16; i++) kernels.push([0.1 + r() * 0.8, r(), 0.18 + r() * 0.74, r(), r() * 6.28]);
	const burners: number[][] = [];
	for (let i = 0; i < 6; i++) burners.push([r(), 0.5 + r() * 0.6, r() * 6.28]);
	const tiles: number[] = [];
	for (let i = 0; i < 8; i++) tiles.push(r());
	const period = 460 + ((r() * 220) | 0);
	const tone = r();
	const grain = (r() * 9999) | 0;
	return { panL, panR, rimY, panBot, handle, kernels, burners, tiles, period, tone, grain };
}

function drawPuff(s: FxScene, x: number, y: number, sz: number, lobes: number[], rot: number, lit: number) {
	for (let l = 0; l < 5; l++) {
		const a = lobes[l * 3] + rot;
		const d = lobes[l * 3 + 1] * sz;
		const rr = lobes[l * 3 + 2] * sz;
		const lx = x + Math.cos(a) * d;
		const ly = y + Math.sin(a) * d;
		for (let dy = -rr - 1; dy <= rr + 1; dy++)
			for (let dx = -rr - 1; dx <= rr + 1; dx++) {
				const q = Math.hypot(dx, dy) / (rr + 0.4);
				if (q > 1) continue;
				const up = Math.max(0, -(dy + ly - y) / (sz * 1.6));
				const k = 0.6 + up * 0.44 + (1 - q) * 0.22 + lit * 0.3;
				paint(s, lx + dx, ly + dy, 246 * k, 236 * k, 206 * k, 1);
			}
	}
	for (let l = 0; l < 2; l++) {
		const a = lobes[l * 3] + rot + 1.1;
		paint(s, x + Math.cos(a) * sz * 0.5, y + Math.sin(a) * sz * 0.5, 232, 188, 96, 0.55);
	}
}

export function makePopcorn(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = popIdent(s);
			(s as any).id = id;
			(s as any).state = id.kernels.map(() => 0);
			(s as any).puffs = [] as number[][];
			(s as any).shards = [] as number[][];
			(s as any).pile = new Float32Array(s.w);
			(s as any).cycleAt = -1;
			(s as any).kick = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Pop;
			const st = (s as any).state as number[];
			const puffs = (s as any).puffs as number[][];
			const shards = (s as any).shards as number[][];
			const pile = (s as any).pile as Float32Array;

			const pl = Math.round(s.w * id.panL);
			const pr = Math.round(s.w * id.panR);
			const rim = Math.round(s.h * id.rimY);
			const bot = Math.round(s.h * id.panBot);
			const counter = Math.min(s.h - 2, bot + Math.round(s.h * 0.17));
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);
			if ((s as any).cycleAt !== cycle) {
				(s as any).cycleAt = cycle;
				for (let i = 0; i < st.length; i++) st[i] = 0;
				puffs.length = 0;
				shards.length = 0;
				pile.fill(0);
			}
			const heat = cyc < 0.1 ? cyc / 0.1 : cyc < 0.82 ? 1 : Math.max(0, 1 - (cyc - 0.82) / 0.1);
			const cook = Math.min(1, Math.max(0, (cyc - 0.12) / 0.62));

			const panCx = (pl + pr) * 0.5;
			for (let y = 0; y < counter; y++) {
				const warmR = s.w * 0.52;
				for (let x = Math.max(0, Math.floor(panCx - warmR)); x < Math.min(s.w, Math.ceil(panCx + warmR)); x++) {
					const warm = Math.max(0, 1 - Math.hypot((x - panCx) / warmR, (y - bot) / (s.h * 0.62)));
					if (warm <= 0) continue;
					plot(s, x, y, 255, 152, 58, warm * warm * heat * 0.3);
				}
			}
			const ctw = (pr - pl) * 1.22;
			for (let y = counter; y < s.h; y++) {
				const f = (y - counter) / Math.max(1, s.h - counter);
				const hw = ctw * (0.5 + f * 0.12);
				for (let x = Math.max(0, Math.floor(panCx - hw)); x < Math.min(s.w, Math.ceil(panCx + hw)); x++) {
					const ex = Math.min(1, (hw - Math.abs(x - panCx)) / 3);
					if (ex <= 0) continue;
					const g = hash2m(x, y, id.grain + 5) * 0.2;
					const k = 0.9 - f * 0.45 + g;
					paint(s, x, y, 58 * k + heat * 22, 54 * k + heat * 9, 50 * k, ex);
					if (y === counter) paint(s, x, y, 132, 124, 114, ex * 0.7);
				}
			}

			const [mr, mg, mb] = hsl(208 + (s.v.hue % 26), 5 + s.v.sat * 0.05, 30);
			const wall = 2;
			for (let y = rim; y <= bot + 2; y++) {
				const f = (y - rim) / Math.max(1, bot - rim);
				const round = Math.max(0, (y - bot) / 3);
				const inset = round * round * 3;
				for (let x = pl + wall + inset; x <= pr - wall - inset; x++) {
					const u = (x - pl) / Math.max(1, pr - pl);
					const g = hash2m(x, y, id.grain + 9) * 0.14;
					const k = 0.12 + Math.max(0, 1 - f * 3.4) * 0.16 + Math.max(0, 1 - Math.abs(u - 0.3) / 0.36) * 0.06 + g * 0.5 + f * f * 0.5;
					const em = f * f * heat;
					paint(s, x, y, mr * k * 0.8 + em * 40, mg * k * 0.8 + em * 15, mb * k * 0.9 + em * 5, 1);
				}
			}
			for (let y = rim; y <= bot + 2; y++) {
				const f = (y - rim) / Math.max(1, bot - rim);
				const round = Math.max(0, (y - bot) / 3);
				const inset = round * round * 3;
				for (let q = 0; q < wall; q++) {
					const kL = 1.5 - q * 0.3 + (1 - f) * 0.3;
					const kR = 0.66 + q * 0.12;
					paint(s, pl + q + inset, y, mr * kL, mg * kL, mb * kL, 1);
					paint(s, pr - q - inset, y, mr * kR, mg * kR, mb * kR, 1);
				}
			}
			for (let x = pl; x <= pr; x++) {
				const u = (x - pl) / Math.max(1, pr - pl);
				const dip = Math.sin(u * Math.PI) * 2.2;
				for (let q = 0; q < 3; q++) {
					const y = bot + dip - q;
					const glow = heat * Math.max(0, 1 - q / 3);
					const k = 0.7 + Math.sin(u * 3.1) * 0.18;
					paint(s, x, y, mr * k + glow * 52, mg * k + glow * 24, mb * k + glow * 10, 1);
				}
			}
			for (let q = 0; q < 2; q++) {
				for (let x = pl - 2; x <= pr + 2; x++) {
					const spec = Math.max(0, 1 - Math.abs((x - pl) / (pr - pl) - 0.3) / 0.28) ** 3;
					const k = 0.9 + spec * 1.5 - q * 0.4;
					paint(s, x, rim + q, mr * k, mg * k, mb * k, 1);
				}
			}
			const hx = id.handle > 0 ? pr + 2 : pl - 2;
			for (let k = 0; k < s.w * 0.14; k++) {
				const x = hx + k * id.handle;
				const y = rim + 1 + Math.sin((k / (s.w * 0.14)) * 1.2) * 2.4;
				for (let dy = 0; dy < 3; dy++) paint(s, x, y + dy, 30 + dy * 8, 28 + dy * 7, 28 + dy * 7, 1);
				paint(s, x, y - 1, 92, 88, 86, 0.8);
			}

			for (let x = pl - 3; x <= pr + 3; x++) {
				for (let q = 0; q < 2; q++) paint(s, x, counter - 1 - q, 44 + q * 14, 42 + q * 13, 44 + q * 14, 1);
			}
			for (const [bx, bh, bph] of id.burners) {
				const x0 = pl + 3 + bx * (pr - pl - 6);
				const fl = (0.5 + 0.5 * Math.sin(s.t * 0.34 * s.v.speed + bph)) * heat;
				const H = (counter - bot) * (0.7 + bh * 0.5) * (0.5 + fl * 0.7);
				for (let k = 0; k < H; k++) {
					const f = k / Math.max(1, H);
					const wdt = 2.2 * (1 - f * 0.8) + 0.4;
					for (let dx = -wdt; dx <= wdt; dx++) {
						const e = 1 - Math.abs(dx) / (wdt + 0.4);
						const y = counter - 2 - k + Math.sin(s.t * 0.3 + bph + f * 3) * 0.6;
						if (y <= bot + 3) continue;
						const blue = f < 0.5 ? 1 : 0;
						plot(s, x0 + dx, y, blue ? 70 : 255, blue ? 165 : 190 - f * 70, blue ? 255 : 70, e * e * (1 - f * 0.5) * heat * (blue ? 0.85 : 0.6));
					}
				}
				for (let dx = -2; dx <= 2; dx++) plot(s, x0 + dx, counter - 2, 150, 210, 255, (1 - Math.abs(dx) / 3) * heat * 0.5);
			}

			const oilY = bot - 1;
			for (let x = pl + wall; x <= pr - wall; x++) {
				const sh = 0.5 + 0.5 * Math.sin(x * 0.4 + s.t * 0.18 * s.v.speed);
				for (let q = 0; q < 2; q++) plot(s, x, oilY - q, 255, 208, 120, sh * heat * (0.3 - q * 0.12));
			}

			for (let i = 0; i < id.kernels.length; i++) {
				if (st[i]) continue;
				const kn = id.kernels[i];
				const kx = pl + wall + 1 + kn[0] * (pr - pl - wall * 2 - 2);
				const base = oilY - 1 - kn[1] * 1.5;
				const agit = heat * (0.4 + cook * 1.6);
				const jx = Math.sin(s.t * (0.4 + kn[3]) * s.v.speed + kn[4]) * agit * 1.3;
				const jy = Math.abs(Math.sin(s.t * (0.6 + kn[3] * 1.4) + kn[4] * 2)) * agit * 2.2;
				const x = kx + jx;
				const y = base - jy;
				if (cook > kn[2]) {
					st[i] = 1;
					const lob: number[] = [];
					for (let l = 0; l < 5; l++) lob.push(s.rnd() * 6.28, 0.3 + s.rnd() * 0.7, 0.42 + s.rnd() * 0.3);
					puffs.push([x, y, (s.rnd() - 0.5) * 1.6 * s.v.drift, -1.6 - s.rnd() * 1.5, s.rnd() * 6.28, (s.rnd() - 0.5) * 0.3, 1.9 + s.rnd() * 1.2, 0, ...lob]);
					for (let q = 0; q < 5; q++) shards.push([x, y, (s.rnd() - 0.5) * 2.4, -0.6 - s.rnd() * 1.8, 0, kn[3]]);
					(s as any).kick = 1;
					continue;
				}
				const near = Math.max(0, 1 - (kn[2] - cook) / 0.16);
				const [kr2, kg2, kb2] = hsl(34 + kn[3] * 12, 62, 22 + near * 22);
				for (let dy = -1; dy <= 1; dy++)
					for (let dx = -1; dx <= 1; dx++) {
						if (Math.abs(dx) + Math.abs(dy) > 1.4) continue;
						const k = dy < 0 ? 1.5 : 1;
						paint(s, x + dx, y + dy, kr2 * k + near * 60, kg2 * k + near * 18, kb2 * k, 1);
					}
			}

			for (let k = shards.length - 1; k >= 0; k--) {
				const sh = shards[k];
				sh[3] += 0.16;
				sh[0] += sh[2];
				sh[1] += sh[3];
				sh[4] += 1;
				if (sh[4] > 34 || sh[1] > counter) {
					shards.splice(k, 1);
					continue;
				}
				const a = 1 - sh[4] / 34;
				const [sr2, sg2, sb2] = hsl(36 + sh[5] * 14, 56, 40);
				paint(s, sh[0], sh[1], sr2, sg2, sb2, a);
			}

			let flying = 0;
			for (let k = puffs.length - 1; k >= 0; k--) {
				const pf = puffs[k];
				if (pf[7] === 0) {
					pf[3] += 0.14;
					pf[0] += pf[2] * s.v.speed;
					pf[1] += pf[3] * s.v.speed;
					pf[4] += pf[5];
					flying += 1;
					const px = Math.max(0, Math.min(s.w - 1, Math.round(pf[0])));
					const inside = pf[0] > pl + wall && pf[0] < pr - wall;
					if (!inside && pf[1] > rim && pf[3] > 0) {
						if (pf[0] >= pl - 1 && pf[0] <= pr + 1) pf[0] += pf[0] < (pl + pr) * 0.5 ? -1.4 : 1.4;
					}
					const floor = inside ? oilY : counter - 1;
					const rest = floor - pile[px];
					if (pf[1] >= rest && pf[3] > 0) {
						pf[1] = rest;
						if (Math.abs(pf[3]) > 1.1) {
							pf[3] *= -0.32;
							pf[2] *= 0.6;
						} else {
							pf[7] = 1;
							const half = Math.max(1, pf[6] * 1.1) | 0;
							if (inside && floor - pile[px] < rim + 3) {
								pf[7] = 0;
								pf[3] = -0.7;
								pf[2] = (pf[0] < (pl + pr) * 0.5 ? -1 : 1) * (0.8 + s.rnd() * 0.6);
							} else {
								for (let q = -half; q <= half; q++) {
									const xi = Math.max(0, Math.min(s.w - 1, px + q));
									pile[xi] = Math.max(pile[xi], floor - pf[1] + pf[6] * 1.1);
								}
							}
						}
					}
					if (pf[0] < -4 || pf[0] > s.w + 4 || pf[1] > s.h + 6) puffs.splice(k, 1);
				}
				const lit = pf[7] === 0 ? 0.28 : 0;
				drawPuff(s, pf[0], pf[1], pf[6], pf.slice(8), pf[4], lit);
			}
			if (puffs.length > 70) puffs.splice(0, puffs.length - 70);

			const steam = heat * (0.3 + flying * 0.12);
			for (let i = 0; i < 22; i++) {
				const ph = i * 1.7 + id.grain * 0.01;
				const rise = ((s.t * 0.5 * s.v.speed + i * 9) % (s.h * 0.9)) / (s.h * 0.9);
				const x = pl + (((i * 37) % 100) / 100) * (pr - pl) + Math.sin(rise * 4 + ph) * 4 * s.v.drift;
				const y = rim - rise * s.h * 0.5;
				if (y < 0) continue;
				const a = Math.sin(rise * Math.PI) * steam * 0.22;
				for (let dy = -1; dy <= 1; dy++)
					for (let dx = -1; dx <= 1; dx++) plot(s, x + dx, y + dy, 220, 226, 232, a * (Math.abs(dx) + Math.abs(dy) > 1 ? 0.3 : 1));
			}

			(s as any).kick *= 0.86;
			s.out = Math.min(1, heat * 0.28 + flying * 0.1 + (s as any).kick * 0.7);
			blit(s);
		}
	};
}

type Tick = {
	cx: number;
	caseW: number;
	caseH: number;
	baseY: number;
	dialR: number;
	dialY: number;
	gears: number[][];
	planks: number[];
	period: number;
	brass: number;
	wood: number;
	bellSide: number;
	pendLen: number;
	numerals: number;
	grain: number;
};

function clockIdent(s: FxScene): Tick {
	const r = mulberry32(s.v.seed + 21179);
	const cx = 0.42 + r() * 0.16;
	const caseW = 0.36 + r() * 0.08;
	const caseH = 0.72 + r() * 0.07;
	const baseY = 0.95;
	const dialR = 0.19 + r() * 0.04;
	const dialY = 0.42 + r() * 0.04;
	const gears: number[][] = [];
	for (let i = 0; i < 4; i++) gears.push([r(), r(), 0.3 + r() * 0.5, 8 + ((r() * 6) | 0), r() * 6.28]);
	const planks: number[] = [];
	for (let i = 0; i < 6; i++) planks.push(r());
	const period = 300 + ((r() * 200) | 0);
	const brass = r();
	const wood = r();
	const bellSide = r() < 0.5 ? -1 : 1;
	const pendLen = 0.6 + r() * 0.2;
	const numerals = r() < 0.5 ? 4 : 12;
	const grain = (r() * 9999) | 0;
	return { cx, caseW, caseH, baseY, dialR, dialY, gears, planks, period, brass, wood, bellSide, pendLen, numerals, grain };
}

export function makeClock(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			(s as any).id = clockIdent(s);
			(s as any).shake = 0;
			(s as any).dust = [] as number[][];
			(s as any).lastStrike = -1;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Tick;
			const dust = (s as any).dust as number[][];

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);
			const striking = cyc < 0.16;
			const strikes = striking ? Math.floor(cyc / 0.04) : -1;
			const hit = striking ? Math.max(0, 1 - ((cyc % 0.04) / 0.04) * 3.2) : 0;
			if (striking && (s as any).lastStrike !== cycle * 10 + strikes) {
				(s as any).lastStrike = cycle * 10 + strikes;
				(s as any).shake = 1;
				for (let q = 0; q < 6; q++)
					dust.push([s.w * (id.cx + (s.rnd() - 0.5) * id.caseW), s.h * (id.dialY - id.dialR), (s.rnd() - 0.5) * 0.3, 0.1 + s.rnd() * 0.2, 0]);
			}
			(s as any).shake *= 0.84;
			const shake = (s as any).shake as number;
			const sx = Math.sin(s.t * 3.1) * shake * 1.6;
			const sy = Math.sin(s.t * 4.3) * shake * 0.9;

			const bq = 0.84 + id.brass * 0.3;
			const ccx = s.w * id.cx + sx;
			const half = s.w * id.caseW * 0.5;
			const baseY = s.h * id.baseY + sy;
			const topY = baseY - s.h * id.caseH;
			const [cr2, cg2, cb2] = hsl(22 + id.wood * 16 + (s.v.hue % 14), 44 + s.v.sat * 0.14, 20);
			const domeR = half * 0.9;
			const domeY = topY + domeR;
			const halfAt = (y: number) => {
				if (y >= domeY) return half;
				const v = (domeY - y) / domeR;
				return v >= 1 ? -1 : half * Math.sqrt(Math.max(0, 1 - v * v * 0.82));
			};

			for (let dy = 0; dy < 5; dy++)
				for (let x = ccx - half - 4; x <= ccx + half + 4; x++) {
					const e = 1 - Math.abs(x - ccx) / (half + 5);
					paint(s, x + 3, baseY + dy - 2, 0, 0, 0, e * (1 - dy / 5) * 0.4);
				}
			for (let y = topY; y <= baseY; y++) {
				const ha = halfAt(y);
				if (ha < 0) continue;
				for (let x = ccx - ha; x <= ccx + ha; x++) {
					const u = (x - ccx) / ha;
					const gr3 = Math.sin((x - ccx) * 0.9 + (y - topY) * 0.08 + id.grain) * 0.1 + hash2m(x, y, id.grain + 4) * 0.12;
					const edgeK = Math.max(0, Math.abs(u) - 0.72) / 0.28;
					const k = 1.05 + gr3 - edgeK * edgeK * 0.5 + Math.max(0, 1 - Math.abs(u + 0.4) / 0.5) * 0.3;
					paint(s, x, y, cr2 * k, cg2 * k * 0.92, cb2 * k * 0.8, 1);
				}
				const lip = Math.abs(y - (baseY - s.h * 0.06)) < 1.5 || Math.abs(y - (domeY + domeR * 0.2)) < 1.2;
				if (lip) for (let x = ccx - ha - 2; x <= ccx + ha + 2; x++) paint(s, x, y, cr2 * 1.7, cg2 * 1.55, cb2 * 1.3, 1);
			}
			for (let y = baseY - s.h * 0.05; y <= baseY + 2; y++)
				for (let x = ccx - half - 3; x <= ccx + half + 3; x++) {
					const u = Math.abs(x - ccx) / (half + 3);
					const k = 1.2 + Math.max(0, 1 - Math.abs(u - 0.2)) * 0.24 - (y - baseY + s.h * 0.05) * 0.02;
					paint(s, x, y, cr2 * k, cg2 * k * 0.9, cb2 * k * 0.78, 1);
				}

			const bellR = half * 0.26;
			const bx = ccx + id.bellSide * half * 0.45;
			const by = topY - bellR * 0.55;
			const swing = hit * Math.sin(s.t * 2.2) * 1.4;
			for (let dy = -bellR; dy <= bellR * 0.9; dy++)
				for (let dx = -bellR - 1; dx <= bellR + 1; dx++) {
					const q = Math.hypot(dx / (bellR + 0.6), dy / bellR);
					if (q > 1 || (dy > 0.1 && Math.abs(dx) > bellR * 0.98)) continue;
					const lit = 0.6 + Math.max(0, -dx / bellR) * 0.5 + Math.max(0, -dy / bellR) * 0.3 + hit * 0.7;
					paint(s, bx + dx + swing, by + dy, 208 * lit * bq, 164 * lit * bq, 62 * lit * bq, 1);
				}
			for (let dx = -bellR; dx <= bellR; dx++) paint(s, bx + dx + swing, by + bellR * 0.9, 120, 92, 34, 1);
			if (hit > 0.05) {
				for (let k = 1; k < 5; k++) {
					const rr = bellR + k * 2.4 + hit * 4;
					for (let a = 0; a < 26; a++) {
						const th = (a / 26) * 6.28;
						plot(s, bx + Math.cos(th) * rr * 1.3, by + Math.sin(th) * rr, 255, 226, 160, hit * (1 - k / 5) * 0.34);
					}
				}
			}

			const dcx = ccx;
			const dcy = s.h * id.dialY + sy;
			const R = Math.min(s.w * 0.13, s.h * id.dialR);
			for (let dy = -R - 3; dy <= R + 3; dy++)
				for (let dx = -R - 3; dx <= R + 3; dx++) {
					const d = Math.hypot(dx, dy);
					if (d > R + 3) continue;
					if (d > R) {
						const rk = 0.9 + Math.max(0, -dy / R) * 0.7 + hit * 0.4;
						paint(s, dcx + dx, dcy + dy, 204 * rk * bq, 160 * rk * bq, 60 * rk * bq, 1);
						continue;
					}
					const shade = 0.82 + Math.max(0, -(dx + dy) / (R * 2)) * 0.2 - (d / R) * 0.12;
					paint(s, dcx + dx, dcy + dy, 236 * shade + hit * 22, 228 * shade + hit * 18, 206 * shade, 1);
				}
			for (let i = 0; i < 60; i++) {
				if (i % 5 === 0) continue;
				const th = (i / 60) * 6.28 - 1.5708;
				paint(s, dcx + Math.cos(th) * R * 0.84, dcy + Math.sin(th) * R * 0.84, 92, 84, 74, 0.7);
			}
			for (let i = 0; i < 12; i++) {
				const th = (i / 12) * 6.28 - 1.5708;
				const big = i % 3 === 0;
				const len = big ? R * 0.26 : R * 0.14;
				for (let k = 0; k < len; k += 0.5) {
					const rr = R * 0.86 - k;
					for (let q = 0; q < (big ? 2 : 1); q++) paint(s, dcx + Math.cos(th) * rr + q * 0.5, dcy + Math.sin(th) * rr, 40, 34, 28, 1);
				}
			}

			const mins = ((s.t * s.v.speed) % id.period) / id.period;
			const mAng = mins * 6.28 - 1.5708;
			const hAng = (Math.floor(mins * 12) / 12) * 6.28 - 1.5708;
			const hand = (ang: number, len: number, wdt: number, r2: number, g2: number, b2: number) => {
				for (let k = -2; k < len; k += 0.4) {
					const f = Math.max(0, k / len);
					const wd = wdt * (1 - f * 0.6);
					for (let q = -wd; q <= wd; q++) {
						const nx = -Math.sin(ang) * q;
						const ny = Math.cos(ang) * q;
						paint(s, dcx + Math.cos(ang) * k + nx, dcy + Math.sin(ang) * k + ny, r2, g2, b2, 1);
					}
				}
			};
			hand(mAng, R * 0.78, 0.7, 26, 22, 20);
			hand(hAng, R * 0.5, 1.1, 26, 22, 20);
			const sAng = s.t * 0.26 * s.v.speed - 1.5708;
			for (let k = -3; k < R * 0.82; k += 0.5) paint(s, dcx + Math.cos(sAng) * k, dcy + Math.sin(sAng) * k, 178 + hit * 60, 52, 38, 1);
			for (let dy = -1.6; dy <= 1.6; dy++)
				for (let dx = -1.6; dx <= 1.6; dx++) {
					if (Math.hypot(dx, dy) > 1.6) continue;
					paint(s, dcx + dx, dcy + dy, 190, 152, 60, 1);
				}
			for (let dy = -R; dy <= R; dy++)
				for (let dx = -R; dx <= R; dx++) {
					if (Math.hypot(dx, dy) > R) continue;
					const gl = Math.max(0, 1 - Math.abs(dx - dy * 0.6 + R * 0.4) / (R * 0.3));
					if (gl > 0) plot(s, dcx + dx, dcy + dy, 255, 255, 255, gl * gl * 0.08);
				}

			const wTop = dcy + R + s.h * 0.05;
			const wBot = baseY - s.h * 0.1;
			const wHalf = half * 0.6;
			if (wBot > wTop + 4) {
				for (let y = wTop; y <= wBot; y++)
					for (let x = ccx - wHalf; x <= ccx + wHalf; x++) {
						const f = (y - wTop) / (wBot - wTop);
						const g3 = hash2m(x, y, id.grain + 12) * 0.1;
						paint(s, x, y, (30 + f * 16) * (1 + g3), (24 + f * 12) * (1 + g3), (20 + f * 10) * (1 + g3), 1);
					}
				for (let g = 0; g < id.gears.length; g++) {
					const gd = id.gears[g];
					const gx = ccx + (gd[0] - 0.5) * wHalf * 1.5;
					const gy = wTop + gd[1] * (wBot - wTop);
					const gr4 = Math.max(2, (wBot - wTop) * 0.2 * (0.6 + gd[2] * 0.8));
					const rot = (s.t * 0.05 * s.v.speed * s.v.dir * (g % 2 ? -1 : 1) * 10) / gd[3] + gd[4];
					for (let a = 0; a < 56; a++) {
						const th = (a / 56) * 6.28;
						const tooth = Math.cos(th * gd[3] + rot) > 0.35 ? 1.22 : 1;
						const rr = gr4 * tooth;
						const x2 = gx + Math.cos(th) * rr;
						const y2 = gy + Math.sin(th) * rr;
						if (x2 < ccx - wHalf || x2 > ccx + wHalf || y2 < wTop || y2 > wBot) continue;
						const lit = 0.6 + Math.max(0, -Math.sin(th)) * 0.6;
						paint(s, x2, y2, 128 * lit * bq, 106 * lit * bq, 52 * lit * bq, 1);
					}
					for (let a = 0; a < 5; a++) {
						const th = rot + (a / 5) * 6.28;
						for (let k = 0; k < gr4; k += 0.6) {
							const x2 = gx + Math.cos(th) * k;
							const y2 = gy + Math.sin(th) * k;
							if (x2 < ccx - wHalf || x2 > ccx + wHalf || y2 < wTop || y2 > wBot) continue;
							paint(s, x2, y2, 112 * bq, 92 * bq, 46 * bq, 1);
						}
					}
				}
				const px = ccx;
				const py = wTop + 1;
				const L = (wBot - wTop) * id.pendLen;
				const ang = Math.sin(s.t * 0.09 * s.v.speed) * 0.42 * (0.7 + s.v.drift * 0.5) - 1.5708 + 1.5708;
				const th = 1.5708 + Math.sin(s.t * 0.09 * s.v.speed) * 0.42;
				const ex = px + Math.cos(th) * L;
				const ey = py + Math.sin(th) * L;
				for (let k = 0; k < L; k += 0.6) paint(s, px + Math.cos(th) * k, py + Math.sin(th) * k, 168, 140, 70, 1);
				const bobR = wHalf * 0.3;
				for (let dy = -bobR; dy <= bobR; dy++)
					for (let dx = -bobR; dx <= bobR; dx++) {
						if (Math.hypot(dx, dy) > bobR) continue;
						const lit = 0.7 + Math.max(0, -(dx + dy) / (bobR * 2)) * 0.7;
						paint(s, ex + dx, ey + dy, 212 * lit * bq, 168 * lit * bq, 64 * lit * bq, 1);
					}
				for (let y = wTop; y <= wBot; y++) {
					const gl = Math.max(0, 1 - Math.abs((y - wTop) / (wBot - wTop) - 0.25) / 0.3);
					for (let x = ccx - wHalf; x <= ccx + wHalf; x++) {
						const u = (x - ccx + wHalf) / (wHalf * 2);
						plot(s, x, y, 210, 226, 238, gl * Math.max(0, 1 - Math.abs(u - 0.28) / 0.22) * 0.18);
					}
				}
				for (let y = wTop - 1; y <= wBot + 1; y++)
					for (let q = 0; q < 2; q++) {
						paint(s, ccx - wHalf - q, y, 168, 138, 66, 1);
						paint(s, ccx + wHalf + q, y, 132, 106, 48, 1);
					}
				for (let x = ccx - wHalf - 1; x <= ccx + wHalf + 1; x++) {
					paint(s, x, wTop - 1, 172, 142, 68, 1);
					paint(s, x, wBot + 1, 132, 106, 48, 1);
				}
			}

			for (let k = dust.length - 1; k >= 0; k--) {
				const d = dust[k];
				d[0] += d[2];
				d[1] += d[3];
				d[4] += 1;
				if (d[4] > 44 || d[1] > s.h) {
					dust.splice(k, 1);
					continue;
				}
				plot(s, d[0], d[1], 220, 206, 176, (1 - d[4] / 44) * 0.4);
			}

			s.out = Math.min(1, hit * 0.9 + shake * 0.5 + 0.12);
			blit(s);
		}
	};
}

type Pane = {
	seeds: number[][];
	period: number;
	sweepDir: number;
	sweepY: number;
	tone: number;
	fogT: number;
	gustK: number;
	grain: number;
};

function paneIdent(s: FxScene): Pane {
	const r = mulberry32(s.v.seed + 22189);
	const seeds: number[][] = [];
	for (let i = 0; i < 34; i++) seeds.push([r(), r(), r(), r(), r()]);
	const period = 360 + ((r() * 260) | 0);
	const sweepDir = r() < 0.5 ? -1 : 1;
	const sweepY = 0.22 + r() * 0.46;
	const tone = r();
	const fogT = 0.22 + r() * 0.3;
	const gustK = 0.7 + r() * 0.9;
	const grain = (r() * 9999) | 0;
	return { seeds, period, sweepDir, sweepY, tone, fogT, gustK, grain };
}

export function makeRainglass(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = paneIdent(s);
			(s as any).id = id;
			const drops: number[][] = [];
			for (const q of id.seeds) drops.push([q[0] * s.w, q[1] * s.h, 0.3 + q[2] * q[2] * 1.7, 0, 1.5 + q[3] * q[3] * 2.4, q[4] * 6.28, 0]);
			(s as any).drops = drops;
			(s as any).cl = new Float32Array(s.w * s.h);
			(s as any).pool = new Float32Array(s.w);
			(s as any).acc = 0;
			(s as any).lastGust = -1;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Pane;
			const sw = s.w;
			const sh = s.h;
			const cl = (s as any).cl as Float32Array;
			const pool = (s as any).pool as Float32Array;
			const drops = (s as any).drops as number[][];

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);
			const sx = (id.sweepDir > 0 ? -0.4 + cyc * 1.8 : 1.4 - cyc * 1.8) * sw;
			const near = Math.max(0, 1 - Math.abs(cyc - 0.5) * 2.6);
			const beam = near * near;
			const gust = 0.5 + 0.5 * Math.sin(cyc * 12.56 + id.tone * 6.28);
			const rain = 0.4 + gust * id.gustK * 0.6 + beam * 0.5;
			const [glr, glg, glb] = hsl(28 + (s.v.hue % 30), 58, 58);
			const [cr, cg, cb] = hsl(s.v.hue2, 24 + s.v.sat * 0.2, 66);

			for (let i = 0; i < cl.length; i++) cl[i] *= 0.984;
			for (let x = 0; x < sw; x++) pool[x] *= 0.99;

			if (beam > 0.003) {
				const bw = sw * 0.32;
				const by = id.sweepY * sh;
				const x0 = Math.max(0, Math.round(sx - bw));
				const x1 = Math.min(sw - 1, Math.round(sx + bw));
				for (let x = x0; x <= x1; x++) {
					const fx = 1 - Math.abs(x - sx) / bw;
					if (fx <= 0) continue;
					for (let y = 0; y < sh; y++) {
						const fy = 1 - Math.min(1, Math.abs(y - by) / (sh * 0.96));
						if (fy <= 0) continue;
						const a = fx * fx * fy * beam * 0.26;
						plot(s, x, y, glr * a, glg * a, glb * a, 1);
					}
				}
			}

			for (let k = 0; k < 48; k++) {
				const col = ((k * 79) % 997) / 997;
				const far = 0.26 + ((k * 43) % 100) / 160;
				const sp = 0.5 + ((k * 29) % 100) / 90;
				const yy = (((s.t * sp * 0.05 * s.v.speed + col * 7.3) % 1) + 1) % 1;
				const xx = col * sw + s.v.tilt * yy * sw * 0.2 * s.v.dir;
				const len = 2 + far * 8;
				const hy = yy * (sh + len);
				for (let d2 = 0; d2 < len; d2++) {
					const fy = hy - d2;
					const a = far * (1 - d2 / len) * 0.26 * rain * edge(fy, -len, sh + len, len * 1.4);
					plot(s, xx - d2 * s.v.tilt * 0.7, fy, (cr + 60) * a, (cg + 70) * a, (cb + 90) * a, 1);
				}
			}

			const GX = 32;
			const GY = 17;
			const breathe = 0.7 + Math.sin(s.t * 0.023 * s.v.speed) * 0.3;
			for (let cy2 = 0; cy2 < GY; cy2++) {
				for (let cx2 = 0; cx2 < GX; cx2++) {
					const h1 = hash2m(cx2, cy2, id.grain);
					if (h1 > 0.34 + id.fogT) continue;
					const h2 = hash2m(cx2, cy2, id.grain + 7);
					const h3 = hash2m(cx2, cy2, id.grain + 13);
					const mx = ((cx2 + 0.15 + h2 * 0.7) / GX) * sw;
					const my = ((cy2 + 0.15 + h3 * 0.7) / GY) * sh;
					const xi = mx | 0;
					const yi = my | 0;
					if (xi < 0 || yi < 0 || xi >= sw || yi >= sh) continue;
					const wiped = Math.min(1, cl[yi * sw + xi] * 1.6);
					if (wiped > 0.92) continue;
					const tw = 0.55 + 0.45 * Math.sin(s.t * 0.04 * s.v.speed + h2 * 6.28);
					const a = (1 - wiped) * (0.2 + h3 * 0.28) * (0.6 + breathe * 0.4);
					paint(s, xi, yi, 26, 32, 46, a * 0.16);
					plot(s, xi, yi, 150 * tw, 172 * tw, 208 * tw, a * (0.3 + beam * 0.7));
					if (h1 < 0.1) {
						paint(s, xi + 1, yi, 24, 30, 44, a * 0.3);
						plot(s, xi, yi - 1, 170, 190, 220, a * 0.22);
					}
				}
			}

			(s as any).acc += rain * 0.16;
			while ((s as any).acc > 1) {
				(s as any).acc -= 1;
				if (drops.length > 74) break;
				const q0 = s.rnd();
				drops.push([s.rnd() * sw, s.rnd() * sh, 0.26 + q0 * q0 * 1.1, 0, 1.4 + s.rnd() ** 2 * 2.5, s.rnd() * 6.28, 0]);
			}
			if (cyc > 0.5 && (s as any).lastGust !== cycle) {
				(s as any).lastGust = cycle;
				for (let q = 0; q < 7; q++) drops.push([s.rnd() * sw, s.rnd() * sh * 0.9, 0.8 + s.rnd() * 1.5, 0, 1.4 + s.rnd() * 1.4, s.rnd() * 6.28, 0]);
			}

			const born: number[][] = [];
			let runners = 0;
			for (let k = drops.length - 1; k >= 0; k--) {
				const b = drops[k];
				if (!b[6]) {
					b[2] += 0.021 * rain * (0.3 + (b[5] % 1) * 1.4) * s.v.speed;
					if (b[2] > b[4]) b[6] = 1;
				} else {
					runners++;
					b[3] = Math.min(0.35 + b[2] * 1.1, b[3] + 0.07 * b[2]);
					b[1] += b[3] * s.v.speed;
					b[0] += Math.sin(b[1] * 0.3 + b[5]) * 0.2 + s.v.tilt * 0.07 * s.v.dir;
					b[2] *= 0.982;
					if (s.rnd() < 0.1) born.push([b[0] + (s.rnd() - 0.5), b[1] - b[2] - 1.2, 0.32 + s.rnd() * 0.32, 0, 1.6 + s.rnd() * 2, s.rnd() * 6.28, 0]);
					if (b[2] < 0.66) {
						b[6] = 0;
						b[3] = 0;
					}
					for (let j = drops.length - 1; j >= 0; j--) {
						if (j === k) continue;
						const e = drops[j];
						const reach = b[2] + e[2] + 0.5;
						if (Math.abs(e[0] - b[0]) > reach || Math.abs(e[1] - b[1]) > reach) continue;
						b[2] = Math.cbrt(b[2] * b[2] * b[2] + e[2] * e[2] * e[2]);
						b[0] = (b[0] * 2 + e[0]) / 3;
						drops.splice(j, 1);
						if (j < k) k--;
					}
				}
				if (b[0] < 0.6) b[0] = 0.6;
				if (b[0] > sw - 1.6) b[0] = sw - 1.6;
				const bi = Math.max(0, Math.min(sw - 1, b[0] | 0));
				if (b[1] > sh - 1.4) {
					pool[bi] += b[2] * 0.8;
					drops.splice(k, 1);
					continue;
				}
				if (b[6]) {
					const rr = b[2] + 0.7;
					const ry = rr * (1 + b[3] * 1.1);
					for (let dy = -ry; dy <= ry; dy++) {
						for (let dx = -rr; dx <= rr; dx++) {
							if ((dx / rr) ** 2 + (dy / ry) ** 2 > 1) continue;
							const xi = (b[0] + dx) | 0;
							const yi = (b[1] + dy) | 0;
							if (xi < 0 || yi < 0 || xi >= sw || yi >= sh) continue;
							if (cl[yi * sw + xi] < 1) cl[yi * sw + xi] = 1;
						}
					}
				}
			}
			for (const b of born) if (drops.length < 34) drops.push(b);

			for (let y = 0; y < sh; y++) {
				for (let x = 0; x < sw; x++) {
					const v = cl[y * sw + x];
					if (v < 0.05) continue;
					plot(s, x, y, 110 * v, 138 * v, 178 * v, 0.11 + beam * 0.16);
				}
			}

			for (const b of drops) {
				const rr = b[2] + 0.7;
				const ry = b[6] ? rr * (1 + b[3] * 1.1) : rr;
				if (b[6]) {
					const tl = Math.min(9, ry * 1.4 + b[3] * 2.6);
					for (let q = 1; q < tl; q++) {
						const f = q / tl;
						const wdt = rr * (1 - f) * 0.66;
						for (let dx = -wdt; dx <= wdt; dx++) {
							const e = 1 - Math.abs(dx) / (wdt + 0.4);
							const x2 = b[0] + dx;
							const y2 = b[1] - q;
							if (y2 < 0 || y2 >= sh) continue;
							plot(s, x2, y2, 128, 156, 196, e * (1 - f) * (0.16 + beam * 0.3));
						}
					}
				}
				for (let dy = -ry - 1; dy <= ry + 1; dy++) {
					for (let dx = -rr - 1; dx <= rr + 1; dx++) {
						const d = Math.hypot(dx / rr, dy / ry);
						if (d > 1.12) continue;
						const x2 = b[0] + dx;
						const y2 = b[1] + dy;
						if (x2 < 0 || y2 < 0 || x2 >= sw || y2 >= sh) continue;
						if (d > 0.9) {
							paint(s, x2, y2, 18, 22, 34, Math.min(1, (1.12 - d) / 0.22) * 0.3);
							continue;
						}
						const lens = d * d;
						if (lens > 0.35) paint(s, x2, y2, 24, 30, 44, (lens - 0.35) * 0.2);
						const caus = Math.max(0, (dy / ry) * 0.9 + 0.12 - Math.abs(dx / rr) * 0.55);
						if (caus > 0) plot(s, x2, y2, 160 + beam * 80, 180 + beam * 66, 206, caus * (0.24 + beam * 0.6));
					}
				}
				const hl = 0.5 + beam * 0.5;
				plot(s, b[0] - rr * 0.36, b[1] - ry * 0.42, 232, 240, 255, hl);
				if (rr > 1.6) {
					plot(s, b[0] - rr * 0.36 + 1, b[1] - ry * 0.42, 232, 240, 255, hl * 0.5);
					plot(s, b[0] - rr * 0.36, b[1] - ry * 0.42 + 1, 232, 240, 255, hl * 0.5);
				}
			}

			for (let x = 0; x < sw; x++) {
				const v = pool[x];
				if (v < 0.05) continue;
				const hgt = Math.min(3.6, v * 0.42);
				for (let q = 0; q < hgt; q++) {
					const y = sh - 1 - q;
					const f = q / Math.max(0.6, hgt);
					paint(s, x, y, 22, 28, 42, (0.22 + (1 - f) * 0.24) * Math.min(1, hgt - q));
					plot(s, x, y, 90, 118, 156, (1 - f) * 0.2);
				}
				const gleam = Math.max(0, Math.sin(x * 0.4 + s.t * 0.06 * s.v.speed));
				plot(s, x, sh - 1 - hgt, 220, 234, 255, Math.min(0.55, v * 0.12) * (0.4 + gleam * 0.6) + beam * 0.25);
			}

			s.out = Math.min(1, beam * 0.8 + runners * 0.05 + 0.1);
			blit(s);
		}
	};
}

const CUBE = [
	[1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
	[-1, 0, 0, 0, 0, 1, 0, 1, 0, 6],
	[0, 1, 0, 1, 0, 0, 0, 0, 1, 2],
	[0, -1, 0, 0, 0, 1, 1, 0, 0, 5],
	[0, 0, 1, 1, 0, 0, 0, 1, 0, 3],
	[0, 0, -1, 0, 1, 0, 1, 0, 0, 4]
];

const PIPS = [
	[0, 0],
	[-0.46, -0.46, 0.46, 0.46],
	[-0.46, -0.46, 0, 0, 0.46, 0.46],
	[-0.46, -0.46, 0.46, -0.46, -0.46, 0.46, 0.46, 0.46],
	[-0.46, -0.46, 0.46, -0.46, 0, 0, -0.46, 0.46, 0.46, 0.46],
	[-0.46, -0.46, 0.46, -0.46, -0.46, 0, 0.46, 0, -0.46, 0.46, 0.46, 0.46]
];

type Roll = {
	wall: number;
	rail: number;
	nDice: number;
	throwX: number;
	side: number;
	period: number;
	pyr: number;
	marks: number[][];
	stackX: number;
	stackN: number;
	chipHue: number;
	feltHue: number;
	woodTone: number;
	point: number;
	grain: number;
};

function rollIdent(s: FxScene): Roll {
	const r = mulberry32(s.v.seed + 23197);
	const wall = 0.17 + r() * 0.07;
	const rail = 0.06 + r() * 0.04;
	const nDice = r() < 0.72 ? 2 : 3;
	const throwX = 0.1 + r() * 0.8;
	const side = r() < 0.5 ? -1 : 1;
	const period = 360 + ((r() * 210) | 0);
	const pyr = 9 + ((r() * 6) | 0);
	const marks: number[][] = [];
	for (let i = 0; i < 6; i++) marks.push([r(), r(), r(), r()]);
	const stackX = 0.1 + r() * 0.8;
	const stackN = 3 + ((r() * 4) | 0);
	const chipHue = r();
	const feltHue = r();
	const woodTone = r();
	const point = [4, 5, 6, 8, 9, 10][(r() * 6) | 0];
	const grain = (r() * 9999) | 0;
	return { wall, rail, nDice, throwX, side, period, pyr, marks, stackX, stackN, chipHue, feltHue, woodTone, point, grain };
}

function drawCube(s: FxScene, cx: number, cy: number, sc: number, a: number, b: number, c: number, body: number[], pip: number[], amb: number, hot: number) {
	const ca = Math.cos(a);
	const sa = Math.sin(a);
	const cb = Math.cos(b);
	const sb = Math.sin(b);
	const cc = Math.cos(c);
	const sc2 = Math.sin(c);
	const vp = Math.cos(0.5);
	const vq = Math.sin(0.5);
	const vy = Math.cos(0.42);
	const vz = Math.sin(0.42);
	const rv = (x: number, y: number, z: number) => {
		const y1 = y * ca - z * sa;
		const z1 = y * sa + z * ca;
		const x2 = x * cb + z1 * sb;
		const z2 = -x * sb + z1 * cb;
		const x3 = x2 * cc - y1 * sc2;
		const y3 = x2 * sc2 + y1 * cc;
		const x4 = x3 * vy + z2 * vz;
		const z4 = -x3 * vz + z2 * vy;
		return [x4, y3 * vp - z4 * vq, y3 * vq + z4 * vp];
	};
	const px: number[] = [];
	const py: number[] = [];
	let top = 1;
	let topY = 9;
	for (let f = 0; f < 6; f++) {
		const F = CUBE[f];
		const n = rv(F[0], F[1], F[2]);
		if (n[1] < topY) {
			topY = n[1];
			top = F[9];
		}
		if (n[2] >= -0.03) continue;
		const u = rv(F[3], F[4], F[5]);
		const v = rv(F[6], F[7], F[8]);
		px.length = 0;
		py.length = 0;
		for (const [su, sv] of [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		]) {
			const X = n[0] + u[0] * su + v[0] * sv;
			const Y = n[1] + u[1] * su + v[1] * sv;
			const Z = n[2] + u[2] * su + v[2] * sv;
			const q = 1 - Z * 0.1;
			px.push(cx + X * sc * q);
			py.push(cy + Y * sc * q);
		}
		const lum = Math.max(0, -(n[0] * 0.42 + n[1] * 0.82 + n[2] * 0.38));
		const k = amb + lum * 0.78;
		let area = 0;
		for (let q = 0; q < 4; q++) {
			const q2 = (q + 1) % 4;
			area += px[q] * py[q2] - px[q2] * py[q];
		}
		const wind = area < 0 ? -1 : 1;
		let x0 = px[0];
		let x1 = px[0];
		let y0 = py[0];
		let y1 = py[0];
		for (let q = 1; q < 4; q++) {
			if (px[q] < x0) x0 = px[q];
			if (px[q] > x1) x1 = px[q];
			if (py[q] < y0) y0 = py[q];
			if (py[q] > y1) y1 = py[q];
		}
		for (let y = Math.floor(y0); y <= y1; y++) {
			for (let x = Math.floor(x0); x <= x1; x++) {
				let inside = 1;
				let near = 9;
				for (let e = 0; e < 4; e++) {
					const ax = px[e];
					const ay = py[e];
					const bx = px[(e + 1) % 4];
					const by = py[(e + 1) % 4];
					const ex = bx - ax;
					const ey = by - ay;
					const cr = ex * (y + 0.5 - ay) - ey * (x + 0.5 - ax);
					const len = Math.hypot(ex, ey) || 1;
					const d = (cr * wind) / len;
					if (d < -0.5) {
						inside = 0;
						break;
					}
					if (d < near) near = d;
				}
				if (!inside) continue;
				const bev = near < 0.9 ? 1 - near / 0.9 : 0;
				const kk = k * (1 - bev * 0.34) + bev * 0.16;
				const cov = Math.min(1, near + 0.5);
				paint(s, x, y, body[0] * kk + hot * 90, body[1] * kk + hot * 74, body[2] * kk + hot * 22, cov);
			}
		}
		if (-n[2] < 0.34) continue;
		const marks = PIPS[F[9] - 1];
		const pr = Math.max(0.8, sc * 0.19 * (0.55 + -n[2] * 0.45));
		for (let m = 0; m < marks.length; m += 2) {
			const ou = marks[m];
			const ov = marks[m + 1];
			const X = n[0] * 1.03 + u[0] * ou + v[0] * ov;
			const Y = n[1] * 1.03 + u[1] * ou + v[1] * ov;
			const Z = n[2] * 1.03 + u[2] * ou + v[2] * ov;
			const q = 1 - Z * 0.1;
			const dxp = cx + X * sc * q;
			const dyp = cy + Y * sc * q;
			for (let dy = -pr - 1; dy <= pr + 1; dy++) {
				for (let dx = -pr - 1; dx <= pr + 1; dx++) {
					const d = Math.hypot(dx, dy) / pr;
					if (d > 1.2) continue;
					const sh = d > 0.55 ? 0.62 : 0.94 + (0.55 - d) * 0.5;
					paint(s, dxp + dx, dyp + dy, pip[0] * sh, pip[1] * sh, pip[2] * sh, Math.min(1, (1.2 - d) * 2) * (0.5 + k * 0.5));
				}
			}
		}
	}
	return top;
}

function drawChip(s: FxScene, x: number, y: number, rr: number, cr: number, cg: number, cb: number, lit: number, tilt: number) {
	const ry = Math.max(0.9, rr * (0.36 + tilt * 0.5));
	for (let dy = -ry - 1.4; dy <= ry + 1.4; dy++) {
		for (let dx = -rr - 1; dx <= rr + 1; dx++) {
			const d = Math.hypot(dx / rr, dy / ry);
			const side = dy > 0 && d > 1 && Math.abs(dx) <= rr && dy <= ry + rr * 0.34 ? 1 : 0;
			if (d > 1 && !side) continue;
			if (side) {
				paint(s, x + dx, y + dy, cr * 0.44 * lit, cg * 0.44 * lit, cb * 0.44 * lit, 1);
				continue;
			}
			const ring = d > 0.66 && d < 0.88;
			const wedge = ring && ((Math.atan2(dy / ry, dx / rr) * 2.2) | 0) % 2 === 0;
			const k = (0.72 + (1 - d) * 0.44) * lit;
			if (wedge) paint(s, x + dx, y + dy, 232 * k, 234 * k, 238 * k, 1);
			else paint(s, x + dx, y + dy, cr * k, cg * k, cb * k, 1);
		}
	}
	plot(s, x - rr * 0.3, y - ry * 0.4, 255, 255, 255, 0.28 * lit);
}

export function makeDice(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = rollIdent(s);
			(s as any).id = id;
			const dice: number[][] = [];
			for (let i = 0; i < id.nDice; i++) dice.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
			(s as any).dice = dice;
			(s as any).puff = [] as number[][];
			(s as any).chips = [] as number[][];
			(s as any).cycled = -1;
			(s as any).paid = -1;
			(s as any).jolt = 0;
			(s as any).total = 0;
			(s as any).verdict = 0;
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Roll;
			const dice = (s as any).dice as number[][];
			const puff = (s as any).puff as number[][];
			const chips = (s as any).chips as number[][];
			const wallY = Math.round(s.h * (0.52 + id.wall * 0.3));
			const railY = Math.round(s.h * (1 - id.rail));
			const near = railY - 1;
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const cycle = Math.floor((s.t * s.v.speed) / id.period);

			const [flr, flg, flb] = hsl(id.feltHue < 0.62 ? 152 + id.feltHue * 18 : 348 + (s.v.hue % 12), 16 + s.v.sat * 0.14, 13 + id.feltHue * 4);
			const [wdr, wdg, wdb] = hsl(24 + id.woodTone * 12, 34 + id.woodTone * 20, 15 + id.woodTone * 6);
			const [chr, chg, chb] = hsl(id.chipHue < 0.34 ? 352 : id.chipHue < 0.67 ? 212 : 44, 62 + s.v.sat * 0.2, 46);

			if ((s as any).cycled !== cycle) {
				(s as any).cycled = cycle;
				(s as any).total = 0;
				(s as any).verdict = 0;
				for (let i = 0; i < dice.length; i++) {
					const d = dice[i];
					d[0] = (id.throwX + (i - (dice.length - 1) * 0.5) * 0.17) * s.w;
					d[1] = near - 1;
					d[2] = s.h * 0.1 + s.rnd() * s.h * 0.07;
					d[3] = id.side * (0.42 + s.rnd() * 0.6) + (i - (dice.length - 1) * 0.5) * 0.34;
					d[4] = -(0.72 + s.rnd() * 0.34);
					d[5] = -(0.42 + s.rnd() * 0.5);
					d[6] = s.rnd() * 6.28;
					d[7] = s.rnd() * 6.28;
					d[8] = s.rnd() * 6.28;
					d[9] = (s.rnd() - 0.5) * 0.7;
					d[10] = (s.rnd() - 0.5) * 0.7;
					d[11] = (s.rnd() - 0.5) * 0.7;
					d[12] = 1;
				}
			}

			(s as any).jolt *= 0.82;
			const jolt = (s as any).jolt as number;
			const jx = Math.sin(s.t * 3.3) * jolt * 1.7;
			const jy = Math.sin(s.t * 4.1) * jolt * 0.9;

			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					if (y < wallY) continue;
					const dep = (y - wallY) / Math.max(1, s.h - wallY);
					const nap = hash2m(x, y, id.grain) * 0.5 + hash2m(x >> 1, y >> 1, id.grain + 7) * 0.5;
					const vig = 1 - Math.hypot(x / s.w - 0.5, (y - wallY) / Math.max(1, s.h - wallY) - 0.4) * 0.6;
					const k = (0.62 + nap * 0.34 + dep * 0.5) * vig;
					paint(s, x, y, flr * k, flg * k, flb * k, 1);
				}
			}

			const [mkr, mkg, mkb] = hsl(44, 26 + s.v.sat * 0.14, 54);
			for (let x = 0; x < s.w; x++) {
				const u = x / s.w;
				const arc = wallY + (s.h - wallY) * (0.52 + Math.sin((u - 0.5) * 2.1) * 0.1);
				for (let q = 0; q < 1.4; q++) paint(s, x, arc + q, mkr, mkg, mkb, 0.2 - q * 0.08);
			}
			for (let mi = 0; mi < 4; mi++) {
				const [mx, my, mw, mh] = id.marks[mi];
				const x0 = wallY + 3 + my * (s.h - wallY - 12);
				const bw = 9 + mw * 14;
				const bh = 4 + mh * 3;
				const bx = mx * (s.w - bw - 4) + 2;
				for (let x = bx; x <= bx + bw; x++) {
					paint(s, x, x0, mkr, mkg, mkb, 0.16);
					paint(s, x, x0 + bh, mkr, mkg, mkb, 0.16);
				}
				for (let y = x0; y <= x0 + bh; y++) {
					paint(s, bx, y, mkr, mkg, mkb, 0.16);
					paint(s, bx + bw, y, mkr, mkg, mkb, 0.16);
				}
			}

			const pyW = s.w / id.pyr;
			for (let p = 0; p < id.pyr; p++) {
				const cxp = (p + 0.5) * pyW + jx * 0.4;
				const ph = wallY * 0.3;
				for (let q = 0; q < ph; q++) {
					const f = q / ph;
					const half = pyW * 0.42 * (1 - f * 0.86);
					for (let dx = -half; dx <= half; dx++) {
						const e = dx / (half + 0.01);
						const k = 0.44 + (1 - f) * 0.34 + Math.max(0, -e) * 0.5 - Math.max(0, e) * 0.18;
						paint(s, cxp + dx, wallY - 1 - q, wdr * k * 1.25, wdg * k * 1.2, wdb * k * 1.15, 1);
					}
				}
			}
			for (let x = 0; x < s.w; x++)
				for (let q = 0; q < 2; q++) paint(s, x + jx * 0.4, wallY + q, wdr * (1.5 - q * 0.6), wdg * (1.45 - q * 0.6), wdb * (1.4 - q * 0.6), 1);

			const stackX = id.stackX * (s.w - 10) + 5;
			const stackY = wallY + (s.h - wallY) * 0.72;
			const chipR = Math.max(2.4, s.h * 0.085);
			let stackN = id.stackN;
			if ((s as any).verdict > 0 && cyc > 0.62) stackN += 2;
			if ((s as any).verdict < 0 && cyc > 0.62) stackN = Math.max(0, stackN - 2);
			for (let k = 0; k < stackN; k++) drawChip(s, stackX, stackY - k * chipR * 0.38, chipR, chr, chg, chb, 0.66 + k * 0.06, 0.32);

			let resting = 0;
			const order = dice.map((d, i) => i).sort((a, b2) => dice[a][1] - dice[b2][1]);
			for (const i of order) {
				const d = dice[i];
				if (d[12]) {
					d[4] += 0.078 * s.v.speed;
					d[0] += d[3] * s.v.speed;
					d[1] += d[5] * s.v.speed;
					d[2] -= d[4] * s.v.speed;
					d[6] += d[9];
					d[7] += d[10];
					d[8] += d[11];
					if (d[2] <= 0) {
						d[2] = 0;
						if (d[4] > 0.5) {
							d[4] = -d[4] * 0.44;
							d[3] *= 0.72;
							d[5] *= 0.72;
							d[9] *= 0.8;
							d[10] *= 0.8;
							d[11] *= 0.8;
							(s as any).jolt = Math.min(1, (s as any).jolt + 0.5);
							for (let q = 0; q < 8; q++) puff.push([d[0], d[1], (s.rnd() - 0.5) * 1.5, -s.rnd() * 0.7, 0]);
						} else {
							d[4] = 0;
							d[3] *= 0.86;
							d[5] *= 0.86;
							d[9] *= 0.8;
							d[10] *= 0.8;
							d[11] *= 0.8;
						}
					}
					if (d[1] < wallY + 3) {
						d[1] = wallY + 3;
						d[5] = Math.abs(d[5]) * 0.72 + 0.16;
						d[3] *= 0.8;
						d[9] += (s.rnd() - 0.5) * 0.5;
						d[11] += (s.rnd() - 0.5) * 0.5;
						(s as any).jolt = 1;
						for (let q = 0; q < 10; q++) puff.push([d[0], d[1] + 1, (s.rnd() - 0.5) * 2.2, -s.rnd() * 1.1, 0]);
					}
					if (d[1] > near) {
						d[1] = near;
						d[5] = -Math.abs(d[5]) * 0.6;
					}
					if (d[0] < 4) {
						d[0] = 4;
						d[3] = Math.abs(d[3]) * 0.66;
					}
					if (d[0] > s.w - 4) {
						d[0] = s.w - 4;
						d[3] = -Math.abs(d[3]) * 0.66;
					}
					if (d[2] === 0 && Math.abs(d[3]) < 0.06 && Math.abs(d[5]) < 0.06 && Math.abs(d[9]) + Math.abs(d[10]) + Math.abs(d[11]) < 0.06) d[12] = 0;
				} else {
					resting++;
					const snap = (v: number) => {
						const t = Math.round(v / 1.5708) * 1.5708;
						return v + (t - v) * 0.3;
					};
					d[6] = snap(d[6]);
					d[7] = snap(d[7]);
					d[8] = snap(d[8]);
				}
				const dep = (d[1] - wallY) / Math.max(1, near - wallY);
				const sc = s.h * (0.078 + dep * 0.042);
				const sx = d[0] + jx;
				const sy = Math.max(sc * 1.1 + 1, d[1] - d[2] + jy);
				const shR = sc * (1.35 - Math.min(0.7, d[2] / (s.h * 0.4)) * 0.5);
				const shA = 0.46 * Math.max(0.16, 1 - d[2] / (s.h * 0.34));
				for (let dy = -shR * 0.42; dy <= shR * 0.42; dy++) {
					for (let dx = -shR; dx <= shR; dx++) {
						const q = Math.hypot(dx / shR, dy / (shR * 0.42));
						if (q > 1) continue;
						paint(s, d[0] + dx + jx, d[1] + dy + jy, 0, 0, 0, (1 - q) * shA);
					}
				}
				const hot = (s as any).verdict > 0 && cyc > 0.56 ? Math.max(0, Math.sin((cyc - 0.56) * 9)) * 0.42 : 0;
				const top = drawCube(s, sx, sy, sc, d[6], d[7], d[8], [232, 230, 226], [186, 32, 44], 0.42, hot);
				if (!d[12]) d[13] = top;
			}

			if (resting === dice.length && (s as any).total === 0) {
				let tt = 0;
				for (const d of dice) tt += d[13] || 1;
				(s as any).total = tt;
				(s as any).verdict = tt === 7 || tt === 11 ? 1 : tt === 2 || tt === 3 || tt === 12 ? -1 : tt === id.point ? 1 : 0;
				(s as any).jolt = Math.max(jolt, 0.5);
			}
			if (resting === dice.length && (s as any).paid !== cycle && cyc > 0.6) {
				(s as any).paid = cycle;
				const v = (s as any).verdict as number;
				const n = v > 0 ? 7 : v < 0 ? 5 : 2;
				for (let q = 0; q < n; q++) {
					if (v >= 0) chips.push([s.rnd() * s.w, s.h + 3, (stackX - s.rnd() * s.w) * 0.016, -1.5 - s.rnd() * 0.9, 0, 0.7 + s.rnd() * 0.5]);
					else chips.push([stackX + (s.rnd() - 0.5) * 4, stackY, (s.rnd() - 0.5) * 1.6, -0.9 - s.rnd() * 0.8, 0, 0.7 + s.rnd() * 0.5]);
				}
			}

			const total = (s as any).total as number;
			const verdict = (s as any).verdict as number;
			if (total > 0 && cyc > 0.52) {
				const rise = Math.min(1, (cyc - 0.52) * 7);
				const fade = cyc > 0.9 ? 1 - (cyc - 0.9) * 10 : 1;
				const a = Math.max(0, rise * fade);
				let mx = 0;
				for (const d of dice) mx += d[0];
				mx /= dice.length;
				const gy = wallY + 3;
				const [tr, tg, tb] = verdict > 0 ? hsl(46, 92, 60) : verdict < 0 ? hsl(2, 84, 54) : hsl(200, 18, 78);
				const span = Math.min(s.w - 10, total * 3.6);
				for (let q = 0; q < total; q++) {
					const x = mx - span * 0.5 + (span / Math.max(1, total - 1)) * q;
					const pop = Math.max(0, Math.min(1, rise * total - q));
					for (let dy = -1.6; dy <= 1.6; dy++)
						for (let dx = -1.6; dx <= 1.6; dx++) {
							const dd = Math.hypot(dx, dy) / 1.6;
							if (dd > 1) continue;
							plot(s, x + dx, gy + dy, tr, tg, tb, (1 - dd) * (1 - dd) * a * pop * 0.95);
						}
					plot(s, x, gy, 255, 255, 255, a * pop * 0.5);
				}
				if (verdict > 0) {
					const pulse = 0.5 + 0.5 * Math.sin(s.t * 0.26);
					const glow = a * (0.6 + pulse * 0.4);
					for (let q = 0; q < 26; q++) {
						const th = (q / 26) * 6.28 + s.t * 0.03;
						const rad = s.h * (0.16 + ((q * 7) % 11) / 30) * (0.7 + rise * 0.9);
						const x = mx + Math.cos(th) * rad * 1.5;
						const y = near - s.h * 0.12 + Math.sin(th) * rad;
						const tw = 0.4 + 0.6 * Math.abs(Math.sin(s.t * 0.2 + q));
						for (let k = 0; k < 4; k++) {
							const e = 1 - k / 4;
							plot(s, x + (k === 1 ? 1 : k === 2 ? -1 : 0), y + (k === 3 ? 1 : 0), tr, tg, tb, glow * tw * e * 0.6);
						}
					}
					for (let y = wallY; y < s.h; y++)
						for (let x = 0; x < s.w; x++) {
							const dd = Math.hypot((x - mx) / (s.w * 0.42), (y - (near - s.h * 0.1)) / (s.h * 0.42));
							if (dd > 1) continue;
							plot(s, x, y, tr, tg * 0.9, tb * 0.5, (1 - dd) * (1 - dd) * glow * 0.12);
						}
				}
			}

			for (let k = chips.length - 1; k >= 0; k--) {
				const q = chips[k];
				q[4] += 1;
				q[3] += 0.088;
				q[0] += q[2];
				q[1] += q[3];
				if (q[1] > s.h + 4 || q[4] > 78) {
					chips.splice(k, 1);
					continue;
				}
				if (q[1] > stackY && q[3] > 0) {
					q[1] = stackY;
					q[3] = -q[3] * 0.4;
					q[2] *= 0.6;
				}
				drawChip(s, q[0], q[1], chipR * q[5], chr, chg, chb, 0.66 + Math.max(0, -q[3]) * 0.3, 0.3 + Math.abs(q[3]) * 0.3);
			}
			if (chips.length > 22) chips.splice(0, chips.length - 22);

			for (let k = puff.length - 1; k >= 0; k--) {
				const q = puff[k];
				q[4] += 1;
				if (q[4] > 20) {
					puff.splice(k, 1);
					continue;
				}
				q[0] += q[2];
				q[1] += q[3];
				q[3] += 0.05;
				q[2] *= 0.92;
				const a = 1 - q[4] / 20;
				plot(s, q[0], q[1], flr * 3.2, flg * 3, flb * 2.8, a * a * 0.45);
			}
			if (puff.length > 70) puff.splice(0, puff.length - 70);

			for (let y = railY; y < s.h; y++) {
				const f = (y - railY) / Math.max(1, s.h - railY);
				for (let x = 0; x < s.w; x++) {
					const gn = hash2m(x >> 1, y, id.grain + 33) * 0.22 + Math.sin(x * 0.5 + y * 2.1) * 0.05;
					const k = 1.15 - f * 0.55 + gn;
					paint(s, x, y, wdr * k * 1.3, wdg * k * 1.25, wdb * k * 1.2, 1);
				}
			}
			for (let x = 0; x < s.w; x++) paint(s, x, railY, 12, 10, 9, 0.5);

			s.out = Math.min(1, jolt * 0.7 + (verdict > 0 && cyc > 0.52 ? 0.55 : 0) + 0.1);
			blit(s);
		}
	};
}
