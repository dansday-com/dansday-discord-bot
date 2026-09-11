import { mulberry32 } from '$lib/effects.js';
import { blit, clear, hsl, plot, type FxProgram, type FxScene } from './engine.js';

/** A seeded ridge silhouette along the bottom — every card gets its own skyline. */
export function ground(s: FxScene, salt: number, height: number, rough: number, light: number) {
	const r = mulberry32(s.v.seed + salt);
	const [gr, gg, gb] = hsl(s.v.hue, s.v.sat * 0.35, light);
	const [er, eg, eb] = hsl(s.v.hue, s.v.sat * 0.5, light + 22);
	const steps = 7 + ((r() * 5) | 0);
	const pts: number[] = [];
	for (let i = 0; i <= steps; i++) pts.push(s.h * (1 - height) + (r() - 0.5) * s.h * rough);
	for (let x = 0; x < s.w; x++) {
		const u = (x / s.w) * steps;
		const i = Math.min(steps - 1, u | 0);
		const f = u - i;
		const y = pts[i] * (1 - f) + pts[i + 1] * f;
		plot(s, x, y, er, eg, eb, 0.85);
		for (let k = y + 1; k < s.h; k++) plot(s, x, k, gr, gg, gb, 0.9);
	}
}

export function withGround(inner: FxProgram, salt: number, height: number, rough: number, light: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			ground(s, salt, height, rough, light);
			blit(s);
		}
	};
}

/** A cone with a glowing vent and lava running down it. Width, lean and vents vary. */
export function withCone(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 7311);
			const cx = s.w * (0.5 + s.v.tilt * 0.14);
			const peak = s.h * (0.3 + r() * 0.14);
			const half = s.w * (0.2 + r() * 0.12);
			const lean = (r() - 0.5) * 0.5;
			const [rr, gg, bb] = hsl(s.v.hue, s.v.sat * 0.35, 14);
			const [lr, lg, lb] = hsl(s.v.hue, s.v.sat, 58);
			for (let y = peak; y < s.h; y++) {
				const f = (y - peak) / (s.h - peak);
				const w = half * f;
				const mid = cx + lean * f * s.w * 0.1;
				for (let x = mid - w; x <= mid + w; x++) plot(s, x, y, rr, gg, bb, 0.92);
				plot(s, mid - w, y, lr * 0.4, lg * 0.4, lb * 0.4, 0.6);
				plot(s, mid + w, y, lr * 0.4, lg * 0.4, lb * 0.4, 0.6);
			}
			const glow = 0.6 + 0.4 * Math.sin(s.t * 0.08 * s.v.speed);
			for (let x = cx - half * 0.16; x <= cx + half * 0.16; x++) for (let y = peak - 1; y < peak + 2; y++) plot(s, x, y, lr, lg, lb, glow);
			for (let run = 0; run < 2; run++) {
				let x = cx + (run ? 1 : -1) * half * 0.1;
				for (let y = peak; y < s.h; y++) {
					x += (mulberry32(s.v.seed + run * 97 + y)() - 0.5) * 1.4;
					const flow = 0.35 + 0.35 * Math.sin(s.t * 0.06 - y * 0.3);
					plot(s, x, y, lr, lg, lb, flow);
				}
			}
			blit(s);
		}
	};
}

