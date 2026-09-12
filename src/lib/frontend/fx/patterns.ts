import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, stamp, type FxProgram, type FxScene } from './engine.js';

/** Ground that cracks open, with dust venting out of the fissures. */
export function makeQuake(rows: number): FxProgram {
	return {
		rows,
		stride: 0.9,
		init(s) {
			const r = mulberry32(s.v.seed + 1201);
			const cracks: number[][] = [];
			const n = 2 + ((r() * 3) | 0);
			for (let i = 0; i < n; i++) cracks.push([0.1 + r() * 0.8, r() * 200, 0.5 + r() * 0.8, r() < 0.5 ? -1 : 1]);
			(s as any).cracks = cracks;
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * 6] = s.rnd() * s.w;
				p[i * 6 + 1] = s.rnd() * 0.88 * s.h;
				p[i * 6 + 2] = s.rnd();
				p[i * 6 + 3] = 0.2 + s.rnd() * 0.8;
				p[i * 6 + 4] = s.rnd() * 6.28;
				p[i * 6 + 5] = s.rnd() - 0.5;
			}
		},
		frame(s) {
			clear(s);
			const cracks = (s as any).cracks as number[][];
			const gy = s.h * 0.7;
			const [rr, rg, rb] = hsl(s.v.hue, s.v.sat, 22);
			const [er, eg, eb] = hsl(s.v.hue, s.v.sat, 46);
			for (let x = 0; x < s.w; x++) for (let y = gy; y < s.h; y++) plot(s, x, y, rr, rg, rb, 0.95);
			for (const [fx, off, scale, dir] of cracks) {
				const open = Math.max(0, Math.sin((s.t - off) * 0.012 * s.v.speed)) * scale;
				if (open < 0.02) continue;
				const cx = fx * s.w;
				let x = cx;
				for (let y = gy; y < s.h; y++) {
					x += (mulberry32(s.v.seed + fx * 1000 + y)() - 0.5) * 2.4 + dir * 0.3;
					const w = open * s.w * 0.035 * (1 - (y - gy) / (s.h - gy));
					for (let k = -w; k <= w; k++) {
						const i = ((y | 0) * s.w + ((x + k) | 0)) * 4;
						if (i < 0 || i >= s.px.length) continue;
						s.px[i] = s.px[i + 1] = s.px[i + 2] = 0;
						s.px[i + 3] = 255;
					}
					plot(s, x - w, y, er, eg, eb, 0.8);
					plot(s, x + w, y, er, eg, eb, 0.8);
				}
			}
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				const o = i * 6;
				p[o + 4] += 0.06 * (0.4 + p[o + 3]) * s.v.speed * s.v.dir;
				const arc = Math.sin(p[o + 4]);
				const x = p[o] + Math.cos(p[o + 4] * 0.7) * p[o + 5] * s.w * 0.06 * (0.5 + s.v.drift) + s.v.tilt * 2;
				const y = p[o + 1] - arc * s.h * 0.16;
				const spin = Math.abs(Math.cos(p[o + 4] * 1.3));
				const wide = 1 + Math.round(spin * 2);
				for (let dx = 0; dx < wide; dx++) plot(s, x + dx, y, er, eg, eb, 0.85);
				if (spin < 0.4) plot(s, x, y + 1, er, eg, eb, 0.6);
			}
			for (const [fx2, off2, sc2] of cracks) {
				const vent = Math.max(0, Math.sin((s.t - off2) * 0.012 * s.v.speed));
				for (let d = 0; d < 24; d++) {
					const ph = ((s.t * 0.6 + d * 9) % 70) / 70;
					const px2 = fx2 * s.w + (mulberry32((d * 31) | 0)() - 0.5) * s.w * 0.1 * (1 + ph * 2);
					plot(s, px2, gy - ph * s.h * 0.55, er, eg, eb, (1 - ph) * vent * sc2 * 0.28);
				}
			}
			for (let sl = 0; sl < 3; sl++) {
				const tilt = Math.sin(s.t * 0.02 * s.v.speed + sl * 2) * 2.2 * s.v.dir;
				const x0 = s.w * (0.1 + sl * 0.32);
				const wsl = s.w * 0.2;
				for (let x = x0; x < x0 + wsl; x++) {
					const y = gy + ((x - x0) / wsl - 0.5) * tilt;
					plot(s, x, y, er, eg, eb, 0.9);
					plot(s, x, y + 1, rr, rg, rb, 0.8);
				}
			}
			blit(s);
		}
	};
}

