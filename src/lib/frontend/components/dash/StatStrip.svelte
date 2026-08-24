<script lang="ts">
	import type { StripItem } from './types';

	let { items }: { items: StripItem[] } = $props();
</script>

<div class="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1.5 sm:gap-2.5">
	{#each items as item}
		<div class="border-base-300 bg-base-100 flex shrink-0 snap-start items-center gap-2.5 rounded-xl border px-2.5 py-2 shadow-sm sm:px-3 sm:py-2.5">
			<span class="from-secondary to-primary text-primary-content grid size-8 shrink-0 place-items-center rounded-xl bg-linear-to-br text-sm sm:size-9">
				<i class="fas {item.icon}"></i>
			</span>
			<span class="flex min-w-0 flex-col">
				<span class="text-base-content text-sm leading-tight font-extrabold tracking-tight tabular-nums sm:text-base">{item.value}</span>
				<span class="text-base-content/50 text-[9px] font-semibold tracking-[0.08em] uppercase sm:text-[10px]">{item.label}</span>
			</span>
		</div>
	{/each}
</div>
