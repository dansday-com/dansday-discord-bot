import { mulberry32 } from '$lib/effects.js';
import { blit, clear, edge, backdrop, hsl, paint, plot, type FxProgram, type FxScene } from './engine.js';

const P = 6;

type Net = { nodes: number[][]; traces: number[][]; rate: number; pads: number[][] };

function circuitIdent(s: FxScene): Net {
	const r = mulberry32(s.v.seed + 4570);
	const nodes: number[][] = [];
	const cols = 6;
	const rowsN = 4;
	for (let gy = 0; gy < rowsN; gy++) {
		for (let gx = 0; gx < cols; gx++) {
			nodes.push([(gx + 0.28 + r() * 0.44) / cols, (gy + 0.28 + r() * 0.44) / rowsN, r()]);
		}
	}
	const traces: number[][] = [];
	for (let i = 0; i < nodes.length; i++) {
		const gx = i % cols;
		const gy = (i / cols) | 0;
		if (gx < cols - 1 && r() < 0.78) traces.push([i, i + 1, r() < 0.5 ? 0 : 1]);
		if (gy < rowsN - 1 && r() < 0.62) traces.push([i, i + cols, r() < 0.5 ? 0 : 1]);
	}
	const rate = 0.006 + r() * 0.012;
	const pads: number[][] = [];
	for (let i = 0; i < 5; i++) pads.push([r(), r(), 0.4 + r() * 0.6]);
	return { nodes, traces, rate, pads };
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
		},
		frame(s) {
			clear(s);
			const id = (s as any).id as Net;
			const pulses = (s as any).pulses as number[];
			const [sub, subg, subb] = hsl(s.v.hue, s.v.sat * 0.55, 9);
			const [cu, cug, cub] = hsl(s.v.hue, s.v.sat * 0.4, 30);
			const [lit, litg, litb] = hsl(s.v.hue2, s.v.sat, 72);

			backdrop(s, sub, subg, subb, 0.82, 0.3);

			for (const [px, py, pr] of id.pads) {
				const x0 = px * s.w;
				const y0 = py * s.h;
				const w = s.w * 0.03 * pr + 2;
				const h = s.h * 0.05 * pr + 2;
				for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) paint(s, x, y, cu, cug, cub, 0.5);
				for (let k = 0; k < w; k += 2) {
					paint(s, x0 + k, y0 - 1, cu * 1.3, cug * 1.3, cub * 1.3, 0.7);
					paint(s, x0 + k, y0 + h, cu * 1.3, cug * 1.3, cub * 1.3, 0.7);
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
				const draw = (x: number, y: number, al: number, r2: number, g2: number, b2: number) => {
					paint(s, x, y, r2, g2, b2, al);
				};
				for (let d = 0; d <= seg1; d += 0.7) {
					const f = d / (seg1 || 1);
					draw(ax + (mx - ax) * f, ay + (my - ay) * f, 0.85, cu, cug, cub);
				}
				for (let d = 0; d <= seg2; d += 0.7) {
					const f = d / (seg2 || 1);
					draw(mx + (bx - mx) * f, my + (by - my) * f, 0.85, cu, cug, cub);
				}

				pulses[ti] += id.rate * s.v.speed * (0.6 + na[2] * 0.8) * s.v.dir;
				if (pulses[ti] > 1.3) pulses[ti] -= 1.6;
				if (pulses[ti] < -0.3) pulses[ti] += 1.6;
				const t = pulses[ti];
				if (t < 0 || t > 1) continue;
				const along = t * total;
				let hx: number;
				let hy: number;
				if (along <= seg1) {
					const f = along / (seg1 || 1);
					hx = ax + (mx - ax) * f;
					hy = ay + (my - ay) * f;
				} else {
					const f = (along - seg1) / (seg2 || 1);
					hx = mx + (bx - mx) * f;
					hy = my + (by - my) * f;
				}
				const fade = edge(t, 0, 1, 0.14);
				for (let k = 0; k < 6; k++) {
					const back = Math.max(0, along - k * 1.1);
					let qx: number;
					let qy: number;
					if (back <= seg1) {
						const f = back / (seg1 || 1);
						qx = ax + (mx - ax) * f;
						qy = ay + (my - ay) * f;
					} else {
						const f = (back - seg1) / (seg2 || 1);
						qx = mx + (bx - mx) * f;
						qy = my + (by - my) * f;
					}
					plot(s, qx, qy, lit, litg, litb, (1 - k / 6) * 0.85 * fade);
				}
				plot(s, hx, hy, 255, 255, 255, 0.5 * fade);
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
				load += hot;
				paint(s, x, y, cu * 1.4, cug * 1.4, cub * 1.4, 0.95);
				paint(s, x + 1, y, cu * 1.4, cug * 1.4, cub * 1.4, 0.8);
				paint(s, x, y + 1, cu * 1.4, cug * 1.4, cub * 1.4, 0.8);
				if (hot > 0.02) {
					const rad = 1.6 + hot * 2.6;
					for (let dy = -rad; dy <= rad; dy++)
						for (let dx = -rad; dx <= rad; dx++) {
							const d = Math.hypot(dx, dy) / rad;
							if (d > 1) continue;
							plot(s, x + dx, y + dy, lit, litg, litb, (1 - d) * (1 - d) * hot * 0.8);
						}
				}
			}
			s.out = Math.min(1, load / 3);
			blit(s);
		}
	};
}

