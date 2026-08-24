<script lang="ts">
	let {
		head,
		meta,
		pct,
		grow = 1,
		color
	}: {
		head?: string;
		meta?: string;
		pct: number;
		grow?: number;
		color?: string;
	} = $props();

	const width = $derived(Math.min(100, Math.max(0, pct)) * grow);
</script>

<div>
	{#if head}
		<div class="text-base-content/60 mb-2 flex items-baseline justify-between gap-2.5 text-xs font-semibold">
			<span>{head}</span>
			{#if meta}<span class="text-primary/85 text-[11px] font-bold tabular-nums">{meta}</span>{/if}
		</div>
	{/if}

	<div class="border-base-300 bg-base-content/10 h-2.5 overflow-hidden rounded-full border">
		<div
			class="from-primary to-accent h-full rounded-full transition-[width] duration-700 ease-out {color ? '' : 'bg-gradient-to-r'}"
			style="width: {width}%;{color ? ` background: ${color};` : ''}"
		></div>
	</div>
</div>
