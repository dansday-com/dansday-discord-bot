export { default as StatCard } from './StatCard.svelte';
export { default as KpiTile } from './KpiTile.svelte';
export { default as StatHero } from './StatHero.svelte';
export { default as StatStrip } from './StatStrip.svelte';
export { default as MiniGrid } from './MiniGrid.svelte';
export { default as MiniStat } from './MiniStat.svelte';
export { default as RowStat } from './RowStat.svelte';
export { default as SegBar } from './SegBar.svelte';
export { default as MeterBar } from './MeterBar.svelte';
export { default as BarList } from './BarList.svelte';
export { default as RingStat } from './RingStat.svelte';
export { default as DonutChart } from './DonutChart.svelte';
export { default as ColumnChart } from './ColumnChart.svelte';
export { default as SparkArea } from './SparkArea.svelte';
export { default as EntityRow } from './EntityRow.svelte';
export { default as SectionTitle } from './SectionTitle.svelte';
export { default as DashGrid } from './DashGrid.svelte';
export { default as TrendChip } from './TrendChip.svelte';

export type { Segment, BarRow, Column, StripItem } from './types';

export { TONES, toneAt, toneVars, type Tone } from './tones';
export { buildPie, buildArea, sharePct, compact, CHART_PALETTE, FILL, type PieItem, type PieSegment } from './chart';
export { countUp, growOnMount, prefersReducedMotion } from './motion.svelte';
