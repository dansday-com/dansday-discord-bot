import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

function hash2(x: number, y: number, g: number) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (g | 0) * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const CAPS = [
	[28, 48, 50],
	[10, 60, 46],
	[44, 56, 54],
	[350, 46, 52],
	[318, 30, 48],
	[52, 58, 56],
	[6, 38, 40],
	[196, 18, 58]
];

const SOILS = [26, 32, 18, 38, 12];
const LEAVES = [34, 22, 44, 14, 50];

type Myc = {
	soil: number;
	cap: number[];
	glow: number;
	leaf: number;
	litter: number[][];
	chips: number[][];
	stones: number[][];
	stalk: number;
	capW: number;
	gills: number;
	warts: number;
	line: number;
	side: number;
	grain: number;
	branch: number;
	cluster: number;
	period: number;
	seat: number;
};

function mycIdent(s: FxScene): Myc {
	const r = mulberry32(s.v.seed + 3301);
	const soil = SOILS[(r() * SOILS.length) | 0];
	const cap = CAPS[(r() * CAPS.length) | 0];
	const leaf = LEAVES[(r() * LEAVES.length) | 0];
	const glow = 38 + r() * 148;
	const litter: number[][] = [];
	for (let i = 0; i < 20; i++) litter.push([r(), r(), 0.4 + r() * 0.95, (r() - 0.5) * 1.3, r(), r()]);
	const chips: number[][] = [];
	for (let i = 0; i < 6; i++) chips.push([0.08 + r() * 0.84, 0.14 + r() * 0.62, 0.5 + r() * 0.6, (r() - 0.5) * 2.2, r()]);
	const stones: number[][] = [];
	for (let i = 0; i < 8; i++) stones.push([r(), r(), 0.4 + r() * 0.9, r()]);
	return {
		soil,
		cap,
		glow,
		leaf,
		litter,
		chips,
		stones,
		stalk: 0.24 + r() * 0.11,
		capW: 0.72 + r() * 0.34,
		gills: 9 + ((r() * 7) | 0),
		warts: r(),
		line: r(),
		side: r(),
		grain: (r() * 9000) | 0,
		branch: 0.05 + r() * 0.06,
		cluster: r(),
		period: 470 + ((r() * 210) | 0),
		seat: r()
	};
}

function mycLine(id: Myc) {
	return 0.4 + id.line * 0.1;
}

function mycGrow(s: FxScene) {
	const id = (s as any).id as Myc;
	const tips = (s as any).tips as number[][];
	const food = (s as any).food as number[][];
	const mat = (s as any).mat as Float32Array;
	const rg = (s as any).rg as () => number;
	const line = mycLine(id);
	const top = line + 0.04;
	for (let k = tips.length - 1; k >= 0; k--) {
		const t = tips[k];
		let gx = 0;
		let gy = 0;
		for (const f of food) {
			if (f[5] < 0.06) continue;
			const dx = f[0] - t[0];
			const dy = line + f[1] * (1 - line) - t[1];
			const d2 = dx * dx + dy * dy + 0.006;
			const pull = f[5] / d2;
			gx += dx * pull;
			gy += dy * pull;
			if (d2 < 0.003) {
				f[5] = Math.max(0, f[5] - 0.02);
				f[6] = Math.min(1, f[6] + 0.02);
				t[4] = Math.min(1.5, t[4] + 0.22);
			}
		}
		const gl = Math.hypot(gx, gy) + 1e-6;
		t[2] += (gx / gl) * 0.3 + (rg() - 0.5) * 0.8 * s.v.drift;
		t[3] += (gy / gl) * 0.3 + (rg() - 0.5) * 0.8 * s.v.drift;
		const sp = Math.hypot(t[2], t[3]) + 1e-6;
		t[2] /= sp;
		t[3] /= sp;
		const nx = t[0] + t[2] * 0.02;
		let ny = t[1] + t[3] * 0.02;
		if (ny < top) {
			ny = top;
			t[3] = Math.abs(t[3]);
		}
		const x0 = t[0] * s.w;
		const y0 = t[1] * s.h;
		const x1 = nx * s.w;
		const y1 = ny * s.h;
		const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
		const thick = Math.min(1.4, t[4]);
		for (let q = 0; q <= steps; q++) {
			const u = q / steps;
			const px = (x0 + (x1 - x0) * u) | 0;
			const py = (y0 + (y1 - y0) * u) | 0;
			if (px < 0 || py < 0 || px >= s.w || py >= s.h) continue;
			const c = py * s.w + px;
			if (mat[c] < thick) mat[c] = thick;
		}
		t[0] = nx;
		t[1] = ny;
		t[4] -= 0.014;
		t[5] += 1;
		if (t[0] < 0.012 || t[0] > 0.988 || t[1] > 0.988 || t[4] <= 0.08 || t[5] > 200) {
			tips.splice(k, 1);
			continue;
		}
		if (tips.length < 30 && rg() < id.branch) {
			const a = Math.atan2(t[3], t[2]) + (rg() < 0.5 ? -1 : 1) * (0.55 + rg() * 0.75);
			tips.push([t[0], t[1], Math.cos(a), Math.sin(a), t[4] * 0.84, 0]);
		}
	}
	let guard = 0;
	while (tips.length < 6 && guard++ < 10) {
		let pick = food[0];
		for (const f of food) if (f[5] > pick[5]) pick = f;
		const a = rg() * 6.28;
		tips.push([Math.max(0.05, Math.min(0.95, pick[0] + (rg() - 0.5) * 0.1)), top + 0.02 + rg() * 0.3, Math.cos(a), Math.sin(a), 1.15, 0]);
	}
}

export function makeMycelium(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		opaque: true,
		init(s) {
			const id = mycIdent(s);
			(s as any).id = id;
			(s as any).rg = mulberry32(s.v.seed + 5501);
			(s as any).mat = new Float32Array(s.w * s.h);
			(s as any).food = id.chips.map((c) => [c[0], c[1], c[2], c[3], c[4], 1, 0, 0]);
			(s as any).tips = [] as number[][];
			(s as any).spores = [] as number[][];
			(s as any).crumbs = [] as number[][];
			(s as any).puff = 0;
			(s as any).boom = 0;
			for (let i = 0; i < 150; i++) mycGrow(s);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Myc;
			const mat = (s as any).mat as Float32Array;
			const food = (s as any).food as number[][];
			const spores = (s as any).spores as number[][];
			const crumbs = (s as any).crumbs as number[][];
			const rg = (s as any).rg as () => number;
			const line = mycLine(id);
			const litY = s.h * line;
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;

			if (s.t % 2 === 0) mycGrow(s);
			if (s.t % 3 === 0) for (let i = 0; i < mat.length; i++) mat[i] *= 0.997;
			if (cyc < 0.02) for (let i = 0; i < mat.length; i++) mat[i] *= 0.9;

			const spread = cyc < 0.2 ? cyc / 0.2 : 1;
			const push = cyc < 0.2 ? 0 : Math.min(1, (cyc - 0.2) / 0.08);
			const rise = cyc < 0.24 ? 0 : Math.min(1, (cyc - 0.24) / 0.2);
			const open = cyc < 0.46 ? 0 : Math.min(1, (cyc - 0.46) / 0.14);
			const ripe = cyc < 0.58 ? 0 : cyc < 0.86 ? Math.min(1, (cyc - 0.58) / 0.08) : Math.max(0, 1 - (cyc - 0.86) / 0.05);
			const wilt = cyc < 0.88 ? 0 : (cyc - 0.88) / 0.12;
			const burst = cyc >= 0.775 && cyc < 0.83;
			const crack = cyc >= 0.2 && cyc < 0.215;

			const [ar, ag, ab] = hsl(id.soil + 16, 20, 13);
			const beamX = id.side > 0.5 ? s.w * 0.26 : s.w * 0.74;
			const slope = id.side > 0.5 ? 0.42 : -0.42;
			const [lr, lg, lb] = hsl(48, 46, 74);
			for (let y = 0; y < litY; y++) {
				const v = y / Math.max(1, litY);
				for (let x = 0; x < s.w; x++) {
					const n = hash2(x, y, id.grain + 5);
					const g = 0.3 + v * 0.8 + (n - 0.5) * 0.1;
					paint(s, x, y, ar * g, ag * g, ab * g, 1);
					const beam = 1 - Math.abs(x - (beamX + slope * y)) / (s.w * (0.05 + v * 0.12));
					if (beam > 0) plot(s, x, y, lr, lg, lb, beam * beam * 0.14 * (0.3 + v * 0.7));
				}
			}

			const [dr, dg, db] = hsl(id.soil, 38, 26);
			for (let y = litY | 0; y < s.h; y++) {
				const v = (y - litY) / Math.max(1, s.h - litY);
				for (let x = 0; x < s.w; x++) {
					const n = hash2(x, y, id.grain);
					const n2 = hash2(x >> 1, y >> 1, id.grain + 3);
					const g = (0.98 - v * 0.5) * (0.72 + n * 0.34 + n2 * 0.16);
					paint(s, x, y, dr * g, dg * g, db * g, 1);
				}
			}

			const [kr, kg, kb] = hsl(id.soil - 8, 12, 36);
			for (const st of id.stones) {
				const cx = st[0] * s.w;
				const cy = litY + (0.14 + st[1] * 0.8) * (s.h - litY);
				const rr = 1.3 + st[2] * 2.2;
				for (let dy = -rr; dy <= rr; dy++) {
					for (let dx = -rr * 1.4; dx <= rr * 1.4; dx++) {
						const d = Math.hypot(dx / 1.4, dy);
						if (d > rr) continue;
						const n = hash2(cx + dx, cy + dy, id.grain + 11);
						const lit = 0.5 + Math.max(0, -dy / rr) * 0.7 + (n - 0.5) * 0.26;
						paint(s, cx + dx, cy + dy, kr * lit, kg * lit, kb * lit, 1);
					}
				}
			}

			const [wr, wg, wb] = hsl(30, 42, 46);
			for (const f of food) {
				const cx = f[0] * s.w;
				const cy = litY + f[1] * (s.h - litY);
				const hw = 1.8 + f[2] * 3.4;
				const hh = 1 + f[2] * 1.6;
				const co = Math.cos(f[3]);
				const si = Math.sin(f[3]);
				const rot = 0.26 + f[5] * 0.74;
				for (let dy = -hh - 1; dy <= hh + 1; dy++) {
					for (let dx = -hw - 1; dx <= hw + 1; dx++) {
						const u = (dx * co + dy * si) / hw;
						const v2 = (-dx * si + dy * co) / hh;
						if (u * u + v2 * v2 > 1) continue;
						const gr = Math.abs(Math.sin(v2 * 5.4 + f[4] * 6)) * 0.3;
						const lit = (0.5 + (1 - Math.abs(v2)) * 0.55 - gr) * rot;
						paint(s, cx + dx, cy + dy, wr * lit, wg * lit, wb * lit, 1);
					}
				}
			}

			const [hr2, hg2, hb2] = hsl(id.glow, 16, 62);
			const [cr3, cg3, cb3] = hsl(id.glow + 18, 30, 90);
			const flare = 0.62 + 0.38 * Math.sin(s.t * 0.05) + ripe * 0.5;
			for (let y = litY | 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const m = mat[y * s.w + x];
					if (m < 0.42) continue;
					const a = Math.min(0.3, (m - 0.42) * 0.36) * spread * flare;
					plot(s, x, y, hr2, hg2, hb2, a);
					if (m > 1.15) plot(s, x, y, cr3, cg3, cb3, (m - 1.15) * 0.5 * spread * flare);
				}
			}
			for (const f of food) {
				if (f[6] < 0.05) continue;
				const cx = f[0] * s.w;
				const cy = litY + f[1] * (s.h - litY);
				const pulse = 0.5 + 0.5 * Math.sin(s.t * 0.1 + f[4] * 9);
				const [gr2, gg2, gb2] = hsl(id.glow, 40, 80);
				const hr = 2.4 + f[2] * 3.4;
				for (let dy = -hr; dy <= hr; dy++) {
					for (let dx = -hr; dx <= hr; dx++) {
						const d = Math.hypot(dx, dy) / hr;
						if (d > 1) continue;
						plot(s, cx + dx, cy + dy, gr2, gg2, gb2, (1 - d) * (1 - d) * 0.13 * f[6] * pulse);
					}
				}
			}

			const drawLitter = (front: boolean) => {
				for (const p of id.litter) {
					if (p[5] > 0.62 !== front) continue;
					const cx = p[0] * s.w;
					const cy = litY + (p[1] - 0.45) * s.h * 0.07;
					const co = Math.cos(p[3]);
					const si = Math.sin(p[3]);
					const twig = p[4] > 0.74;
					const hw = 2.2 + p[2] * 4.8;
					const hh = (0.9 + p[2] * 1.5) * (twig ? 0.44 : 1);
					const [r2, g2, b2] = hsl(id.leaf + (p[4] - 0.5) * 30, twig ? 20 : 48, twig ? 24 : 32 + p[4] * 18);
					for (let dy = -hh - 1; dy <= hh + 1; dy++) {
						for (let dx = -hw - 1; dx <= hw + 1; dx++) {
							const u = (dx * co + dy * si) / hw;
							const v2 = (-dx * si + dy * co) / hh;
							if (u * u + v2 * v2 > 1) continue;
							const rib = !twig && Math.abs(v2) < 0.2 ? 0.68 : 1;
							const lit = (0.56 + (1 - Math.abs(v2)) * 0.55 - Math.abs(u) * 0.2) * rib;
							paint(s, cx + dx, cy + dy, r2 * lit, g2 * lit, b2 * lit, 1);
						}
					}
				}
			};
			drawLitter(false);

			const nf = 1 + (id.cluster > 0.55 ? 1 : 0) + (id.cluster > 0.84 ? 1 : 0);
			const seatX = 0.24 + id.seat * 0.52;
			const baseY = litY + 2;

			if (crack) {
				for (let i = 0; i < nf; i++) {
					const bx = (seatX + (i - (nf - 1) / 2) * 0.115) * s.w;
					for (let j = 0; j < 9; j++) {
						const a = -Math.PI * (0.18 + rg() * 0.64);
						const pw = 0.5 + rg() * 1.2;
						crumbs.push([bx + (rg() - 0.5) * 5, baseY - 1, Math.cos(a) * pw, Math.sin(a) * pw, 0, rg()]);
					}
				}
			}

			let lamp = 0;
			for (let i = 0; i < nf; i++) {
				const sz = (nf === 1 ? 1.26 : 1) - Math.abs(i - (nf - 1) / 2) * 0.24;
				const bx = (seatX + (i - (nf - 1) / 2) * 0.115) * s.w;
				const stemH = s.h * id.stalk * sz * rise * (1 - wilt * 0.36);
				if (stemH < 0.6) continue;
				const bend = ((i - (nf - 1) / 2) * 0.5 + (id.seat - 0.5) * 0.6 + wilt * 1.5) * stemH * 0.2;
				lamp = Math.max(lamp, ripe * sz);

				const [str, stg, stb] = hsl(id.cap[0] + 10, 14, 78 - wilt * 38);
				for (let j = 0; j <= stemH; j++) {
					const f = j / Math.max(1, stemH);
					const wq = (0.9 + (1 - f) * 0.9 + (f < 0.16 ? (0.16 - f) * 7 : 0)) * sz;
					const px = bx + bend * f * f;
					for (let dx = -wq; dx <= wq; dx++) {
						const e = 1 - Math.abs(dx) / (wq + 0.5);
						const fib = 0.8 + hash2(dx * 3, j, id.grain + 7) * 0.34;
						const lit = (0.46 + e * 0.64) * fib;
						paint(s, px + dx, baseY - j, str * lit, stg * lit, stb * lit, 1);
					}
				}

				if (open > 0.3) {
					const rgo = Math.min(1, (open - 0.3) / 0.35);
					const ry = baseY - stemH * 0.68;
					const rw = (1.6 + sz * 1.4) * rgo;
					const rx = bx + bend * 0.46;
					for (let dx = -rw; dx <= rw; dx++) {
						const e = 1 - Math.abs(dx) / (rw + 0.5);
						paint(s, rx + dx, ry, str * (0.7 + e * 0.5), stg * (0.7 + e * 0.5), stb * (0.7 + e * 0.5), 1);
						paint(s, rx + dx * 0.8, ry + 1, str * 0.48, stg * 0.48, stb * 0.48, 1);
					}
				}

				const capX = bx + bend;
				const capY = baseY - stemH;
				const cw = stemH * id.capW * (0.46 + open * 0.44) * (1 + wilt * 0.2);
				const ch = cw * (0.86 - open * 0.36) * (1 - wilt * 0.3);
				const [c0, c1, c2] = hsl(id.cap[0] + (sz - 0.8) * 24, id.cap[1] * (1 - wilt * 0.55), id.cap[2] * (1 - wilt * 0.48));
				const [g0, g1, g2b] = hsl(id.cap[0], 14, 76 - wilt * 36);
				const face = id.side > 0.5 ? -1 : 1;
				for (let dx = -cw; dx <= cw; dx++) {
					const u = dx / cw;
					if (Math.abs(u) > 1) continue;
					const dome = Math.pow(Math.max(0, 1 - u * u), 0.6);
					const droop = wilt * ch * 1.2 * u * u;
					const top = capY - dome * ch + droop;
					const bot = capY + (1 - Math.abs(u)) * ch * 0.22 + droop;
					for (let y = top; y <= bot; y++) {
						const dv = (y - top) / Math.max(0.5, bot - top);
						const lit = 0.48 + dome * 0.5 + u * face * 0.26 - dv * 0.3;
						const wart = id.warts > 0.45 && dv < 0.5 && hash2(dx * 5, y * 5, id.grain + 21) < 0.08 ? 0.5 : 0;
						paint(s, capX + dx, y, Math.min(255, c0 * lit + wart * 165), Math.min(255, c1 * lit + wart * 158), Math.min(255, c2 * lit + wart * 150), 1);
					}
					if (Math.abs(u) > 0.84) plot(s, capX + dx, top + 0.5, c0, c1, c2, 0.22);
					if (open > 0.16) {
						const gd = ch * 0.5 * open * (1 - wilt * 0.6);
						for (let y = bot; y <= bot + gd; y++) {
							const gl2 = Math.abs(Math.sin(u * id.gills * 1.7));
							const fadeY = 1 - (y - bot) / (gd + 0.7);
							const lit = 0.3 + gl2 * 0.26 + dome * 0.14;
							paint(s, capX + dx, y, g0 * lit, g1 * lit, g2b * lit, Math.min(0.9, fadeY * 1.2 * dome));
						}
					}
				}

				if (ripe > 0.01) {
					const [gr3, gg3, gb3] = hsl(id.glow, 44, 84);
					const hx = cw * 1.9;
					const hy = ch * 3.4;
					for (let dy = -hy; dy <= hy; dy++) {
						for (let dx = -hx; dx <= hx; dx++) {
							const d = Math.hypot(dx / hx, dy / hy);
							if (d > 1) continue;
							plot(s, capX + dx, capY + dy, gr3, gg3, gb3, (1 - d) * (1 - d) * 0.16 * ripe);
						}
					}
				}

				if (burst) {
					for (let j = 0; j < 7; j++) {
						const side = rg() < 0.5 ? -1 : 1;
						const u = 0.2 + rg() * 0.8;
						spores.push([capX + side * u * cw, capY + ch * 0.34 + rg() * 3, side * (0.16 + rg() * 0.42), 0.04 + rg() * 0.26, 0, rg()]);
					}
				}
			}

			const [pr, pg, pb] = hsl(id.glow, 30, 88);
			for (let k = spores.length - 1; k >= 0; k--) {
				const q = spores[k];
				q[4] += 1;
				q[2] += (rg() - 0.5) * 0.05 * s.v.drift;
				q[3] -= 0.009 * s.v.speed;
				q[3] = Math.max(-0.42, q[3]);
				q[0] += q[2] * s.v.speed;
				q[1] += q[3] * s.v.speed;
				if (q[0] < -1 || q[0] > s.w + 1 || q[1] < -2 || q[4] > 300) {
					spores.splice(k, 1);
					continue;
				}
				const a = edge(q[4], 0, 300, 60) * (0.16 + q[5] * 0.3);
				plot(s, q[0], q[1], pr, pg, pb, a);
				if (q[5] > 0.7) plot(s, q[0] + 1, q[1], pr, pg, pb, a * 0.35);
			}

			const [xr, xg, xb] = hsl(id.leaf, 40, 34);
			for (let k = crumbs.length - 1; k >= 0; k--) {
				const q = crumbs[k];
				q[4] += 1;
				q[3] += 0.08;
				q[0] += q[2];
				q[1] += q[3];
				if (q[1] > baseY || q[4] > 60) {
					crumbs.splice(k, 1);
					continue;
				}
				paint(s, q[0], q[1], xr, xg, xb, 1);
				if (q[5] > 0.6) paint(s, q[0] + 1, q[1], xr * 0.8, xg * 0.8, xb * 0.8, 1);
			}

			drawLitter(true);

			for (let i = 0; i < 10; i++) {
				const ph = i * 2.2 + id.side * 6;
				const my = ((s.t * 0.14 * s.v.speed + i * 27) % (litY + 10)) - 5;
				const mx = beamX + slope * (litY - my) + Math.sin(s.t * 0.024 + ph) * s.w * 0.045;
				plot(s, mx, litY - my, lr, lg, lb, 0.3 * edge(my, -5, litY + 5, 9));
			}

			let boom = (s as any).boom as number;
			let puff = (s as any).puff as number;
			if (crack) boom = 1;
			if (burst) puff = 1;
			if (boom > 0) boom = Math.max(0, boom - 0.05);
			if (puff > 0) puff = Math.max(0, puff - 0.018);
			(s as any).boom = boom;
			(s as any).puff = puff;
			s.out = Math.min(1, puff * 0.85 + boom * 0.45 + lamp * 0.34 + push * 0.08 + 0.05);
			blit(s);
		}
	};
}

