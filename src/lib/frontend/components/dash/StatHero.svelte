<script lang="ts">
	import type { Snippet } from 'svelte';
	import { countUp } from './motion.svelte';

	let {
		label,
		value,
		countTo,
		hint,
		trailing
	}: {
		label: string;
		value: string;
		countTo?: number;
		hint?: string;
		trailing?: Snippet;
	} = $props();
</script>

<div class="from-primary/10 to-secondary/5 border-primary/15 rounded-2xl border bg-linear-to-br px-2.5 py-3 text-center sm:px-3 sm:py-3.5">
	<p class="text-primary/75 text-[10px] font-semibold tracking-widest uppercase">{label}</p>

	{#if countTo === undefined}
		<p class="text-base-content mt-1 text-[clamp(1.35rem,6vw,2.1rem)] leading-none font-extrabold tracking-tight break-all tabular-nums">{value}</p>
	{:else}
		<p class="text-base-content mt-1 text-[clamp(1.35rem,6vw,2.1rem)] leading-none font-extrabold tracking-tight break-all tabular-nums" use:countUp={countTo}>
			{value}
		</p>
	{/if}

	{#if hint}
		<p class="text-base-content/55 mt-1.5 text-[11px] font-semibold tabular-nums">{hint}</p>
	{/if}

	{#if trailing}
		<div class="mt-2">{@render trailing()}</div>
	{/if}
</div>
