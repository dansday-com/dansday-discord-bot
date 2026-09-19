import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Board = {
	nodes: number[][];
	traces: number[][];
	rate: number;
	chips: number[][];
	vias: number[][];
	hero: number;
	period: number;
	grain: number;
};

function hash2(x: number, y: number, g: number) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (g | 0) * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function circuitIdent(s: FxScene): Board {
	const r = mulberry32(s.v.seed + 4570);
	const nodes: number[][] = [];
	const cols = 6;
	const rowsN = 4;
	for (let gy = 0; gy < rowsN; gy++) {
		for (let gx = 0; gx < cols; gx++) nodes.push([(gx + 0.28 + r() * 0.44) / cols, (gy + 0.28 + r() * 0.44) / rowsN, r()]);
	}
	const traces: number[][] = [];
	for (let i = 0; i < nodes.length; i++) {
		const gx = i % cols;
		const gy = (i / cols) | 0;
		if (gx < cols - 1 && r() < 0.78) traces.push([i, i + 1, r() < 0.5 ? 0 : 1]);
		if (gy < rowsN - 1 && r() < 0.62) traces.push([i, i + cols, r() < 0.5 ? 0 : 1]);
	}
	const rate = 0.007 + r() * 0.013;
	const chips: number[][] = [];
	for (let i = 0; i < 4; i++) chips.push([0.12 + r() * 0.66, 0.16 + r() * 0.56, 0.08 + r() * 0.07, 0.15 + r() * 0.13]);
	const vias: number[][] = [];
	for (let i = 0; i < 10; i++) vias.push([r(), r()]);
	const hero = (r() * 4) | 0;
	const period = 300 + ((r() * 220) | 0);
	const grain = (r() * 9999) | 0;
	return { nodes, traces, rate, chips, vias, hero, period, grain };
}

