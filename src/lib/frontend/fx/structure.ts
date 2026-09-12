import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

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

export function withGround(inner: FxProgram, salt: number, height: number, rough: number, light: number, catchLight = false): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const lit: number[][] = [];
			if (catchLight) {
				const r = mulberry32(s.v.seed + salt);
				const steps = 7 + ((r() * 5) | 0);
				const pts: number[] = [];
				for (let i = 0; i <= steps; i++) pts.push(s.h * (1 - height) + (r() - 0.5) * s.h * rough);
				for (let x = 0; x < s.w; x++) {
					const u = (x / s.w) * steps;
					const i = Math.min(steps - 1, u | 0);
					const crest = pts[i] * (1 - (u - i)) + pts[i + 1] * (u - i);
					let mr = 0;
					let mg = 0;
					let mb = 0;
					for (let y = Math.max(0, crest - s.h * 0.45); y < crest; y++) {
						const q = ((y | 0) * s.w + x) * 4;
						if (s.px[q] > mr) mr = s.px[q];
						if (s.px[q + 1] > mg) mg = s.px[q + 1];
						if (s.px[q + 2] > mb) mb = s.px[q + 2];
					}
					lit.push([x, crest, mr, mg, mb]);
				}
			}
			ground(s, salt, height, rough, light);
			for (const [x, crest, mr, mg, mb] of lit) for (let k = 0; k < 4; k++) plot(s, x, crest + k, mr, mg, mb, (0.55 - k * 0.13) * 0.55);
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
			const pool = 0.6 + 0.4 * Math.sin(s.t * 0.05 * s.v.speed);
			for (let x = cx - half * 1.15; x <= cx + half * 1.15; x++) {
				const f = 1 - Math.abs(x - cx) / (half * 1.15);
				for (let y = s.h - 3 * f; y < s.h; y++) plot(s, x, y, lr, lg, lb, f * pool * 0.7);
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

/** The funnel's axis and half-width at height fraction f (0 = cloud base, 1 = ground). */
export function funnelAxis(s: FxScene, f: number): [number, number] {
	const r = mulberry32(s.v.seed + 3120);
	const top = s.w * (0.35 + r() * 0.3);
	const lean = (r() - 0.5) * s.w * 0.3 + s.v.tilt * s.w * 0.1;
	const wTop = s.w * (0.16 + r() * 0.08);
	const wob = Math.sin(f * 6 + s.t * 0.07 * s.v.speed) * s.w * 0.03 * f;
	return [top + lean * f * f + wob, wTop * (1 - f * 0.82)];
}

/** A leaning funnel reaching down from the cloud deck. Lean and width vary. */
export function withFunnel(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const [fr, fg, fb] = hsl(s.v.hue, s.v.sat * 0.45, 52);
			for (let y = 0; y < s.h; y++) {
				const f = y / s.h;
				const [mid, w] = funnelAxis(s, f);
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
			for (let fl = 0; fl < 5; fl++) {
				const ph = ((s.t * 0.4 * s.v.speed + fl * 40) % 200) / 200;
				const fx2 = ph * s.w * 1.2 * dir + (dir < 0 ? s.w : 0);
				const u2 = ((fx2 - crest) / s.w) * dir;
				const fy2 = s.h * 0.78 - Math.exp(-u2 * u2 * 9) * s.h * 0.6;
				for (let k = 0; k < 3; k++) plot(s, fx2 + k, fy2 - 1, 40, 28, 20, 0.85);
			}
			for (let x = 0; x < s.w; x++) {
				const foam = 0.35 + 0.35 * Math.sin(x * 0.5 + t * 4);
				for (let k = 0; k < 2; k++) plot(s, x, s.h - 1 - k, fr, fg, fb, foam * 0.5);
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
			const spread = 0.3 + s.v.drift * 0.5;
			const mid = 0.5 + s.v.tilt * 0.3;
			for (let i = 0; i < n; i++) holes.push([mid + (r() - 0.5) * spread * 1.6, r(), 1.6 + r() * 2.6 * (0.7 + s.v.drift * 0.5), r() * 240 + 40]);
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
				const age = (s.t * s.v.speed - born) % Math.round(360 / Math.max(0.5, s.v.speed));
				const fresh = age >= 0 && age < 14 ? 1 - age / 14 : 0;
				if (age < 0) continue;
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
					const th = (k / 5) * Math.PI * 2 + hx * 6 * s.v.dir;
					for (let d = rad; d < rad * 3.4; d++) plot(s, cx + Math.cos(th) * d, cy + Math.sin(th) * d, sr, sg, sb, 0.35 * (1 - d / (rad * 3.4)));
				}
				if (fresh > 0) for (let y = -rad * 4; y <= rad * 4; y++) for (let x = -rad * 4; x <= rad * 4; x++) plot(s, cx + x, cy + y, 255, 240, 200, fresh * 0.12);
			}
			const mz = (s.t * s.v.speed) % 90;
			if (mz < 5) {
				const [fr2, fg2, fb2] = hsl(s.v.hue, 40, 96);
				for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) plot(s, x, y, fr2, fg2, fb2, (1 - mz / 5) * 0.22);
			}
			for (let c = 0; c < 3; c++) {
				const ph = ((s.t * s.v.speed + c * 30) % 90) / 90;
				const cx2 = s.w * (0.2 + c * 0.3 + s.v.tilt * 0.1) + ph * s.w * 0.3 * s.v.dir;
				const cy2 = s.h * 0.3 + ph * ph * s.h * 0.9;
				if (cy2 > s.h) continue;
				const [gr2, gg2, gb2] = hsl(45, 60, 62);
				plot(s, cx2, cy2, gr2, gg2, gb2, 0.9);
				plot(s, cx2 + 1, cy2, gr2, gg2, gb2, 0.7);
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
			const lean = s.v.tilt * 0.12;
			for (let i = 0; i <= n; i++) pts.push([0.14 + (i / n) * 0.72, 0.28 + r() * (0.28 + s.v.drift * 0.3) + lean * (i / n)]);
			(s as any).pts = pts;
		},
		frame(s) {
			clear(s);
			const [kr, kg, kb] = hsl(s.v.hue + 20, 16, 16);
			for (let y = 0; y < s.h; y++)
				for (let x = 0; x < s.w; x++) {
					const row = (y / 5) | 0;
					const brick = ((x + (row % 2) * 6) / 12) | 0;
					const edge = (x + (row % 2) * 6) % 12 < 1 || y % 5 === 0;
					plot(s, x, y, kr, kg, kb, edge ? 0.25 : 0.5 + ((brick * 7) % 3) * 0.04);
				}
			const pts = (s as any).pts as number[][];
			const flick = s.rnd() < 0.02 + s.v.drift * 0.04 ? 0.25 : 1;
			const buzz = (0.82 + 0.18 * Math.sin(s.t * 0.3 * s.v.speed * s.v.dir)) * flick;
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

/** Ground impacts — shock rings, ejecta and a lingering scorch. Sites vary per card. */
export function withImpacts(inner: FxProgram, period: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init(s) {
			inner.init(s);
			const r = mulberry32(s.v.seed + 4711);
			const sites: number[][] = [];
			const n = 2 + ((r() * 3) | 0);
			for (let i = 0; i < n; i++) sites.push([0.12 + r() * 0.76, r() * period, 0.7 + r() * 0.6]);
			(s as any).sites = sites;
		},
		frame(s) {
			inner.frame(s);
			const sites = (s as any).sites as number[][];
			const groundY = s.h * 0.86;
			for (const [fx, offset, scale] of sites) {
				const age = (s.t - offset + period * 4) % period;
				if (age > 34) continue;
				const cx = fx * s.w;
				const f = age / 34;
				const [hr, hg, hb] = hsl(s.v.hue, s.v.sat, 90 - f * 30);
				const rad = f * s.w * 0.2 * scale;
				for (let k = 0; k < 180; k += 3) {
					const th = (k * Math.PI) / 180 + Math.PI;
					plot(s, cx + Math.cos(th) * rad, groundY + Math.sin(th) * rad * 0.32, hr, hg, hb, (1 - f) * 0.75);
				}
				if (age < 12) {
					const flash = 1 - age / 12;
					for (let y = groundY - 6 * scale; y < groundY + 3; y++) for (let x = cx - 8 * scale; x < cx + 8 * scale; x++) plot(s, x, y, hr, hg, hb, flash * 0.3);
				}
				for (let e = 0; e < 7; e++) {
					const th = Math.PI + (e / 6) * Math.PI;
					const d = f * s.h * 0.5 * scale;
					plot(s, cx + Math.cos(th) * d * 1.4, groundY + Math.sin(th) * d + f * f * s.h * 0.3, hr, hg, hb, (1 - f) * 0.9);
				}
				const glow = Math.max(0, 1 - ((s.t - offset + period * 4) % period) / period);
				for (let x = cx - 5 * scale; x < cx + 5 * scale; x++) plot(s, x, groundY, hr, hg * 0.5, hb * 0.3, glow * 0.5);
			}
			blit(s);
		}
	};
}

/** A quiet night: seeded constellation, a rising moon, and the rare wish streak. */
export function makeWishNight(rows: number): FxProgram {
	return {
		rows,
		stride: 0.5,
		init(s) {
			const r = mulberry32(s.v.seed + 8123);
			const link: number[][] = [];
			const n = 4 + ((r() * 3) | 0);
			for (let i = 0; i < n; i++) link.push([0.1 + r() * 0.8, 0.06 + r() * 0.56, 0.55 + r() * 0.45, r() * 6.28]);
			(s as any).link = link;
			const PHASES = [0.02, 0.16, 0.5, 0.82, 1, 0.82, 0.5, 0.16];
			const TINTS = [
				[38, 12, 94],
				[214, 44, 88],
				[6, 62, 62],
				[338, 46, 86],
				[28, 58, 80]
			];
			const pick = (r() * PHASES.length) | 0;
			const tint = TINTS[(r() * TINTS.length) | 0];
			const maria: number[][] = [];
			for (let k = 0; k < 5; k++) maria.push([(r() - 0.5) * 1.3, (r() - 0.5) * 1.3, 0.14 + r() * 0.2]);
			(s as any).moon = {
				x: 0.1 + r() * 0.24,
				y: 0.2 + r() * 0.18,
				lit: PHASES[pick],
				waxing: pick < 4,
				size: 0.09 + r() * 0.1,
				tint,
				maria
			};
			(s as any).wish = [r() * 300, r(), r()];
			const field = mulberry32(s.v.seed + 4409);
			const stars: number[][] = [];
			for (let i = 0; i < s.n; i++) stars.push([field(), field() * 0.8, 0.3 + field() * 0.7, field() * 6.28]);
			(s as any).stars = stars;
		},
		frame(s) {
			clear(s);
			const stars = (s as any).stars as number[][];
			const link = (s as any).link as number[][];
			const moon = (s as any).moon as { x: number; y: number; lit: number; waxing: boolean; size: number; tint: number[]; maria: number[][] };
			const [wOff, wx, wy] = (s as any).wish as number[];

			const rise = Math.min(1, s.t / 300);
			const cx = moon.x * s.w;
			const cy = (moon.y + (1 - rise) * 0.3) * s.h;
			const rad = s.h * moon.size * (0.85 + s.v.drift * 0.3);
			const [mr, mg, mb] = hsl(moon.tint[0], moon.tint[1], moon.tint[2]);
			for (let g = 9; g >= 1; g--)
				for (let y = -rad - g * 2; y <= rad + g * 2; y++)
					for (let x = -rad - g * 2; x <= rad + g * 2; x++) {
						const d = Math.sqrt(x * x + y * y);
						if (d > rad + g * 2 || d < rad) continue;
						plot(s, cx + x, cy + y, mr, mg, mb, 0.035 / g);
					}
			for (let y = -rad; y <= rad; y++) {
				const halfW = Math.sqrt(Math.max(0, rad * rad - y * y));
				for (let x = -halfW; x <= halfW; x++) {
					const term = (1 - 2 * moon.lit) * halfW;
					const lit = moon.waxing ? x > term : x < -term;
					let a = lit ? 1 : 0.09;
					if (lit) for (const [mxp, myp, mrad] of moon.maria) if (Math.hypot(x / rad - mxp, y / rad - myp) < mrad) a *= 0.74;
					plot(s, cx + x, cy + y, mr, mg, mb, a);
				}
			}

			const [sr, sg, sb] = hsl(s.v.hue2, s.v.sat * 0.5, 88);
			for (let i = 0; i < link.length - 1; i++) {
				const a = link[i];
				const b = link[i + 1];
				for (let k = 0; k <= 30; k++) {
					const f = k / 30;
					plot(s, (a[0] + (b[0] - a[0]) * f) * s.w, (a[1] + (b[1] - a[1]) * f) * s.h, sr, sg, sb, 0.12);
				}
			}
			for (const node of link) {
				const tw = 0.5 + 0.5 * Math.sin(s.t * 0.02 * node[2] + node[3]);
				const nx = node[0] * s.w;
				const ny = node[1] * s.h;
				plot(s, nx, ny, sr, sg, sb, tw * node[2]);
				for (let d = 1; d <= 2; d++) {
					const spill = (tw * node[2] * 0.45) / d;
					plot(s, nx - d, ny, sr, sg, sb, spill);
					plot(s, nx + d, ny, sr, sg, sb, spill);
					plot(s, nx, ny - d, sr, sg, sb, spill);
					plot(s, nx, ny + d, sr, sg, sb, spill);
				}
			}
			for (const st of stars) {
				st[3] += 0.02 * st[2];
				const tw = 0.4 + 0.6 * Math.sin(st[3]);
				plot(s, st[0] * s.w, st[1] * s.h, sr, sg, sb, tw * st[2]);
			}

			const spill = rise * moon.lit;
			for (let x = 0; x < s.w; x++) {
				const reach = Math.max(0, 1 - Math.abs(x - cx) / (s.w * 0.45));
				if (reach <= 0.01) continue;
				for (let y = s.h * 0.7; y < s.h; y++) plot(s, x, y, mr, mg, mb, reach * reach * spill * 0.2);
			}
			const age = (s.t * s.v.speed - wOff + 900) % Math.round(300 / Math.max(0.5, s.v.speed));
			if (age < 26) {
				const f = age / 26;
				const x0 = wx * s.w * 0.7 + s.w * 0.15;
				const y0 = wy * s.h * 0.3;
				const [wr, wg, wb] = hsl(s.v.hue, s.v.sat * 0.3, 98);
				for (let k = 0; k < 14; k++) {
					const t = k / 14;
					const p = f - t * 0.12;
					if (p < 0) continue;
					plot(s, x0 + p * s.w * 0.6 * s.v.dir, y0 + p * s.h * (0.35 + s.v.tilt * 0.3), wr, wg, wb, (1 - t) * (1 - f) * 0.95);
				}
			}
			blit(s);
		}
	};
}

/** Meteors that actually land: each streak stops at the ground and throws its own impact. */
export function makeStrike(rows: number, stride: number, steep: number, len: number, groundFrac: number): FxProgram {
	const spawn = (sc: FxScene, i: number) => {
		const p = sc.parts;
		p[i * 6] = sc.rnd() * sc.w * 1.5 - sc.w * 0.25;
		p[i * 6 + 1] = -sc.rnd() * sc.h * 1.4 - 4;
		p[i * 6 + 2] = 0.55 + sc.rnd() * 1.1;
		p[i * 6 + 3] = 0.55 + sc.rnd() * 0.45;
		p[i * 6 + 4] = 1.4 + sc.rnd() * 2.2;
		p[i * 6 + 5] = (sc.rnd() * 4096) | 0;
	};
	return {
		rows,
		stride,
		init(s) {
			for (let i = 0; i < s.n; i++) {
				spawn(s, i);
				s.parts[i * 6 + 1] = s.rnd() * s.h * groundFrac;
			}
			(s as any).hits = [] as number[][];
		},
		frame(s) {
			clear(s);
			const gy = s.h * groundFrac;
			const dx = steep * s.v.dir;
			const hits = (s as any).hits as number[][];
			const [r, g, b] = hsl(s.v.hue, s.v.sat, 88);

			for (let i = 0; i < s.n; i++) {
				const o = i * 6;
				const p = s.parts;
				p[o] += dx * p[o + 2] * s.v.speed;
				p[o + 1] += p[o + 2] * s.v.speed * 1.7;
				if (p[o + 1] >= gy) {
					hits.push([p[o], 0, 0.4 + p[o + 4] * 0.28]);
					if (hits.length > 6) hits.shift();
					spawn(s, i);
					continue;
				}
				const fade = edge(p[o + 1], -4, gy + 1, s.h * 0.18);
				for (let k = 0; k < len; k++) {
					const t = k / len;
					plot(s, p[o] - dx * k * 1.4, p[o + 1] - k * 1.7, r, g, b, p[o + 3] * (1 - t) * fade);
				}
				const rad = p[o + 4];
				const key = p[o + 5];
				const spin = s.t * 0.22 * p[o + 2];
				for (let dy = -rad; dy <= rad; dy++) {
					for (let dx = -rad; dx <= rad; dx++) {
						const d = Math.hypot(dx, dy) / rad;
						if (d > 1) continue;
						const bite = ((((dx + 8) * 73 + (dy + 8) * 151 + key) * 2654435761) >>> 0) % 100;
						if (d > 0.55 && bite < 34) continue;
						const face = (dx * Math.cos(spin) + dy * Math.sin(spin)) / rad;
						const heat = Math.max(0, face) * 0.7 + 0.3;
						const [rr2, rg2, rb2] = hsl(s.v.hue + (1 - heat) * 24, s.v.sat, 34 + heat * 58);
						plot(s, p[o] + dx, p[o + 1] + dy, rr2, rg2, rb2, fade * (0.75 + heat * 0.25));
					}
				}
				plot(s, p[o] + Math.cos(spin) * rad, p[o + 1] + Math.sin(spin) * rad, 255, 250, 224, fade);
			}

			for (let h = hits.length - 1; h >= 0; h--) {
				const hit = hits[h];
				hit[1] += 1;
				const age = hit[1];
				if (age > 46) {
					hits.splice(h, 1);
					continue;
				}
				const cx = hit[0];
				const sc2 = hit[2];
				const f = age / 46;
				const [hr, hg, hb] = hsl(s.v.hue, s.v.sat, 92 - f * 34);
				if (age < 10) {
					const flash = 1 - age / 10;
					for (let y = gy - 8 * sc2; y < gy + 3; y++) for (let x = cx - 11 * sc2; x < cx + 11 * sc2; x++) plot(s, x, y, hr, hg, hb, flash * 0.32);
				}
				const rad = f * s.w * 0.22 * sc2;
				for (let k = 0; k < 180; k += 3) {
					const th = (k * Math.PI) / 180 + Math.PI;
					plot(s, cx + Math.cos(th) * rad, gy + Math.sin(th) * rad * 0.3, hr, hg, hb, (1 - f) * 0.8);
				}
				for (let e = 0; e < 9; e++) {
					const th = Math.PI + (e / 8) * Math.PI;
					const d = f * s.h * 0.6 * sc2;
					plot(s, cx + Math.cos(th) * d * 1.5, gy + Math.sin(th) * d + f * f * s.h * 0.45, hr, hg, hb, (1 - f) * 0.95);
				}
				for (let x = cx - 6 * sc2; x < cx + 6 * sc2; x++) plot(s, x, gy, hr, hg * 0.45, hb * 0.25, (1 - f) * 0.6);
			}
			blit(s);
		}
	};
}

/** A dim screen the effect is displayed on: a dark panel behind, a vignette, and a shadow mask over every other line. */
export function withScreen(inner: FxProgram, dark: number, cover: number, vignette: number, scan: number): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init: inner.init,
		frame(s) {
			inner.frame(s);
			const px = s.px;
			const [br, bg, bb] = hsl(s.v.hue, s.v.sat * 0.45, dark);
			const cx = s.w / 2;
			const cy = s.h / 2;
			const rad = Math.sqrt(cx * cx + cy * cy);
			for (let y = 0; y < s.h; y++) {
				for (let x = 0; x < s.w; x++) {
					const i = (y * s.w + x) * 4;
					const lit = px[i + 3] / 255;
					const dx = (x - cx) / rad;
					const dy = (y - cy) / rad;
					const k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * vignette) * cover * (1 - lit);
					if (k <= 0) continue;
					px[i] = Math.min(255, px[i] + br * k);
					px[i + 1] = Math.min(255, px[i + 1] + bg * k);
					px[i + 2] = Math.min(255, px[i + 2] + bb * k);
					px[i + 3] = Math.min(255, px[i + 3] + 255 * k);
				}
			}
			if (scan > 0) {
				const keep = 1 - scan;
				for (let y = 1; y < s.h; y += 2) {
					for (let x = 0; x < s.w; x++) {
						const i = (y * s.w + x) * 4;
						px[i] *= keep;
						px[i + 1] *= keep;
						px[i + 2] *= keep;
					}
				}
			}
			blit(s);
		}
	};
}

