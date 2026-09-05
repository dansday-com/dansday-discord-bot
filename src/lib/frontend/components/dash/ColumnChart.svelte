<script lang="ts">
	import type { Column } from './types';

	let {
		columns,
		grow = 1
	}: {
		columns: Column[];
		grow?: number;
	} = $props();
</script>

<div class="flex h-36 items-stretch gap-1.5 sm:h-44 sm:gap-2">
	{#each columns as col}
		<div class="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
			<span class="text-base-content/70 w-full truncate text-center text-[10px] font-bold tabular-nums sm:text-[11px]">{col.value}</span>
			<div class="bg-base-content/10 flex w-3/5 max-w-6 flex-1 items-end overflow-hidden rounded-t-md">
				<div
					class="w-full rounded-t-md transition-[height] duration-700 ease-out"
					style="height: {Math.max(6, col.pct) * grow}%; background: {col.color};"
				></div>
			</div>
			{#if col.icon}
				<i class="fas {col.icon} text-xs sm:text-sm" style="color: {col.color};" title={col.label}></i>
			{/if}
		</div>
	{/each}
</div>