type Reef = {
	heads: number[][];
	fans: number[][];
	floor: number[];
	rocks: number[][];
	fish: number[][];
	surge: number;
	grain: number;
	caust: number;
};

function reefIdent(s: FxScene): Reef {
	const r = mulberry32(s.v.seed + 4127);
	const heads: number[][] = [];
	for (let i = 0; i < 6; i++) heads.push([0.06 + r() * 0.88, 0.22 + r() * 0.36, r() * 6.28, 0.6 + r() * 0.8, r()]);
	const fans: number[][] = [];
	for (let i = 0; i < 5; i++) fans.push([0.05 + r() * 0.9, 0.16 + r() * 0.3, r() * 6.28, r()]);
	const floor: number[] = [];
	for (let i = 0; i < 12; i++) floor.push(r());
	const rocks: number[][] = [];
	for (let i = 0; i < 5; i++) rocks.push([r(), 0.05 + r() * 0.08, r()]);
	const fish: number[][] = [];
	for (let i = 0; i < 9; i++) fish.push([r(), 0.2 + r() * 0.5, 0.4 + r() * 0.9, r() * 6.28, r() < 0.5 ? -1 : 1]);
	const surge = 260 + ((r() * 200) | 0);
	const grain = (r() * 9999) | 0;
	const caust = 0.5 + r() * 0.7;
	return { heads, fans, floor, rocks, fish, surge, grain, caust };
}

function coralBranch(s: FxScene, x: number, y: number, ang: number, len: number, wide: number, depth: number, bend: number, col: number[], lit: number) {
	if (depth <= 0 || len < 1) return;
	const steps = Math.max(2, len | 0);
	let cx = x;
	let cy = y;
	let a = ang;
	const turn = Math.max(-0.9, Math.min(0.9, bend)) / steps;
	for (let i = 0; i < steps; i++) {
		a += turn;
		cx += Math.cos(a);
		cy += Math.sin(a);
		const f = 1 - i / steps;
		const thick = Math.max(0.5, wide * (0.35 + f * 0.65));
		for (let q = -thick; q <= thick; q++) {
			const e = 1 - Math.abs(q) / (thick + 0.4);
			const nx = cx + Math.cos(a + Math.PI / 2) * q;
			const ny = cy + Math.sin(a + Math.PI / 2) * q;
			const shade = 0.55 + e * 0.75;
			paint(s, nx, ny, col[0] * shade * lit, col[1] * shade * lit, col[2] * shade * lit, Math.min(1, 0.5 + e));
			if (e > 0.75) plot(s, nx, ny - 0.5, col[0], col[1] * 1.05, col[2] * 1.1, 0.16 * lit);
		}
	}
	const sp = 0.42 + (depth % 2) * 0.12;
	coralBranch(s, cx, cy, a - sp, len * 0.68, wide * 0.68, depth - 1, bend, col, lit);
	coralBranch(s, cx, cy, a + sp, len * 0.6, wide * 0.62, depth - 1, -bend, col, lit);
}

export function makeCoral(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.3,
		init(s) {
			const id = reefIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.3 + s.rnd() * 0.8;
				s.parts[o + 3] = s.rnd() * 6.28;
				s.parts[o + 4] = s.rnd();
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Reef;
			const p = s.parts;
			const cyc = ((s.t * s.v.speed) % id.surge) / id.surge;
			const surge = cyc < 0.34 ? Math.sin((cyc / 0.34) * Math.PI) : 0;
			const sway = (Math.sin(s.t * 0.018 * s.v.speed) * 0.4 + surge * 1.5) * s.v.dir;

			const [dr, dg, db] = hsl(s.v.hue2, 40 + s.v.sat * 0.3, 10);
			const [sr, sg, sb] = hsl(s.v.hue2 - 12, 46 + s.v.sat * 0.3, 34);
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const k = (1 - f) ** 1.5;
				for (let x = 0; x < s.w; x++) paint(s, x, y, dr + (sr - dr) * k, dg + (sg - dg) * k, db + (sb - db) * k, 1);
			}
			for (let x = 0; x < s.w; x++) {
				const shaft = Math.sin(x * 0.05 + s.t * 0.006 * s.v.speed) + Math.sin(x * 0.017 - s.t * 0.004);
				if (shaft < 0.7) continue;
				const a = (shaft - 0.7) * 0.5;
				for (let y = 0; y < s.h * 0.75; y++) plot(s, x + y * 0.22 * s.v.dir, y, 220, 250, 255, a * (1 - y / (s.h * 0.75)) ** 2 * 0.3);
			}

			const floorY = (x: number) => {
				const u = (x / s.w) * 11;
				const i = u | 0;
				const f = u - i;
				const a = id.floor[i];
				const b = id.floor[Math.min(11, i + 1)];
				const sm = f * f * (3 - 2 * f);
				return s.h * (0.8 + (a + (b - a) * sm) * 0.14);
			};
			const [fr, fg, fb] = hsl(s.v.hue2 + 20, 18 + s.v.sat * 0.14, 26);
			for (let x = 0; x < s.w; x++) {
				const y0 = floorY(x);
				for (let y = y0; y < s.h; y++) {
					const g = hash2(x, y, id.grain) * 0.4 + hash2(x >> 1, y >> 1, id.grain + 3) * 0.3;
					const d = (y - y0) / Math.max(1, s.h - y0);
					const k = (0.75 + g) * (1 - d * 0.45);
					paint(s, x, y, fr * k, fg * k, fb * k * 0.95, 1);
				}
				for (let k = 0; k < 3; k++) {
					const cw = Math.sin(x * 0.19 + s.t * 0.03 * s.v.speed * id.caust + k * 2) * Math.sin(x * 0.07 - s.t * 0.02 + k);
					if (cw > 0.55) plot(s, x, y0 + k * 1.4, 190, 250, 255, (cw - 0.55) * 0.7 * (1 - k / 3));
				}
			}
			for (const [rx, rr, rt] of id.rocks) {
				const bx = rx * s.w;
				const by = floorY(bx);
				const rw = rr * s.w;
				const rh = rr * s.h * 1.1;
				for (let dy = -rh; dy <= 1; dy++)
					for (let dx = -rw; dx <= rw; dx++) {
						const d = Math.hypot(dx / rw, dy / rh);
						if (d > 0.85 + hash2(dx | 0, dy | 0, id.grain + 9) * 0.22) continue;
						const lit = 0.65 + (1 - d) * 0.4 - (dy / rh) * 0.3 + rt * 0.1;
						paint(s, bx + dx, by + dy, fr * lit * 0.9, fg * lit * 0.92, fb * lit, 1);
					}
			}

			for (const [fx, fh, fph, ft] of id.fans) {
				const bx = fx * s.w;
				const by = floorY(bx);
				const [r2, g2, b2] = hsl(s.v.hue + 200 + ft * 90, Math.max(45, s.v.sat * 0.8), 30);
				const H = fh * s.h;
				const ribs = 7;
				const lean0 = Math.sin(fph + s.t * 0.03 * s.v.speed) * (0.28 + surge * 0.5) * s.v.dir;
				const spread = 0.5 + ft * 0.3;
				const pts: number[][] = [];
				for (let rb = 0; rb < ribs; rb++) {
					const u = rb / (ribs - 1) - 0.5;
					const baseA = -Math.PI / 2 + u * spread;
					const rl = H * (0.7 + 0.3 * Math.cos(u * 2.4));
					let px2 = bx;
					let py2 = by;
					let aa = baseA;
					const col: number[] = [];
					for (let d = 0; d < rl; d += 0.7) {
						const f = d / rl;
						aa = baseA + lean0 * f * f;
						px2 = bx + Math.cos(aa) * d;
						py2 = by + Math.sin(aa) * d;
						col.push(px2, py2);
						const e = 1 - f * 0.4;
						paint(s, px2, py2, r2 * (1 + e * 0.5), g2 * (1 + e * 0.4), b2 * (1 + e * 0.4), 0.9);
					}
					pts.push(col);
				}
				for (let rb = 0; rb + 1 < pts.length; rb++) {
					const A = pts[rb];
					const B = pts[rb + 1];
					const nn = Math.min(A.length, B.length) / 2;
					for (let i = 2; i < nn; i++) {
						const f = i / nn;
						const ax = A[i * 2];
						const ay = A[i * 2 + 1];
						const bx2 = B[i * 2];
						const by2 = B[i * 2 + 1];
						const seg = Math.hypot(bx2 - ax, by2 - ay);
						for (let q = 0; q <= seg; q += 1) {
							const g = seg === 0 ? 0 : q / seg;
							const mesh = Math.sin(i * 1.9 + g * 7 + rb * 2.1);
							if (mesh < 0.25) continue;
							paint(s, ax + (bx2 - ax) * g, ay + (by2 - ay) * g, r2 * 0.85, g2 * 0.85, b2 * 0.9, Math.min(0.8, (mesh - 0.25) * 1.4 * (1 - f * 0.3)));
						}
					}
				}
			}

			for (const [hx, hh, hph, hsp, ht] of id.heads) {
				const bx = hx * s.w;
				const by = floorY(bx);
				const hue = s.v.hue + ht * 70;
				const col = hsl(hue, Math.max(50, s.v.sat), 48 + ht * 14) as unknown as number[];
				const bendv = Math.sin(hph + s.t * 0.024 * s.v.speed * hsp) * (0.35 + s.v.drift * 0.4) * (1 + surge * 1.1) * s.v.dir;
				const lit = 0.85 + surge * 0.3;
				coralBranch(s, bx, by, -Math.PI / 2 + sway * 0.1, hh * s.h * 0.5, Math.max(1.2, s.w * 0.016), 4, bendv * 0.5, col, lit);
				for (let k = 0; k < 5; k++) {
					const px2 = bx + Math.cos(k * 1.7 + hph) * s.w * 0.02;
					const py2 = by - hh * s.h * 0.1;
					const pol = 0.4 + 0.6 * Math.max(0, Math.sin(s.t * 0.05 * hsp + k + hph));
					plot(s, px2, py2 - pol * 2, col[0], col[1] * 1.1, col[2] * 1.2, 0.4 * pol);
				}
			}

			for (const [fx, fy, fsp, fph, fdir] of id.fish) {
				const dir2 = fdir * s.v.dir;
				const prog = (fx + s.t * 0.0016 * fsp * s.v.speed * (1 + surge * 1.6) * dir2) % 1;
				const x = (((prog % 1) + 1) % 1) * s.w;
				const y = fy * s.h + Math.sin(s.t * 0.05 * fsp + fph) * s.h * 0.04 - surge * s.h * 0.05;
				const [r2, g2, b2] = hsl(s.v.hue + 150 + fph * 20, Math.max(60, s.v.sat), 62);
				const fe = edge(x, 0, s.w, s.w * 0.12);
				for (let dx = -2; dx <= 2; dx++)
					for (let dy = -1; dy <= 1; dy++) {
						const d = Math.hypot(dx / 2.4, dy / 1.2);
						if (d > 1) continue;
						paint(s, x + dx, y + dy, r2, g2, b2, (1 - d * 0.55) * fe);
					}
				const tail = Math.sin(s.t * 0.3 * fsp + fph) * 1.2;
				plot(s, x - 3 * dir2, y + tail * 0.4, r2, g2, b2, 0.7 * fe);
				plot(s, x - 4 * dir2, y + tail, r2, g2, b2, 0.4 * fe);
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o + 3] += 0.03;
				p[o] += (0.1 + surge * 1.2) * s.v.dir * p[o + 2] + Math.sin(p[o + 3]) * 0.2;
				p[o + 1] -= 0.06 * p[o + 2] * (1 + surge);
				if (p[o + 1] < -1) {
					p[o + 1] = s.h + 1;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] > s.w + 1) p[o] = -1;
				if (p[o] < -1) p[o] = s.w + 1;
				const a = (0.1 + p[o + 4] * 0.3) * edge(p[o + 1], -1, s.h + 1, s.h * 0.2) * edge(p[o], -1, s.w + 1, s.w * 0.1);
				plot(s, p[o], p[o + 1], 220, 244, 250, a * (0.5 + surge * 0.7));
			}

			s.out = Math.min(1, 0.12 + surge * 0.85);
			blit(s);
		}
	};
}

type Crust = {
	colonies: number[][];
	harm: number[][];
	cracks: number[][];
	grain: number;
	damp: number;
	moss: number[][];
};

function crustIdent(s: FxScene): Crust {
	const r = mulberry32(s.v.seed + 5519);
	const colonies: number[][] = [];
	for (let i = 0; i < 7; i++) colonies.push([0.06 + r() * 0.88, 0.1 + r() * 0.8, 0.55 + r() * 0.65, r(), r() * 6.28]);
	const harm: number[][] = [];
	for (let i = 0; i < 7; i++) {
		const h: number[] = [];
		for (let k = 0; k < 8; k++) h.push(r());
		harm.push(h);
	}
	const cracks: number[][] = [];
	for (let i = 0; i < 5; i++) cracks.push([r(), r(), r() * 6.28, 0.3 + r() * 0.6]);
	const moss: number[][] = [];
	for (let i = 0; i < 6; i++) moss.push([r(), r(), 0.3 + r() * 0.6]);
	const grain = (r() * 9999) | 0;
	const damp = 300 + ((r() * 220) | 0);
	return { colonies, harm, cracks, grain, damp, moss };
}