/** Channel-split tear bands that jump in hard steps. */
export function makeTear(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).bands = [] as number[][];
			(s as any).next = 0;
			(s as any).ghost = [] as number[][];
		},
		frame(s) {
			clear(s);
			const st = s as any;
			if (s.t >= st.next) {
				const bands: number[][] = [];
				const n = 2 + ((s.rnd() * 4) | 0);
				for (let i = 0; i < n; i++)
					bands.push([s.rnd() * s.h, 1 + s.rnd() * (3 + s.v.drift * 4), (s.rnd() - 0.5) * s.w * (0.12 + s.v.drift * 0.22) * s.v.dir, s.rnd()]);
				st.bands = bands;
				st.next = s.t + 1 + ((s.rnd() * 9 * (1.4 - s.v.speed * 0.4)) | 0);
				for (const bd of bands) st.ghost.push([bd[0], bd[1], bd[2], 1]);
				if (st.ghost.length > 18) st.ghost.splice(0, st.ghost.length - 18);
			}
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat, 56);
			const [cr, cg, cb] = hsl(s.v.hue2, s.v.sat, 56);
			for (const [y0, h, shift, which] of st.bands as number[][]) {
				for (let y = y0; y < y0 + h; y++) {
					for (let x = 0; x < s.w; x++) {
						if (which < 0.5) {
							plot(s, x + shift, y + s.v.tilt, br, bg * 0.2, bb * 0.2, 0.5);
							plot(s, x - shift, y, cr * 0.2, cg, cb, 0.5);
						} else {
							plot(s, x + shift, y, 255, 255, 255, 0.16);
						}
					}
				}
			}
			for (let k = 0; k < 3; k++) {
				const y = s.rnd() * s.h;
				for (let x = 0; x < s.w; x++) if (s.rnd() > 0.6) plot(s, x, y, 255, 255, 255, 0.3);
			}
			for (let i = (st.ghost as number[][]).length - 1; i >= 0; i--) {
				const gh = st.ghost[i];
				gh[3] -= 0.08;
				if (gh[3] <= 0) {
					st.ghost.splice(i, 1);
					continue;
				}
				for (let y = gh[0]; y < gh[0] + gh[1]; y++) for (let x = 0; x < s.w; x += 2) plot(s, x + gh[2] * gh[3], y, br, bg, bb, gh[3] * 0.18);
			}
			blit(s);
		}
	};
}

/** Lines drawn inward and swallowed by a rimmed maw. */
export function makeMaw(rows: number): FxProgram {
	return {
		rows,
		stride: 0.8,
		init(s) {
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				p[i * 6] = s.rnd() * Math.PI * 2;
				p[i * 6 + 1] = 0.5 + s.rnd() * 0.8;
				p[i * 6 + 2] = 0.3 + s.rnd() * 0.9;
			}
		},
		frame(s) {
			clear(s);
			const cx = s.w * 0.5;
			const cy = s.h * 0.5;
			const rad = s.h * (0.2 + 0.02 * Math.sin(s.t * 0.03));
			const [lr, lg, lb] = hsl(s.v.hue, s.v.sat, 62);
			for (let i = 0; i < s.n; i++) {
				const p = s.parts;
				const o = i * 6;
				p[o + 1] -= 0.005 * p[o + 2] * s.v.speed;
				if (p[o + 1] < 0.16) {
					p[o + 1] = 1.3;
					p[o] = s.rnd() * Math.PI * 2;
				}
				const a = p[o];
				for (let k = 0; k < 7; k++) {
					const rr = p[o + 1] + k * 0.035;
					plot(s, cx + Math.cos(a) * rr * s.w * 0.5, cy + Math.sin(a) * rr * s.h * 0.5, lr, lg, lb, (1 - k / 7) * 0.6 * edge(p[o + 1], 0.16, 1.3, 0.22));
				}
			}
			const [vr, vg, vb] = hsl(s.v.hue2, s.v.sat * 0.4, 82);
			for (let i = 0; i < 40; i++) {
				const a2 = (i * 2.39996 + s.v.tilt) % 6.283;
				const d2 = 0.55 + ((i * 0.137 + s.t * 0.0008 * s.v.speed) % 0.6);
				plot(s, cx + Math.cos(a2) * d2 * s.w * 0.5, cy + Math.sin(a2) * d2 * s.h * 0.5, vr, vg, vb, (d2 - 0.3) * 0.7);
			}
			const [mr, mg, mb] = hsl(s.v.hue2, s.v.sat, 74);
			for (let k = 0; k < 360; k += 2) {
				const th = (k * Math.PI) / 180;
				const wob = 1 + 0.06 * Math.sin(th * 5 + s.t * 0.05 * s.v.dir);
				plot(s, cx + Math.cos(th) * rad * wob, cy + Math.sin(th) * rad * wob, mr, mg, mb, 0.9);
			}
			for (let y = -rad; y <= rad; y++)
				for (let x = -rad; x <= rad; x++) {
					if (x * x + y * y > rad * rad) continue;
					const i = (((cy + y) | 0) * s.w + ((cx + x) | 0)) * 4;
					if (i < 0 || i >= s.px.length) continue;
					s.px[i] = s.px[i + 1] = s.px[i + 2] = 0;
					s.px[i + 3] = 250;
				}
			blit(s);
		}
	};
}

/** Foil: a spectrum wash under a printed grid, with a scan bar riding over it. */
export function makeFoil(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const t = s.t * 0.015 * s.v.speed * s.v.dir;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const u = (x / s.w + (y / s.h) * 0.4 + t) % 1;
					const [r, g, b] = hsl(u * 360 + s.v.hue, 88, 62);
					plot(s, x, y, r, g, b, 0.2);
				}
			}
			const [gr, gg, gb] = hsl(0, 0, 100);
			for (let x = 0; x < s.w; x += 6) for (let y = 0; y < s.h; y++) plot(s, x, y, gr, gg, gb, 0.07);
			for (let y = 0; y < s.h; y += 6) for (let x = 0; x < s.w; x++) plot(s, x, y, gr, gg, gb, 0.07);
			const bar = ((s.t * 0.9 * s.v.speed) % (s.w + 40)) - 20;
			for (let x = bar - 6; x < bar + 6; x++)
				for (let y = 0; y < s.h; y++) plot(s, x + (y - s.h / 2) * 0.3, y, 255, 255, 255, (1 - Math.abs(x - bar) / 6) * 0.35);
			blit(s);
		}
	};
}

