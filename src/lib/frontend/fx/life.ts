import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Flock = {
	cohere: number;
	align: number;
	sep: number;
	roost: number[];
	poles: number[][];
	sun: number;
	ridge: number[];
	trees: number[][];
	period: number;
	wire: number;
};

function flockIdent(s: FxScene): Flock {
	const r = mulberry32(s.v.seed + 1240);
	const cohere = 0.0016 + r() * 0.003;
	const align = 0.04 + r() * 0.07;
	const sep = 1.6 + r() * 1.8;
	const roost = [0.2 + r() * 0.6, 0.25 + r() * 0.4];
	const poles: number[][] = [];
	for (let i = 0; i < 4; i++) poles.push([r(), 0.3 + r() * 0.4]);
	const sun = 0.15 + r() * 0.7;
	const ridge: number[] = [];
	for (let i = 0; i < 9; i++) ridge.push(r());
	const trees: number[][] = [];
	for (let i = 0; i < 7; i++) trees.push([r(), 0.4 + r() * 0.8]);
	const period = 300 + ((r() * 180) | 0);
	const wire = r() < 0.5 ? 1 : 0;
	return { cohere, align, sep, roost, poles, sun, ridge, trees, period, wire };
}

export function makeSwarm(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.9,
		init(s) {
			const id = flockIdent(s);
			(s as any).id = id;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h * 0.7;
				const th = s.rnd() * Math.PI * 2;
				s.parts[o + 2] = Math.cos(th) * 0.6;
				s.parts[o + 3] = Math.sin(th) * 0.4;
				s.parts[o + 4] = 0.5 + s.rnd() * 0.5;
				s.parts[o + 5] = s.rnd();
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Flock;
			const p = s.parts;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.3, 14);
			const [wr, wg, wb] = hsl(s.v.hue2, s.v.sat * 0.4, 72);

			const dusk = s.h * 0.82;
			const sunX = id.sun * s.w;
			const sunY = dusk - s.h * 0.06;
			const [skr, skg, skb] = hsl(s.v.hue2, 42 + s.v.sat * 0.3, 26);
			for (let y = 0; y < dusk; y++)
				for (let x = 0; x < dusk * 0 + s.w; x++) {
					const f = 1 - y / dusk;
					const d = Math.hypot((x - sunX) / (s.w * 0.55), (y - sunY) / (s.h * 0.8));
					const warm = Math.max(0, 1 - d) ** 2.1;
					paint(s, x, y, skr * (0.35 + f * 0.5) + warm * 190, skg * (0.4 + f * 0.6) + warm * 104, skb * (0.6 + f * 1) + warm * 46, 1);
				}
			const srd = s.h * 0.09;
			for (let dy = -srd * 4; dy <= srd * 4; dy++)
				for (let dx = -srd * 4; dx <= srd * 4; dx++) {
					const d = Math.hypot(dx, dy) / srd;
					if (d < 1) paint(s, sunX + dx, sunY + dy, 255, 196, 128, 1);
					else plot(s, sunX + dx, sunY + dy, 255, 158, 92, Math.max(0, 1 - d / 4) ** 2.3 * 0.42);
				}

			for (let L = 0; L < 2; L++) {
				const amp = L ? 0.18 : 0.1;
				const base = dusk - (L ? s.h * 0.02 : 0);
				const tone = L ? 0.5 : 0.24;
				for (let x = 0; x < s.w; x++) {
					const t2 = (x / s.w) * 8 + L * 3.1;
					const i2 = t2 | 0;
					const raw = t2 - i2;
					const ff = raw * raw * (3 - 2 * raw);
					const hz = base - (id.ridge[i2 % 9] * (1 - ff) + id.ridge[(i2 + 1) % 9] * ff) * s.h * amp;
					for (let y = hz; y < dusk; y++) paint(s, x, y, br * tone * 3, bg * tone * 3, bb * tone * 3, 1);
				}
			}

			const [gr, gg, gb] = hsl(s.v.hue, 18 + s.v.sat * 0.2, 11);
			for (let y = dusk; y < s.h; y++) {
				const f = (y - dusk) / (s.h - dusk);
				for (let x = 0; x < s.w; x++) {
					const lit = Math.max(0, 1 - Math.abs(x - sunX) / (s.w * 0.4)) * (1 - f) * 0.7;
					paint(s, x, y, gr * (1 + f * 0.6) + lit * 120, gg * (1 + f * 0.6) + lit * 62, gb * (1 + f * 0.6) + lit * 26, 1);
				}
			}

			for (const [tx, th] of id.trees) {
				const bx = tx * s.w;
				const bh = th * s.h * 0.22;
				for (let k = 0; k < bh; k++) {
					const f = k / bh;
					const tier = (f * 3) % 1;
					const half = (0.2 + f * 0.8) * (0.5 + tier * 0.6) * s.w * 0.02 + 0.4;
					for (let q = -half; q <= half; q++) paint(s, bx + q, dusk - (bh - k), 8, 10, 12, 0.96);
				}
			}

			for (const [px, ph] of id.poles) {
				const x = px * s.w;
				const top = dusk - ph * s.h * 0.5;
				for (let y = top; y < dusk; y++) for (let q = -1; q <= 1; q++) paint(s, x + q, y, 10, 11, 13, 0.96);
				for (let k = -3; k <= 3; k++) paint(s, x + k, top, 10, 11, 13, 0.96);
				for (let k = -2; k <= 2; k++) paint(s, x + k, top + 3, 10, 11, 13, 0.96);
			}
			if (id.wire) {
				for (let i = 0; i + 1 < id.poles.length; i++) {
					const x0 = id.poles[i][0] * s.w;
					const x1 = id.poles[i + 1][0] * s.w;
					const y0 = dusk - id.poles[i][1] * s.h * 0.5;
					const y1 = dusk - id.poles[i + 1][1] * s.h * 0.5;
					const lo = Math.min(x0, x1);
					const hi = Math.max(x0, x1);
					for (let x = lo; x <= hi; x++) {
						const f = (x - x0) / (x1 - x0 || 1);
						const sag = Math.sin(f * Math.PI) * s.h * 0.05;
						paint(s, x, y0 + (y1 - y0) * f + sag, 10, 11, 13, 0.85);
					}
				}
			}

			const cyc = ((s.t * s.v.speed) % id.period) / id.period;
			const hunt = cyc > 0.55 && cyc < 0.85 ? (cyc - 0.55) / 0.3 : -1;
			const hx = hunt >= 0 ? (s.v.dir > 0 ? hunt * (s.w + 30) - 15 : s.w + 15 - hunt * (s.w + 30)) : -999;
			const hy = hunt >= 0 ? s.h * 0.2 + Math.sin(hunt * Math.PI) * s.h * 0.42 : 0;

			const rx = id.roost[0] * s.w + Math.sin(s.t * 0.008 * s.v.speed) * s.w * 0.22 * s.v.dir;
			const ry = id.roost[1] * s.h + Math.cos(s.t * 0.011 * s.v.speed) * s.h * 0.14;

			let packed = 0;
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				let ax = 0;
				let ay = 0;
				let cx = 0;
				let cy = 0;
				let vx = 0;
				let vy = 0;
				let seen = 0;
				for (let j = 0; j < s.n; j += 2) {
					if (j === i) continue;
					const q = j * P;
					const dx = p[q] - p[o];
					const dy = p[q + 1] - p[o + 1];
					const d2 = dx * dx + dy * dy;
					if (d2 > 90) continue;
					seen++;
					cx += p[q];
					cy += p[q + 1];
					vx += p[q + 2];
					vy += p[q + 3];
					if (d2 < id.sep * id.sep && d2 > 0.0001) {
						const inv = 1 / d2;
						ax -= dx * inv * 0.9;
						ay -= dy * inv * 0.9;
					}
				}
				packed += seen;
				if (seen > 0) {
					ax += (cx / seen - p[o]) * id.cohere;
					ay += (cy / seen - p[o + 1]) * id.cohere;
					ax += (vx / seen - p[o + 2]) * id.align;
					ay += (vy / seen - p[o + 3]) * id.align;
				}
				ax += (rx - p[o]) * 0.0014;
				ay += (ry - p[o + 1]) * 0.0022;
				if (p[o + 1] > dusk - 4) ay -= 0.06;
				if (hunt >= 0) {
					const fdx = p[o] - hx;
					const fdy = p[o + 1] - hy;
					const fd = Math.hypot(fdx, fdy);
					if (fd < s.w * 0.3 && fd > 0.001) {
						const push = (1 - fd / (s.w * 0.3)) ** 2 * 1.9;
						ax += (fdx / fd) * push;
						ay += (fdy / fd) * push;
					}
				}

				p[o + 2] += ax;
				p[o + 3] += ay;
				const sp = Math.hypot(p[o + 2], p[o + 3]);
				const max = 0.85 * s.v.speed * (0.7 + p[o + 4] * 0.5) * (hunt >= 0 ? 1.7 : 1);
				if (sp > max) {
					p[o + 2] = (p[o + 2] / sp) * max;
					p[o + 3] = (p[o + 3] / sp) * max;
				}
				p[o] += p[o + 2];
				p[o + 1] += p[o + 3];
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o + 1] < -2) p[o + 1] = 2;

				p[o + 5] += sp * 0.5;
				const flap = Math.sin(p[o + 5]);
				const a = 0.85 * edge(p[o], -2, s.w + 2, s.w * 0.1);
				const dirx = sp > 0.001 ? p[o + 2] / sp : 1;
				const diry = sp > 0.001 ? p[o + 3] / sp : 0;
				for (let q = -1; q <= 0; q++) paint(s, p[o] + dirx * q, p[o + 1] + diry * q, 6, 7, 9, a);
				const span = 1.6 + Math.abs(flap) * 2.4;
				for (let k = 1; k <= span; k++) {
					const fx = -diry * k;
					const fy = dirx * k * (flap > 0 ? 1 : -1) * 0.6;
					const ka = a * (1 - k / (span + 1.4));
					paint(s, p[o] + fx, p[o + 1] + fy * 0.6 - Math.abs(flap) * 0.4, 6, 7, 9, ka);
					paint(s, p[o] - fx, p[o + 1] - fy * 0.6 - Math.abs(flap) * 0.4, 6, 7, 9, ka);
				}
				if (p[o + 1] < s.h * 0.3) plot(s, p[o], p[o + 1], wr, wg, wb, a * 0.12);
			}

			if (hunt >= 0) {
				const fade = Math.min(1, Math.sin(hunt * Math.PI) * 2.6);
				const fd2 = s.v.dir > 0 ? 1 : -1;
				const flap2 = Math.sin(s.t * 0.42);
				for (let k = -4; k <= 4; k++) {
					const f = Math.abs(k) / 4;
					for (let q = -1; q <= 1; q++) paint(s, hx + k * fd2, hy + q * (1 - f * 0.55), 4, 5, 7, fade * 0.98);
				}
				for (let side = -1; side <= 1; side += 2) {
					for (let k = 1; k <= 9; k++) {
						const f = k / 9;
						const sw = 1.4 - f * 0.9;
						const wy = hy + side * k * (0.35 + Math.abs(flap2) * 0.75) - Math.abs(flap2) * 1.2;
						for (let q = -sw; q <= sw; q++) paint(s, hx - k * 0.55 * fd2 + q, wy, 5, 6, 8, fade * (1 - f * 0.4));
					}
				}
				for (let k = 0; k < 5; k++) paint(s, hx - (5 + k) * fd2, hy + k * 0.3, 4, 5, 7, fade * (1 - k / 6));
				plot(s, hx + 4 * fd2, hy - 1, 230, 180, 70, fade * 0.8);
			}

			s.out = Math.min(1, Math.max(0, (packed / s.n - 3) / 18) * 0.6 + (hunt >= 0 ? Math.sin(hunt * Math.PI) * 0.8 : 0));
			blit(s);
		}
	};
}