export function makeLichen(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.12,
		init(s) {
			const id = crustIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.3 + s.rnd() * 0.7;
				s.parts[o + 3] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Crust;
			const cyc = ((s.t * s.v.speed) % id.damp) / id.damp;
			const wet = cyc < 0.16 ? cyc / 0.16 : cyc < 0.46 ? 1 - (cyc - 0.16) / 0.3 : 0;
			const rain = cyc < 0.14 ? 1 : 0;

			const [rr, rg, rb] = hsl(s.v.hue2 + 6, 6 + s.v.sat * 0.1, 30);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const n = hash2(x >> 1, y >> 1, id.grain) * 0.5 + hash2(x >> 2, y >> 2, id.grain + 5) * 0.35 + hash2(x, y, id.grain + 9) * 0.18;
					const bevel = 0.85 + (n - 0.5) * 0.9;
					const dark = 1 - wet * 0.3;
					paint(s, x, y, rr * bevel * dark, rg * bevel * dark, rb * bevel * dark, 1);
				}
			}
			for (const [cx0, cy0, ca, clen] of id.cracks) {
				let x = cx0 * s.w;
				let y = cy0 * s.h;
				let a = ca;
				const L = clen * Math.max(s.w, s.h);
				for (let d = 0; d < L; d += 0.8) {
					a += (hash2(d | 0, cx0 * 100, id.grain + 21) - 0.5) * 0.35;
					x += Math.cos(a) * 0.8;
					y += Math.sin(a) * 0.8;
					if (x < 0 || y < 0 || x >= s.w || y >= s.h) break;
					const deep = 0.5 + wet * 0.4;
					paint(s, x, y, rr * 0.35, rg * 0.35, rb * 0.4, deep);
					paint(s, x, y - 1, rr * 1.5, rg * 1.5, rb * 1.5, 0.3);
				}
			}

			const grow = Math.min(1, s.t / 420);
			const maxR = Math.min(s.w, s.h) * 0.17;
			for (let ci = 0; ci < id.colonies.length; ci++) {
				const [nx, ny, sc, tint, ph] = id.colonies[ci];
				const h = id.harm[ci];
				const cx = nx * s.w;
				const cy = ny * s.h;
				const R = maxR * sc * (0.5 + grow * 0.5);
				const hue = s.v.hue + tint * 80;
				const bodyL = 30 + tint * 12 + wet * 10;
				const [lr, lg, lb] = hsl(hue, (18 + s.v.sat * 0.3) * (1 + wet * 0.5), bodyL);
				const [er, eg, eb] = hsl(hue + 14, 12 + s.v.sat * 0.2, bodyL + 24);
				for (let dy = -R * 1.1; dy <= R * 1.1; dy++) {
					for (let dx = -R * 1.1; dx <= R * 1.1; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > R * 1.15) continue;
						const th = Math.atan2(dy, dx);
						let lobe = 1;
						for (let k = 0; k < 4; k++) lobe += Math.sin(th * (3 + k * 2) + ph + h[k] * 6.28) * (0.16 - k * 0.03) * h[k + 4];
						const edgeR = R * lobe;
						const u = d / Math.max(0.5, edgeR);
						if (u > 1) continue;
						const px2 = cx + dx;
						const py2 = cy + dy;
						const gn = hash2(px2 | 0, py2 | 0, id.grain + 30 + ci);
						if (u > 0.62 && gn > 1.35 - u) continue;
						const crust = 0.7 + gn * 0.55;
						const rim = u > 0.78 ? (u - 0.78) / 0.22 : 0;
						const r2 = lr * crust + (er - lr) * rim;
						const g2 = lg * crust + (eg - lg) * rim;
						const b2 = lb * crust + (eb - lb) * rim;
						paint(s, px2, py2, r2, g2, b2, Math.min(1, 0.7 + gn * 0.4));
						const ridge = Math.sin(d * 1.6 - ph * 2) * Math.sin(th * 7 + ph);
						if (ridge > 0.6) plot(s, px2, py2, er, eg, eb, (ridge - 0.6) * 0.5 * (1 + wet));
					}
				}
				for (let k = 0; k < 9; k++) {
					const th = (k / 9) * 6.28 + ph;
					const d = R * (0.2 + hash2(k, ci, id.grain + 44) * 0.55);
					const ax = cx + Math.cos(th) * d;
					const ay = cy + Math.sin(th) * d;
					const rad = 1 + wet * 0.7;
					const [ar2, ag2, ab2] = hsl(hue - 20, 30 + s.v.sat * 0.3, 22 + wet * 14);
					for (let oy = -rad; oy <= rad; oy++)
						for (let ox = -rad; ox <= rad; ox++) {
							const dd = Math.hypot(ox, oy) / rad;
							if (dd > 1) continue;
							paint(s, ax + ox, ay + oy, ar2, ag2, ab2, 1 - dd * 0.4);
						}
					plot(s, ax, ay - rad * 0.4, 230, 240, 230, 0.25 * (0.4 + wet));
				}
			}

			for (const [mx, my, msc] of id.moss) {
				const bx = mx * s.w;
				const by = my * s.h;
				const [mr, mg, mb] = hsl(100 + (s.v.hue % 40), 30 + s.v.sat * 0.3, 22 + wet * 16);
				const n = (6 + msc * 10) | 0;
				for (let k = 0; k < n; k++) {
					const hgt = (1.5 + hash2(k, mx * 90, id.grain + 61) * 3) * (1 + wet * 0.5);
					const ox = (hash2(k, my * 90, id.grain + 62) - 0.5) * s.w * 0.05 * msc;
					const lean = Math.sin(s.t * 0.03 * s.v.speed + k) * 0.4 * s.v.drift;
					for (let d = 0; d < hgt; d++) {
						const f = d / hgt;
						paint(s, bx + ox + lean * f, by - d, mr * (0.7 + f * 0.6), mg * (0.7 + f * 0.7), mb * 0.9, 0.85);
					}
					plot(s, bx + ox + lean, by - hgt, mr * 1.4, mg * 1.5, mb, 0.5 * (0.4 + wet));
				}
			}

			if (rain) {
				for (let i = 0; i < s.n; i++) {
					const o = i * P;
					const p = s.parts;
					p[o + 1] += (1.6 + p[o + 2] * 2.2) * s.v.speed;
					p[o] += 0.3 * s.v.dir * s.v.drift;
					if (p[o + 1] > s.h) {
						p[o + 1] = -2;
						p[o] = s.rnd() * s.w;
					}
					if (p[o] > s.w) p[o] = 0;
					if (p[o] < 0) p[o] = s.w;
					const a = 0.4 * p[o + 2] * edge(p[o + 1], -2, s.h, s.h * 0.15);
					for (let k = 0; k < 3; k++) plot(s, p[o], p[o + 1] - k, 200, 225, 245, a * (1 - k / 3));
				}
			}
			if (wet > 0) {
				for (let i = 0; i < s.n; i += 3) {
					const o = i * P;
					const p = s.parts;
					const gx = (p[o] * 1.7) % s.w;
					const gy = (p[o + 1] * 1.3) % s.h;
					const tw = 0.4 + 0.6 * Math.max(0, Math.sin(s.t * 0.06 + p[o + 3]));
					plot(s, gx, gy, 235, 245, 255, tw * wet * 0.45);
				}
			}

			s.out = Math.min(1, 0.1 + wet * 0.8);
			blit(s);
		}
	};
}

type Colony = {
	nest: number[];
	piles: number[][];
	evap: number;
	pebbles: number[][];
	twigs: number[][];
	grain: number;
	dropPeriod: number;
	dropAt: number[];
};

function colonyIdent(s: FxScene): Colony {
	const r = mulberry32(s.v.seed + 6113);
	const nest = [0.14 + r() * 0.72, 0.18 + r() * 0.64];
	const piles: number[][] = [];
	for (let i = 0; i < 4; i++) piles.push([0.08 + r() * 0.84, 0.12 + r() * 0.76, r()]);
	const pebbles: number[][] = [];
	for (let i = 0; i < 9; i++) pebbles.push([r(), r(), 0.6 + r() * 1.4, r()]);
	const twigs: number[][] = [];
	for (let i = 0; i < 4; i++) twigs.push([r(), r(), r() * 6.28, 0.08 + r() * 0.14]);
	const evap = 0.975 + r() * 0.018;
	const grain = (r() * 9999) | 0;
	const dropPeriod = 320 + ((r() * 240) | 0);
	const dropAt = [0.15 + r() * 0.7, 0.15 + r() * 0.7];
	return { nest, piles, evap, pebbles, twigs, grain, dropPeriod, dropAt };
}

function drawAnt(s: FxScene, x: number, y: number, ang: number, carry: boolean, col: number[], lit: number) {
	const cx = Math.cos(ang);
	const cy = Math.sin(ang);
	const px = -cy;
	const py = cx;
	for (let k = -1; k <= 1; k++) {
		const kick = Math.sin(s.t * 0.55 + k * 2.1 + x * 0.7) * 1.2;
		for (const sgn of [-1, 1]) {
			const lx = x + cx * k * 1.1 + px * sgn * 1.7;
			const ly = y + cy * k * 1.1 + py * sgn * 1.7 + kick * 0.3 * sgn;
			paint(s, lx, ly, col[0] * 0.5 * lit, col[1] * 0.5 * lit, col[2] * 0.5 * lit, 0.8);
		}
	}
	const seg = [
		[1.5, 0.8],
		[0, 0.6],
		[-1.6, 1]
	];
	for (const [d, rad] of seg) {
		for (let oy = -rad; oy <= rad; oy++)
			for (let ox = -rad; ox <= rad; ox++) {
				if (Math.hypot(ox, oy) > rad) continue;
				const sh = 0.6 + (1 - Math.hypot(ox, oy) / (rad + 0.4)) * 0.4;
				paint(s, x + cx * d + ox, y + cy * d + oy, col[0] * sh * lit, col[1] * sh * lit, col[2] * sh * lit, 1);
			}
	}
	for (const sgn of [-1, 1])
		paint(s, x + cx * 2.5 + px * sgn * 0.8, y + cy * 2.5 + py * sgn * 0.8, col[0] * 0.55 * lit, col[1] * 0.55 * lit, col[2] * 0.55 * lit, 0.65);
	if (carry) {
		const gx = x + cx * 2.4;
		const gy = y + cy * 2.4;
		paint(s, gx, gy, 138, 116, 76, 0.9);
		paint(s, gx + px * 0.9, gy + py * 0.9, 120, 100, 64, 0.6);
	}
}

export function makeAnthill(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = colonyIdent(s);
			(s as any).id = id;
			(s as any).food = new Float32Array(4).fill(1);
			(s as any).ph = new Float32Array(s.w * s.h);
			(s as any).worn = new Float32Array(s.w * s.h);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const sth = s.rnd() * 6.28;
				const srr = Math.sqrt(s.rnd());
				s.parts[o] = Math.max(2, Math.min(s.w - 3, id.nest[0] * s.w + Math.cos(sth) * srr * s.w * 0.55));
				s.parts[o + 1] = Math.max(2, Math.min(s.h - 3, id.nest[1] * s.h + Math.sin(sth) * srr * s.h * 0.55));
				const th = s.rnd() * 6.28;
				s.parts[o + 2] = Math.cos(th);
				s.parts[o + 3] = Math.sin(th);
				s.parts[o + 4] = 0;
				s.parts[o + 5] = th;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Colony;
			const food = (s as any).food as Float32Array;
			const ph = (s as any).ph as Float32Array;
			const worn = (s as any).worn as Float32Array;
			const p = s.parts;

			const cyc = ((s.t * s.v.speed) % id.dropPeriod) / id.dropPeriod;
			const falling = cyc < 0.06;
			const crumbLife = cyc < 0.06 ? 0 : cyc < 0.72 ? 1 - (cyc - 0.06) / 0.66 : 0;
			const crumbX = id.dropAt[0] * s.w;
			const crumbY = id.dropAt[1] * s.h;

			const [sr, sg2, sb] = hsl(26 + (s.v.hue2 % 24), 26 + s.v.sat * 0.14, 22);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const g = hash2(x, y, id.grain) * 0.42 + hash2(x >> 1, y >> 1, id.grain + 4) * 0.34 + hash2(x >> 2, y >> 2, id.grain + 8) * 0.24;
					const vig = 1 - Math.hypot(x / s.w - 0.5, y / s.h - 0.5) * 0.4;
					const wear = 1 - Math.min(0.45, worn[y * s.w + x] * 0.5);
					const k = (0.68 + g * 0.72) * vig * wear;
					paint(s, x, y, sr * k, sg2 * k * 0.96, sb * k * 0.88, 1);
				}
			}
			for (const [px2, py2, rad, tone] of id.pebbles) {
				const bx = px2 * s.w;
				const by = py2 * s.h;
				const [kr, kg, kb] = hsl(24 + tone * 18, 8 + s.v.sat * 0.06, 21 + tone * 8);
				for (let oy = -rad - 1; oy <= rad + 1; oy++)
					for (let ox = -rad - 1; ox <= rad + 1; ox++) {
						const d = Math.hypot(ox, oy) / (rad + 0.6 + hash2(ox | 0, oy | 0, id.grain + 12) * 0.5);
						if (d > 1) continue;
						const lit = 0.82 + (1 - d) * 0.28 - (oy / (rad + 1)) * 0.3;
						paint(s, bx + ox, by + oy, kr * lit, kg * lit, kb * lit, 1);
					}
				for (let ox = -rad; ox <= rad; ox++) paint(s, bx + ox, by + rad + 1, sr * 0.34, sg2 * 0.34, sb * 0.32, 0.7);
			}
			for (const [tx, ty, ta, tl] of id.twigs) {
				const bx = tx * s.w;
				const by = ty * s.h;
				const L = tl * s.w;
				for (let d = 0; d < L; d += 0.7) {
					const a = ta + Math.sin(d * 0.2 + tx * 9) * 0.2;
					paint(s, bx + Math.cos(a) * d, by + Math.sin(a) * d, sr * 0.7, sg2 * 0.62, sb * 0.5, 1);
					paint(s, bx + Math.cos(a) * d, by + Math.sin(a) * d - 1, sr * 1.3, sg2 * 1.2, sb * 1, 0.4);
				}
			}

			for (let i = 0; i < ph.length; i++) ph[i] *= id.evap;

			const nx = id.nest[0] * s.w;
			const ny = id.nest[1] * s.h;
			const mound = Math.max(3.5, s.w * 0.05);
			for (let oy = -mound; oy <= mound; oy++)
				for (let ox = -mound; ox <= mound; ox++) {
					const d = Math.hypot(ox, oy) / mound;
					if (d > 1) continue;
					const gr2 = hash2(nx + ox, ny + oy, id.grain + 17);
					const lit = (1.1 + (1 - d) * 0.5 - (oy / mound) * 0.35) * (0.8 + gr2 * 0.5);
					paint(s, nx + ox, ny + oy, sr * lit, sg2 * lit * 0.98, sb * lit * 0.9, 1);
				}
			const hole = mound * 0.36;
			for (let oy = -hole; oy <= hole; oy++)
				for (let ox = -hole; ox <= hole; ox++) {
					const d = Math.hypot(ox / hole, oy / (hole * 0.8));
					if (d > 1) continue;
					const k = 0.12 + d * 0.2;
					paint(s, nx + ox, ny + oy, sr * k, sg2 * k, sb * k, 1);
				}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const carry = p[o + 4] > 0.5;
				let bx = 0;
				let by = 0;
				if (carry) {
					bx = nx - p[o];
					by = ny - p[o + 1];
				} else if (crumbLife > 0 && s.rnd() < 0.55) {
					bx = crumbX - p[o];
					by = crumbY - p[o + 1];
				} else {
					let best = 0;
					for (let a = -2; a <= 2; a++) {
						const th = p[o + 5] + a * 0.5;
						const sx = (p[o] + Math.cos(th) * 3) | 0;
						const sy = (p[o + 1] + Math.sin(th) * 3) | 0;
						if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
						const v = ph[sy * s.w + sx];
						if (v * (0.7 + hash2(i, a + 3, id.grain + 91) * 0.6) > best) {
							best = v;
							bx = Math.cos(th);
							by = Math.sin(th);
						}
					}
					if (best < 0.02) {
						bx = Math.cos(p[o + 5]);
						by = Math.sin(p[o + 5]);
					}
				}
				const want = Math.atan2(by, bx);
				let turn = want - p[o + 5];
				while (turn > Math.PI) turn -= Math.PI * 2;
				while (turn < -Math.PI) turn += Math.PI * 2;
				const grip = carry ? 0.3 : 0.17;
				const roam = carry ? 0.16 : 0.34;
				p[o + 5] += turn * grip + (s.rnd() - 0.5) * roam * (0.6 + s.v.drift * 0.8);
				const rate = (0.34 + (i % 9) * 0.04) * s.v.speed * (crumbLife > 0 ? 1.3 : 1) * (carry ? 1.1 : 0.9);
				p[o] += Math.cos(p[o + 5]) * rate;
				p[o + 1] += Math.sin(p[o + 5]) * rate;
				if (p[o] < 2 || p[o] > s.w - 3) {
					p[o + 5] = Math.PI - p[o + 5];
					p[o] = Math.max(2, Math.min(s.w - 3, p[o]));
				}
				if (p[o + 1] < 2 || p[o + 1] > s.h - 3) {
					p[o + 5] = -p[o + 5];
					p[o + 1] = Math.max(2, Math.min(s.h - 3, p[o + 1]));
				}

				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				worn[cell] = Math.min(1, worn[cell] + 0.02);
				if (carry) {
					ph[cell] = Math.min(2, ph[cell] + 0.6);
					if (Math.hypot(nx - p[o], ny - p[o + 1]) < 3) p[o + 4] = 0;
				} else {
					if (crumbLife > 0 && Math.hypot(crumbX - p[o], crumbY - p[o + 1]) < 4) {
						p[o + 4] = 1;
						p[o + 5] += Math.PI;
					}
					for (let k = 0; k < id.piles.length; k++) {
						if (food[k] < 0.05) continue;
						const f = id.piles[k];
						if (Math.hypot(f[0] * s.w - p[o], f[1] * s.h - p[o + 1]) < 3) {
							p[o + 4] = 1;
							food[k] -= 0.004;
							p[o + 5] += Math.PI;
						}
					}
				}
			}

			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat * 0.7, 46);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = ph[y * s.w + x];
					if (v < 0.02) continue;
					plot(s, x, y, tr, tg, tb, Math.min(0.42, v * 0.22));
				}
			}

			for (let k = 0; k < id.piles.length; k++) {
				food[k] = Math.min(1, food[k] + 0.0001);
				if (food[k] < 0.05) continue;
				const cx = id.piles[k][0] * s.w;
				const cy = id.piles[k][1] * s.h;
				const spread = 1.2 + food[k] * 1.8;
				for (let g = 0; g < 9; g++) {
					if (g / 9 > food[k]) break;
					const th = hash2(g, k, id.grain + 51) * 6.28;
					const rr = Math.sqrt(hash2(g, k, id.grain + 52)) * spread;
					const gx = cx + Math.cos(th) * rr;
					const gy = cy + Math.sin(th) * rr * 0.7;
					const tone = 0.8 + hash2(g, k, id.grain + 53) * 0.45;
					paint(s, gx, gy, 104 * tone, 86 * tone, 54 * tone, 1);
					paint(s, gx + 1, gy, 96 * tone, 79 * tone, 49 * tone, 0.85);
					paint(s, gx, gy - 1, 126 * tone, 106 * tone, 70 * tone, 0.6);
					paint(s, gx, gy + 1, 52, 42, 28, 0.45);
				}
			}

			if (falling) {
				const fy = crumbY * (cyc / 0.06);
				for (let oy = -2; oy <= 2; oy++)
					for (let ox = -2; ox <= 2; ox++) {
						if (Math.hypot(ox, oy) > 2.2) continue;
						paint(s, crumbX + ox, fy + oy, 146, 124, 82, 1);
					}
				for (let k = 1; k < 5; k++) plot(s, crumbX, fy - k * 2, 150, 132, 96, (1 - k / 5) * 0.25);
			} else if (crumbLife > 0) {
				const rad = 1.4 + crumbLife * 2.6;
				for (let oy = -rad - 2; oy <= rad + 2; oy++)
					for (let ox = -rad - 2; ox <= rad + 2; ox++) {
						const th = Math.atan2(oy, ox);
						const lump = 1 + Math.sin(th * 3 + id.grain) * 0.18 + Math.sin(th * 5 - id.grain * 0.3) * 0.12;
						const d = Math.hypot(ox, oy) / (rad * lump);
						if (d > 1) continue;
						const crumb2 = hash2(ox | 0, oy | 0, id.grain + 71);
						if (d > 0.74 && crumb2 > 1.5 - d) continue;
						const lit = 0.72 + (1 - d) * 0.34 - (oy / (rad + 1)) * 0.26 + crumb2 * 0.3;
						paint(s, crumbX + ox, crumbY + oy, 118 * lit, 99 * lit, 63 * lit, 1);
						if (crumb2 > 0.86) paint(s, crumbX + ox, crumbY + oy, 62, 50, 32, 0.55);
					}
				for (let ox = -rad; ox <= rad; ox++) paint(s, crumbX + ox, crumbY + rad + 1, sr * 0.34, sg2 * 0.34, sb * 0.32, 0.75);
				for (let k = 0; k < 5; k++) {
					const th = hash2(k, 3, id.grain + 81) * 6.28;
					const rr = rad + 2 + hash2(k, 7, id.grain + 83) * 2;
					paint(s, crumbX + Math.cos(th) * rr, crumbY + Math.sin(th) * rr * 0.7, 96, 80, 52, 0.7 * crumbLife);
				}
			}

			const [ar, ag, ab] = hsl(16 + (s.v.hue % 20), 40 + s.v.sat * 0.2, 11);
			const shown = Math.max(8, (s.n * 0.42) | 0);
			let laden = 0;
			for (let i = 0; i < shown; i++) {
				const o = i * P;
				const carrying = p[o + 4] > 0.5;
				if (carrying) laden++;
				drawAnt(s, p[o], p[o + 1], p[o + 5], carrying, [ar, ag, ab], carrying ? 1.25 : 1);
			}
			s.out = Math.min(1, laden / (s.n * 0.14) + (crumbLife > 0 ? 0.25 : 0));
			blit(s);
		}
	};
}