/** Woven threads crossing over and under, with a sheen travelling along the weave. */
export function makeWeave(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const r = mulberry32(s.v.seed + 6612);
			const pitch = 4 + ((r() * 3) | 0);
			const t = s.t * 0.02 * s.v.speed;
			const [wr, wg, wb] = hsl(s.v.hue, s.v.sat, 48);
			const [hr, hg, hb] = hsl(s.v.hue2, s.v.sat * 0.7, 86);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const over = (((x / pitch) | 0) + ((y / pitch) | 0)) % 2 === 0;
					const along = over ? x / s.w : y / s.h;
					const fold = 0.5 + 0.5 * Math.sin((over ? y : x) * 0.4 + t);
					const sheen = Math.max(0, Math.sin(along * 3.2 - t * 1.6 + s.v.tilt));
					const a = 0.16 + fold * 0.14;
					plot(s, x, y, wr, wg, wb, a);
					if (sheen > 0.82) plot(s, x, y, hr, hg, hb, (sheen - 0.82) * 3.4 * fold);
				}
			}
			for (let sa = 0; sa < 3; sa++) {
				const base = s.h * (0.24 + sa * 0.26);
				for (let x = 0; x < s.w; x++) {
					const y = base + Math.sin(x * 0.06 + t * 1.4 + sa) * s.h * 0.07 + s.v.tilt * 3;
					for (let k = 0; k < 3; k++) plot(s, x, y + k, hr, hg, hb, (0.3 - k * 0.08) * (0.6 + 0.4 * Math.sin(x * 0.1 - t)));
				}
			}
			for (let gi = 0; gi < 7; gi++) {
				const gx = ((gi * 0.37 + t * 0.05) % 1) * s.w;
				const gy2 = ((gi * 0.61 + s.v.drift) % 1) * s.h;
				const sp = Math.max(0, Math.sin(t * 2 + gi));
				plot(s, gx, gy2, 255, 255, 255, sp * 0.8);
				plot(s, gx + 1, gy2, 255, 255, 255, sp * 0.4);
				plot(s, gx, gy2 + 1, 255, 255, 255, sp * 0.4);
			}
			blit(s);
		}
	};
}

function line(s: FxScene, x1: number, y1: number, x2: number, y2: number, w: number, c: number[], a: number) {
	const steps = Math.max(2, Math.hypot(x2 - x1, y2 - y1) | 0);
	for (let k = 0; k <= steps; k++) {
		const f = k / steps;
		const x = x1 + (x2 - x1) * f;
		const y = y1 + (y2 - y1) * f;
		const half = Math.max(0, w / 2);
		for (let o = -half; o <= half; o += 0.6) plot(s, x + o, y, c[0], c[1], c[2], a);
		if (w > 1.4) for (let o = -half; o <= half; o += 0.6) plot(s, x, y + o, c[0], c[1], c[2], a * 0.7);
	}
}

function grow(s: FxScene, x: number, y: number, ang: number, len: number, w: number, depth: number, r: () => number, c: number[], tips: number[][]) {
	if (depth === 0 || len < 1.5) {
		tips.push([x, y]);
		return;
	}
	const sway = Math.sin(s.t * 0.012 * s.v.speed + depth) * 0.05 * (5 - depth);
	const x2 = x + Math.cos(ang + sway) * len;
	const y2 = y + Math.sin(ang + sway) * len;
	line(s, x, y, x2, y2, w, c, 0.95);
	const n = 2 + (r() < 0.28 ? 1 : 0);
	for (let i = 0; i < n; i++) {
		const spread = 0.5 + r() * 0.7;
		grow(s, x2, y2, ang + (i - (n - 1) / 2) * spread + (r() - 0.5) * 0.3, len * (0.6 + r() * 0.22), w * 0.66, depth - 1, r, c, tips);
	}
}

/** A blossoming bough reaching in from a top corner. Shape, side and bloom vary. */
export function withBough(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 2204);
			const side = s.v.dir > 0 ? 0 : 1;
			const bark = hsl(s.v.hue + 190, 18, 24);
			const tips: number[][] = [];
			grow(s, side ? s.w + 2 : -2, -2, side ? Math.PI * 0.78 : Math.PI * 0.22, s.h * (0.32 + r() * 0.12), 2.6, 4, r, bark, tips);
			const petal = hsl(s.v.hue, s.v.sat, 78);
			const core = hsl(s.v.hue, s.v.sat * 0.6, 94);
			for (let i = 0; i < tips.length; i++) {
				const [tx, ty] = tips[i];
				const bloom = 0.55 + 0.45 * Math.sin(s.t * 0.02 + i);
				plot(s, tx, ty, core[0], core[1], core[2], bloom);
				for (const [dx, dy] of [
					[-1, 0],
					[1, 0],
					[0, -1],
					[0, 1]
				])
					plot(s, tx + dx, ty + dy, petal[0], petal[1], petal[2], bloom * 0.75);
			}
			blit(s);
		}
	};
}