function glint(x: number, y: number, t: number) {
	let h = (x * 73856093) ^ (y * 19349663) ^ (t * 83492791);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The shore the sunset falls on: the sun lays a glitter path down the water, swell breaks at the sand, and the foam it leaves keeps the sand wet enough to mirror the sky until it dries. */
export function withShore(inner: FxProgram): FxProgram {
	return {
		rows: inner.rows,
		stride: inner.stride,
		init(s) {
			inner.init(s);
			const r = mulberry32(s.v.seed + 3313);
			const st = s as any;
			st.shore = 0.77 + r() * 0.06;
			st.lip = r() * 6.28;
			const crests: number[][] = [];
			const n = 3 + ((r() * 3) | 0);
			for (let i = 0; i < n; i++) crests.push([r(), 0.45 + r() * 0.55, r() * 6.28]);
			st.crests = crests;
			st.runs = [] as number[][];
			st.wet = new Float32Array(s.w);
			st.mirror = new Float32Array(s.w);
		},
		frame(s) {
			inner.frame(s);
			const st = s as any;
			const sun = st.sun as number[];
			if (!sun) {
				blit(s);
				return;
			}
			const [sunX, , alt, sr, sg, sb, hz, low] = sun;
			const shoreY = Math.round(s.h * st.shore);
			const deep = Math.max(1, shoreY - hz);
			const wet = st.wet as Float32Array;
			const crests = st.crests as number[][];
			const runs = st.runs as number[][];

			const [fr, fg, fb] = hsl(s.v.hue + 198, s.v.sat * 0.5, 20);
			const [nr, ng, nb] = hsl(s.v.hue + 206, s.v.sat * 0.42, 34);
			const mirror = st.mirror as Float32Array;
			for (let x = 0; x < s.w; x++) mirror[x] = 0.22 + 0.78 * Math.exp(-Math.abs(x - sunX) / (s.w * 0.42));
			for (let y = hz; y < shoreY; y++) {
				const t = (y - hz) / deep;
				const sky = Math.exp(-t * 3.2) * (0.3 + low * 0.3);
				const rr = fr + (nr - fr) * t;
				const gg = fg + (ng - fg) * t;
				const bb = fb + (nb - fb) * t;
				for (let x = 0; x < s.w; x++) {
					const k = sky * mirror[x];
					paint(s, x, y, rr + (sr - rr) * k, gg + (sg - gg) * k, bb + (sb - bb) * k, 1);
				}
			}

			for (let x = 0; x < s.w; x++) {
				const near = Math.exp(-Math.abs(x - sunX) / (s.w * 0.22));
				if (near < 0.02) continue;
				plot(s, x, hz, sr, sg, sb, near * 0.34 * (0.4 + low * 0.6));
			}

			if (alt > 0.02) {
				const tick = (s.t * 0.22 * s.v.speed) | 0;
				for (let y = hz; y < shoreY; y++) {
					const t = (y - hz) / deep;
					const half = s.w * (0.014 + t * t * 0.2);
					const lo = Math.max(0, Math.round(sunX - half));
					const hi = Math.min(s.w - 1, Math.round(sunX + half));
					const scint = 0.34 + t * 0.4;
					for (let x = lo; x <= hi; x++) {
						const u = (x - sunX) / half;
						const across = 1 - u * u;
						if (across <= 0) continue;
						const g = glint(x, y * 3 + tick, tick >> 2);
						if (g < 1 - scint) continue;
						const f = (g - (1 - scint)) / scint;
						plot(s, x, y, sr, sg, sb, across * f * f * (0.5 + low * 0.5));
					}
				}
			}

			const [wr, wg, wb] = hsl(s.v.hue2 + 4, s.v.sat * 0.3, 92);
			const rate = 0.0042 * s.v.speed;
			for (const c of crests) {
				c[0] += rate * (0.7 + c[1] * 0.6);
				if (c[0] >= 1) {
					c[0] = 0;
					c[1] = 0.45 + s.rnd() * 0.55;
					runs.push([0, c[1] * 0.62, 52 + s.rnd() * 26]);
					if (runs.length > 4) runs.shift();
				}
				const p = c[0];
				if (p < 0.22) continue;
				const y = hz + deep * Math.pow(p, 1.9);
				const thick = 0.4 + p * p * 2.2;
				const a = edge(p, 0.18, 1.02, 0.2) * (0.22 + p * 0.5) * c[1];
				for (let x = 0; x < s.w; x++) {
					const wob = Math.sin(x * 0.13 + c[2]) * 0.5 + Math.sin(x * 0.041 - c[2] * 1.7) * 0.5;
					const gap = Math.sin(x * 0.055 + c[2] * 2.3) * 0.5 + Math.sin(x * 0.017 - c[2]) * 0.5;
					const bite = Math.max(0, gap * 0.7 + 0.45);
					if (bite <= 0.02) continue;
					const yy = y + wob * thick * 0.8;
					for (let k = 0; k < thick; k++) paint(s, x, yy + k, wr, wg, wb, a * bite * (1 - k / thick) * 0.7);
				}
			}

			const sand = Math.max(1, s.h - shoreY);
			const lipOf = (x: number) => Math.sin(x * 0.062 + st.lip) * 0.6 + Math.sin(x * 0.019 - st.lip * 1.4) * 0.4;
			for (let x = 0; x < s.w; x++) wet[x] *= 0.991;
			const front = new Float32Array(s.w);
			const wash = new Float32Array(s.w);
			for (let k = runs.length - 1; k >= 0; k--) {
				const run = runs[k];
				run[0] += 1;
				if (run[0] > run[2]) {
					runs.splice(k, 1);
					continue;
				}
				const f = Math.sin((run[0] / run[2]) * Math.PI);
				for (let x = 0; x < s.w; x++) {
					const wob = 0.78 + 0.22 * Math.sin(x * 0.075 + st.lip) * Math.sin(x * 0.028 - st.lip * 1.3);
					const up = f * run[1] * wob;
					if (up > wet[x]) wet[x] = up;
					if (up > front[x]) {
						front[x] = up;
						wash[x] = 1 - f * 0.4;
					}
				}
			}

			const [dryR, dryG, dryB] = hsl(s.v.hue2 - 6, s.v.sat * 0.45, 46);
			const [darkR, darkG, darkB] = hsl(s.v.hue2 - 10, s.v.sat * 0.5, 28);
			for (let x = 0; x < s.w; x++) {
				const soak = wet[x];
				const edgeY = shoreY + lipOf(x) * sand * 0.16;
				for (let y = Math.round(edgeY); y < s.h; y++) {
					const t = (y - edgeY) / sand;
					const grain = 1 + (glint(x, y, 0) * 0.12 - 0.06);
					let rr = dryR + (darkR - dryR) * t * 0.5;
					let gg = dryG + (darkG - dryG) * t * 0.5;
					let bb = dryB + (darkB - dryB) * t * 0.5;
					if (t < soak) {
						const sheen = (1 - t / soak) * soak * 0.62;
						rr = rr * (1 - sheen) + sr * 0.62 * sheen;
						gg = gg * (1 - sheen) + sg * 0.62 * sheen;
						bb = bb * (1 - sheen) + sb * 0.68 * sheen;
					}
					paint(s, x, y, rr * grain, gg * grain, bb * grain, 1);
				}
			}

			for (let x = 0; x < s.w; x++) {
				if (front[x] <= 0.004) continue;
				const fy = shoreY + lipOf(x) * sand * 0.16 + front[x] * sand;
				for (let d = 0; d < 3; d++) paint(s, x, fy - d, wr, wg, wb, (1 - d / 3) * wash[x] * 0.9);
			}
			blit(s);
		}
	};
}
