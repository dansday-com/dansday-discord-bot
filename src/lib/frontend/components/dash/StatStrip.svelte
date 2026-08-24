<script lang="ts">
	import type { StripItem } from './types';

	let { items }: { items: StripItem[] } = $props();
</script>

<div class="stats stats-horizontal border-base-300 bg-base-100 w-full overflow-x-auto border shadow-sm">
	{#each items as item}
		<div class="stat gap-0.5 px-4 py-3">
			<div class="stat-figure text-primary"><i class="fas {item.icon} text-lg"></i></div>
			<div class="stat-title text-base-content/50 text-[10px] font-semibold tracking-[0.08em] uppercase">{item.label}</div>
			<div class="stat-value text-base-content text-lg font-extrabold tracking-tight tabular-nums">{item.value}</div>
		</div>
	{/each}
</div>