/** A rooted stand of trees with litter underfoot. Count, sizes and shapes vary. */
export function withCanopy(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 3307);
			const gy = s.h * 0.84;
			const soil = hsl(s.v.hue + 12, 30, 14);
			const litter = hsl(s.v.hue, s.v.sat, 40);
			for (let x = 0; x < s.w; x++) {
				const lip = gy + Math.sin(x * 0.09 + s.v.tilt) * 1.4;
				for (let y = lip; y < s.h; y++) plot(s, x, y, soil[0], soil[1], soil[2], 0.95);
				plot(s, x, lip, litter[0], litter[1], litter[2], 0.5);
			}
			for (let l = 0; l < 14; l++) {
				const lx = ((l * 0.137 + s.v.drift) % 1) * s.w;
				const ly = gy + 2 + ((l * 0.31) % 1) * (s.h - gy - 2);
				const lc = hsl(s.v.hue + ((l % 4) - 2) * 14, s.v.sat, 44);
				plot(s, lx, ly, lc[0], lc[1], lc[2], 0.8);
				plot(s, lx + 1, ly, lc[0], lc[1], lc[2], 0.6);
			}

			const count = 3 + ((r() * 3) | 0);
			const order: number[][] = [];
			for (let i = 0; i < count; i++) order.push([0.08 + (i / count) * 0.84 + (r() - 0.5) * 0.1, 0.5 + r() * 0.6, r()]);
			order.sort((a, b) => a[1] - b[1]);
			for (const [fx, scale, tone] of order) {
				const depth = scale < 0.75 ? 3 : 4;
				const bark = hsl(s.v.hue + 200, 22, 12 + scale * 12);
				const tips: number[][] = [];
				grow(s, fx * s.w, gy + 1, -Math.PI / 2 + s.v.tilt * 0.18, s.h * 0.3 * scale, 1.4 + scale * 2.4, depth, r, bark, tips);
				let cx = 0;
				let cy = 0;
				for (const t of tips) {
					cx += t[0];
					cy += t[1];
				}
				cx /= tips.length || 1;
				cy /= tips.length || 1;
				const rx = s.w * 0.1 * scale;
				const ry = s.h * 0.15 * scale;
				for (let y = -ry; y <= ry; y++) {
					for (let x = -rx; x <= rx; x++) {
						const d = Math.hypot(x / rx, y / ry);
						if (d > 1) continue;
						if ((((x + cx) | 0) * 7 + ((y + cy) | 0) * 13) % 5 === 0 && d > 0.55) continue;
						const rustle = Math.sin(s.t * 0.03 * s.v.speed + (x + y) * 0.2 + tone * 6) * scale;
						const leaf = hsl(s.v.hue + ((x + y) % 5) * 11 - 22, s.v.sat, (34 + scale * 20) * (1 - d * 0.3));
						plot(s, cx + x + rustle, cy + y, leaf[0], leaf[1], leaf[2], 0.9 - d * 0.25);
					}
				}
			}
			blit(s);
		}
	};
}

/** An ambient bloom low in the frame, breathing. */
export function withGlow(inner: FxProgram, at: number, reach: number, light: number, salt: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + salt);
			const cx = s.w * (0.25 + r() * 0.5);
			const cy = s.h * at;
			const breathe = 0.62 + 0.38 * Math.sin(s.t * 0.02 * s.v.speed);
			const [gr, gg, gb] = hsl(s.v.hue, s.v.sat, light);
			const rx = s.w * reach;
			const ry = s.h * reach * 1.1;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
					if (d > 1) continue;
					plot(s, x, y, gr, gg, gb, (1 - d) * (1 - d) * 0.3 * breathe);
				}
			}
			blit(s);
		}
	};
}

/** A body of water with a rippling surface line. */
export function withWater(inner: FxProgram, level: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			const [wr, wg, wb] = hsl(s.v.hue, s.v.sat, 30);
			const [lr, lg, lb] = hsl(s.v.hue2, s.v.sat * 0.5, 88);
			const t = s.t * 0.04 * s.v.speed;
			for (let x = 0; x < s.w; x++) {
				const y0 = s.h * level + Math.sin(x * 0.22 + t) * 1.6 + Math.sin(x * 0.07 - t * 0.6) * 1.1;
				for (let y = y0; y < s.h; y++) plot(s, x, y, wr, wg, wb, 0.45);
				plot(s, x, y0, lr, lg, lb, 0.75);
			}
			blit(s);
			inner.frame(s);
		}
	};
}

/** A diagonal galaxy band with a dust rift through its middle. */
export function withGalaxyBand(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			const r = mulberry32(s.v.seed + 5521);
			const slope = 0.5 + r() * 0.5;
			const off = 0.1 + r() * 0.3;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.6, 66);
			const [dr, dg, db] = hsl(s.v.hue, s.v.sat, 10);
			const thick = s.h * (0.3 + r() * 0.14);
			for (let x = 0; x < s.w; x++) {
				const centre = s.h * (0.88 - slope * (x / s.w)) + s.h * off * 0.2;
				for (let y = centre - thick; y <= centre + thick; y++) {
					const f = Math.abs(y - centre) / thick;
					plot(s, x, y, br, bg, bb, (1 - f) * (1 - f) * 0.3);
					if (f < 0.16) plot(s, x, y, dr, dg, db, (0.16 - f) * 2.4);
				}
			}
			blit(s);
			inner.frame(s);
		}
	};
}

/** Rings and bits popping outward from seeded points. */
export function withBursts(inner: FxProgram, count: number, period: number, salt: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + salt);
			for (let i = 0; i < count; i++) {
				const bx = (0.1 + r() * 0.8) * s.w;
				const by = (0.12 + r() * 0.66) * s.h;
				const phase = ((s.t + r() * period) % period) / period;
				if (phase > 0.4) continue;
				const f = phase / 0.4;
				const rad = f * s.w * 0.09;
				const [pr, pg, pb] = hsl(s.v.hue + i * 40, s.v.sat, 74);
				for (let k = 0; k < 360; k += 8) {
					const th = (k * Math.PI) / 180;
					plot(s, bx + Math.cos(th) * rad, by + Math.sin(th) * rad, pr, pg, pb, (1 - f) * 0.7);
				}
				for (let b = 0; b < 5; b++) {
					const th = (b / 5) * Math.PI * 2 + i;
					plot(s, bx + Math.cos(th) * rad * 1.5, by + Math.sin(th) * rad * 1.5 + f * f * 6, pr, pg, pb, (1 - f) * 0.9);
				}
			}
			blit(s);
		}
	};
}

