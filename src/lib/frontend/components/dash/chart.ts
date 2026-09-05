export type PieItem = { value: number; color: string; label: string; icon?: string };
export type PieSegment = PieItem & { pct: number; d: string };

export const CHART_PALETTE = ['#e43d12', '#d6536d', '#c8911a', '#1f8a4c', '#b23b3b', '#6d5bd0', '#e07a5f', '#2a9d8f', '#9b2c6f', '#457b9d'];

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
	if (n >= 1e9) return (value / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
	if (n >= 1e6) return (value / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
	if (n >= 1e3) return (value / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
	return String(Math.round(value || 0));
}

function polar(cx: number, cy: number, r: number, pctPoint: number) {
	const a = (pctPoint / 100) * 2 * Math.PI - Math.PI / 2;
	return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function buildPie(items: PieItem[]): { total: number; segments: PieSegment[] } {
	const total = items.reduce((s, x) => s + x.value, 0);
	if (total <= 0) return { total: 0, segments: [] };
	const visible = items.filter((it) => (it.value / total) * 100 >= 0.5);
	if (visible.length === 1) return { total, segments: [{ ...visible[0], pct: 100, d: '' }] };
	let offset = 0;
	const segments = visible.map((it) => {
		const pct = (it.value / total) * 100;
		const large = pct > 50 ? 1 : 0;
		const p1 = polar(50, 50, 48, offset);
		const p2 = polar(50, 50, 48, offset + pct);
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
	return Math.max(floor, Math.round(((Number(value) || 0) / max) * 100));
}

export function buildArea(values: number[], width = 300, height = 90) {
	if (values.length < 2) return null;
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
