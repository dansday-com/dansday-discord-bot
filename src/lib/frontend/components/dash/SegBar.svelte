<script lang="ts">
	import type { Segment } from './types';

	let {
		head,
		meta,
		segments,
		spaced = false,
		title
	}: {
		head?: string;
		meta?: string;
		segments: Segment[];
		spaced?: boolean;
		title?: string;
	} = $props();

	const legend = $derived(segments.filter((s) => s.label));
</script>

<div>
	{#if head}
		<div class="text-base-content/70 mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold">
			<span class="min-w-0 truncate">{head}</span>
			{#if meta}<span class="text-primary shrink-0 text-[11px] font-bold tabular-nums">{meta}</span>{/if}
		</div>
	{/if}

	<div class="border-base-300 bg-base-content/10 h-2.5 overflow-hidden rounded-full border" {title}>
		<div class="bar-grow flex h-full {spaced ? 'gap-0.5' : ''}">
			{#each segments as seg}
				<div
					class="h-full min-w-0 transition-[width] duration-700 ease-out {spaced ? 'rounded-full' : ''}"
					style="width: {seg.pct}%; background: {seg.color};"
				></div>
			{/each}
		</div>
	</div>

	{#if legend.length > 0}
		<div class="text-base-content/70 mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold">
			{#each legend as seg}
				<span class="inline-flex min-w-0 items-center gap-1.5">
					<span class="size-2 shrink-0 rounded-sm" style="background: {seg.color};"></span>{seg.label}
				</span>
			{/each}
		</div>
	{/if}
</div>