type Optic = { entryY: number; apex: number; size: number; spin: number; facets: number[] };

function prismIdent(s: FxScene): Optic {
	const r = mulberry32(s.v.seed + 5680);
	const entryY = 0.28 + r() * 0.3;
	const apex = 0.3 + r() * 0.4;
	const size = 0.2 + r() * 0.12;
	const spin = 0.4 + r() * 0.9;
	const facets: number[] = [];
	for (let i = 0; i < 8; i++) facets.push(r());
	return { entryY, apex, size, spin, facets };
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
			const [gr, gg, gb] = hsl(s.v.hue, s.v.sat * 0.3, 12);
			const wobble = Math.sin(s.t * 0.01 * s.v.speed * id.spin) * 0.22 * s.v.dir;
			const cx = s.w * 0.5 + s.v.tilt * s.w * 0.08;
			const cy = s.h * id.apex;
			const R = Math.min(s.w, s.h) * id.size;

			const verts: number[][] = [];
			for (let k = 0; k < 3; k++) {
				const th = -Math.PI / 2 + wobble + (k * Math.PI * 2) / 3;
				verts.push([cx + Math.cos(th) * R, cy + Math.sin(th) * R]);
			}

			const entry = s.h * id.entryY;
			const hit = [cx - R * 0.5, entry];
			for (let x = 0; x < hit[0]; x++) {
				const spreadY = 0.6 + Math.sin(x * 0.2 + s.t * 0.1) * 0.25;
				plot(s, x, entry, 255, 255, 255, 0.55);
				plot(s, x, entry - 1, 255, 255, 255, 0.22 * spreadY);
				plot(s, x, entry + 1, 255, 255, 255, 0.22 * spreadY);
			}

			const bands = 9;
			const pulse = 0.72 + 0.28 * Math.sin(s.t * 0.03 * s.v.speed);
			for (let b = 0; b < bands; b++) {
				const f = b / (bands - 1);
				const hue = s.v.hue + f * 300;
				const [r2, g2, b2] = hsl(hue, Math.max(60, s.v.sat), 62);
				const bend = (0.18 + f * 0.42) * (1 + s.v.drift * 0.35) + wobble * 0.5;
				const len = s.w - hit[0];
				for (let d = 0; d < len; d += 0.8) {
					const x = hit[0] + d;
					const y = entry + Math.tan(bend) * d;
					if (y < 0 || y >= s.h) break;
					const a = Math.max(0, 1 - d / len) * 0.5 * pulse;
					plot(s, x, y, r2, g2, b2, a);
					plot(s, x, y + 1, r2, g2, b2, a * 0.4);
				}
			}

			const [lr, lg, lb] = hsl(s.v.hue2, s.v.sat * 0.4, 70);
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
					paint(s, x, y, gr, gg, gb, 0.42);
					const sheen = Math.sin((x + y) * 0.35 + s.t * 0.05 * s.v.dir);
					if (sheen > 0.75) plot(s, x, y, lr, lg, lb, 0.22);
				}
			}
			for (let k = 0; k < 3; k++) {
				const a = verts[k];
				const b = verts[(k + 1) % 3];
				const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
				for (let d = 0; d <= len; d += 0.7) {
					const f = d / len;
					plot(s, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, lr, lg, lb, 0.75);
				}
			}

			for (let i = 0; i < s.n; i++) {
				const o = i * P;
				const p = s.parts;
				p[o + 3] += 0.02 * p[o + 2];
				p[o + 1] += 0.05 * p[o + 2] * s.v.drift;
				p[o] += Math.sin(p[o + 3]) * 0.06 * s.v.dir;
				if (p[o + 1] > s.h + 1) {
					p[o + 1] = -1;
					p[o] = s.rnd() * s.w;
				}
				const near = Math.max(0, 1 - Math.abs(p[o + 1] - entry) / (s.h * 0.4));
				const tw = 0.35 + 0.65 * Math.max(0, Math.sin(p[o + 3] * 1.4));
				const a = tw * (0.12 + near * 0.4) * edge(p[o + 1], -1, s.h + 1, s.h * 0.18);
				plot(s, p[o], p[o + 1], 255, 255, 255, a * 0.7);
			}
			s.out = Math.min(1, pulse * 0.9);
			blit(s);
		}
	};
}