type Bloom = { bells: number[][]; period: number; motes: number; kelp: number[][]; floor: number[]; rocks: number[][]; flashPeriod: number; grain: number };

function hash2(x: number, y: number, g: number) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (g | 0) * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function jellyIdent(s: FxScene): Bloom {
	const r = mulberry32(s.v.seed + 2350);
	const bells: number[][] = [];
	for (let i = 0; i < 7; i++) bells.push([r(), r(), 0.55 + r() * 0.85, r() * Math.PI * 2, 0.5 + r() * 0.6, r()]);
	const period = 44 + r() * 42;
	const motes = 0.3 + r() * 0.5;
	const kelp: number[][] = [];
	for (let i = 0; i < 9; i++) kelp.push([r(), 0.22 + r() * 0.4, r() * 6.28, 0.6 + r() * 0.8]);
	const floor: number[] = [];
	for (let i = 0; i < 9; i++) floor.push(r());
	const rocks: number[][] = [];
	for (let i = 0; i < 5; i++) rocks.push([r(), 0.03 + r() * 0.05, 0.4 + r() * 0.6]);
	const flashPeriod = 230 + ((r() * 170) | 0);
	const grain = (r() * 9999) | 0;
	return { bells, period, motes, kelp, floor, rocks, flashPeriod, grain };
}