/** Embers lifting off a coal bed: steady rise, sideways weave, shrinking as they cool. */
export function makeEmbers(rows: number): FxProgram {
	const place = (sc: FxScene, i: number, fresh: boolean) => {
		const p = sc.parts;
		p[i * 6] = sc.rnd() * sc.w;
		p[i * 6 + 1] = fresh ? sc.h + 2 : sc.rnd() * sc.h;
		p[i * 6 + 2] = 0.3 + sc.rnd() * 0.8;
		p[i * 6 + 3] = sc.rnd() * Math.PI * 2;
		p[i * 6 + 4] = (0.5 + sc.rnd() * 0.9) * sc.v.drift;
		p[i * 6 + 5] = 1.2 + sc.rnd() * 1.6;
	};
	return {
		rows,
		stride: 0.6,
		init(s) {
			const r = mulberry32(s.v.seed + 6607);
			(s as any).wisps = Array.from({ length: 4 }, () => [r(), r() * 6.28, 0.6 + r() * 0.7]);
			for (let i = 0; i < s.n; i++) place(s, i, false);
		},
		frame(s) {
			clear(s);

			const haze = 0.55 + 0.45 * Math.sin(s.t * 0.03 * s.v.speed);
			const [hr, hg, hb] = hsl(s.v.hue, s.v.sat, 46);
			for (let y = s.h * 0.45; y < s.h; y++) {
				const f = (y - s.h * 0.45) / (s.h * 0.55);
				for (let x = 0; x < s.w; x++) plot(s, x, y, hr, hg, hb, f * f * 0.2 * haze);
			}

			const [sr, sg, sb] = hsl(s.v.hue + 190, 12, 34);
			for (const [wx, wph, wsc] of (s as any).wisps as number[][]) {
				for (let k = 0; k < 26; k++) {
					const f = k / 26;
					const y = s.h - f * s.h * 0.85 * wsc;
					const x = wx * s.w + Math.sin(f * 4 + s.t * 0.02 * s.v.speed + wph) * s.w * 0.05 * (1 + f);
					const w = 1 + f * 3.5 * wsc;
					for (let d = -w; d <= w; d++) plot(s, x + d, y, sr, sg, sb, (1 - f) * 0.1 * (1 - Math.abs(d) / (w + 1)));
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * 6;
				const p = s.parts;
				p[o + 3] += 0.045 * p[o + 2];
				p[o + 1] -= p[o + 2] * s.v.speed * 0.85;
				if (p[o + 1] < -3) place(s, i, true);
				const climb = 1 - p[o + 1] / s.h;
				const x = p[o] + Math.sin(p[o + 3]) * p[o + 4] * s.w * 0.09 * s.v.dir;
				const cool = 1 - climb * 0.28;
				const fade = Math.min(1, p[o + 1] / s.h + 0.15) * Math.min(1, (s.h - p[o + 1]) / (s.h * 0.12));
				const rad = p[o + 5] * cool;
				const [r, g, b] = hsl(s.v.hue + climb * 16, s.v.sat, 58 + (1 - climb) * 34);
				for (let dy = -rad; dy <= rad; dy++)
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy) / rad;
						if (d > 1) continue;
						plot(s, x + dx, p[o + 1] + dy, r, g, b, (1 - d) * (1 - d) * fade);
					}
				plot(s, x, p[o + 1], 255, 246, 208, fade * 0.9);
			}
			blit(s);
		}
	};
}

/** Where autumn's crowns sit — the same seeded maths withCanopy draws them from. */
export function canopySource(sc: FxScene): [number, number] {
	const r = mulberry32(sc.v.seed + 3307);
	const gy = sc.h * 0.84;
	const count = 3 + ((r() * 3) | 0);
	const trees: number[][] = [];
	for (let i = 0; i < count; i++) trees.push([0.08 + (i / count) * 0.84 + (r() - 0.5) * 0.1, 0.5 + r() * 0.6]);
	const t = trees[(sc.rnd() * trees.length) | 0];
	const scale = t[1];
	return [t[0] * sc.w + (sc.rnd() - 0.5) * sc.w * 0.18 * scale, gy - sc.h * 0.3 * scale - sc.rnd() * sc.h * 0.12 * scale];
}

/** Where sakura's bough tips reach — mirrors withBough. */
export function boughSource(sc: FxScene): [number, number] {
	const side = sc.v.dir > 0 ? 0 : 1;
	const reach = sc.h * 0.32;
	const f = sc.rnd();
	return [(side ? sc.w + 2 : -2) + (side ? -1 : 1) * f * reach * 2.4, -2 + f * reach * 0.9 + sc.rnd() * 4];
}

/** A CRT beam: the sweep is what lights the phosphor, and it decays behind it. */
export function makeCrt(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).phos = new Float32Array(s.h);
			(s as any).hold = 0;
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const phos = st.phos as Float32Array;
			const beam = ((s.t * (1.1 + s.v.speed * 0.8) * s.v.dir + s.h * 4) | 0) % s.h;
			phos[beam] = 1;
			if (s.rnd() < 0.004) st.hold = 26;
			if (st.hold > 0) st.hold -= 1;
			const slip = st.hold > 0 ? Math.sin(st.hold * 0.5) * s.h * 0.1 : 0;
			const [r, g, b] = hsl(s.v.hue, s.v.sat, 62);
			const [hr, hg, hb] = hsl(s.v.hue, s.v.sat * 0.4, 96);
			for (let y = 0; y < s.h; y++) {
				phos[y] *= 0.82;
				const lit = phos[y];
				if (lit < 0.01) continue;
				const row = (y + slip + s.h) % s.h;
				for (let x = 0; x < s.w; x++) {
					const mask = x % 3 === 0 ? 1 : 0.55;
					plot(s, x, row, r, g, b, lit * 0.5 * mask);
				}
				if (lit > 0.9) for (let x = 0; x < s.w; x++) plot(s, x, row, hr, hg, hb, (lit - 0.9) * 6 * (0.4 + s.v.drift * 0.3));
			}
			for (let y = s.t % 2; y < s.h; y += 2) for (let x = 0; x < s.w; x++) plot(s, x, y, 0, 0, 0, 0);
			blit(s);
		}
	};
}