type Mold = {
	sites: number[][];
	drop: number[];
	period: number;
	decay: number;
	grain: number;
	blotch: number[][];
	dew: number[][];
};

function moldIdent(s: FxScene): Mold {
	const r = mulberry32(s.v.seed + 7321);
	const sites: number[][] = [];
	for (let i = 0; i < 5; i++) sites.push([0.1 + r() * 0.8, 0.14 + r() * 0.72, 0.45 + r() * 0.55]);
	const drop = [0.16 + r() * 0.68, 0.18 + r() * 0.64];
	const period = 340 + ((r() * 260) | 0);
	const decay = 0.985 + r() * 0.011;
	const grain = (r() * 9999) | 0;
	const blotch: number[][] = [];
	for (let i = 0; i < 6; i++) blotch.push([r(), r(), 0.1 + r() * 0.16, r()]);
	const dew: number[][] = [];
	for (let i = 0; i < 16; i++) dew.push([r(), r(), 0.5 + r() * 1.3]);
	return { sites, drop, period, decay, grain, blotch, dew };
}

export function makeSlime(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 4.6,
		init(s) {
			const id = moldIdent(s);
			(s as any).id = id;
			(s as any).tr = new Float32Array(s.w * s.h);
			(s as any).tmp = new Float32Array(s.w * s.h);
			(s as any).vn = new Float32Array(s.w * s.h);
			(s as any).food = id.sites.map((q) => [q[0], q[1], q[2], q[2]]);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const sp = id.sites[i % id.sites.length];
				const th = s.rnd() * 6.28;
				const rr = Math.sqrt(s.rnd()) * Math.min(s.w, s.h) * 0.9;
				s.parts[o] = Math.max(2, Math.min(s.w - 3, sp[0] * s.w + Math.cos(th) * rr));
				s.parts[o + 1] = Math.max(2, Math.min(s.h - 3, sp[1] * s.h + Math.sin(th) * rr * 0.7));
				s.parts[o + 2] = i % id.sites.length;
				s.parts[o + 3] = 0;
				s.parts[o + 4] = 0.4 + s.rnd() * 0.3;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Mold;
			const tr = (s as any).tr as Float32Array;
			const food = (s as any).food as number[][];
			const p = s.parts;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const falling = cyc < 0.07;
			const feast = cyc >= 0.07 && cyc < 0.6 ? 1 - (cyc - 0.07) / 0.53 : 0;
			const prune = cyc >= 0.6 && cyc < 0.86 ? Math.sin(((cyc - 0.6) / 0.26) * Math.PI) : 0;
			const dropX = id.drop[0] * s.w;
			const dropY = id.drop[1] * s.h;

			const [ar, ag2, ab] = hsl(s.v.hue2 + 20, 16 + s.v.sat * 0.14, 22);
			const [br, bg, bb] = hsl(s.v.hue2 + 34, 22 + s.v.sat * 0.16, 30);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					let bl = 0;
					for (const [bx2, by2, brad, bt] of id.blotch) {
						const d = Math.hypot(x / s.w - bx2, (y / s.h - by2) * 0.72) / brad;
						if (d < 1) bl = Math.max(bl, (1 - d) * (0.5 + bt * 0.5));
					}
					const g = hash2(x, y, id.grain) * 0.3 + hash2(x >> 1, y >> 1, id.grain + 5) * 0.4;
					const vig = 1 - Math.hypot(x / s.w - 0.5, y / s.h - 0.5) * 0.42;
					const k = (0.74 + g * 0.5) * vig;
					const mr = ar + (br - ar) * bl;
					const mg = ag2 + (bg - ag2) * bl;
					const mb = ab + (bb - ab) * bl;
					paint(s, x, y, mr * k, mg * k, mb * k, 1);
				}
			}
			for (const [dx2, dy2, drad] of id.dew) {
				const cx = dx2 * s.w;
				const cy = dy2 * s.h;
				for (let oy = -drad - 1; oy <= drad + 1; oy++)
					for (let ox = -drad - 1; ox <= drad + 1; ox++) {
						const d = Math.hypot(ox, oy) / (drad + 0.7);
						if (d > 1) continue;
						paint(s, cx + ox, cy + oy, br * 1.5, bg * 1.5, bb * 1.6, (1 - d) * 0.4);
					}
				plot(s, cx - drad * 0.3, cy - drad * 0.4, 220, 232, 226, 0.22);
			}

			const tmp = (s as any).tmp as Float32Array;
			const vn = (s as any).vn as Float32Array;
			for (let k = 0; k < vn.length; k++) vn[k] *= 0.93 - prune * 0.06;
			const dk = id.decay * (1 - prune * 0.06);
			for (let y = 0; y < s.h; y++) {
				const yn = y > 0 ? -s.w : 0;
				const ys = y < s.h - 1 ? s.w : 0;
				for (let x = 0; x < s.w; x++) {
					const c = y * s.w + x;
					const xw = x > 0 ? -1 : 0;
					const xe = x < s.w - 1 ? 1 : 0;
					const sum =
						tr[c] * 4 + (tr[c + xw] + tr[c + xe] + tr[c + yn] + tr[c + ys]) * 2 + tr[c + xw + yn] + tr[c + xe + yn] + tr[c + xw + ys] + tr[c + xe + ys];
					tmp[c] = (sum / 16) * dk;
				}
			}
			tr.set(tmp);

			const sense = 2.2 + s.v.drift * 2;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				let best = -1;
				let bth = p[o + 5];
				for (let a = -1; a <= 1; a++) {
					const th = p[o + 5] + a * 0.62;
					const sx = (p[o] + Math.cos(th) * sense) | 0;
					const sy = (p[o + 1] + Math.sin(th) * sense) | 0;
					if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
					let v = tr[sy * s.w + sx] * 2.4;
					for (const f of food) {
						if (f[2] < 0.04) continue;
						const dx = f[0] * s.w - sx;
						const dy = f[1] * s.h - sy;
						v += (f[2] * 22) / (dx * dx + dy * dy + 30);
					}
					if (feast > 0) {
						const dx = dropX - sx;
						const dy = dropY - sy;
						v += (feast * 70) / (dx * dx + dy * dy + 30);
					}
					if (v > best) {
						best = v;
						bth = th;
					}
				}
				p[o + 5] = bth + (s.rnd() - 0.5) * (0.72 + prune * 0.9);
				const rate = 0.42 * s.v.speed * (0.6 + p[o + 4] * 0.8) * (1 + feast * 0.3);
				p[o] += Math.cos(p[o + 5]) * rate;
				p[o + 1] += Math.sin(p[o + 5]) * rate;
				if (p[o] < 2 || p[o] > s.w - 3) {
					p[o + 5] = Math.PI - p[o + 5];
					p[o] = Math.max(2, Math.min(s.w - 3, p[o]));
				}
				if (p[o + 1] < 2 || p[o + 1] > s.h - 3) {
					p[o + 5] = -p[o + 5];
					p[o + 1] = Math.max(2, Math.min(s.h - 3, p[o + 1]));
				}
				const cell = (p[o + 1] | 0) * s.w + (p[o] | 0);
				tr[cell] = Math.min(3.4, tr[cell] + 0.16 + p[o + 4] * 0.2);
				vn[cell] = Math.min(1.8, vn[cell] + 0.34 + p[o + 4] * 0.4);
				p[o + 4] = Math.max(0, p[o + 4] - 0.004);
				if (feast > 0 && Math.hypot(dropX - p[o], dropY - p[o + 1]) < 5) p[o + 4] = Math.min(1, p[o + 4] + 0.2);
				for (const f of food) {
					if (f[2] < 0.04) continue;
					const dx = f[0] * s.w - p[o];
					const dy = f[1] * s.h - p[o + 1];
					if (dx * dx + dy * dy < 14) {
						f[2] = Math.max(0, f[2] - 0.0016);
						p[o + 4] = Math.min(1, p[o + 4] + 0.14);
					}
				}
			}

			const [vr, vg, vb] = hsl(s.v.hue + 8, Math.max(50, s.v.sat * 0.85), 30);
			const [cr, cg, cb] = hsl(s.v.hue + 26, Math.max(62, s.v.sat), 60);
			let veins = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const c = y * s.w + x;
					const m = tr[c];
					const bite = hash2(x, y, id.grain + 21) * 0.1;
					if (m < 0.4 + bite) continue;
					const body = Math.min(1, (m - 0.4) / 0.46);
					const mottle = 0.78 + hash2(x >> 1, y >> 1, id.grain + 33) * 0.4;
					paint(s, x, y, vr * mottle, vg * mottle, vb * mottle, Math.min(0.78, 0.26 + body * 0.52));
					if (body > 0.82) plot(s, x, y - 1, cr * 0.5, cg * 0.5, cb * 0.5, (body - 0.82) * 0.5);
				}
			}
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const v = vn[y * s.w + x];
					if (v < 0.16) continue;
					const tube = Math.min(1, (v - 0.16) / 0.9);
					veins++;
					const flow = 0.55 + 0.45 * Math.sin(s.t * 0.11 * s.v.speed - x * 0.22 - y * 0.14);
					plot(s, x, y, cr, cg, cb, tube * (0.35 + flow * 0.65) * 0.85);
					if (tube > 0.55) plot(s, x, y, 255, 255, 240, (tube - 0.55) * flow * 0.4);
				}
			}

			const [hr, hg, hb] = hsl(s.v.hue2, s.v.sat * 0.3, 24);
			for (const f of food) {
				const cx = f[0] * s.w;
				const cy = f[1] * s.h;
				const left = f[2];
				const spent = 1 - Math.min(1, left / Math.max(0.001, f[3]));
				const rad = 1.2 + left * 2.2;
				for (let dy = -rad - 2; dy <= rad + 2; dy++)
					for (let dx = -rad - 2; dx <= rad + 2; dx++) {
						const d = Math.hypot(dx, dy);
						if (d > rad + 2) continue;
						if (d > rad) {
							paint(s, cx + dx, cy + dy, hr, hg, hb, spent * 0.6 * (1 - (d - rad) / 2.4));
							continue;
						}
						const k = 1 - d / (rad + 0.6);
						paint(s, cx + dx, cy + dy, cr * 0.5, cg * 0.5, cb * 0.5, Math.min(1, k * (0.4 + left)));
						plot(s, cx + dx, cy + dy, cr, cg, cb, k * k * left * 0.6);
					}
				f[2] = Math.min(f[3], f[2] + 0.0011);
			}

			if (falling) {
				const fy = dropY * (cyc / 0.07);
				const wob = 1 + Math.sin(s.t * 0.4) * 0.16;
				for (let oy = -2; oy <= 2; oy++)
					for (let ox = -2; ox <= 2; ox++) {
						if (Math.hypot(ox / wob, oy * wob) > 2.2) continue;
						paint(s, dropX + ox, fy + oy, cr * 0.7, cg * 0.7, cb * 0.7, 0.95);
					}
				plot(s, dropX - 0.6, fy - 0.8, 255, 255, 255, 0.5);
				for (let k = 1; k < 6; k++) plot(s, dropX, fy - k * 2, cr, cg, cb, (1 - k / 6) * 0.3);
			} else if (feast > 0) {
				const rad = 1.6 + feast * 3;
				for (let oy = -rad - 2; oy <= rad + 2; oy++)
					for (let ox = -rad - 2; ox <= rad + 2; ox++) {
						const th = Math.atan2(oy, ox);
						const lump = 1 + Math.sin(th * 3 + id.grain) * 0.2;
						const d = Math.hypot(ox, oy) / (rad * lump);
						if (d > 1.6) continue;
						if (d <= 1) paint(s, dropX + ox, dropY + oy, cr * 0.6, cg * 0.6, cb * 0.6, Math.min(1, (1 - d) * 1.4 + 0.3));
						plot(s, dropX + ox, dropY + oy, cr, cg, cb, Math.max(0, 1 - d / 1.6) ** 2 * feast * 0.55);
					}
			}

			if (prune > 0) {
				for (let i = 0; i < s.n; i++) {
					const o = i * P;
					if (s.rnd() > prune * 0.12) continue;
					plot(s, p[o], p[o + 1], hr * 2, hg * 2, hb * 2, prune * 0.5);
				}
			}
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				if (p[o + 4] < 0.32) continue;
				plot(s, p[o], p[o + 1], 255, 255, 250, (p[o + 4] - 0.32) * 0.5);
			}

			s.out = Math.min(1, veins / (s.w * s.h * 0.12) + feast * 0.3 + prune * 0.2);
			blit(s);
		}
	};
}

type Plate = {
	colonies: number[][];
	lag: number;
	tol: number;
	grain: number;
	drops: number[][];
	scratch: number[][];
	sats: number[][];
};

function plateIdent(s: FxScene): Plate {
	const r = mulberry32(s.v.seed + 8219);
	const colonies: number[][] = [];
	for (let i = 0; i < 7; i++) colonies.push([0.16 + r() * 0.68, 0.22 + r() * 0.56, 0.5 + r() * 0.9, r() * 6.28, 0, r(), r(), r()]);
	const lag = 0.3 + r() * 0.5;
	const tol = 0.5 + r() * 0.45;
	const grain = (r() * 9999) | 0;
	const drops: number[][] = [];
	for (let i = 0; i < 20; i++) drops.push([r(), r(), 0.4 + r() * 1.2]);
	const scratch: number[][] = [];
	for (let i = 0; i < 5; i++) scratch.push([r(), r(), r() * 6.28, 0.1 + r() * 0.24]);
	const sats: number[][] = [];
	for (let i = 0; i < 14; i++) sats.push([r(), r(), 0.3 + r() * 0.7, (r() * 7) | 0]);
	return { colonies, lag, tol, grain, drops, scratch, sats };
}