export function makeJelly(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = jellyIdent(s);
			(s as any).id = id;
			(s as any).y = id.bells.map((b) => b[1]);
			(s as any).lit = id.bells.map(() => 0);
			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				s.parts[o] = s.rnd() * s.w;
				s.parts[o + 1] = s.rnd() * s.h;
				s.parts[o + 2] = 0.2 + s.rnd() * 0.6;
				s.parts[o + 3] = s.rnd() * Math.PI * 2;
			}
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Bloom;
			const ys = (s as any).y as number[];
			const lits = (s as any).lit as number[];
			const [dr, dg, db] = hsl(s.v.hue, 30 + s.v.sat * 0.5, 12);
			const [br2, bg2, bb2] = hsl(s.v.hue2, Math.max(50, s.v.sat), 70);
			const [tr, tg, tb] = hsl(s.v.hue, 34 + s.v.sat * 0.5, 58);
			const [kr, kg, kb] = hsl(140 + (s.v.hue % 50), 22 + s.v.sat * 0.2, 16);

			const prev = ((s as any).glow as number) ?? 0;
			const cyc = ((s.t * s.v.speed) % id.flashPeriod) / id.flashPeriod;
			const wave = cyc < 0.42 ? cyc / 0.42 : -1;

			const bedY = s.h * 0.82;
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				for (let x = 0; x < s.w; x++) {
					const murk = hash2(x >> 1, y >> 1, id.grain) * 0.2;
					const k = 0.35 + f * 1.3 + murk;
					paint(s, x, y, dr * k, dg * k, db * k * 1.15, 1);
				}
			}
			const shaftX = s.w * 0.5 + Math.sin(s.t * 0.006) * s.w * 0.14;
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const half = s.w * (0.05 + f * 0.13);
				for (let x = shaftX - half; x <= shaftX + half; x++) {
					const e = 1 - Math.abs(x - shaftX) / (half + 0.5);
					const ray = 0.7 + 0.3 * Math.sin(x * 0.5 + s.t * 0.02);
					plot(s, x, y, br2, bg2, bb2, e * e * (1 - f * 0.8) * 0.1 * ray);
				}
			}

			for (let x = 0; x < s.w; x++) {
				const t2 = (x / s.w) * 8;
				const i2 = t2 | 0;
				const raw = t2 - i2;
				const ff = raw * raw * (3 - 2 * raw);
				const hz = bedY - (id.floor[i2 % 9] * (1 - ff) + id.floor[(i2 + 1) % 9] * ff) * s.h * 0.08;
				for (let y = hz; y < s.h; y++) {
					const g = hash2(x, y, id.grain + 5);
					const lit = (0.55 + g * 0.5 + Math.max(0, 1 - (y - hz) / 4) * 0.5) * (1 + prev * 0.7);
					paint(s, x, y, dr * lit * 2.1, dg * lit * 2.1, db * lit * 1.9, 1);
				}
			}
			for (const [rx, rr2, rh] of id.rocks) {
				const px = rx * s.w;
				const rad = rr2 * s.w;
				for (let dy = -rad * rh * 2; dy <= 0; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx / rad, dy / (rad * rh * 2));
						if (d > 1) continue;
						const g = hash2(px + dx, bedY + dy, id.grain + 9);
						const lit = (0.9 + g * 0.5) * (1 + Math.max(0, -dy / (rad * rh * 2)) * 0.5) * (1 + prev * 0.8);
						paint(s, px + dx, bedY + dy + 2, dr * lit * 1.8, dg * lit * 1.8, db * lit * 1.7, 1);
					}
			}
			for (const [kx, klen, kph, kthk] of id.kelp) {
				const bx = kx * s.w;
				const len = klen * s.h;
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const sway = Math.sin(kph + s.t * 0.018 * s.v.speed + f * 2.6) * f * f * s.w * 0.05 * s.v.drift * s.v.dir;
					const w = kthk * (1 - f * 0.55) + 0.4;
					for (let q = -w; q <= w; q++) {
						const e = 1 - Math.abs(q) / (w + 0.5);
						const sh = (0.6 + e * 0.7) * (1 + f * 0.5) * (1 + prev * 1.1);
						paint(s, bx + sway + q, bedY - k, kr * sh, kg * sh, kb * sh, 0.95);
					}
				}
			}

			let pump = 0;
			let glow = 0;
			for (let bi = 0; bi < id.bells.length; bi++) {
				const b = id.bells[bi];
				const per = id.period * b[4];
				const ph = ((s.t * s.v.speed + b[3] * per) % per) / per;
				const thrust = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
				const squeeze = thrust;
				pump = Math.max(pump, thrust);
				ys[bi] -= thrust * 0.5 * b[2] * s.v.speed;
				ys[bi] += 0.06 * (1 - thrust) * 0.5;
				if (ys[bi] < -0.25) ys[bi] = 1.25;
				if (ys[bi] > 1.3) ys[bi] = -0.2;

				const cx = b[0] * s.w + Math.sin(s.t * 0.01 + b[3]) * s.w * 0.05 * s.v.drift * s.v.dir;
				const cy = ys[bi] * s.h;
				if (wave >= 0) {
					const front = wave * 1.35 - 0.2;
					const near = 1 - Math.abs(cx / s.w - front) / 0.22;
					if (near > 0) lits[bi] = Math.max(lits[bi], Math.min(1, near * 1.5));
				}
				lits[bi] *= 0.955;
				const fl = lits[bi];
				glow = Math.max(glow, fl);
				const rw = s.w * 0.085 * b[2] * (1 + squeeze * 0.22);
				const rh = s.h * 0.15 * b[2] * (1 - squeeze * 0.3);
				const a = edge(cy, -s.h * 0.3, s.h * 1.3, s.h * 0.3);
				if (a <= 0.01) continue;

				const gr2 = br2 * (1 - fl) + 255 * fl;
				const gg3 = bg2 * (1 - fl) + 250 * fl;
				const gb3 = bb2 * (1 - fl) + 255 * fl;

				for (let y = -rh; y <= 0; y++) {
					const f = -y / rh;
					const half = rw * Math.sqrt(Math.max(0, 1 - f * f * 0.85));
					for (let x = -half; x <= half; x++) {
						const e = 1 - Math.abs(x) / (half + 0.4);
						const rib = 0.85 + 0.35 * Math.sin(x * 1.5 + b[3] * 4);
						plot(s, cx + x, cy + y, gr2, gg3, gb3, (0.1 + e * 0.26) * (0.6 + f * 0.7) * rib * a * (1 + fl * 1.6));
					}
					plot(s, cx - half, cy + y, gr2, gg3, gb3, (0.55 + fl * 0.4) * a);
					plot(s, cx + half, cy + y, gr2, gg3, gb3, (0.55 + fl * 0.4) * a);
				}
				for (let x = -rw; x <= rw; x++) {
					const frill = Math.sin(x * 2.1 + s.t * 0.08 * s.v.speed + b[3]) * 0.9;
					plot(s, cx + x, cy + frill, gr2, gg3, gb3, (0.5 + fl * 0.45) * a);
				}

				for (let k = 0; k < 7; k++) {
					const off = (k / 6 - 0.5) * rw * 1.6;
					const len = rh * (1.9 + (k % 3) * 0.8);
					for (let q = 0; q < len; q++) {
						const f = q / len;
						const lag = Math.sin(s.t * 0.06 * s.v.speed - q * 0.26 + b[3] + k) * f * rw * 0.6;
						const drag = thrust * f * f * 2.4;
						plot(
							s,
							cx + off + lag,
							cy + q + drag,
							tr * (1 - fl) + 255 * fl,
							tg * (1 - fl) + 240 * fl,
							tb * (1 - fl) + 255 * fl,
							(1 - f) * (0.5 + fl * 0.5) * a
						);
					}
				}
				const hrad = rw * (1.8 + fl * 2.4);
				for (let y = -hrad; y <= hrad; y++)
					for (let x = -hrad; x <= hrad; x++) {
						const d = Math.hypot(x / hrad, y / (hrad * 0.9));
						if (d > 1) continue;
						plot(s, cx + x, cy + y, gr2, gg3, gb3, (1 - d) * (1 - d) * (0.12 + fl * 0.5) * a);
					}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * p[o + 2];
				p[o + 1] -= 0.06 * p[o + 2] * id.motes;
				p[o] += Math.sin(p[o + 3]) * 0.1 * s.v.drift;
				if (p[o + 1] < -1) {
					p[o + 1] = s.h + 1;
					p[o] = s.rnd() * s.w;
				}
				const tw = 0.4 + 0.6 * Math.sin(p[o + 3] * 1.3);
				plot(s, p[o], p[o + 1], br2, bg2, bb2, tw * (0.3 + glow * 0.5) * edge(p[o + 1], -1, s.h + 1, s.h * 0.2));
			}
			(s as any).glow = glow;
			s.out = Math.min(1, pump * 0.35 + glow * 0.85);
			blit(s);
		}
	};
}

