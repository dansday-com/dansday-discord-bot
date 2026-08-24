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

<div class="flex items-center gap-4">
	<div
		class="radial-progress bg-base-200 text-primary shrink-0"
		style="--value: {pct * grow}; --size: 6rem; --thickness: 0.65rem;{color ? ` color: ${color};` : ''}"
		role="progressbar"
		aria-valuenow={pct}
		aria-valuemin="0"
		aria-valuemax="100"
	>
		<span class="flex flex-col items-center leading-none">
			<span class="text-base-content text-xl font-extrabold tabular-nums">
				<span use:countUp={pct}>{pct}</span>%
			</span>
			<span class="text-base-content/55 mt-1 text-[9px] font-semibold tracking-[0.06em] uppercase">{label}</span>
		</span>
	</div>

	{#if side}
		<div class="flex min-w-0 flex-1 flex-col gap-2.5">{@render side()}</div>
	{/if}
</div>