/** Film: the gate weaves, dust sticks for a few frames, a scratch rides the emulsion. */
export function makeFilm(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			(s as any).dust = [] as number[][];
			(s as any).scratch = -1;
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const weave = Math.round(Math.sin(s.t * 0.31 * s.v.speed) * (1 + s.v.drift));
			const lift = Math.round(Math.sin(s.t * 0.17) * s.v.tilt * 2);
			const [r, g, b] = hsl(s.v.hue, s.v.sat * 0.3, 74);
			const density = 0.28 + s.v.drift * 0.2;
			for (let y = 0; y < s.h; y += 1) {
				for (let x = 0; x < s.w; x += 1) {
					if (s.rnd() > density * 0.3) continue;
					plot(s, x + weave, y + lift, r, g, b, s.rnd() * 0.42);
				}
			}
			if (s.rnd() < 0.06) st.dust.push([s.rnd() * s.w, s.rnd() * s.h, 3 + ((s.rnd() * 9) | 0), 1 + s.rnd() * 2]);
			for (let i = st.dust.length - 1; i >= 0; i--) {
				const d = st.dust[i];
				d[2] -= 1;
				if (d[2] <= 0) {
					st.dust.splice(i, 1);
					continue;
				}
				for (let k = 0; k < d[3]; k++) plot(s, d[0] + weave, d[1] + k + lift, 20, 18, 16, 0.85);
			}
			if (st.scratch < 0 && s.rnd() < 0.01) st.scratch = s.rnd() * s.w;
			if (st.scratch >= 0) {
				st.scratch += (s.rnd() - 0.5) * 0.8;
				for (let y = 0; y < s.h; y++) plot(s, st.scratch + weave + Math.sin(y * 0.3) * 0.6, y, 240, 236, 228, 0.4);
				if (s.rnd() < 0.02) st.scratch = -1;
			}
			blit(s);
		}
	};
}

/** Foil: the scan bar is the light source, and the spectrum is where it falls. */
export function makeFoilLit(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const bar = ((s.t * 0.7 * s.v.speed * s.v.dir + s.w * 4) % (s.w * 1.7)) - s.w * 0.35;
			const slant = 0.35 + s.v.tilt * 0.4;
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const d = (x - bar - (y - s.h / 2) * slant) / (s.w * 0.5);
					const lit = Math.max(0, 1 - Math.abs(d));
					if (lit < 0.02) continue;
					const [r, g, b] = hsl(s.v.hue + d * 300 * (0.6 + s.v.drift * 0.5), 90, 58);
					plot(s, x, y, r, g, b, lit * lit * 0.55);
				}
			}
			const [gr, gg, gb] = hsl(0, 0, 100);
			for (let x = 0; x < s.w; x += 6)
				for (let y = 0; y < s.h; y++) {
					const near = Math.max(0, 1 - Math.abs(x - bar - (y - s.h / 2) * slant) / (s.w * 0.2));
					plot(s, x, y, gr, gg, gb, 0.05 + near * 0.3);
				}
			for (let y = 0; y < s.h; y += 6)
				for (let x = 0; x < s.w; x++) {
					const near = Math.max(0, 1 - Math.abs(x - bar - (y - s.h / 2) * slant) / (s.w * 0.2));
					plot(s, x, y, gr, gg, gb, 0.05 + near * 0.3);
				}
			blit(s);
		}
	};
}