type Field = {
	blades: number[][];
	gustPeriod: number;
	horizon: number;
	seeds: number;
	hills: number[];
	trees: number[][];
	sun: number;
	clouds: number[][];
	posts: number[];
	fence: number;
};

function meadowIdent(s: FxScene): Field {
	const r = mulberry32(s.v.seed + 3460);
	const blades: number[][] = [];
	for (let i = 0; i < 64; i++) blades.push([r(), r(), r(), r()]);
	const gustPeriod = 120 + r() * 110;
	const horizon = 0.3 + r() * 0.16;
	const seeds = 0.3 + r() * 0.5;
	const hills: number[] = [];
	for (let i = 0; i < 9; i++) hills.push(r());
	const trees: number[][] = [];
	for (let i = 0; i < 5; i++) trees.push([r(), 0.4 + r() * 0.9, r()]);
	const sun = 0.12 + r() * 0.76;
	const clouds: number[][] = [];
	for (let i = 0; i < 5; i++) clouds.push([r(), 0.1 + r() * 0.6, 0.4 + r() * 0.8]);
	const posts: number[] = [];
	for (let i = 0; i < 6; i++) posts.push(r());
	const fence = r() < 0.5 ? 1 : 0;
	return { blades, gustPeriod, horizon, seeds, hills, trees, sun, clouds, posts, fence };
}