export function makeCulture(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const id = plateIdent(s);
			(s as any).id = id;
			(s as any).own = new Int8Array(s.w * s.h).fill(-1);
			(s as any).waste = new Float32Array(s.w * s.h);
			(s as any).swap = new Float32Array(s.w * s.h);
			(s as any).rad = id.colonies.map(() => 0);
			(s as any).seedAt = 40;
			(s as any).ino = [] as number[][];
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Plate;
			const own = (s as any).own as Int8Array;
			const waste = (s as any).waste as Float32Array;
			const swap = (s as any).swap as Float32Array;
			const rad = (s as any).rad as number[];
			const span = Math.min(s.w, s.h);

			const ino = (s as any).ino as number[][];
			const [pr, pg, pb] = hsl(38 + (s.v.hue2 % 26), 26 + s.v.sat * 0.14, 38);
			const ax = s.w * 0.5;
			const ay = s.h * 0.5;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const dd = Math.hypot((x - ax) / ax, (y - ay) / ay);
					const g = hash2(x, y, id.grain) * 0.16 + hash2(x >> 1, y >> 1, id.grain + 3) * 0.2;
					const k = (0.86 + g) * (1 - Math.min(1, dd) * 0.3);
					paint(s, x, y, pr * k, pg * k, pb * k * 0.8, 1);
					if (dd > 0.9) {
						const rimk = Math.min(1, (dd - 0.9) / 0.14);
						paint(s, x, y, pr * 1.5, pg * 1.5, pb * 1.4, rimk * 0.6);
						if (dd > 0.99) paint(s, x, y, 18, 16, 14, Math.min(1, (dd - 0.99) * 8) * 0.7);
					}
				}
			}
			for (const [sx2, sy2, sa, sl] of id.scratch) {
				const bx = sx2 * s.w;
				const by = sy2 * s.h;
				const L = sl * s.w;
				for (let d = 0; d < L; d += 0.8) {
					const a = sa + Math.sin(d * 0.14 + sx2 * 8) * 0.14;
					plot(s, bx + Math.cos(a) * d, by + Math.sin(a) * d, pr * 0.9, pg * 0.9, pb * 0.8, 0.09);
				}
			}
			for (const [dx2, dy2, drad] of id.drops) {
				const cx = dx2 * s.w;
				const cy = dy2 * s.h;
				for (let oy = -drad - 1; oy <= drad + 1; oy++)
					for (let ox = -drad - 1; ox <= drad + 1; ox++) {
						const d = Math.hypot(ox, oy) / (drad + 0.7);
						if (d > 1) continue;
						plot(s, cx + ox, cy + oy, 210, 226, 220, (1 - d) * 0.14);
					}
				plot(s, cx - drad * 0.35, cy - drad * 0.45, 235, 244, 240, 0.28);
			}

			const edgeAt = (ci: number, th: number, R: number) => {
				const c = id.colonies[ci];
				const lobes = 4 + ((c[5] * 5) | 0);
				const wob =
					1 + Math.sin(th * lobes + c[3]) * (0.1 + c[6] * 0.12) + Math.sin(th * (lobes * 2 + 3) - c[3] * 2) * 0.07 + Math.sin(th * 3 + c[7] * 6.28) * 0.06;
				return R * wob;
			};

			for (let ci = 0; ci < id.colonies.length; ci++) {
				const c = id.colonies[ci];
				if (c[4] > 1.5) continue;
				const cx = c[0] * s.w;
				const cy = c[1] * s.h;
				const wcell = waste[Math.min(waste.length - 1, Math.max(0, (cy | 0) * s.w + (cx | 0)))];
				const choke = Math.max(0, 1 - wcell / id.tol);
				rad[ci] = Math.min(span * 0.26, rad[ci] + 0.075 * s.v.speed * c[2] * choke);
				const R = rad[ci];
				if (R < 0.8) continue;
				const y0 = Math.max(0, (cy - R * 1.3 - 1) | 0);
				const y1 = Math.min(s.h - 1, (cy + R * 1.3 + 1) | 0);
				const x0 = Math.max(0, (cx - R * 1.3 - 1) | 0);
				const x1 = Math.min(s.w - 1, (cx + R * 1.3 + 1) | 0);
				for (let y = y0; y <= y1; y++) {
					for (let x = x0; x <= x1; x++) {
						const dx = x - cx;
						const dy = y - cy;
						const dd = Math.hypot(dx, dy);
						const lim = edgeAt(ci, Math.atan2(dy, dx), R);
						if (dd > lim) continue;
						const u = dd / Math.max(0.5, lim);
						const nx = ((x / s.w) * 96) | 0;
						const ny = ((y / s.h) * 96) | 0;
						if (u > 0.7 && hash2(nx, ny, id.grain + 40 + ci) > 1.5 - u) continue;
						const cell = y * s.w + x;
						if (own[cell] === -1) own[cell] = ci;
					}
				}
			}

			let lawn = 0;
			for (let c = 0; c < own.length; c++) {
				if (own[c] < 0) continue;
				lawn++;
				waste[c] += 0.0062;
			}

			for (let y = 1; y < s.h - 1; y++) {
				for (let x = 1; x < s.w - 1; x++) {
					const i2 = y * s.w + x;
					swap[i2] = (waste[i2] + 0.16 * (waste[i2 - 1] + waste[i2 + 1] + waste[i2 - s.w] + waste[i2 + s.w] - 4 * waste[i2])) * 0.9955;
				}
			}
			waste.set(swap);

			let dead = 0;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const cell = y * s.w + x;
					const o = own[cell];
					const wv = waste[cell];
					if (o < 0) {
						if (wv > 0.05) {
							const haze = Math.min(0.32, wv * 0.32);
							paint(s, x, y, pr * 0.72, pg * 0.78, pb * 0.68, haze);
						}
						continue;
					}
					const c = id.colonies[o];
					const dd = Math.hypot(x - c[0] * s.w, y - c[1] * s.h);
					const u = Math.min(1, dd / Math.max(0.6, rad[o]));
					const speck = hash2(((x / s.w) * 96) | 0, ((y / s.h) * 96) | 0, id.grain + 60 + o);
					const vig = Math.max(0, 1 - wv / id.tol);
					if (wv > id.tol) {
						dead++;
						const rot = Math.min(1, (wv - id.tol) * 1.6);
						const [dr, dg, db] = hsl(30 + o * 5, 24 + s.v.sat * 0.1, 40 - rot * 12);
						const k = 0.74 + speck * 0.52;
						paint(s, x, y, dr * k, dg * k, db * k, 0.58 + rot * 0.22);
						if (speck > 0.9) plot(s, x, y, dr * 1.6, dg * 1.5, db, 0.3);
						continue;
					}
					const dome = 1 - u * u * 0.55;
					const [lr3, lg3, lb3] = hsl(s.v.hue + o * 13, Math.max(30, s.v.sat * (0.4 + vig * 0.5)), 26 + vig * 22 + dome * 14);
					const k = (0.78 + speck * 0.44) * dome;
					paint(s, x, y, lr3 * k, lg3 * k, lb3 * k, Math.min(0.9, 0.42 + u * -0.1 + vig * 0.4));
					if (u < 0.3) plot(s, x, y - 1, lr3, lg3, lb3, (0.3 - u) * vig * 0.7);
					const rim = own[Math.max(0, cell - 1)] !== o || own[Math.min(own.length - 1, cell + 1)] !== o || own[Math.max(0, cell - s.w)] !== o;
					if (rim) {
						plot(s, x, y, lr3 * 1.5, lg3 * 1.5, lb3 * 1.5, 0.4 * vig);
						paint(s, x, y + 1, 0, 0, 0, 0.26);
					}
				}
			}

			for (const [sx2, sy2, ss, host] of id.sats) {
				const hc = id.colonies[host % id.colonies.length];
				if (hc[4] > 1.5 || rad[host % id.colonies.length] < span * 0.1) continue;
				const cx = sx2 * s.w;
				const cy = sy2 * s.h;
				const rr = 0.6 + ss * 1.1;
				const [lr3, lg3, lb3] = hsl(s.v.hue + (host % 7) * 13, Math.max(30, s.v.sat * 0.6), 40);
				for (let oy = -rr - 1; oy <= rr + 1; oy++)
					for (let ox = -rr - 1; ox <= rr + 1; ox++) {
						const d = Math.hypot(ox, oy) / (rr + 0.5);
						if (d > 1) continue;
						paint(s, cx + ox, cy + oy, lr3, lg3, lb3, (1 - d * 0.5) * 0.7);
					}
				paint(s, cx, cy + rr + 1, 0, 0, 0, 0.22);
			}

			for (let ci = 0; ci < id.colonies.length; ci++) {
				const c = id.colonies[ci];
				const cx = c[0] * s.w;
				const cy = c[1] * s.h;
				const idx = Math.min(waste.length - 1, Math.max(0, (cy | 0) * s.w + (cx | 0)));
				if (waste[idx] > id.tol * 1.3 && c[4] < 1.5) {
					c[4] = 2;
					ino.push([cx, cy, 0, 1]);
				}
			}

			for (let k = ino.length - 1; k >= 0; k--) {
				const q = ino[k];
				q[2] += 1;
				if (q[2] > 22) {
					ino.splice(k, 1);
					continue;
				}
				const f = q[2] / 22;
				const rr = f * span * 0.2;
				const a = (1 - f) * (1 - f);
				for (let th = 0; th < 6.28; th += 0.12) {
					const wob = 1 + Math.sin(th * 4 + q[0]) * 0.1;
					if (q[3] > 0.5) plot(s, q[0] + Math.cos(th) * rr * wob, q[1] + Math.sin(th) * rr * wob * 0.9, 255, 190, 120, a * 0.6);
					else plot(s, q[0] + Math.cos(th) * rr * wob, q[1] + Math.sin(th) * rr * wob * 0.9, 210, 255, 220, a * 0.8);
				}
				if (f < 0.4) {
					for (let oy = -2; oy <= 2; oy++)
						for (let ox = -2; ox <= 2; ox++) {
							const d = Math.hypot(ox, oy) / 2.4;
							if (d > 1) continue;
							plot(s, q[0] + ox, q[1] + oy, q[3] > 0.5 ? 255 : 220, q[3] > 0.5 ? 170 : 255, q[3] > 0.5 ? 110 : 230, (1 - d) * (1 - f / 0.4) * 0.9);
						}
				}
			}

			if (--(s as any).seedAt <= 0) {
				(s as any).seedAt = 70 + ((s.rnd() * 110) | 0);
				let pick = -1;
				let dirt = 1e9;
				for (let ci = 0; ci < id.colonies.length; ci++) {
					const c = id.colonies[ci];
					if (c[4] < 1.5) continue;
					const wv = waste[Math.min(waste.length - 1, Math.max(0, ((c[1] * s.h) | 0) * s.w + ((c[0] * s.w) | 0)))];
					if (wv < dirt) {
						dirt = wv;
						pick = ci;
					}
				}
				if (pick >= 0) {
					const c = id.colonies[pick];
					let bx = 0;
					let by = 0;
					let clean = 1e9;
					for (let q = 0; q < 12; q++) {
						const tx = (0.1 + s.rnd() * 0.8) * s.w;
						const ty = (0.1 + s.rnd() * 0.8) * s.h;
						const v = waste[Math.min(waste.length - 1, (ty | 0) * s.w + (tx | 0))] + (own[Math.min(own.length - 1, (ty | 0) * s.w + (tx | 0))] >= 0 ? 0.6 : 0);
						if (v < clean) {
							clean = v;
							bx = tx;
							by = ty;
						}
					}
					c[0] = bx / s.w;
					c[1] = by / s.h;
					c[3] = s.rnd() * 6.28;
					c[4] = 0;
					rad[pick] = 0;
					ino.push([bx, by, 0, 0]);
					for (let cI = 0; cI < own.length; cI++)
						if (own[cI] === pick) {
							own[cI] = -1;
							waste[cI] *= 0.35;
						}
				}
			}

			s.out = Math.min(1, (lawn - dead * 0.5) / (s.w * s.h * 0.4));
			blit(s);
		}
	};
}

type Pasture = {
	ridge: number[];
	clouds: number[][];
	patch: number[][];
	rocks: number[][];
	flowers: number[][];
	period: number;
	dogSide: number;
	dogY: number;
	grain: number;
	tones: number[];
};

function pastureIdent(s: FxScene): Pasture {
	const r = mulberry32(s.v.seed + 9127);
	const ridge: number[] = [];
	for (let i = 0; i < 8; i++) ridge.push(r());
	const clouds: number[][] = [];
	for (let i = 0; i < 5; i++) clouds.push([r(), 0.04 + r() * 0.16, 0.14 + r() * 0.22, 0.3 + r() * 0.8]);
	const patch: number[][] = [];
	for (let i = 0; i < 7; i++) patch.push([r(), 0.4 + r() * 0.6, 0.1 + r() * 0.16]);
	const rocks: number[][] = [];
	for (let i = 0; i < 6; i++) rocks.push([r(), 0.4 + r() * 0.58, 1 + r() * 2.2]);
	const flowers: number[][] = [];
	for (let i = 0; i < 22; i++) flowers.push([r(), 0.38 + r() * 0.6, r()]);
	const period = 420 + ((r() * 260) | 0);
	const dogSide = r() < 0.5 ? -1 : 1;
	const dogY = 0.58 + r() * 0.3;
	const grain = (r() * 9999) | 0;
	const tones: number[] = [];
	for (let i = 0; i < 24; i++) tones.push(r());
	return { ridge, clouds, patch, rocks, flowers, period, dogSide, dogY, grain, tones };
}

function drawSheep(s: FxScene, x: number, y: number, sc: number, face: number, head: number, tone: number, fear: number) {
	const bw = 3.2 * sc;
	const bh = 2.1 * sc;
	for (let ox = -bw; ox <= bw; ox++) {
		const e = 1 - Math.abs(ox) / (bw + 0.6);
		paint(s, x + ox, y + bh + 1.4 * sc, 0, 0, 0, e * 0.38);
	}
	const lg = 1.5 * sc;
	for (let k = 0; k < 4; k++) {
		const lx = x + (k < 2 ? -bw * 0.5 : bw * 0.5) + (k % 2 ? 0.7 * sc : -0.5 * sc);
		const trot = fear > 0.1 ? Math.sin(s.t * 0.9 + k * 1.6 + x) * 0.9 * sc * fear : 0;
		for (let d = 0; d <= lg; d += 0.7) paint(s, lx + trot * (d / (lg + 0.5)), y + bh * 0.5 + d, 36, 30, 28, 0.9);
	}
	const cream = 224 + tone * 26;
	for (let oy = -bh - 1; oy <= bh; oy++) {
		for (let ox = -bw - 1; ox <= bw + 1; ox++) {
			const th = Math.atan2(oy, ox);
			const puff = 1 + Math.sin(th * 5 + tone * 9) * 0.13 + Math.sin(th * 9 - tone * 5) * 0.09;
			const d = Math.hypot(ox / (bw * puff), oy / (bh * puff));
			if (d > 1) continue;
			const curl = hash2((x + ox) | 0, (y + oy) | 0, 771) * 0.3;
			const k = (0.84 + curl) * (1 - (oy + bh) / (bh * 4.6)) + 0.14;
			paint(s, x + ox, y + oy, cream * k, (cream - 6) * k, (cream - 22) * k, 1);
			if (d > 0.78 && curl > 0.22) paint(s, x + ox, y + oy, 172, 164, 152, 0.34);
			if (oy < -bh * 0.3 && curl > 0.2) paint(s, x + ox, y + oy, 255, 253, 246, 0.4);
		}
	}
	const hx = x + face * bw * 0.92;
	const hy = y - bh * 0.35 + head * bh * 1.5;
	const hr2 = 1.1 * sc;
	for (let oy = -hr2; oy <= hr2; oy++)
		for (let ox = -hr2; ox <= hr2; ox++) {
			if (Math.hypot(ox / hr2, oy / (hr2 * 1.15)) > 1) continue;
			paint(s, hx + ox, hy + oy, 52, 44, 42, 1);
		}
	paint(s, hx - face * hr2 * 0.7, hy - hr2 * 0.8, 40, 34, 32, 0.9);
	paint(s, hx + face * hr2 * 0.3, hy - hr2 * 0.2, 236, 232, 226, 0.7);
}