/** Glyph columns: a head that falls, a tail of phosphor decaying behind it, and characters that re-roll while they are still hot. */
export function makeGlyphRain(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + 4703);
			const gw = s.v.tilt > 0.12 ? 4 : 3;
			const gh = gw === 4 ? 6 : 5;
			const cw = gw + 1;
			const ch = gh + 1;
			const cols = Math.max(4, Math.floor(s.w / cw));
			const lines = Math.max(3, Math.floor(s.h / ch));
			const glyphs: { w: number; h: number; bits: Uint8Array }[] = [];
			for (let i = 0; i < 16; i++) {
				const bits = new Uint8Array(gw * gh);
				let on = 0;
				for (let k = 0; k < bits.length; k++) {
					bits[k] = r() < 0.45 ? 1 : 0;
					on += bits[k];
				}
				while (on < 4) {
					const k = (r() * bits.length) | 0;
					if (!bits[k]) {
						bits[k] = 1;
						on += 1;
					}
				}
				glyphs.push({ w: gw, h: gh, bits });
			}
			const SLOTS = 64;
			const slotSpd = new Float32Array(SLOTS);
			const slotLen = new Float32Array(SLOTS);
			const slotLead = new Uint8Array(SLOTS);
			const slotPhase = new Float32Array(SLOTS);
			for (let i = 0; i < SLOTS; i++) {
				slotSpd[i] = 0.05 + r() * 0.12;
				slotLen[i] = 0.14 + r() * 0.86;
				slotLead[i] = r() < 0.18 ? 1 : 0;
				slotPhase[i] = r();
			}
			const period = 150 + ((r() * 200) | 0);

			const head = new Float32Array(cols);
			const spd = new Float32Array(cols);
			const len = new Float32Array(cols);
			const lead = new Uint8Array(cols);
			for (let c = 0; c < cols; c++) {
				const k = c % SLOTS;
				spd[c] = slotSpd[k];
				len[c] = 2 + slotLen[k] * lines * 0.9;
				lead[c] = slotLead[k];
				head[c] = -slotPhase[k] * (lines + len[c]);
			}
			const st = s as any;
			st.slots = SLOTS;
			st.slotSpd = slotSpd;
			st.slotLen = slotLen;
			st.slotLead = slotLead;
			st.glyphs = glyphs;
			st.cols = cols;
			st.lines = lines;
			st.cw = cw;
			st.ch = ch;
			st.head = head;
			st.spd = spd;
			st.len = len;
			st.lead = lead;
			st.mark = new Int16Array(cols).fill(-999);
			st.gi = new Uint8Array(cols * lines);
			st.gb = new Float32Array(cols * lines);
			st.period = period;
			st.cycle = 0;
			st.surge = -1;
			const fill = mulberry32(s.v.seed + 9901);
			for (let k = 0; k < cols * lines; k++) st.gi[k] = (fill() * glyphs.length) | 0;
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const { cols, lines, cw, ch, period } = st;
			const glyphs = st.glyphs as { w: number; h: number; bits: Uint8Array }[];
			const head = st.head as Float32Array;
			const spd = st.spd as Float32Array;
			const len = st.len as Float32Array;
			const lead = st.lead as Uint8Array;
			const mark = st.mark as Int16Array;
			const gi = st.gi as Uint8Array;
			const gb = st.gb as Float32Array;
			const down = s.v.dir > 0;

			if (st.surge < 0 && s.t % period === 0) st.surge = 0;
			if (st.surge >= 0) {
				st.surge += 0.6 + s.v.speed * 0.5;
				if (st.surge > cols + 10) st.surge = -1;
			}
			const wave = st.surge >= 0 ? st.surge : -99;
			const swell = st.surge >= 0 ? Math.max(0, 1 - Math.abs(st.surge - cols * 0.5) / (cols * 0.5)) : 0;
			s.out = swell;

			for (let c = 0; c < cols; c++) {
				const near = wave > -90 ? Math.max(0, 1 - Math.abs(c - wave) / 6) : 0;
				head[c] += spd[c] * s.v.speed * (1 + near * 2.2);
				const cell = Math.floor(head[c]);
				if (cell !== mark[c]) {
					mark[c] = cell;
					if (cell >= 0 && cell < lines) {
						const k = cell * cols + c;
						gi[k] = (s.rnd() * glyphs.length) | 0;
						gb[k] = lead[c] ? 1.35 : 1;
					}
				}
				if (head[c] > lines + len[c]) {
					const k = (c + st.cycle) % st.slots;
					head[c] = -s.rnd() * lines * 0.8 - len[c];
					mark[c] = -999;
					spd[c] = (st.slotSpd as Float32Array)[k];
					len[c] = 2 + (st.slotLen as Float32Array)[k] * lines * 0.9;
					lead[c] = (st.slotLead as Uint8Array)[k];
					st.cycle += 1;
				}
			}

			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat, 46);
			const [hr, hg, hb] = hsl(s.v.hue2, s.v.sat * 0.35, 92);
			const mutate = 0.1 + s.v.drift * 0.16;
			for (let row = 0; row < lines; row++) {
				for (let c = 0; c < cols; c++) {
					const k = row * cols + c;
					let b = gb[k];
					if (b < 0.012) {
						gb[k] = 0;
						continue;
					}
					const fade = 0.995 - 0.11 / Math.max(1, len[c] * 0.35);
					b *= fade;
					gb[k] = b;
					if (b > 0.3 && s.rnd() < mutate * b) gi[k] = (s.rnd() * glyphs.length) | 0;
					const shown = down ? row : lines - 1 - row;
					const px = c * cw + glyphs[0].w / 2;
					const py = shown * ch + glyphs[0].h / 2;
					const hem = edge(py, -1, s.h + 1, s.h * 0.16);
					if (hem <= 0) continue;
					const hot = Math.min(1, Math.max(0, (b - 0.82) * 4));
					const rr = tr + (hr - tr) * hot;
					const gg = tg + (hg - tg) * hot;
					const bb2 = tb + (hb - tb) * hot;
					stamp(s, glyphs[gi[k]], px, py, rr, gg, bb2, Math.min(1, b) * hem * (0.75 + swell * 0.25));
					if (hot > 0.2) {
						const halo = hot * hem * 0.16;
						for (let dy = -2; dy <= 2; dy++)
							for (let dx = -2; dx <= 2; dx++) {
								const d = Math.abs(dx) + Math.abs(dy);
								if (d === 0 || d > 3) continue;
								plot(s, px + dx, py + dy, hr, hg, hb, halo / d);
							}
					}
				}
			}
			blit(s);
		}
	};
}

