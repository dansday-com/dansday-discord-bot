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

<div class="from-primary/10 to-secondary/5 border-primary/15 rounded-2xl border bg-gradient-to-br px-3 py-4 text-center">
	<p class="text-primary/75 text-[10px] font-semibold tracking-[0.1em] uppercase">{label}</p>

	{#if countTo === undefined}
		<p class="text-base-content mt-1 text-[clamp(1.6rem,5vw,2.15rem)] leading-none font-extrabold tracking-tight tabular-nums">{value}</p>
	{:else}
		<p class="text-base-content mt-1 text-[clamp(1.6rem,5vw,2.15rem)] leading-none font-extrabold tracking-tight tabular-nums" use:countUp={countTo}>
			{value}
		</p>
	{/if}

	{#if hint}
		<p class="text-base-content/55 mt-2 text-[11px] font-semibold tabular-nums">{hint}</p>
	{/if}

	{#if trailing}
		<div class="mt-2.5">{@render trailing()}</div>
	{/if}
</div>