/** Event horizon, accretion disc and polar jets. Disc tilt and jet strength vary. */
export function withHorizon(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 5150);
			const cx = s.w * 0.5;
			const cy = s.h * 0.5;
			const rad = s.h * (0.16 + r() * 0.07);
			const tilt = 0.1 + r() * 0.22;
			const [dr, dg, db] = hsl(s.v.hue, s.v.sat, 66);
			const [jr, jg, jb] = hsl(s.v.hue2, s.v.sat, 82);
			for (let k = 0; k < 360; k += 2) {
				const th = (k * Math.PI) / 180;
				const spin = Math.sin(th + s.t * 0.05 * s.v.dir);
				for (let ring = 0; ring < 5; ring++) {
					const rr2 = rad * (1.5 + ring * 0.26);
					plot(s, cx + Math.cos(th) * rr2, cy + Math.sin(th) * rr2 * tilt, dr, dg, db, (0.5 + spin * 0.5) * 0.5);
				}
			}
			const jet = 0.5 + 0.5 * Math.sin(s.t * 0.04);
			for (let y = 0; y < s.h; y++) {
				const d = Math.abs(y - cy) / cy;
				if (d < 0.25) continue;
				plot(s, cx, y, jr, jg, jb, (d - 0.25) * jet * 0.7);
				plot(s, cx + 1, y, jr, jg, jb, (d - 0.25) * jet * 0.3);
			}
			for (let y = -rad; y <= rad; y++)
				for (let x = -rad; x <= rad; x++) {
					if (x * x + y * y > rad * rad) continue;
					const i = (((cy + y) | 0) * s.w + ((cx + x) | 0)) * 4;
					if (i < 0 || i >= s.px.length) continue;
					s.px[i] = s.px[i + 1] = s.px[i + 2] = 0;
					s.px[i + 3] = 255;
				}
			blit(s);
		}
	};
}

/** A leaning funnel reaching down from the cloud deck. Lean and width vary. */
export function withFunnel(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const r = mulberry32(s.v.seed + 3120);
			const top = s.w * (0.35 + r() * 0.3);
			const lean = (r() - 0.5) * s.w * 0.3 + s.v.tilt * s.w * 0.1;
			const wTop = s.w * (0.16 + r() * 0.08);
			const [fr, fg, fb] = hsl(s.v.hue, s.v.sat * 0.45, 52);
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const w = wTop * (1 - f * 0.82);
				const wob = Math.sin(f * 6 + s.t * 0.07 * s.v.speed) * s.w * 0.03 * f;
				const mid = top + lean * f * f + wob;
				for (let x = mid - w; x <= mid + w; x++) {
					const edge = Math.abs(x - mid) / Math.max(0.5, w);
					plot(s, x, y, fr, fg, fb, (0.12 + edge * 0.3) * (0.5 + 0.5 * f));
				}
				const band = Math.sin(f * 22 - s.t * 0.16 * s.v.dir);
				if (band > 0.6) for (let x = mid - w; x <= mid + w; x++) plot(s, x, y, fr, fg, fb, 0.3);
			}
			blit(s);
		}
	};
}

/** One breaking wave with a curl and spray. Crest position and direction vary. */
export function makeBreaker(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init() {},
		frame(s) {
			clear(s);
			const r = mulberry32(s.v.seed + 8080);
			const dir = s.v.dir;
			const crest = s.w * (0.35 + r() * 0.3);
			const t = s.t * 0.02 * s.v.speed;
			const [deep, dg, db] = hsl(s.v.hue, s.v.sat, 22);
			const [mid, mg, mb] = hsl(s.v.hue, s.v.sat, 42);
			const [fr, fg, fb] = hsl(s.v.hue2, s.v.sat * 0.4, 94);
			for (let x = 0; x < s.w; x++) {
				const u = ((x - crest) / s.w) * dir;
				const swell = Math.exp(-u * u * 9);
				const base = s.h * 0.78 - swell * s.h * 0.6 + Math.sin(x * 0.18 + t * 3) * s.h * 0.03;
				for (let y = base; y < s.h; y++) {
					const depth = (y - base) / (s.h - base);
					plot(s, x, y, deep + (mid - deep) * (1 - depth), dg + (mg - dg) * (1 - depth), db + (mb - db) * (1 - depth), 0.9);
				}
				plot(s, x, base, fr, fg, fb, 0.5 + swell * 0.5);
				if (swell > 0.55) {
					const lip = base - swell * s.h * 0.12 * Math.sin(t * 2 + u * 4);
					plot(s, x + dir * 2, lip, fr, fg, fb, 0.8);
					if (r() < 0.08) plot(s, x + dir * 3, lip - r() * 5, fr, fg, fb, 0.6);
				}
			}
			blit(s);
		}
	};
}

