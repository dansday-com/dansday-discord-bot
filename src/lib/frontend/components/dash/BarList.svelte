<script lang="ts">
	import type { BarRow } from './types';

	let {
		rows,
		grow = 1,
		layout = 'inline',
		empty = 'None yet'
	}: {
		rows: BarRow[];
		grow?: number;
		layout?: 'inline' | 'stacked';
		empty?: string;
	} = $props();
</script>

{#if rows.length === 0}
	<span class="text-base-content/35 text-xs font-semibold italic">{empty}</span>
{:else if layout === 'inline'}
	<div class="flex flex-col gap-2.5">
		{#each rows as row}
			<div class="grid grid-cols-[4.5rem_minmax(2.5rem,1fr)_auto] items-center gap-2">
				<span class="text-base-content inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
					{#if row.icon}<i class="fas {row.icon} shrink-0" style={row.color ? `color: ${row.color};` : undefined}></i>{/if}
					<span class="truncate">{row.label}</span>
				</span>
				<div class="bg-base-content/10 h-2.5 overflow-hidden rounded-full">
					<div
						class="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
						style="width: {row.pct * grow}%;{row.color ? ` background: ${row.color};` : ''}"
					></div>
				</div>
				<span class="text-base-content/60 text-right text-xs font-bold whitespace-nowrap tabular-nums">{row.value}</span>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex flex-col gap-2.5">
		{#each rows as row}
			<div class="flex flex-col gap-1.5">
				<div class="flex items-baseline justify-between gap-2">
					<span class="text-base-content min-w-0 truncate text-xs font-semibold">{row.label}</span>
					<span class="text-base-content/60 shrink-0 text-[11px] font-bold tabular-nums">{row.value}</span>
				</div>
				<div class="bg-base-content/10 h-2 overflow-hidden rounded-full">
					<div
						class="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
						style="width: {row.pct * grow}%;{row.color ? ` background: ${row.color};` : ''}"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}