export function makeCircuit(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0,
		init(s) {
			const id = circuitIdent(s);
			(s as any).id = id;
			(s as any).pulses = id.traces.map((_, i) => (i * 0.37) % 1);
			(s as any).bolts = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Board;
			const pulses = (s as any).pulses as number[];
			const bolts = (s as any).bolts as number[][];
			const [sub, subg, subb] = hsl(s.v.hue, 30 + s.v.sat * 0.4, 13);
			const [cu, cug, cub] = hsl(s.v.hue, 24 + s.v.sat * 0.35, 34);
			const [lit, litg, litb] = hsl(s.v.hue2, Math.max(55, s.v.sat), 72);
			const [slk, slkg, slkb] = hsl(s.v.hue2, 12, 68);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const heat = cyc > 0.4 && cyc < 0.72 ? (cyc - 0.4) / 0.32 : 0;
			const blown = cyc >= 0.72 && cyc < 0.8;
			const sweep = cyc >= 0.8 ? (cyc - 0.8) / 0.2 : blown ? 0 : 1;
			const flick = cyc > 0.62 && cyc < 0.72 ? (Math.sin(s.t * 1.7) > 0.2 ? 0.45 : 1) : 1;
			const live = (x: number) => (blown ? 0.06 : Math.min(1, Math.max(0, (sweep * 1.18 - x / s.w) * 6)) * flick);

			void sub;
			void subg;
			void subb;

			for (const [vx, vy] of id.vias) {
				const x0 = vx * s.w;
				const y0 = vy * s.h;
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > 2.2) continue;
						if (d < 0.9) paint(s, x0 + dx, y0 + dy, sub * 0.3, subg * 0.3, subb * 0.3, 1);
						else paint(s, x0 + dx, y0 + dy, cu * 1.5, cug * 1.5, cub * 1.5, 0.9);
					}
			}

			for (let ti = 0; ti < id.traces.length; ti++) {
				const [a, b, elbow] = id.traces[ti];
				const na = id.nodes[a];
				const nb = id.nodes[b];
				const ax = na[0] * s.w;
				const ay = na[1] * s.h;
				const bx = nb[0] * s.w;
				const by = nb[1] * s.h;
				const mx = elbow ? bx : ax;
				const my = elbow ? ay : by;
				const seg1 = Math.hypot(mx - ax, my - ay);
				const seg2 = Math.hypot(bx - mx, by - my);
				const total = seg1 + seg2 || 1;
				const at = (along: number) => {
					if (along <= seg1) {
						const f = along / (seg1 || 1);
						return [ax + (mx - ax) * f, ay + (my - ay) * f];
					}
					const f = (along - seg1) / (seg2 || 1);
					return [mx + (bx - mx) * f, my + (by - my) * f];
				};
				for (let d = 0; d <= total; d += 0.7) {
					const [x, y] = at(d);
					paint(s, x, y - 1, cu * 0.5, cug * 0.5, cub * 0.5, 0.6);
					paint(s, x, y, cu, cug, cub, 0.95);
					paint(s, x, y + 1, cu * 1.35, cug * 1.35, cub * 1.35, 0.8);
				}

				pulses[ti] += id.rate * s.v.speed * (0.6 + na[2] * 0.8) * s.v.dir * (1 + heat * 1.6) * (blown ? 0 : 1);
				if (pulses[ti] > 1.3) pulses[ti] -= 1.6;
				if (pulses[ti] < -0.3) pulses[ti] += 1.6;
				const t = pulses[ti];
				if (t < 0 || t > 1) continue;
				const along = t * total;
				const [hx, hy] = at(along);
				const pw = live(hx);
				if (pw <= 0.08) continue;
				const fade = edge(t, 0, 1, 0.14) * pw;
				for (let k = 0; k < 7; k++) {
					const [qx, qy] = at(Math.max(0, along - k * 1.1));
					const ka = (1 - k / 7) * 0.9 * fade;
					plot(s, qx, qy, lit, litg, litb, ka);
					plot(s, qx, qy - 1, lit, litg, litb, ka * 0.3);
					plot(s, qx, qy + 1, lit, litg, litb, ka * 0.3);
				}
				plot(s, hx, hy, 255, 255, 255, 0.6 * fade);
			}

			for (let ci = 0; ci < id.chips.length; ci++) {
				const [px, py, pw2, ph2] = id.chips[ci];
				const x0 = px * s.w;
				const y0 = py * s.h;
				const w = pw2 * s.w;
				const h = ph2 * s.h;
				const isHero = ci === id.hero;
				const burn = isHero ? heat : 0;
				const scorch = isHero && cyc >= 0.72 ? 1 : 0;
				for (let k = 0; k <= h; k += 2.2) {
					for (let q = -2; q <= 2; q++) {
						paint(s, x0 - 2 + q * 0.5, y0 + k, 168, 172, 178, 0.9);
						paint(s, x0 + w + 2 + q * 0.5, y0 + k, 168, 172, 178, 0.9);
					}
				}
				for (let y = y0; y <= y0 + h; y++)
					for (let x = x0; x <= x0 + w; x++) {
						const g = hash2(x, y, id.grain + 17) * 0.25;
						const bev = 1 - Math.min(1, Math.min(x - x0, y - y0, x0 + w - x, y0 + h - y) / 2) * 0.45;
						const base = (22 + g * 26) * (1 + bev * 0.9) * (1 - scorch * 0.55);
						paint(s, x, y, base + burn * 90 * bev, base + burn * 22 * bev, base + burn * 8, 1);
					}
				for (let q = 0; q < 3; q++) paint(s, x0 + 2 + q, y0 + 2, slk, slkg, slkb, 0.5);
				if (burn > 0.05) {
					const rad = Math.max(w, h) * (0.6 + burn * 0.9);
					for (let dy = -rad; dy <= rad; dy++)
						for (let dx = -rad; dx <= rad; dx++) {
							const d = Math.hypot(dx / rad, dy / rad);
							if (d > 1) continue;
							plot(s, x0 + w * 0.5 + dx, y0 + h * 0.5 + dy, 255, 110 + burn * 60, 40, (1 - d) * (1 - d) * burn * burn * 0.7);
						}
				}
				if (isHero && cyc > 0.64 && cyc < 0.74 && s.rnd() < 0.5) {
					const tgt = id.vias[((((ci + s.rnd() * 10) | 0) % 10) + 10) % 10];
					bolts.push([x0 + w * 0.5, y0 + h * 0.5, tgt[0] * s.w, tgt[1] * s.h, 0, 4 + ((s.rnd() * 4) | 0)]);
					if (bolts.length > 6) bolts.shift();
				}
			}

			for (let k = bolts.length - 1; k >= 0; k--) {
				const bo = bolts[k];
				bo[4] += 1;
				if (bo[4] > bo[5]) {
					bolts.splice(k, 1);
					continue;
				}
				const a = 1 - bo[4] / bo[5];
				const dx = bo[2] - bo[0];
				const dy = bo[3] - bo[1];
				const len = Math.hypot(dx, dy) || 1;
				const nx = -dy / len;
				const ny = dx / len;
				for (let q = 0; q <= 18; q++) {
					const f = q / 18;
					const jag = Math.sin(f * 11 + bo[4] * 2.1 + bo[0]) * Math.sin(f * Math.PI) * len * 0.16;
					const x = bo[0] + dx * f + nx * jag;
					const y = bo[1] + dy * f + ny * jag;
					plot(s, x, y, 255, 255, 255, a * 0.95);
					plot(s, x, y - 1, 190, 220, 255, a * 0.4);
					plot(s, x + 1, y, 190, 220, 255, a * 0.4);
				}
			}

			let load = 0;
			for (let i = 0; i < id.nodes.length; i++) {
				const n = id.nodes[i];
				const x = n[0] * s.w;
				const y = n[1] * s.h;
				let hot = 0;
				for (let ti = 0; ti < id.traces.length; ti++) {
					const [a, b] = id.traces[ti];
					const t = pulses[ti];
					if (a === i && t < 0.12 && t > -0.02) hot = Math.max(hot, 1 - t / 0.12);
					if (b === i && t > 0.88 && t < 1.02) hot = Math.max(hot, 1 - (1 - t) / 0.12);
				}
				hot *= live(x);
				load += hot;
				for (let dy = -1; dy <= 1; dy++)
					for (let dx = -1; dx <= 1; dx++) paint(s, x + dx, y + dy, cu * 1.5, cug * 1.5, cub * 1.5, Math.abs(dx) + Math.abs(dy) > 1 ? 0.5 : 0.95);
				if (hot > 0.02) {
					const rad = 1.8 + hot * 3;
					for (let dy = -rad; dy <= rad; dy++)
						for (let dx = -rad; dx <= rad; dx++) {
							const d = Math.hypot(dx, dy) / rad;
							if (d > 1) continue;
							plot(s, x + dx, y + dy, lit, litg, litb, (1 - d) * (1 - d) * hot * 0.85);
						}
				}
			}

			for (let x = 0; x < s.w; x++) {
				const pw = live(x);
				if (pw > 0.94) continue;
				const d = (1 - pw) * 0.66;
				for (let y = 0; y < s.h; y++) paint(s, x, y, 0, 0, 0, d);
			}
			if (cyc >= 0.8) {
				const fx = sweep * 1.18 * s.w;
				for (let dx = -2; dx <= 2; dx++) for (let y = 0; y < s.h; y++) plot(s, fx + dx, y, lit, litg, litb, (1 - Math.abs(dx) / 3) * 0.5 * (1 - sweep * 0.4));
			}

			s.out = Math.min(1, load / 3 + heat * 0.7 + (blown ? 0.9 : 0));
			blit(s);
		}
	};
}

