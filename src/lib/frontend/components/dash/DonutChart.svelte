<script lang="ts">
	import type { PieSegment } from './chart';

	let {
		segments,
		total,
		totalLabel,
		ariaLabel,
		valueFormat = (s: PieSegment) => `${s.pct.toFixed(0)}%`,
		showIcons = false
	}: {
		segments: PieSegment[];
		total: string;
		totalLabel: string;
		ariaLabel: string;
		valueFormat?: (seg: PieSegment) => string;
		showIcons?: boolean;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-5">
	<svg class="size-32 max-w-[40vw] shrink-0 drop-shadow-sm" viewBox="0 0 100 100" role="img" aria-label={ariaLabel}>
		{#if segments.length === 1}
			<circle cx="50" cy="50" r="48" fill={segments[0].color} />
		{:else}
			{#each segments as slice}
				<path d={slice.d} fill={slice.color} stroke="var(--color-base-100)" stroke-width="0.9" />
			{/each}
		{/if}
		<circle cx="50" cy="50" r="27" fill="var(--color-base-100)" />
		<text x="50" y="48" text-anchor="middle" class="fill-base-content text-[13px] font-extrabold">{total}</text>
		<text x="50" y="58" text-anchor="middle" class="fill-base-content/55 text-[6px] font-semibold tracking-[0.1em] uppercase">{totalLabel}</text>
	</svg>

	<div class="flex min-w-[9rem] flex-1 flex-col gap-2">
		{#each segments as seg}
			<div class="text-base-content flex items-center gap-2 text-[13px] font-semibold">
				<span class="size-2.5 shrink-0 rounded-sm" style="background: {seg.color};"></span>
				{#if showIcons && seg.icon}<i class="fas {seg.icon} shrink-0" style="color: {seg.color};"></i>{/if}
				<span class="min-w-0 flex-1 truncate">{seg.label}</span>
				<span class="text-base-content/55 shrink-0 text-xs tabular-nums">{valueFormat(seg)}</span>
			</div>
		{/each}
	</div>
</div>