export function makeMeadow(rows: number): FxProgram {
	return {
		opaque: true,
		rows,
		stride: 0.5,
		init(s) {
			const id = meadowIdent(s);
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
			const id = (s as any).id as Field;
			const horizon = id.horizon * s.h;
			const [gr, gg, gb] = hsl(s.v.hue, 30 + s.v.sat * 0.5, 26);
			const [lr, lg, lb] = hsl(s.v.hue2, 34 + s.v.sat * 0.5, 62);
			const [sr, sg, sb] = hsl(s.v.hue2, 24 + s.v.sat * 0.4, 88);

			const gust = ((s.t * s.v.speed) % id.gustPeriod) / id.gustPeriod;
			const front = gust * (s.w + s.w * 0.9) - s.w * 0.45;
			const sunX = id.sun * s.w;
			const sunY = horizon - s.h * 0.08;

			const [skr, skg, skb] = hsl(s.v.hue2 + 12, 40 + s.v.sat * 0.3, 40);
			for (let y = 0; y < horizon; y++) {
				const f = 1 - y / horizon;
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - sunX) / (s.w * 0.6), (y - sunY) / (s.h * 0.7));
					const warm = Math.max(0, 1 - d) ** 2;
					paint(s, x, y, skr * (0.5 + f * 0.6) + warm * 175, skg * (0.6 + f * 0.7) + warm * 130, skb * (0.8 + f * 0.9) + warm * 60, 1);
				}
			}
			const srd = s.h * 0.075;
			for (let dy = -srd * 3.5; dy <= srd * 3.5; dy++)
				for (let dx = -srd * 3.5; dx <= srd * 3.5; dx++) {
					const d = Math.hypot(dx, dy) / srd;
					if (d < 1) paint(s, sunX + dx, sunY + dy, 255, 236, 186, 1);
					else plot(s, sunX + dx, sunY + dy, 255, 208, 130, Math.max(0, 1 - d / 3.5) ** 2.2 * 0.4);
				}
			for (const [cx, cy, cw] of id.clouds) {
				const px = ((cx * s.w + s.t * 0.05 * s.v.speed * s.v.dir) % (s.w * 1.4)) - s.w * 0.2;
				const py = cy * horizon * 0.8;
				const rw = s.w * 0.14 * cw;
				const rh = s.h * 0.03 * cw;
				for (let dy = -rh; dy <= rh; dy++)
					for (let dx = -rw; dx <= rw; dx++) {
						const lump = 0.7 + 0.5 * Math.sin(dx * 0.4 + cx * 9) * Math.sin(dx * 0.13 + cy * 5);
						const d = Math.hypot(dx / (rw * lump), dy / rh);
						if (d > 1) continue;
						const und = dy / rh;
						plot(s, px + dx, py + dy, 255, 224 - und * 40, 206 - und * 70, (1 - d) * 0.34);
					}
			}

			for (let L = 0; L < 2; L++) {
				const amp = L ? 0.14 : 0.08;
				const tone = L ? 1 : 0.62;
				for (let x = 0; x < s.w; x++) {
					const t2 = (x / s.w) * 8 + L * 3.3;
					const i2 = t2 | 0;
					const raw = t2 - i2;
					const ff = raw * raw * (3 - 2 * raw);
					const hz = horizon - (id.hills[i2 % 9] * (1 - ff) + id.hills[(i2 + 1) % 9] * ff) * s.h * amp;
					const lit = Math.max(0, 1 - Math.abs(x - sunX) / (s.w * 0.5));
					for (let y = hz; y < horizon; y++) {
						const dep = (y - hz) / Math.max(1, horizon - hz);
						const k = tone * (0.5 + dep * 0.5) * (1 + lit * 0.5);
						paint(s, x, y, gr * k * 0.9, gg * k, gb * k * 0.8, 1);
					}
				}
			}
			for (const [tx, th, tw2] of id.trees) {
				const bx = tx * s.w;
				const bh = th * s.h * 0.12;
				for (let k = 0; k < bh; k++) {
					const f = k / bh;
					const half = (0.25 + (1 - f) * 0.75) * (0.6 + tw2 * 0.8) * s.w * 0.022 + 0.5;
					const ragged = half * (0.8 + 0.35 * Math.sin(k * 1.9 + tx * 21));
					for (let q = -ragged; q <= ragged; q++) {
						const e = 1 - Math.abs(q) / (ragged + 0.5);
						const k2 = 0.5 + e * 0.6 + (1 - f) * 0.3;
						paint(s, bx + q, horizon - (bh - k), gr * k2 * 0.6, gg * k2 * 0.7, gb * k2 * 0.5, 0.96);
					}
				}
			}
			if (id.fence) {
				const fy = horizon + (s.h - horizon) * 0.14;
				for (const px of id.posts) {
					const x = px * s.w;
					for (let k = 0; k < s.h * 0.1; k++) for (let q = -1; q <= 0; q++) paint(s, x + q, fy - k, 62, 46, 32, 0.95);
				}
				for (let rail = 0; rail < 2; rail++) {
					const ry = fy - s.h * (0.04 + rail * 0.045);
					for (let x = 0; x < s.w; x++) paint(s, x, ry + Math.sin(x * 0.05) * 0.6, 58, 43, 30, 0.85);
				}
			}

			for (let y = horizon; y < s.h; y++) {
				const f = (y - horizon) / (s.h - horizon);
				for (let x = 0; x < s.w; x++) {
					const lit = Math.max(0, 1 - Math.abs(x - sunX) / (s.w * 0.7)) * (1 - f) ** 1.6;
					const mott = 0.85 + 0.3 * Math.sin(x * 0.11 + y * 0.31) * Math.sin(x * 0.03 - y * 0.07);
					const k = (0.5 + f * 0.75) * mott;
					paint(s, x, y, gr * k * 0.85 + lit * 92, gg * k + lit * 74, gb * k * 0.7 + lit * 30, 1);
				}
			}

			const count = Math.max(24, (s.w * 1.4) | 0);
			const bstream = mulberry32(s.v.seed + 8888);
			for (let i = 0; i < count; i++) {
				const b = id.blades[i % 64];
				const jx = bstream();
				const x0 = ((i / count) * s.w + (jx - 0.5) * (s.w / count) * 2) % s.w;
				const depth = b[1];
				const base = horizon + depth * (s.h - horizon) * 1.02;
				if (base > s.h + 2) continue;
				const len = (s.h - horizon) * (0.16 + b[0] * 0.36) * (0.5 + depth * 0.8);
				const reach = (x0 - front) / (s.w * 0.28);
				const hit = Math.exp(-reach * reach);
				const bend = (Math.sin(s.t * 0.04 * s.v.speed + b[2] * 9) * 0.12 + hit * (0.6 + b[3] * 0.4)) * s.v.dir * (0.6 + s.v.drift * 0.6);
				const shade = 0.4 + depth * 0.6;
				const sunlit = Math.max(0, 1 - Math.abs(x0 - sunX) / (s.w * 0.6));
				for (let k = 0; k < len; k++) {
					const f = k / len;
					const x = x0 + bend * f * f * len * 0.9;
					const y = base - k;
					const lit = 0.5 + 0.5 * Math.max(0, bend * s.v.dir) + sunlit * 0.4;
					const cr = gr * (1 - f * 0.25) + lr * f * 0.42 * lit;
					const cg2 = gg * (1 - f * 0.25) + lg * f * 0.42 * lit;
					const cb2 = gb * (1 - f * 0.25) + lb * f * 0.42 * lit;
					paint(s, x, y, cr, cg2, cb2, (0.55 + f * 0.4) * shade);
					if (f > 0.55 && hit > 0.3) plot(s, x, y, sr, sg, sb, (f - 0.55) * hit * 0.35 * shade);
				}
				if (b[3] > 0.78) {
					const hx = x0 + bend * len * 0.9;
					const hy = base - len;
					const hrad = 1.2 + depth * 0.9;
					for (let dy = -hrad * 1.5; dy <= hrad * 1.5; dy++)
						for (let dx = -hrad; dx <= hrad; dx++) {
							const d = Math.hypot(dx / hrad, dy / (hrad * 1.5));
							if (d > 1) continue;
							const fuzz = 0.55 + 0.45 * Math.sin(dx * 3.1 + dy * 2.3 + b[2] * 17);
							paint(s, hx + dx, hy + dy, sr, sg, sb, (1 - d) * fuzz * 0.75 * shade);
						}
					plot(s, hx, hy, 255, 250, 232, 0.4 * shade * (0.4 + sunlit * 0.8));
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				const reach = (p[o] - front) / (s.w * 0.3);
				const hit = Math.exp(-reach * reach);
				p[o + 3] += 0.04;
				p[o] += (0.1 + hit * 1.1) * s.v.dir * s.v.drift * p[o + 2];
				p[o + 1] += Math.sin(p[o + 3]) * 0.1 - 0.04 * p[o + 2] - hit * 0.14;
				if (p[o] > s.w + 2) p[o] = -2;
				if (p[o] < -2) p[o] = s.w + 2;
				if (p[o + 1] < -2) p[o + 1] = s.h * 0.5 + s.rnd() * s.h * 0.5;
				if (p[o + 1] > s.h + 2) p[o + 1] = horizon;
				const a = 0.6 * edge(p[o], -2, s.w + 2, s.w * 0.12) * edge(p[o + 1], -2, s.h + 2, s.h * 0.15);
				const spin = p[o + 3] * 0.6;
				for (let k = 0; k < 4; k++) {
					const th = spin + (k / 4) * Math.PI * 2;
					plot(s, p[o] + Math.cos(th) * 1.3, p[o + 1] + Math.sin(th) * 1.3, sr, sg, sb, a * 0.45);
				}
				plot(s, p[o], p[o + 1], 255, 252, 238, a);
			}
			s.out = Math.max(0, Math.sin(gust * Math.PI));
			blit(s);
		}
	};
}