/** Sunset sky: the sun's altitude reddens it, lights the clouds from underneath, and refraction squashes the disc as it nears the horizon. */
export function makeSunset(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + 7717);
			const st = s as any;
			const clouds: number[][] = [];
			const n = 1 + ((r() * 7) | 0);
			for (let i = 0; i < n; i++) clouds.push([r(), 0.1 + r() * 0.46, 0.12 + r() * 0.3, 0.045 + r() * 0.1, r() * 6.28]);
			st.clouds = clouds;
			st.sunX = 0.18 + r() * 0.64;
			st.phase = r() * 6.28;
			st.sunR = 0.075 + r() * 0.07;
			st.altLo = 0.012 + r() * 0.062;
			st.altSpan = 0.045 + r() * 0.175;
			st.zenith = 184 + r() * 76;
			st.haze = 0.66 + r() * 0.62;
			st.rowR = new Float32Array(s.h);
			st.rowG = new Float32Array(s.h);
			st.rowB = new Float32Array(s.h);
			st.colX = new Float32Array(s.w);
		},
		frame(s) {
			clear(s);
			const st = s as any;
			const hz = Math.round(s.h * (0.52 + s.v.tilt * 0.07));
			const alt = st.altLo + st.altSpan * (0.5 + 0.5 * Math.sin(s.t * 0.0017 * s.v.speed + st.phase));
			const red = 1 - Math.min(1, alt / 0.2);
			const sunX = st.sunX * s.w;
			const sunY = hz - alt * s.h;

			const sat = Math.min(100, s.v.sat * st.haze);
			const sunHue = s.v.hue2 + (s.v.hue - s.v.hue2) * red;
			const [sr, sg, sb] = hsl(sunHue, Math.min(100, sat + red * 14), 74 - red * 18);
			const [zr, zg, zb] = hsl(s.v.hue + st.zenith, sat * 0.5, 17 + (1 - red) * 7);
			const [br, bg, bb] = hsl(sunHue + 6, sat * 0.95, 50);
			const [gr, gg, gb] = hsl(s.v.hue2 + 8, sat * 0.8, 74);
			const low = red;

			const rowR = st.rowR as Float32Array;
			const rowG = st.rowG as Float32Array;
			const rowB = st.rowB as Float32Array;
			const spread = s.h * 0.24;
			for (let y = 0; y < hz; y++) {
				const t = y / Math.max(1, hz - 1);
				const glow = Math.exp(-Math.abs(y - sunY) / spread);
				const m = Math.min(1, t * t * 0.75 + glow * 0.95);
				const k = t * t * t * 0.75;
				const r1 = zr + (br - zr) * m;
				const g1 = zg + (bg - zg) * m;
				const b1 = zb + (bb - zb) * m;
				rowR[y] = r1 + (gr - r1) * k;
				rowG[y] = g1 + (gg - g1) * k;
				rowB[y] = b1 + (gb - b1) * k;
			}
			const colX = st.colX as Float32Array;
			const reach = s.w * 0.44;
			for (let x = 0; x < s.w; x++) colX[x] = 0.62 + 0.38 * Math.exp(-Math.abs(x - sunX) / reach);

			for (let y = 0; y < hz; y++) {
				const a = 0.68 + (y / Math.max(1, hz)) * 0.24;
				for (let x = 0; x < s.w; x++) {
					const k = colX[x];
					paint(s, x, y, rowR[y] * k, rowG[y] * k, rowB[y] * k, a);
				}
			}

			const [dr, dg, db] = hsl(s.v.hue + st.zenith + 20, sat * 0.4, 20);
			const slide = s.t * 0.045 * s.v.drift * s.v.dir;
			for (const [cx, cy, chw, chh, warp] of st.clouds as number[][]) {
				const ox = ((((cx * s.w + slide) % (s.w + 40)) + s.w + 40) % (s.w + 40)) - 20;
				const oy = cy * hz;
				const hw = chw * s.w;
				const hh = chh * s.h;
				for (let dx = -hw; dx <= hw; dx++) {
					const u = dx / hw;
					const body = Math.sqrt(Math.max(0, 1 - u * u));
					const puff = body * (0.62 + 0.38 * Math.sin(u * 5.5 + warp) * Math.sin(u * 2.1 - warp * 0.6));
					const th = hh * puff;
					if (th < 0.5) continue;
					const px = ox + dx;
					const fade = edge(px, -18, s.w + 18, 22);
					if (fade <= 0) continue;
					const lit = Math.exp(-Math.abs(px - sunX) / (s.w * 0.5));
					for (let dy = -th; dy <= th; dy++) {
						const under = (dy + th) / (2 * th);
						const warm = under * under * (0.35 + lit * 0.75) * (0.5 + low * 0.5);
						const d = Math.abs(dy) / (th + 0.5);
						const a = (1 - d * d) * 0.72 * fade;
						paint(s, px, oy + dy, dr + (sr - dr) * warm, dg + (sg - dg) * warm, db + (sb - db) * warm, a);
					}
				}
			}

			const rad = st.sunR * s.h * (0.85 + s.v.drift * 0.22);
			const squash = 1 - low * 0.34;
			for (let g = 7; g >= 1; g--) {
				const gr2 = rad * (1 + g * 0.55);
				for (let dy = -gr2 * squash; dy <= gr2 * squash; dy++)
					for (let dx = -gr2; dx <= gr2; dx++) {
						const d = Math.sqrt(dx * dx + (dy / squash) * (dy / squash));
						if (d > gr2 || d < rad) continue;
						plot(s, sunX + dx, sunY + dy, sr, sg, sb, 0.05 / g);
					}
			}
			const [cr, cg, cb] = hsl(sunHue + 8, sat * 0.55, 96 - red * 10);
			for (let dy = -rad * squash; dy <= rad * squash; dy++)
				for (let dx = -rad; dx <= rad; dx++) {
					const d = Math.sqrt(dx * dx + (dy / squash) * (dy / squash)) / rad;
					if (d > 1) continue;
					const core = 1 - d * d;
					paint(s, sunX + dx, sunY + dy, cr + (sr - cr) * d, cg + (sg - cg) * d, cb + (sb - cb) * d, Math.min(1, 0.55 + core));
				}

			st.sun = [sunX, sunY, alt, sr, sg, sb, hz, low];
			s.out = low;
		}
	};
}