export function makeGraze(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.05,
		init(s) {
			const id = pastureIdent(s);
			(s as any).id = id;
			const turf = new Float32Array(s.w * s.h);
			for (let i = 0; i < turf.length; i++) turf[i] = 0.55 + s.rnd() * 0.45;
			(s as any).turf = turf;
			(s as any).dust = [] as number[][];
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = (0.1 + s.rnd() * 0.8) * s.w;
				s.parts[o + 1] = (0.44 + s.rnd() * 0.5) * s.h;
				s.parts[o + 2] = 0;
				s.parts[o + 3] = s.rnd();
				s.parts[o + 4] = s.rnd() < 0.5 ? -1 : 1;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Pasture;
			const turf = (s as any).turf as Float32Array;
			const dust = (s as any).dust as number[][];
			const p = s.parts;
			const hy = Math.round(s.h * 0.32);

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const run = cyc > 0.62 && cyc < 0.82 ? (cyc - 0.62) / 0.2 : -1;
			const panic = run < 0 ? 0 : Math.sin(Math.min(1, run * 1.25) * Math.PI) ** 0.6;
			const dogX = run < 0 ? -99 : (id.dogSide > 0 ? run * 1.25 - 0.12 : 1.12 - run * 1.25) * s.w;
			const dogY = id.dogY * s.h;

			const [sk1, sk2, sk3] = hsl(s.v.hue2 + 12, 24 + s.v.sat * 0.24, 62);
			const [sk4, sk5, sk6] = hsl(s.v.hue2 + 26, 18 + s.v.sat * 0.2, 80);
			for (let y = 0; y < hy + 2; y++) {
				const f = y / (hy + 2);
				for (let x = 0; x < s.w; x++) {
					const g = hash2(x >> 2, y >> 1, id.grain) * 0.07;
					paint(s, x, y, sk1 + (sk4 - sk1) * f + g * 40, sk2 + (sk5 - sk2) * f + g * 40, sk3 + (sk6 - sk3) * f + g * 40, 1);
				}
			}
			for (const [cx, cy2, cw, csp] of id.clouds) {
				const px = ((cx + s.t * 0.00035 * csp * s.v.speed * s.v.dir) % 1.3) * s.w - s.w * 0.15;
				const py = cy2 * hy + 2;
				const rw = cw * s.w;
				for (let ox = -rw; ox <= rw; ox++) {
					const u = ox / rw;
					const lob = 1 + Math.sin(u * 7 + cx * 9) * 0.3 + Math.sin(u * 13 - cx * 4) * 0.18;
					const th2 = Math.max(0, (1 - u * u) * lob) * (2.2 + cw * 14);
					for (let oy = -th2; oy <= th2 * 0.6; oy++) {
						const k = 1 - Math.abs(oy) / (th2 + 0.6);
						paint(s, px + ox, py + oy, 250, 250, 248, k * 0.8);
						if (oy > th2 * 0.2) paint(s, px + ox, py + oy, 196, 202, 212, k * 0.4);
					}
				}
			}

			const gh = 82 + (s.v.hue % 44);
			const [fr, fg, fb] = hsl(gh - 14, Math.max(34, s.v.sat * 0.6), 20);
			const [gr2, gg2, gb2] = hsl(gh, Math.max(42, s.v.sat * 0.72), 38);
			const [rr2, rg2, rb2] = hsl(gh + 34, 18 + s.v.sat * 0.16, 27);
			for (let x = 0; x < s.w; x++) {
				const u = (x / s.w) * 7;
				const i0 = u | 0;
				const f = u - i0;
				const a = id.ridge[i0 % 8];
				const b2 = id.ridge[(i0 + 1) % 8];
				const sm = f * f * (3 - 2 * f);
				const hgt = (a + (b2 - a) * sm) * s.h * 0.16;
				const top = hy - 1 - hgt;
				for (let y = top; y < hy + 2; y++) {
					const dn = (y - top) / (hgt + 2);
					const tex = hash2(x, y, id.grain + 21) * 0.16 + hash2(x >> 2, y >> 1, id.grain + 27) * 0.2;
					const lit = 0.72 + dn * 0.45 + tex;
					paint(s, x, y, rr2 * lit, rg2 * lit, rb2 * lit * 1.04, 1);
					if (tex > 0.3 && dn > 0.25) paint(s, x, y, rr2 * 0.55, rg2 * 0.62, rb2 * 0.58, 0.4);
				}
				paint(s, x, top, rr2 * 1.7, rg2 * 1.75, rb2 * 1.5, 0.75);
				paint(s, x, top + 1, rr2 * 1.3, rg2 * 1.35, rb2 * 1.2, 0.4);
			}

			for (let y = hy; y < s.h; y++) {
				const dep = (y - hy) / (s.h - hy);
				for (let x = 0; x < s.w; x++) {
					const cell = y * s.w + x;
					let fert = 0;
					for (const [px2, py2, pr2] of id.patch) fert += Math.max(0, 1 - Math.hypot(x / s.w - px2, (y / s.h - py2) * 1.8) / pr2);
					turf[cell] = Math.min(1, turf[cell] + (0.0022 + fert * 0.004) * s.v.speed);
					const v = turf[cell];
					const tex = hash2(x, y, id.grain + 5) * 0.26 + hash2(x >> 1, y >> 2, id.grain + 9) * 0.2;
					const roll = Math.sin(x * 0.07 + id.ridge[0] * 6) * 0.5 + Math.sin(x * 0.019 - y * 0.05) * 0.5;
					const lit = 0.5 + dep * 0.62 + tex + roll * 0.16;
					const mix = v * v;
					const bare = Math.max(0, 0.34 - v) / 0.34;
					const dr2 = 94 + tex * 60;
					paint(
						s,
						x,
						y,
						((fr + (gr2 - fr) * mix) * (1 - bare) + dr2 * bare) * lit,
						((fg + (gg2 - fg) * mix) * (1 - bare) + dr2 * 0.82 * bare) * lit,
						((fb + (gb2 - fb) * mix) * (1 - bare) + dr2 * 0.56 * bare) * lit,
						1
					);
					if (v > 0.66 && tex > 0.62) {
						const bl = (1 + (v - 0.62) * 4 * dep) | 0;
						const sway = Math.sin(s.t * 0.06 * s.v.speed + x * 0.3) * 0.5 * s.v.drift;
						for (let k = 1; k <= bl; k++) paint(s, x + sway * (k / bl), y - k, gr2 * (1.1 + k * 0.1), gg2 * (1.15 + k * 0.1), gb2 * 0.9, 0.7);
					}
				}
			}
			for (const [fx2, fy2, fh] of id.flowers) {
				const x = fx2 * s.w;
				const y = fy2 * s.h;
				if (y < hy + 2) continue;
				if (turf[(y | 0) * s.w + (x | 0)] < 0.5) continue;
				const [pr2, pg2, pb2] = hsl(gh + 150 + fh * 150, Math.max(64, s.v.sat), 76);
				paint(s, x, y, pr2, pg2, pb2, 0.9);
				paint(s, x, y - 1, pr2 * 1.1, pg2 * 1.1, pb2 * 1.1, 0.6);
			}
			for (const [rx, ry, rsz] of id.rocks) {
				const x = rx * s.w;
				const y = ry * s.h;
				if (y < hy + 3) continue;
				for (let oy = -rsz; oy <= rsz * 0.7; oy++)
					for (let ox = -rsz; ox <= rsz; ox++) {
						const th = Math.atan2(oy, ox);
						if (Math.hypot(ox / rsz, oy / (rsz * 0.8)) > 1 + Math.sin(th * 4 + rx * 7) * 0.12) continue;
						const k = 0.8 - oy / (rsz * 3) + hash2((x + ox) | 0, (y + oy) | 0, id.grain + 15) * 0.3;
						paint(s, x + ox, y + oy, 118 * k, 114 * k, 106 * k, 1);
					}
				for (let ox = -rsz; ox <= rsz; ox++) paint(s, x + ox, y + rsz * 0.7 + 1, 0, 0, 0, (1 - Math.abs(ox) / (rsz + 1)) * 0.35);
			}

			const order: number[] = [];
			for (let i = 0; i < s.n; i++) order.push(i);
			order.sort((a, b2) => p[a * P + 1] - p[b2 * P + 1]);

			let full = 0;
			for (const i of order) {
				const o = i * P;
				const sc = 0.55 + ((p[o + 1] - hy) / (s.h - hy)) * 0.8;
				let fear = p[o + 2];
				if (panic > 0.02) {
					const dx = p[o] - dogX;
					const dy = p[o + 1] - dogY;
					const d = Math.hypot(dx, dy * 1.6) + 0.01;
					const scare = Math.max(0, 1 - d / (s.w * 0.42)) * panic;
					fear = Math.max(fear, scare);
					if (scare > 0.02) {
						p[o + 5] = Math.atan2(dy / 1.6, dx);
						p[o + 4] = dx > 0 ? 1 : -1;
					}
				}
				fear *= 0.965;
				p[o + 2] = fear;

				const cell = Math.max(0, Math.min(turf.length - 1, (p[o + 1] | 0) * s.w + (p[o] | 0)));
				const here = turf[cell];
				const grazing = fear < 0.12 && here > 0.34;
				if (grazing) {
					p[o + 3] = Math.min(1, p[o + 3] + 0.07);
					const r2 = 1.6 * sc;
					for (let oy = -r2; oy <= r2; oy++)
						for (let ox = -r2; ox <= r2; ox++) {
							const c2 = Math.max(0, Math.min(turf.length - 1, ((p[o + 1] + oy) | 0) * s.w + ((p[o] + ox) | 0)));
							turf[c2] = Math.max(0, turf[c2] - 0.02 * s.v.speed);
						}
				} else {
					p[o + 3] = Math.max(0, p[o + 3] - 0.12);
					if (fear < 0.12) {
						let bth = p[o + 5];
						let best = -1;
						for (let a = -2; a <= 2; a++) {
							const th = p[o + 5] + a * 0.6;
							const sx = Math.round(p[o] + Math.cos(th) * 6);
							const sy = Math.round(p[o + 1] + Math.sin(th) * 3);
							if (sx < 2 || sy < hy + 2 || sx >= s.w - 2 || sy >= s.h - 2) continue;
							const v = turf[sy * s.w + sx];
							if (v > best) {
								best = v;
								bth = th;
							}
						}
						p[o + 5] = bth + (s.rnd() - 0.5) * 0.35 * s.v.drift;
						if (Math.cos(p[o + 5]) > 0.2) p[o + 4] = 1;
						else if (Math.cos(p[o + 5]) < -0.2) p[o + 4] = -1;
					}
					const rate = (0.14 + fear * 1.5) * s.v.speed;
					p[o] += Math.cos(p[o + 5]) * rate;
					p[o + 1] += Math.sin(p[o + 5]) * rate * 0.5;
					if (fear > 0.3 && s.rnd() < 0.3) dust.push([p[o], p[o + 1] + 2 * sc, (s.rnd() - 0.5) * 0.6, 0]);
				}
				if (p[o] < 3) {
					p[o] = 3;
					p[o + 5] = Math.PI - p[o + 5];
				}
				if (p[o] > s.w - 3) {
					p[o] = s.w - 3;
					p[o + 5] = Math.PI - p[o + 5];
				}
				p[o + 1] = Math.max(hy + 3, Math.min(s.h - 3, p[o + 1]));
				full += 1 - here;
				drawSheep(s, p[o], p[o + 1], sc, p[o + 4], p[o + 3], id.tones[i % 24], fear);
			}

			if (run >= 0 && dogX > -s.w * 0.2 && dogX < s.w * 1.2) {
				const sc = 0.55 + ((dogY - hy) / (s.h - hy)) * 0.8;
				const face = id.dogSide;
				for (let ox = -3 * sc; ox <= 3 * sc; ox++) paint(s, dogX + ox, dogY + 2.4 * sc, 0, 0, 0, (1 - Math.abs(ox) / (3 * sc + 1)) * 0.4);
				for (let k = 0; k < 4; k++) {
					const lx = dogX + (k < 2 ? -2 * sc : 2 * sc);
					const gait = Math.sin(s.t * 1.3 + k * 1.9) * 1.4 * sc;
					for (let d = 0; d <= 1.6 * sc; d += 0.7) paint(s, lx + gait * (d / (1.6 * sc + 0.5)), dogY + 0.8 * sc + d, 32, 26, 24, 0.95);
				}
				for (let oy = -1.4 * sc; oy <= 1.2 * sc; oy++)
					for (let ox = -3 * sc; ox <= 3 * sc; ox++) {
						if (Math.hypot(ox / (3 * sc), oy / (1.3 * sc)) > 1) continue;
						const k = 0.8 - oy / (4 * sc) + hash2((dogX + ox) | 0, (dogY + oy) | 0, 991) * 0.25;
						paint(s, dogX + ox, dogY + oy, 46 * k, 38 * k, 34 * k, 1);
					}
				for (let oy = -1.1 * sc; oy <= 1.1 * sc; oy++)
					for (let ox = -1.2 * sc; ox <= 1.2 * sc; ox++) {
						if (Math.hypot(ox / (1.2 * sc), oy / (1.1 * sc)) > 1) continue;
						paint(s, dogX + face * 3.2 * sc + ox, dogY - 0.9 * sc + oy, 40, 33, 30, 1);
					}
				paint(s, dogX + face * 3.9 * sc, dogY - 1 * sc, 224, 216, 206, 0.8);
				for (let d = 0; d <= 3 * sc; d += 0.8) paint(s, dogX - face * (3 * sc + d), dogY - 0.6 * sc - d * 0.4, 44, 36, 32, 0.9);
				for (let k = 0; k < 2; k++) dust.push([dogX - face * 3 * sc, dogY + 2 * sc, -face * (0.3 + s.rnd() * 0.5), 0]);
			}

			for (let k = dust.length - 1; k >= 0; k--) {
				const d = dust[k];
				d[3] += 1;
				if (d[3] > 26) {
					dust.splice(k, 1);
					continue;
				}
				d[0] += d[2];
				d[1] -= 0.09;
				const f = d[3] / 26;
				const rr3 = 0.6 + f * 2.4;
				for (let oy = -rr3; oy <= rr3; oy++)
					for (let ox = -rr3; ox <= rr3; ox++) {
						const dd = Math.hypot(ox, oy) / (rr3 + 0.4);
						if (dd > 1) continue;
						plot(s, d[0] + ox, d[1] + oy, 168, 150, 122, (1 - dd) * (1 - f) * 0.28);
					}
			}
			if (dust.length > 70) dust.splice(0, dust.length - 70);

			s.out = Math.min(1, panic * 0.8 + (full / s.n) * 0.4);
			blit(s);
		}
	};
}

type Rot = {
	logs: number[][];
	caps: number[][];
	leaves: number[][];
	ferns: number[][];
	stones: number[][];
	period: number;
	grain: number;
};

function rotIdent(s: FxScene): Rot {
	const r = mulberry32(s.v.seed + 10711);
	const logs: number[][] = [];
	for (let i = 0; i < 3; i++) logs.push([0.04 + r() * 0.2, 0.36 + r() * 0.46, 0.42 + r() * 0.42, (r() - 0.5) * 0.24, 0.6 + r() * 0.6, r()]);
	const caps: number[][] = [];
	for (let i = 0; i < 26; i++) caps.push([r(), r(), r(), r(), r()]);
	const leaves: number[][] = [];
	for (let i = 0; i < 46; i++) leaves.push([r(), 0.5 + r() * 0.5, r() * 6.28, r()]);
	const ferns: number[][] = [];
	for (let i = 0; i < 6; i++) ferns.push([r(), 0.52 + r() * 0.4, 0.5 + r() * 0.7, r() < 0.5 ? -1 : 1]);
	const stones: number[][] = [];
	for (let i = 0; i < 5; i++) stones.push([r(), 0.58 + r() * 0.36, 1 + r() * 2.4]);
	const period = 380 + ((r() * 240) | 0);
	const grain = (r() * 9999) | 0;
	return { logs, caps, leaves, ferns, stones, period, grain };
}