/** Impact holes punched through the surface. Count, size and spread vary. */
export function makeHoles(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + 6161);
			const n = 3 + ((r() * 5) | 0);
			const holes: number[][] = [];
			for (let i = 0; i < n; i++) holes.push([r(), r(), 1.6 + r() * 2.6, r() * 240 + 40]);
			(s as any).holes = holes;
		},
		frame(s) {
			clear(s);
			const holes = (s as any).holes as number[][];
			const [wr, wg, wb] = hsl(s.v.hue, s.v.sat * 0.25, 34);
			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.3, 62);
			for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, wr, wg, wb, 0.5);
			for (const [hx, hy, rad, born] of holes) {
				const cx = hx * s.w;
				const cy = hy * s.h;
				const age = (s.t - born) % 360;
				const fresh = age >= 0 && age < 14 ? 1 - age / 14 : 0;
				for (let y = -rad * 2.4; y <= rad * 2.4; y++)
					for (let x = -rad * 2.4; x <= rad * 2.4; x++) {
						const d = Math.sqrt(x * x + y * y);
						if (d > rad * 2.4) continue;
						if (d < rad) {
							const i = (((cy + y) | 0) * s.w + ((cx + x) | 0)) * 4;
							if (i >= 0 && i < s.px.length) {
								s.px[i] = s.px[i + 1] = s.px[i + 2] = 0;
								s.px[i + 3] = 255;
							}
						} else plot(s, cx + x, cy + y, sr, sg, sb, (1 - (d - rad) / (rad * 1.4)) * 0.5);
					}
				for (let k = 0; k < 5; k++) {
					const th = (k / 5) * Math.PI * 2 + hx * 6;
					for (let d = rad; d < rad * 3.4; d++) plot(s, cx + Math.cos(th) * d, cy + Math.sin(th) * d, sr, sg, sb, 0.35 * (1 - d / (rad * 3.4)));
				}
				if (fresh > 0) for (let y = -rad * 4; y <= rad * 4; y++) for (let x = -rad * 4; x <= rad * 4; x++) plot(s, cx + x, cy + y, 255, 240, 200, fresh * 0.12);
			}
			blit(s);
		}
	};
}

/** A neon tube bent into a seeded shape, buzzing in its own pool of light. */
export function makeSign(rows: number): FxProgram {
	return {
		rows,
		stride: 0,
		init(s) {
			const r = mulberry32(s.v.seed + 9090);
			const pts: number[][] = [];
			const n = 3 + ((r() * 3) | 0);
			for (let i = 0; i <= n; i++) pts.push([0.14 + (i / n) * 0.72, 0.28 + r() * 0.44]);
			(s as any).pts = pts;
		},
		frame(s) {
			clear(s);
			const pts = (s as any).pts as number[][];
			const flick = s.rnd() < 0.04 ? 0.25 : 1;
			const buzz = (0.82 + 0.18 * Math.sin(s.t * 0.3)) * flick;
			const [tr, tg, tb] = hsl(s.v.hue, s.v.sat, 62);
			const [cr, cg, cb] = hsl(s.v.hue, s.v.sat * 0.3, 96);
			for (let i = 0; i < pts.length - 1; i++) {
				const [x1, y1] = pts[i];
				const [x2, y2] = pts[i + 1];
				const steps = s.w * 0.4;
				for (let k = 0; k <= steps; k++) {
					const f = k / steps;
					const x = (x1 + (x2 - x1) * f) * s.w;
					const y = (y1 + (y2 - y1) * f) * s.h;
					for (let g = 6; g >= 1; g--) {
						const a = (0.1 / g) * buzz;
						for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) plot(s, x + dx, y + dy, tr, tg, tb, a * 0.25);
					}
					plot(s, x, y, cr, cg, cb, buzz);
					plot(s, x, y + 1, cr, cg, cb, buzz * 0.6);
				}
			}
			blit(s);
		}
	};
}
