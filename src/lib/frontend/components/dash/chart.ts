import { PERCENT } from '../../../utils/numbers.js';

export type PieItem = { value: number; color: string; label: string; icon?: string };
export type PieSegment = PieItem & { pct: number; d: string };

export const CHART_PALETTE = ['#e43d12', '#d6536d', '#c8911a', '#1f8a4c', '#b23b3b', '#6d5bd0', '#e07a5f', '#2a9d8f', '#9b2c6f', '#457b9d'];

const COMPACT_UNITS = [
	{ size: 1e9, suffix: 'B' },
	{ size: 1e6, suffix: 'M' },
	{ size: 1e3, suffix: 'K' }
];
const COMPACT_WHOLE_FROM_UNITS = 10;
const MIN_PIE_SLICE_PCT = 0.5;

export const FILL = {
	primary: 'linear-gradient(90deg, var(--color-secondary), var(--color-primary))',
	accent: 'linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 75%, transparent), var(--color-accent))',
	neutral: 'linear-gradient(90deg, color-mix(in srgb, var(--color-secondary) 55%, transparent), var(--color-neutral))',
	muted: 'color-mix(in srgb, var(--color-base-content) 18%, transparent)',
	success: 'var(--color-success)',
	warning: 'var(--color-warning)',
	error: 'var(--color-error)'
} as const;

export function compact(value: number): string {
	const n = Math.abs(Number(value) || 0);
	const unit = COMPACT_UNITS.find((u) => n >= u.size);
	if (unit) {
		return `${(value / unit.size).toFixed(n >= unit.size * COMPACT_WHOLE_FROM_UNITS ? 0 : 1)}${unit.suffix}`;
	}
	return String(Math.round(value || 0));
}

type Circle = { cx: number; cy: number; r: number };

function polar({ cx, cy, r }: Circle, pctPoint: number) {
	const a = (pctPoint / PERCENT) * 2 * Math.PI - Math.PI / 2;
	return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function buildPie(items: PieItem[]): { total: number; segments: PieSegment[] } {
	const total = items.reduce((s, x) => s + x.value, 0);
	if (total <= 0) {
		return { total: 0, segments: [] };
	}
	const visible = items.filter((it) => (it.value / total) * PERCENT >= MIN_PIE_SLICE_PCT);
	if (visible.length === 1) {
		return { total, segments: [{ ...visible[0], pct: PERCENT, d: '' }] };
	}
	let offset = 0;
	const segments = visible.map((it) => {
		const pct = (it.value / total) * PERCENT;
		const large = pct > PERCENT / 2 ? 1 : 0;
		const p1 = polar({ cx: 50, cy: 50, r: 48 }, offset);
		const p2 = polar({ cx: 50, cy: 50, r: 48 }, offset + pct);
		const seg = {
			...it,
			pct,
			d: `M50,50 L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A48,48 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z`
		};
		offset += pct;
		return seg;
	});
	return { total, segments };
}

export function sharePct(value: number, rows: number[], floor = 4): number {
	const max = Math.max(1, ...rows);
	return Math.max(floor, Math.round(((Number(value) || 0) / max) * PERCENT));
}

export function buildArea(values: number[], width = 300, height = 90) {
	if (values.length < 2) {
		return null;
	}
	const min = Math.min(0, ...values);
	const max = Math.max(0, ...values);
	const span = max - min || 1;
	const stepX = width / (values.length - 1);
	const coords = values.map((v, i) => ({ x: i * stepX, y: height - ((v - min) / span) * height }));
	const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
	const last = values[values.length - 1];
	return {
		width,
		height,
		line,
		area: `${line} L${width},${height} L0,${height} Z`,
		zeroY: height - ((0 - min) / span) * height,
		last,
		up: last >= 0
	};
}
