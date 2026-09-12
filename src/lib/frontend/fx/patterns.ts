import { mulberry32 } from '$lib/effects.js';
import { blit, clear, hsl, plot, type FxProgram, type FxScene } from './engine.js';

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
					plot(s, cx + Math.cos(a) * rr * s.w * 0.5, cy + Math.sin(a) * rr * s.h * 0.5, lr, lg, lb, (1 - k / 7) * 0.6);
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

/** A trunk and crown rooted on the ground. Height, lean and canopy vary. */
export function withCanopy(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 3307);
			const baseX = s.w * (0.16 + r() * 0.68);
			const bark = hsl(s.v.hue + 200, 22, 20);
			const tips: number[][] = [];
			grow(s, baseX, s.h * 0.92, -Math.PI / 2 + s.v.tilt * 0.2, s.h * (0.26 + r() * 0.1), 3.2, 4, r, bark, tips);
			for (let i = 0; i < tips.length; i++) {
				const [tx, ty] = tips[i];
				const leaf = hsl(s.v.hue + (i % 5) * 12 - 12, s.v.sat, 46 + (i % 3) * 10);
				const rustle = Math.sin(s.t * 0.03 + i * 0.7) * 0.8;
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++) {
						if (dx * dx + dy * dy > 5) continue;
						plot(s, tx + dx + rustle, ty + dy, leaf[0], leaf[1], leaf[2], 0.72);
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