export function makeDecay(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.2,
		init(s) {
			const id = rotIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = (s.rnd() - 0.5) * 0.24;
				s.parts[o + 3] = -0.05 - s.rnd() * 0.16;
				s.parts[o + 4] = 0.3 + s.rnd() * 0.7;
				s.parts[o + 5] = s.rnd() * 6.28;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Rot;
			const p = s.parts;

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const rot = Math.min(1, cyc / 0.62);
			const flush = cyc > 0.4 && cyc < 0.86 ? Math.min(1, (cyc - 0.4) / 0.14) * Math.min(1, (0.86 - cyc) / 0.1) : 0;
			const fall = cyc > 0.86 ? (cyc - 0.86) / 0.14 : 0;
			const slump = fall > 0 ? Math.min(1, fall * 2.2) : 0;

			const [dr, dg, db] = hsl(24 + (s.v.hue % 22), 24 + s.v.sat * 0.14, 12);
			const [lr2, lg2, lb2] = hsl(28 + (s.v.hue % 30), 32 + s.v.sat * 0.22, 26);
			for (let y = 0; y < s.h; y++) {
				const dep = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const g = hash2(x, y, id.grain) * 0.24 + hash2(x >> 1, y >> 1, id.grain + 4) * 0.28;
					const k = (0.6 + g) * (0.5 + dep * 0.9);
					paint(s, x, y, dr * k, dg * k, db * k, 1);
				}
			}
			for (const [lx, ly, la, lt] of id.leaves) {
				const x = lx * s.w;
				const y = ly * s.h;
				const w2 = 1.4 + lt * 1.4;
				const [er, eg, eb] = hsl(18 + lt * 34, 34 + s.v.sat * 0.2, 22 + lt * 16);
				for (let d = -w2; d <= w2; d += 0.6) {
					const th = 1 - Math.abs(d) / (w2 + 0.4);
					for (let q = -th; q <= th; q += 0.8) {
						const px = x + Math.cos(la) * d - Math.sin(la) * q;
						const py = y + Math.sin(la) * d + Math.cos(la) * q;
						paint(s, px, py, er, eg, eb, 0.85);
					}
				}
				paint(s, x + Math.cos(la) * w2, y + Math.sin(la) * w2, er * 1.4, eg * 1.4, eb * 1.3, 0.6);
			}
			for (const [sx2, sy2, sr2] of id.stones) {
				const x = sx2 * s.w;
				const y = sy2 * s.h;
				for (let oy = -sr2; oy <= sr2 * 0.7; oy++)
					for (let ox = -sr2; ox <= sr2; ox++) {
						const th = Math.atan2(oy, ox);
						if (Math.hypot(ox / sr2, oy / (sr2 * 0.8)) > 1 + Math.sin(th * 4 + sx2 * 8) * 0.12) continue;
						const k = 0.72 - oy / (sr2 * 3.4) + hash2((x + ox) | 0, (y + oy) | 0, id.grain + 11) * 0.3;
						const moss = hash2((x + ox) | 0, (y + oy) | 0, id.grain + 13);
						if (moss > 0.62 && oy < 0) paint(s, x + ox, y + oy, 54 * k, 78 * k, 42 * k, 1);
						else paint(s, x + ox, y + oy, 84 * k, 80 * k, 74 * k, 1);
					}
			}
			for (const [fx2, fy2, fs, fd] of id.ferns) {
				const x = fx2 * s.w;
				const y = fy2 * s.h;
				const L = 4 + fs * 7;
				const sway = Math.sin(s.t * 0.035 * s.v.speed + fx2 * 9) * 0.5 * s.v.drift;
				for (let d = 0; d <= L; d += 0.7) {
					const f = d / L;
					const bx = x + fd * f * f * 3.4 + sway * f * 2;
					const by = y - d;
					const [gr3, gg3, gb3] = hsl(96 + fs * 16, 30 + s.v.sat * 0.2, 20 + f * 14);
					paint(s, bx, by, gr3, gg3, gb3, 0.9);
					const arm = (1 - f) * 2.4;
					if ((d | 0) % 2 === 0)
						for (let q = 1; q <= arm; q++) {
							paint(s, bx - q, by + q * 0.4, gr3 * 0.85, gg3 * 0.85, gb3 * 0.85, 0.8);
							paint(s, bx + q, by + q * 0.4, gr3 * 0.92, gg3 * 0.92, gb3 * 0.92, 0.8);
						}
				}
			}

			let shrooms = 0;
			for (let li = 0; li < id.logs.length; li++) {
				const lg = id.logs[li];
				const len = lg[2] * s.w;
				const th = lg[3];
				const x0 = lg[0] * s.w;
				const y0 = lg[1] * s.h + slump * (1.4 + lg[4]);
				const thick = (1.8 + s.h * 0.05 * lg[4]) * (1 - slump * 0.42);
				const [br2, bg2, bb2] = hsl(22 + lg[5] * 16, 26 + s.v.sat * 0.18, 30 - rot * 9);

				for (let d = 0; d <= len; d += 0.6) {
					const f = d / len;
					const x = x0 + Math.cos(th) * d;
					const y = y0 + Math.sin(th) * d;
					for (let q = 0; q < 3; q++) {
						const sy3 = y + thick + 0.8 + q;
						for (let ox = -thick * 0.9; ox <= thick * 0.9; ox++) paint(s, x + ox, sy3, 0, 0, 0, (1 - Math.abs(ox) / (thick + 1)) * (1 - q / 3) * 0.22);
					}
					const soft = 0.5 + Math.sin(d * 0.22 + lg[0] * 9) * 0.3 + Math.sin(d * 0.07 - lg[5] * 6) * 0.2;
					const eaten = rot * soft;
					for (let k = -thick; k <= thick; k++) {
						const rim = 1 - Math.abs(k) / thick;
						if (rim <= 0) continue;
						const bit = hash2((x + k * 0.3) | 0, (y + k) | 0, id.grain + 30 + li);
						if (rim < eaten * 0.75 + bit * eaten * 0.4) continue;
						const bark = hash2(((d * 1.7) | 0) % 997, k | 0, id.grain + 40 + li);
						const ridge2 = Math.sin(d * 0.9 + k * 0.4 + lg[5] * 8) * 0.5 + 0.5;
						const shade = 0.52 + rim * 0.62 - (k / thick) * 0.22 + bark * 0.3 + ridge2 * 0.16;
						const wet = 1 - eaten * 0.5;
						paint(s, x, y + k, br2 * shade * wet, bg2 * shade * wet, bb2 * shade * wet * 0.9, 1);
						if (rim > 0.82 && bark > 0.5) plot(s, x, y + k, br2 * 1.3, bg2 * 1.3, bb2, 0.22 * (1 - eaten));
						if (bark > 0.93 && eaten > 0.2) paint(s, x, y + k, 18, 14, 12, 0.6);
						if (k < -thick * 0.5 && hash2((x * 1.3) | 0, k | 0, id.grain + 51) > 0.6 - eaten * 0.2)
							paint(s, x, y + k, 48 + eaten * 22, 74 + eaten * 20, 38, 0.6);
					}
					if (f < 0.04 || f > 0.96) {
						for (let k = -thick; k <= thick; k++) {
							const rim = 1 - Math.abs(k) / thick;
							if (rim <= 0) continue;
							const ring = Math.sin(Math.abs(k) * 2.4 + lg[5] * 5) * 0.5 + 0.5;
							paint(s, x, y + k, (128 + ring * 44) * (1 - rot * 0.4), (104 + ring * 34) * (1 - rot * 0.4), 72 * (1 - rot * 0.3), 1);
						}
					}
				}

				for (let ci = 0; ci < id.caps.length; ci++) {
					const cp = id.caps[ci];
					if ((cp[4] * id.logs.length) | 0) {
						if (((cp[4] * id.logs.length) | 0) !== li) continue;
					} else if (li !== 0) continue;
					const grow = Math.max(0, Math.min(1, (flush - cp[2] * 0.4) / 0.5));
					if (grow <= 0.02) continue;
					shrooms += grow;
					const d = cp[0] * len;
					const side = cp[1] < 0.5 ? -1 : 1;
					const x = x0 + Math.cos(th) * d;
					const y = y0 + Math.sin(th) * d - thick * (cp[1] < 0.5 ? 0.9 : 0.1);
					const stem = (1 + cp[3] * 2.4) * grow;
					const cap = (1.2 + cp[3] * 2.6) * grow;
					const sx3 = x + side * cp[2] * 1.4;
					for (let q = 0; q <= stem; q += 0.6) paint(s, sx3 + side * q * 0.24, y - q, 212, 200, 176, 0.95);
					const ty = y - stem;
					const [cr2, cg2, cb2] = hsl(20 + cp[3] * 36, 30 + s.v.sat * 0.3, 44 + cp[2] * 16);
					for (let ox = -cap; ox <= cap; ox++) {
						const u = Math.abs(ox) / (cap + 0.3);
						const hgt = Math.sqrt(Math.max(0, 1 - u * u)) * cap * 0.8;
						for (let oy = -hgt; oy <= 0; oy++) {
							const k = 0.72 + (1 - u) * 0.4 + (-oy / (hgt + 0.4)) * 0.3;
							paint(s, sx3 + ox, ty + oy, cr2 * k, cg2 * k, cb2 * k, 1);
						}
						paint(s, sx3 + ox, ty + 1, 232, 224, 204, 0.85);
						paint(s, sx3 + ox, ty + 2, 140, 128, 112, 0.5);
					}
					if (grow > 0.85 && flush > 0.5) plot(s, sx3, ty - cap * 0.5, 255, 246, 220, 0.2);
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				p[o] += p[o + 2] * s.v.speed + Math.sin(p[o + 5] + s.t * 0.03) * 0.14 * s.v.drift;
				p[o + 1] += p[o + 3] * s.v.speed;
				p[o + 5] += 0.03;
				if (p[o + 1] < -2) {
					p[o + 1] = s.h + 2;
					p[o] = s.rnd() * s.w;
				}
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o] > s.w + 2) p[o] = -2;
				const a = (0.3 + flush * 0.7) * p[o + 4] * edge(p[o + 1], -2, s.h + 2, s.h * 0.24);
				plot(s, p[o], p[o + 1], 238, 232, 206, a * 0.5);
				if (p[o + 4] > 0.8) plot(s, p[o] + 1, p[o + 1], 238, 232, 206, a * 0.2);
			}

			if (fall > 0) {
				const puff = Math.sin(Math.min(1, fall * 3) * Math.PI);
				for (const lg of id.logs) {
					const x = (lg[0] + lg[2] * 0.5) * s.w;
					const y = lg[1] * s.h + 2;
					const rr3 = fall * s.w * 0.22;
					for (let th2 = 0; th2 < 6.28; th2 += 0.16) {
						const wob = 1 + Math.sin(th2 * 3 + lg[5] * 7) * 0.2;
						plot(s, x + Math.cos(th2) * rr3 * wob, y + Math.sin(th2) * rr3 * wob * 0.4, 224, 214, 184, puff * 0.34);
					}
				}
			}

			s.out = Math.min(1, shrooms / 8 + fall * 0.5);
			blit(s);
		}
	};
}

type Bloom = {
	segs: number[][];
	sites: number[][];
	hills: number[];
	far: number[][];
	tufts: number[][];
	rootX: number;
	scale: number;
	sunX: number;
	lit: number;
	lightSide: number;
	swayT: number;
	period: number;
	grain: number;
};

function bloomIdent(s: FxScene): Bloom {
	const r = mulberry32(s.v.seed + 11311);
	const rootX = 0.24 + r() * 0.5;
	const scale = 0.82 + r() * 0.36;
	const sunX = r() < 0.5 ? 0.12 + r() * 0.16 : 0.72 + r() * 0.16;
	const lit = r() * 6.28;
	const lightSide = sunX < 0.5 ? -1 : 1;
	const swayT = 150 + r() * 160;
	const period = 400 + ((r() * 240) | 0);
	const grain = (r() * 9999) | 0;
	const hills: number[] = [];
	for (let i = 0; i < 7; i++) hills.push(r());
	const far: number[][] = [];
	for (let i = 0; i < 3; i++) far.push([r(), 0.05 + r() * 0.06, 0.05 + r() * 0.05]);
	const tufts: number[][] = [];
	for (let i = 0; i < 26; i++) tufts.push([r(), r(), 0.4 + r() * 0.8]);

	const segs: number[][] = [];
	const sites: number[][] = [];
	const trunkA = -1.57 + (r() - 0.5) * 0.24;
	const grow = (x: number, y: number, ang: number, len: number, th: number, depth: number) => {
		const ex = x + Math.cos(ang) * len;
		const ey = y + Math.sin(ang) * len;
		segs.push([x, y, ex, ey, depth, th]);
		if (depth >= 4 || len < 0.028) {
			const n = 2 + ((r() * 3) | 0);
			for (let i = 0; i < n; i++) {
				const f = 0.3 + r() * 0.8;
				sites.push([x + (ex - x) * f + (r() - 0.5) * 0.04, y + (ey - y) * f + (r() - 0.5) * 0.04, (1 + r() * 1.1) * scale, r() * 40, r() * 6.28]);
			}
			return;
		}
		const kids = depth === 0 ? 3 : r() < 0.26 ? 3 : 2;
		for (let i = 0; i < kids; i++) {
			const spread = 0.42 + r() * 0.52;
			const side = kids === 2 ? (i === 0 ? -1 : 1) : i - 1;
			grow(ex, ey, ang + side * spread + (r() - 0.5) * 0.24, len * (0.56 + r() * 0.2), th * 0.64, depth + 1);
		}
	};
	grow(0, 0, trunkA, (0.2 + r() * 0.05) * scale, (2.4 + r() * 0.7) * scale, 0);
	return { segs, sites, hills, far, tufts, rootX, scale, sunX, lit, lightSide, swayT, period, grain };
}

export function makeBloom(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const id = bloomIdent(s);
			(s as any).id = id;
			const open = new Float32Array(id.sites.length);
			for (let i = 0; i < open.length; i++) open[i] = 0.2 + ((i * 37) % 13) / 16;
			(s as any).open = open;
			(s as any).fly = [] as number[][];
			(s as any).drift = new Float32Array(s.w);
			(s as any).tint = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Bloom;
			const open = (s as any).open as Float32Array;
			const fly = (s as any).fly as number[][];
			const drift = (s as any).drift as Float32Array;
			const tint = (s as any).tint as Float32Array;

			const gy = Math.round(s.h * 0.84);
			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const gust = cyc > 0.54 && cyc < 0.8 ? Math.sin(((cyc - 0.54) / 0.26) * Math.PI) ** 0.7 : 0;
			const front = cyc > 0.54 ? (cyc - 0.54) / 0.17 : -1;
			const dir = s.v.dir > 0 ? 1 : -1;
			const frontX = dir > 0 ? front * 1.3 - 0.16 : 1.16 - front * 1.3;
			const sway = Math.sin((s.t * 6.28) / id.swayT) * 0.5 + Math.sin((s.t * 6.28) / (id.swayT * 0.43)) * 0.26;
			const bend = (sway * 0.05 * s.v.drift + gust * 0.2 * dir) * s.h;

			const [skHi, skHiG, skHiB] = hsl(s.v.hue2 + 8, 24 + s.v.sat * 0.28, 26);
			const [skLo, skLoG, skLoB] = hsl(s.v.hue2 + 34, 34 + s.v.sat * 0.3, 52);
			const sunX = id.sunX * s.w;
			const sunY = gy * 0.42;
			for (let y = 0; y < gy; y++) {
				const f = y / gy;
				const ff = f * f;
				for (let x = 0; x < s.w; x++) {
					const band = hash2(x >> 2, y, id.grain + 1) * 0.06;
					let r2 = skHi + (skLo - skHi) * ff + band * 40;
					let g2 = skHiG + (skLoG - skHiG) * ff + band * 38;
					let b2 = skHiB + (skLoB - skHiB) * ff + band * 34;
					const sd = Math.hypot((x - sunX) / (s.h * 0.62), (y - sunY) / (s.h * 0.62));
					if (sd < 1) {
						const k = (1 - sd) * (1 - sd);
						r2 += k * 96;
						g2 += k * 84;
						b2 += k * 58;
					}
					paint(s, x, y, r2, g2, b2, 1);
				}
			}

			const [hlR, hlG, hlB] = hsl(s.v.hue2 + 46, 18 + s.v.sat * 0.2, 34);
			for (let x = 0; x < s.w; x++) {
				const u = x / s.w;
				const ridge =
					id.hills[0] * Math.sin(u * 3.1 + id.hills[1] * 6.28) +
					id.hills[2] * Math.sin(u * 6.4 - id.hills[3] * 6.28) +
					id.hills[4] * Math.sin(u * 1.7 + id.hills[5] * 6.28);
				const top = gy - s.h * (0.1 + 0.07 * ridge);
				for (let y = Math.round(top); y < gy; y++) {
					const d = (y - top) / Math.max(1, gy - top);
					const k = 0.72 + d * 0.3 + hash2(x, y, id.grain + 4) * 0.16;
					paint(s, x, y, hlR * k, hlG * k, hlB * k, 1);
				}
				paint(s, x, top, hlR * 1.35, hlG * 1.32, hlB * 1.2, 0.8);
			}

			const [ftR, ftG, ftB] = hsl(104 + (s.v.hue % 30), 24 + s.v.sat * 0.24, 22);
			for (const [fx, fh, fw] of id.far) {
				const bx = fx * s.w;
				const by = gy - s.h * 0.06;
				const rr = s.h * fw;
				for (let dy = -rr * 1.1; dy <= rr * 0.5; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const th = Math.atan2(dy, dx);
						const lump = 1 + Math.sin(th * 4 + fx * 20) * 0.16 + Math.sin(th * 7 - fh * 9) * 0.1;
						if (Math.hypot(dx / (rr * lump), dy / (rr * 0.82 * lump)) > 1) continue;
						const g = hash2((bx + dx) | 0, (by + dy) | 0, id.grain + 7);
						if (g > 0.86) continue;
						const k = 0.76 + g * 0.34 - dy / (rr * 5);
						paint(s, bx + dx, by + dy, ftR * k, ftG * k, ftB * k, 0.92);
					}
				for (let k = 0; k < s.h * fh * 0.5; k++) paint(s, bx, by + k, 42, 34, 36, 0.8);
			}

			const [grR, grG, grB] = hsl(96 + (s.v.hue % 40), Math.max(26, s.v.sat * 0.36), 26);
			const [gdR, gdG, gdB] = hsl(96 + (s.v.hue % 40), Math.max(22, s.v.sat * 0.3), 12);
			for (let y = gy; y < s.h; y++) {
				const d = (y - gy) / Math.max(1, s.h - gy);
				for (let x = 0; x < s.w; x++) {
					const tex = hash2(x, y, id.grain + 11) * 0.3 + hash2(x >> 1, y >> 1, id.grain + 13) * 0.22;
					const roll = Math.sin(x * 0.06 + id.hills[6] * 6) * 0.5;
					const k = 0.6 + d * 0.32 + tex * 0.7 + roll * 0.1;
					paint(s, x, y, grR * k + gdR * d * 0.5, grG * k + gdG * d * 0.5, grB * k + gdB * d * 0.5, 1);
				}
			}
			for (const [tx, ty, th2] of id.tufts) {
				const x = tx * s.w;
				const y = gy + ty * (s.h - gy);
				const bl = th2 * s.h * 0.06;
				const kick = sway * 0.6 + gust * 2.2 * dir;
				for (let k = 0; k < bl; k++) {
					const f = k / bl;
					paint(s, x + f * f * kick, y - k, grR * (1.25 + f * 0.5), grG * (1.3 + f * 0.5), grB * (1.1 + f * 0.4), 0.8 * (1 - f * 0.4));
				}
			}

			const rx = id.rootX * s.w;
			const px = (u: number, v: number) => rx + u * s.h + bend * Math.pow(Math.max(0, -v), 1.35);
			const py = (v: number) => gy + v * s.h;

			const shw = s.h * 0.34 * id.scale;
			const shx = rx + id.lightSide * s.h * 0.1;
			for (let dy = 0; dy < 4; dy++)
				for (let dx = -shw; dx <= shw; dx++) {
					const d = Math.hypot(dx / shw, dy / 3.4);
					if (d > 1) continue;
					paint(s, shx + dx, gy + dy, 0, 0, 0, (1 - d) * (1 - d) * 0.34);
				}

			const [bkR, bkG, bkB] = hsl(18 + (s.v.hue2 % 20), 22 + s.v.sat * 0.14, 24);
			for (const sg of id.segs) {
				const ax = px(sg[0], sg[1]);
				const ay = py(sg[1]);
				const bx = px(sg[2], sg[3]);
				const by = py(sg[3]);
				const len = Math.hypot(bx - ax, by - ay) || 1;
				const nx = -(by - ay) / len;
				const ny = (bx - ax) / len;
				const steps = Math.ceil(len * 1.6);
				for (let q = 0; q <= steps; q++) {
					const f = q / steps;
					const x = ax + (bx - ax) * f;
					const y = ay + (by - ay) * f;
					const th2 = sg[5] * (1 - f * 0.38);
					for (let k = -th2; k <= th2; k += 0.5) {
						const rim = 1 - Math.abs(k) / (th2 + 0.4);
						const bark = hash2((x + k * nx) | 0, (y + k * ny) | 0, id.grain + 21);
						const lit = 0.52 + rim * 0.5 + bark * 0.3 - (k / (th2 + 0.4)) * 0.26 * id.lightSide;
						paint(s, x + k * nx, y + k * ny, bkR * lit, bkG * lit, bkB * lit, 1);
						if (rim > 0.8 && bark > 0.66) plot(s, x + k * nx, y + k * ny, bkR * 1.5, bkG * 1.4, bkB * 1.3, 0.24);
					}
				}
			}

			for (let i = 0; i < id.sites.length; i++) {
				const st = id.sites[i];
				const o = open[i];
				if (o > -0.98) open[i] = Math.min(1, o + 0.0042 * s.v.speed * (0.7 + st[4] * 0.6));
				if (o <= 0) continue;
				const x = px(st[0], st[1]);
				const y = py(st[1]);
				if (gust > 0.04 && ((dir > 0 && x / s.w < frontX) || (dir < 0 && x / s.w > frontX)) && o > 0.3 && s.rnd() < 0.09 * gust + 0.004) {
					open[i] = -0.35 - s.rnd() * 0.6;
					for (let q = 0; q < 3; q++)
						fly.push([
							x + (s.rnd() - 0.5) * 2,
							y + (s.rnd() - 0.5) * 2,
							dir * (0.5 + s.rnd() * 1.3) * gust,
							-0.3 - s.rnd() * 0.5,
							s.rnd() * 6.28,
							0.1 + s.rnd() * 0.18,
							st[3]
						]);
					if (fly.length > 90) fly.splice(0, fly.length - 90);
					continue;
				}
				const sz = st[2] * (0.6 + o * 1.2);
				const bud = Math.min(1, o * 3);
				const [pr, pg2, pb] = hsl(s.v.hue + st[3] * 0.6 + (1 - o) * 16, Math.max(58, s.v.sat), 40 + o * 18 + st[3] * 0.2);
				for (let a = 0; a < 5; a++) {
					const pa = st[4] + (a / 5) * 6.28;
					const ox = x + Math.cos(pa) * sz * 0.64 * bud;
					const oy = y + Math.sin(pa) * sz * 0.64 * bud;
					for (let dy = -sz; dy <= sz; dy++)
						for (let dx = -sz; dx <= sz; dx++) {
							const dd = Math.hypot(dx, dy) / (sz * 0.78);
							if (dd > 1) continue;
							const face = Math.min(1.24, 0.74 + Math.cos(pa - id.lit) * 0.2 + (1 - dd) * 0.16);
							paint(s, ox + dx, oy + dy, pr * face, pg2 * face, pb * face, 0.95);
						}
				}
				if (o > 0.6) {
					const [cr, cg, cb] = hsl(48, 80, 62);
					paint(s, x, y, cr, cg, cb, (o - 0.6) * 2.2);
					plot(s, x, y, 255, 236, 180, (o - 0.6) * 1.4);
				}
			}

			for (let k = fly.length - 1; k >= 0; k--) {
				const q = fly[k];
				q[3] += 0.016 * s.v.speed;
				q[2] += (dir * gust * 0.06 + Math.sin(q[4] * 0.7) * 0.03 * s.v.drift) * s.v.speed;
				q[2] *= 0.985;
				q[4] += q[5] + Math.abs(q[2]) * 0.14;
				q[0] += q[2];
				q[1] += Math.max(-0.4, q[3]);
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				if (q[0] < -3 || q[0] > s.w + 3) {
					fly.splice(k, 1);
					continue;
				}
				if (q[1] >= s.h - 1 - drift[col] * 0.5) {
					drift[col] = Math.min(5, drift[col] + 1);
					tint[col] = q[6];
					const l2 = Math.max(0, col - 1);
					const r3 = Math.min(s.w - 1, col + 1);
					drift[l2] = Math.min(5, drift[l2] + 0.35);
					drift[r3] = Math.min(5, drift[r3] + 0.35);
					fly.splice(k, 1);
					continue;
				}
				const sq = Math.abs(Math.cos(q[4]));
				const sz = 1.2 + sq * 1.2;
				const [pr, pg2, pb] = hsl(s.v.hue + q[6] * 0.6 + 6, Math.max(58, s.v.sat), 50 + sq * 16);
				for (let dy = -sz; dy <= sz; dy++)
					for (let dx = -sz; dx <= sz; dx++) {
						const dd = Math.hypot(dx / Math.max(0.42, sq), dy) / sz;
						if (dd > 1) continue;
						const bite = hash2((dx * 7 + q[4] * 3) | 0, dy | 0, id.grain + 31);
						if (dd > 0.52 && bite < 0.4) continue;
						paint(s, q[0] + dx, q[1] + dy, pr, pg2, pb, 0.94 * edge(q[1], -3, s.h + 2, s.h * 0.08));
					}
			}

			for (let x = 0; x < s.w; x++) {
				const hgt = drift[x] * 0.55;
				if (hgt < 0.3) continue;
				for (let k = 0; k < hgt; k++) {
					const g = hash2(x, k, id.grain + 41);
					const [lr, lg2, lb] = hsl(s.v.hue + tint[x] * 0.6 + g * 12, Math.max(52, s.v.sat * 0.9), 40 + g * 14 - k * 3);
					paint(s, x, s.h - 1 - k, lr, lg2, lb, 0.92 * (1 - k / (hgt + 1.6)));
				}
				drift[x] *= 0.99965;
			}

			if (gust > 0.05) {
				const [wr, wg2, wb] = hsl(s.v.hue2 + 30, 20, 88);
				for (let i = 0; i < 7; i++) {
					const yy = ((i * 97 + id.grain) % 100) / 100;
					const base = (yy * 3.7 + i * 0.13) % 1;
					const cx2 = (dir > 0 ? frontX - 0.06 - base * 0.3 : frontX + 0.06 + base * 0.3) * s.w;
					const y = (0.08 + yy * 0.72) * s.h;
					for (let d = 0; d < 16; d++) {
						const x = cx2 + dir * d;
						plot(s, x, y + Math.sin(d * 0.3 + s.t * 0.2 + i) * 0.9, wr, wg2, wb, gust * 0.16 * (1 - d / 16));
					}
				}
			}

			let lit2 = 0;
			for (let i = 0; i < open.length; i++) if (open[i] > 0.5) lit2++;
			s.out = Math.min(1, gust * 0.85 + (lit2 / open.length) * 0.3);
			blit(s);
		}
	};
}