type Optic = {
	entryY: number;
	apex: number;
	size: number;
	spin: number;
	px: number;
	facets: number[];
	slit: number;
	shelf: number;
	motes: number[][];
	period: number;
	grain: number;
	frame: number;
};

function prismIdent(s: FxScene): Optic {
	const r = mulberry32(s.v.seed + 5680);
	const entryY = 0.2 + r() * 0.34;
	const apex = 0.32 + r() * 0.3;
	const size = 0.17 + r() * 0.15;
	const spin = 0.4 + r() * 1.1;
	const px = 0.3 + r() * 0.26;
	const facets: number[] = [];
	for (let i = 0; i < 8; i++) facets.push(r());
	const slit = 0.1 + r() * 0.1;
	const shelf = 0.7 + r() * 0.14;
	const motes: number[][] = [];
	for (let i = 0; i < 26; i++) motes.push([r(), r(), 0.3 + r() * 0.8, r() * 6.28]);
	const period = 300 + ((r() * 220) | 0);
	const grain = (r() * 9999) | 0;
	const frameOn = r() < 0.6 ? 1 : 0;
	return { entryY, apex, size, spin, px, facets, slit, shelf, motes, period, grain, frame: frameOn };
}

export function makePrism(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = prismIdent(s);
			(s as any).id = id;
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
			const id = (s as any).id as Optic;
			const [wr, wg, wb] = hsl(s.v.hue, 12 + s.v.sat * 0.15, 15);
			const [tr2, tg2, tb2] = hsl(24 + (s.v.hue % 26), 26 + s.v.sat * 0.1, 13);
			const shelfY = id.shelf * s.h;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const shade = cyc > 0.46 && cyc < 0.68 ? Math.sin(((cyc - 0.46) / 0.22) * Math.PI) : 0;
			const sunUp = cyc < 0.46 ? Math.min(1, cyc / 0.12) : 1;
			const beam = Math.max(0.05, sunUp * (1 - shade * 0.94));

			void wr;
			void wg;
			void wb;
			const shw = s.w * 0.3;
			const shc = s.w * id.px;
			for (let y = shelfY; y < s.h; y++) {
				const f = (y - shelfY) / Math.max(1, s.h - shelfY);
				for (let x = Math.max(0, Math.round(shc - shw)); x <= Math.min(s.w - 1, shc + shw); x++) {
					const ex = Math.min(1, (shw - Math.abs(x - shc)) / (shw * 0.4));
					const ring = Math.sin(x * 0.09 + Math.sin(x * 0.021) * 2.6 + y * 0.9) * 0.5 + 0.5;
					const grain2 = ring * 0.22 + hash2(x >> 1, y, id.grain + 6) * 0.12;
					const k = (1.05 - f * 0.5 + grain2) * (1 + Math.max(0, 1 - Math.abs(y - shelfY) / 1.6) * 0.55);
					paint(s, x, y, tr2 * k, tg2 * k * 0.94, tb2 * k * 0.86, ex);
				}
			}

			const entry = s.h * id.entryY;
			const slitH = s.h * id.slit;
			const sx0 = s.w * 0.02;
			for (let y = entry - slitH * 0.5; y <= entry + slitH * 0.5; y++) {
				const e = 1 - Math.abs(y - entry) / (slitH * 0.5 + 0.5);
				for (let x = 0; x <= sx0; x++) paint(s, x, y, 255 * beam, 250 * beam, 232 * beam, Math.min(1, 0.4 + e));
			}
			if (id.frame) {
				for (let y = entry - slitH * 0.5 - 2; y <= entry + slitH * 0.5 + 2; y++) for (let q = 0; q <= 1; q++) paint(s, sx0 + 1 + q, y, 30, 28, 26, 0.95);
				for (let x = 0; x <= sx0 + 2; x++) paint(s, x, entry, 30, 28, 26, 0.7);
			}

			const wobble = Math.sin(s.t * 0.01 * s.v.speed * id.spin) * 0.22 * s.v.dir;
			const cx = s.w * id.px + s.v.tilt * s.w * 0.06;
			const R = Math.min(s.w, s.h) * id.size;
			const cy = Math.min(s.h * id.apex, shelfY - R * 0.9);
			const verts: number[][] = [];
			for (let k = 0; k < 3; k++) {
				const th = -Math.PI / 2 + wobble + (k * Math.PI * 2) / 3;
				verts.push([cx + Math.cos(th) * R, cy + Math.sin(th) * R]);
			}
			const hitX = cx - R * 0.55;

			for (let x = sx0; x < hitX; x++) {
				const f = (x - sx0) / Math.max(1, hitX - sx0);
				const half = slitH * (0.5 + f * 0.22);
				for (let y = entry - half; y <= entry + half; y++) {
					const e = 1 - Math.abs(y - entry) / (half + 0.5);
					const dusty = 0.75 + 0.35 * Math.sin(x * 0.17 + y * 0.4 - s.t * 0.05 * s.v.speed);
					plot(s, x, y, 255, 248, 226, e * e * beam * 0.3 * dusty);
				}
				plot(s, x, entry, 255, 252, 240, beam * 0.55);
			}

			const fanLo = 0.1 + wobble * 0.5;
			const fanHi = fanLo + (0.42 + s.v.drift * 0.3);
			const len = Math.max(1, s.w - hitX);
			for (let x = hitX; x < s.w; x++) {
				const d = x - hitX;
				const yLo = entry + Math.tan(fanLo) * d;
				const yHi = entry + Math.tan(fanHi) * d;
				const thick = Math.max(1.2, yHi - yLo);
				const soft = 0.9 + (d / len) * 2.2;
				const a = beam * (0.26 + (d / len) * 0.34);
				for (let y = yLo - soft; y <= yHi + soft; y++) {
					if (y >= shelfY + 1) break;
					const u = (y - yLo) / thick;
					const hue = s.v.hue + Math.min(1, Math.max(0, u)) * 290;
					const [r2, g2, b2] = hsl(hue, Math.max(74, s.v.sat), 58);
					const out = u < 0 ? -u * thick : u > 1 ? (u - 1) * thick : 0;
					const fall = out > 0 ? Math.max(0, 1 - out / soft) ** 2 : 1;
					const ripple2 = 0.86 + 0.18 * Math.sin(u * 22 + s.t * 0.04 * s.v.speed);
					plot(s, x, y, r2, g2, b2, a * fall * ripple2 * 0.5);
				}
				if (yHi >= shelfY) {
					const uh = Math.min(1, Math.max(0, (shelfY - yLo) / thick));
					const pool = Math.min(1, (yHi - shelfY) / Math.max(1, thick)) * 0.5 + 0.5;
					const deep = (s.h - shelfY) * 0.8 * pool;
					for (let k = 0; k < deep; k++) {
						const py = shelfY + k;
						const kf = k / Math.max(1, deep);
						const [r2, g2, b2] = hsl(s.v.hue + Math.min(1, uh + kf * 0.35) * 290, Math.max(74, s.v.sat), 56 + (1 - kf) * 14);
						const sm = 0.85 + 0.2 * Math.sin(x * 0.3 + k * 1.1);
						plot(s, x, py, r2, g2, b2, beam * (1 - kf) ** 1.7 * 0.62 * sm);
					}
					const [er, eg, eb] = hsl(s.v.hue + uh * 290, Math.max(74, s.v.sat), 68);
					for (let k = 1; k < 5; k++) plot(s, x, shelfY - k, er, eg, eb, beam * (1 - k / 5) ** 2 * 0.3);
				}
			}
			for (let x = hitX; x < s.w; x += 1) {
				const d = x - hitX;
				const yLo = entry + Math.tan(fanLo) * d;
				if (yLo < shelfY) plot(s, x, yLo, 255, 240, 220, beam * 0.3 * (1 - d / len));
			}

			const [lr, lg, lb] = hsl(s.v.hue2, s.v.sat * 0.35, 74);
			const minx = Math.min(verts[0][0], verts[1][0], verts[2][0]);
			const maxx = Math.max(verts[0][0], verts[1][0], verts[2][0]);
			const miny = Math.min(verts[0][1], verts[1][1], verts[2][1]);
			const maxy = Math.max(verts[0][1], verts[1][1], verts[2][1]);
			const sign = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (px - bx) * (ay - by) - (ax - bx) * (py - by);
			for (let y = miny; y <= maxy; y++) {
				for (let x = minx; x <= maxx; x++) {
					const d1 = sign(verts[0][0], verts[0][1], verts[1][0], verts[1][1], x, y);
					const d2 = sign(verts[1][0], verts[1][1], verts[2][0], verts[2][1], x, y);
					const d3 = sign(verts[2][0], verts[2][1], verts[0][0], verts[0][1], x, y);
					const neg = d1 < 0 || d2 < 0 || d3 < 0;
					const pos = d1 > 0 || d2 > 0 || d3 > 0;
					if (neg && pos) continue;
					const glassy = 0.3 + hash2(x, y, id.grain + 12) * 0.12;
					paint(s, x, y, wr * 1.6 + glassy * 34, wg * 1.6 + glassy * 38, wb * 1.7 + glassy * 46, 0.8);
					const inner = Math.max(0, 1 - Math.abs(y - entry) / (R * 0.55));
					if (inner > 0) {
						const ih = s.v.hue + ((y - entry) / (R * 0.55)) * 150 + 150;
						const [ir2, ig2, ib2] = hsl(ih, Math.max(70, s.v.sat), 62);
						plot(s, x, y, ir2, ig2, ib2, inner * inner * beam * 0.28);
					}
					const sheen = Math.sin((x + y) * 0.35 + s.t * 0.05 * s.v.dir);
					if (sheen > 0.7) plot(s, x, y, lr, lg, lb, 0.2);
				}
			}
			for (let k = 0; k < 3; k++) {
				const a = verts[k];
				const b = verts[(k + 1) % 3];
				const elen = Math.hypot(b[0] - a[0], b[1] - a[1]);
				for (let d = 0; d <= elen; d += 0.6) {
					const f = d / elen;
					const x = a[0] + (b[0] - a[0]) * f;
					const y = a[1] + (b[1] - a[1]) * f;
					plot(s, x, y, lr, lg, lb, 0.8);
					plot(s, x, y + 1, lr, lg, lb, 0.3);
				}
			}
			for (let dy = 0; dy < 4; dy++) {
				const sy = shelfY + dy;
				for (let x = cx - R; x <= cx + R; x++) {
					const e = 1 - Math.abs(x - cx) / (R + 0.5);
					paint(s, x, sy, 0, 0, 0, e * (1 - dy / 4) * 0.45);
				}
			}

			for (const [mx, my, msp, mph] of id.motes) {
				const drift = (mx + s.t * 0.0009 * msp * s.v.speed * s.v.dir) % 1;
				const x = drift * s.w;
				const y = entry + Math.sin(s.t * 0.02 * msp + mph) * slitH * 0.55 + (my - 0.5) * slitH * 0.5;
				if (x > hitX) continue;
				const tw = 0.4 + 0.6 * Math.max(0, Math.sin(s.t * 0.08 * msp + mph));
				const core = Math.max(0, 1 - Math.abs(y - entry) / (slitH * 0.8));
				plot(s, x, y, 255, 250, 238, tw * beam * 0.55 * core * edge(x, 0, hitX, s.w * 0.12));
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * p[o + 2];
				p[o + 1] += 0.04 * p[o + 2] * s.v.drift;
				p[o] += Math.sin(p[o + 3]) * 0.06 * s.v.dir;
				if (p[o + 1] > shelfY) {
					p[o + 1] = -1;
					p[o] = s.rnd() * s.w;
				}
				const near = Math.max(0, 1 - Math.abs(p[o + 1] - entry) / (slitH * 1.1));
				if (near <= 0 || p[o] > hitX) continue;
				const tw = 0.35 + 0.65 * Math.max(0, Math.sin(p[o + 3] * 1.4));
				const a = tw * near * near * beam * edge(p[o + 1], -1, shelfY, s.h * 0.16);
				plot(s, p[o], p[o + 1], 255, 250, 240, a * 0.5);
			}
			s.out = Math.min(1, beam * 0.85);
			blit(s);
		}
	};
}
