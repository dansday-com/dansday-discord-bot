<script lang="ts">
	import type { Snippet } from 'svelte';
	import { countUp } from './motion.svelte';

	let {
		pct,
		label,
		grow = 1,
		color,
		side
	}: {
		pct: number;
		label: string;
		grow?: number;
		color?: string;
		side?: Snippet;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-3 sm:gap-4">
	<div
		class="radial-progress bg-base-200 text-primary shrink-0"
		style="--value: {pct * grow}; --size: 5rem; --thickness: 0.6rem;{color ? ` color: ${color};` : ''}"
		role="progressbar"
		aria-valuenow={pct}
		aria-valuemin="0"
		aria-valuemax="100"
	>
		<span class="flex flex-col items-center leading-none">
			<span class="text-base-content text-lg font-extrabold tabular-nums">
				<span use:countUp={pct}>{pct}</span>%
			</span>
			<span class="text-base-content/55 mt-1 text-[8px] font-semibold tracking-[0.06em] uppercase">{label}</span>
		</span>
	</div>

	{#if side}
		<div class="flex min-w-28 flex-1 flex-col gap-2">{@render side()}</div>
	{/if}
</div>