type Puff = {
	caps: number[][];
	twigs: number[][];
	moss: number[][];
	litter: number[][];
	trunks: number[][];
	shaftX: number;
	shaftW: number;
	drift: number;
	period: number;
	grain: number;
};

function sporeIdent(s: FxScene): Puff {
	const r = mulberry32(s.v.seed + 12401);
	const caps: number[][] = [];
	for (let i = 0; i < 5; i++) caps.push([0.1 + r() * 0.8, 0.56 + r() * 0.42, 0.5 + r() * 0.7, r(), r(), 0.8 + r() * 0.5]);
	const twigs: number[][] = [];
	for (let i = 0; i < 5; i++) twigs.push([r(), 0.66 + r() * 0.3, 0.06 + r() * 0.12, (r() - 0.5) * 0.7]);
	const moss: number[][] = [];
	for (let i = 0; i < 7; i++) moss.push([r(), 0.5 + r() * 0.3, 0.05 + r() * 0.08]);
	const litter: number[][] = [];
	for (let i = 0; i < 40; i++) litter.push([r(), 0.6 + r() * 0.38, r() * 6.28, r()]);
	const trunks: number[][] = [];
	for (let i = 0; i < 5; i++) trunks.push([r(), 1.4 + r() * 3, (r() - 0.5) * 0.16, r()]);
	const shaftX = 0.18 + r() * 0.6;
	const shaftW = 0.14 + r() * 0.14;
	const drift = (r() - 0.5) * 2;
	const period = 300 + ((r() * 200) | 0);
	const grain = (r() * 9999) | 0;
	return { caps, twigs, moss, trunks, litter, shaftX, shaftW, drift, period, grain };
}

export function makeSpore(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.02,
		init(s) {
			const id = sporeIdent(s);
			(s as any).id = id;
			const ph = new Float32Array(id.caps.length);
			for (let i = 0; i < ph.length; i++) ph[i] = id.caps[i][3];
			(s as any).ph = ph;
			(s as any).cloud = [] as number[][];
			(s as any).rings = [] as number[][];
			(s as any).pins = [] as number[][];
			(s as any).dust = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Puff;
			const ph = (s as any).ph as Float32Array;
			const cloud = (s as any).cloud as number[][];
			const rings = (s as any).rings as number[][];
			const pins = (s as any).pins as number[][];
			const dust = (s as any).dust as Float32Array;
			const gy = Math.round(s.h * 0.56);
			const wind = id.drift * s.v.drift * s.v.dir;

			const [bgR, bgG, bgB] = hsl(s.v.hue2 + 12, 16 + s.v.sat * 0.16, 11);
			const [flR, flG, flB] = hsl(28 + (s.v.hue % 22), 22 + s.v.sat * 0.18, 20);
			for (let y = 0; y < gy; y++) {
				const f = y / gy;
				for (let x = 0; x < s.w; x++) {
					const g = hash2(x >> 1, y >> 1, id.grain) * 0.3 + hash2(x, y, id.grain + 2) * 0.16;
					const k = 0.52 + f * 0.62 + g * 0.5;
					paint(s, x, y, bgR * k, bgG * k, bgB * k * 1.1, 1);
				}
			}
			const trunkH = hsl(22 + (s.v.hue2 % 18), 18, 14);
			for (let i = 0; i < id.trunks.length; i++) {
				const tr = id.trunks[i];
				const tx = tr[0] * s.w;
				const tw = tr[1];
				const far = 0.5 + tr[3] * 0.6;
				for (let y = 0; y < gy + 2; y++)
					for (let k = -tw; k <= tw; k++) {
						const rim = 1 - Math.abs(k) / (tw + 0.6);
						const kk = (0.42 + rim * 0.62 + hash2((tx + k) | 0, y, id.grain + 9 + i) * 0.34) * far;
						paint(s, tx + k + (y / gy) * tr[2] * s.w * 1.6, y, trunkH[0] * kk, trunkH[1] * kk, trunkH[2] * kk, 1);
					}
			}

			const sx = id.shaftX * s.w;
			const sw = id.shaftW * s.w;
			const beat = 0.8 + 0.2 * Math.sin(s.t * 0.012 * s.v.speed);
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const half = sw * (0.4 + f * 0.9);
				for (let x = sx - half; x <= sx + half; x++) {
					const e = 1 - Math.abs(x - sx) / (half + 0.5);
					plot(s, x + f * s.w * 0.06, y, 255, 246, 214, e * e * (1 - f * 0.4) * 0.09 * beat);
				}
			}

			for (let y = gy; y < s.h; y++) {
				const d = (y - gy) / Math.max(1, s.h - gy);
				for (let x = 0; x < s.w; x++) {
					const tex = hash2(x, y, id.grain + 11) * 0.34 + hash2(x >> 1, y >> 2, id.grain + 13) * 0.24;
					const k = 0.58 + d * 0.46 + tex;
					paint(s, x, y, flR * k, flG * k, flB * k * 0.86, 1);
				}
			}
			for (const [lx, ly, la, lt] of id.litter) {
				const x = lx * s.w;
				const y = gy + ly * (s.h - gy) * 0.9;
				const len = 1.6 + lt * 2.4;
				const [lr, lg2, lb] = hsl(24 + lt * 24, 30 + s.v.sat * 0.14, 24 + lt * 12);
				for (let d = -len; d <= len; d += 0.6) {
					const cu = Math.sin(d * 0.6 + la) * 0.5;
					paint(s, x + Math.cos(la) * d, y + Math.sin(la) * d * 0.4 + cu, lr, lg2, lb, 0.8);
				}
			}
			for (const [tx, ty, tl, ta] of id.twigs) {
				const x = tx * s.w;
				const y = gy + ty * (s.h - gy) * 0.8;
				const len = tl * s.w;
				for (let d = 0; d < len; d += 0.5) {
					const px2 = x + Math.cos(ta) * d;
					const py2 = y + Math.sin(ta) * d * 0.5;
					paint(s, px2, py2 + 1, 0, 0, 0, 0.2);
					paint(s, px2, py2, 58, 44, 34, 0.95);
					paint(s, px2, py2 - 1, 84, 66, 50, 0.55);
				}
			}
			const [moR, moG, moB] = hsl(96 + (s.v.hue % 30), 32 + s.v.sat * 0.2, 26);
			for (const [mx, my, mr] of id.moss) {
				const x = mx * s.w;
				const y = gy + my * (s.h - gy) * 0.86;
				const rr = mr * s.h;
				for (let dy = -rr * 0.6; dy <= rr * 0.4; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						if (Math.hypot(dx / rr, dy / (rr * 0.55)) > 1) continue;
						const g = hash2((x + dx) | 0, (y + dy) | 0, id.grain + 17);
						if (g > 0.82) continue;
						paint(s, x + dx, y + dy, moR * (0.7 + g * 0.7), moG * (0.72 + g * 0.7), moB * (0.6 + g * 0.5), 0.9);
					}
			}

			const [skR, skG, skB] = hsl(38 + (s.v.hue % 20), 22 + s.v.sat * 0.22, 66);
			const drawCap = (x: number, y: number, rr: number, swell: number, split: number, tone: number, live: number) => {
				for (let dx = -rr * 1.1; dx <= rr * 1.1; dx++) {
					const e = 1 - Math.abs(dx) / (rr * 1.2);
					if (e <= 0) continue;
					paint(s, x + dx, y + 1, 0, 0, 0, e * 0.34);
				}
				const stH = rr * (0.5 + tone * 0.3);
				for (let k = 0; k <= stH; k++) {
					const half = rr * (0.3 + (k / (stH + 1)) * 0.2);
					for (let dx = -half; dx <= half; dx++) {
						const rim = 1 - Math.abs(dx) / (half + 0.4);
						const kk = 0.56 + rim * 0.5;
						paint(s, x + dx, y - k, skR * kk * 0.72, skG * kk * 0.72, skB * kk * 0.68, 1);
					}
				}
				const top = y - stH;
				const sag = 1.3 - live * 0.5;
				for (let dy = -rr * sag; dy <= rr * 0.36; dy++)
					for (let dx = -rr; dx <= rr; dx++) {
						const d = Math.hypot(dx / rr, dy / (rr * sag * 0.98));
						if (d > 1) continue;
						const wart = hash2((x + dx) | 0, (top + dy) | 0, (id.grain + 23 + tone * 90) | 0);
						const lift = -dy / (rr * sag + 0.5);
						let kk = 0.44 + lift * 0.74 + wart * 0.24 + swell * 0.18;
						if (wart > 0.88) kk += 0.4;
						const dark = split * (0.4 + wart * 0.6) * Math.max(0, 1 - Math.abs(dy + rr * 0.3) / (rr * 0.9));
						paint(s, x + dx, top + dy, skR * kk * (1 - dark * 0.7), skG * kk * (1 - dark * 0.72), skB * kk * (1 - dark * 0.6), 1);
						if (d > 0.86 && wart > 0.5) paint(s, x + dx, top + dy, 26, 20, 16, 0.3);
					}
				if (split > 0.25) {
					const mouth = rr * split * 0.8;
					for (let dx = -mouth; dx <= mouth; dx++) {
						const e = 1 - Math.abs(dx) / (mouth + 0.4);
						for (let k = 0; k < 1 + e * 2; k++) paint(s, x + dx, top - rr * sag * 0.72 + k, 22, 16, 14, e * 0.9);
					}
				}
			};

			for (let i = 0; i < id.caps.length; i++) {
				const c = id.caps[i];
				const cyc = c[5] * id.period;
				ph[i] += (1 / cyc) * s.v.speed;
				if (ph[i] >= 1) ph[i] -= 1;
				const t = ph[i];
				const x = c[0] * s.w;
				const depth = c[1];
				const y = gy + (depth - 0.54) * (s.h - gy) * 1.15;
				const rr = (2.6 + c[2] * 4.4) * (0.62 + depth * 0.66);
				const swell = t < 0.7 ? t / 0.7 : 0;
				const split = t > 0.5 && t < 0.72 ? (t - 0.5) / 0.22 : 0;
				const fired = t >= 0.72 && t < 0.74;
				const live = t < 0.72 ? 0.55 + swell * 0.45 : 0.35 + ((t - 0.72) / 0.26) * 0.6;
				drawCap(x, y, rr * (0.78 + swell * 0.26), swell, split, c[4], live);
				if (fired) {
					rings.push([x, y - rr * 1.4, 0, rr]);
					const n = 22 + ((rr * 5) | 0);
					for (let q = 0; q < n; q++) {
						const a2 = -1.57 + (s.rnd() - 0.5) * 2.1;
						const sp = (0.5 + s.rnd() * 1.1) * (0.6 + rr * 0.18);
						cloud.push([x, y - rr * 1.5, Math.cos(a2) * sp, Math.sin(a2) * sp, 0, 60 + s.rnd() * 90, s.rnd() * 6.28]);
					}
					if (cloud.length > 300) cloud.splice(0, cloud.length - 300);
				}
			}

			for (let k = pins.length - 1; k >= 0; k--) {
				const q = pins[k];
				q[2] += 0.0016 * s.v.speed;
				if (q[2] > 1) {
					pins.splice(k, 1);
					continue;
				}
				const rr = q[2] * 3.4;
				drawCap(q[0], q[1], rr, q[2], 0, q[3], 0.9);
			}

			const [spR, spG, spB] = hsl(s.v.hue + 16, 18 + s.v.sat * 0.2, 60);
			for (let k = cloud.length - 1; k >= 0; k--) {
				const q = cloud[k];
				q[4] += 1;
				if (q[4] > q[5]) {
					cloud.splice(k, 1);
					continue;
				}
				q[6] += 0.09;
				q[3] += 0.006 * s.v.speed;
				q[2] += (wind * 0.02 + Math.sin(q[6]) * 0.012) * s.v.speed;
				q[2] *= 0.988;
				q[3] *= 0.99;
				q[0] += q[2] + Math.sin(q[6] * 0.7) * 0.12;
				q[1] += q[3];
				if (q[0] < -2 || q[0] > s.w + 2) {
					cloud.splice(k, 1);
					continue;
				}
				const col = Math.max(0, Math.min(s.w - 1, q[0] | 0));
				if (q[1] >= s.h - 1 - dust[col] * 0.35) {
					dust[col] = Math.min(4, dust[col] + 0.55);
					if (pins.length < 5 && s.rnd() < 0.014) pins.push([q[0], Math.min(s.h - 2, q[1]), 0, s.rnd()]);
					cloud.splice(k, 1);
					continue;
				}
				const life = 1 - q[4] / q[5];
				const sz = 0.7 + (1 - life) * 1.5;
				const a = life * life * 0.5 * edge(q[1], -2, s.h + 1, s.h * 0.1);
				for (let dy = -sz; dy <= sz; dy++)
					for (let dx = -sz; dx <= sz; dx++) {
						const d = Math.hypot(dx, dy) / (sz + 0.3);
						if (d > 1) continue;
						plot(s, q[0] + dx, q[1] + dy, spR, spG, spB, a * (1 - d) * 0.9);
					}
			}

			for (let k = rings.length - 1; k >= 0; k--) {
				const q = rings[k];
				q[2] += 1;
				if (q[2] > 16) {
					rings.splice(k, 1);
					continue;
				}
				const f = q[2] / 16;
				const rr = q[3] * (0.4 + f * 3.4);
				const a = (1 - f) * (1 - f) * 0.7;
				for (let th = 0; th < 6.28; th += 0.1) {
					const wob = 1 + Math.sin(th * 3 + q[0]) * 0.12;
					plot(s, q[0] + Math.cos(th) * rr * wob, q[1] + Math.sin(th) * rr * 0.6 * wob, spR, spG, spB, a * 0.55);
				}
			}

			for (let x = 0; x < s.w; x++) {
				const hgt = dust[x] * 0.4;
				if (hgt < 0.25) continue;
				for (let k = 0; k < hgt; k++) plot(s, x, s.h - 1 - k, spR, spG, spB, 0.3 * (1 - k / (hgt + 1.2)));
				dust[x] *= 0.9992;
			}

			s.out = Math.min(1, cloud.length / 90 + rings.length * 0.2);
			blit(s);
		}
	};
}
