<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon,
		label,
		value,
		children
	}: {
		icon: string;
		label: string;
		value?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="bg-base-200/60 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 sm:gap-3 sm:px-2.5 sm:py-2">
	<span class="text-base-content/70 flex min-w-0 items-center gap-2 text-[13px] sm:text-sm">
		<i class="fas {icon} shrink-0 text-xs text-(--tone)"></i>
		<span class="truncate">{label}</span>
	</span>
	{#if children}
		{@render children()}
	{:else}
		<span class="text-base-content shrink-0 text-base font-bold tabular-nums sm:text-lg">{value}</span>
	{/if}
</div>
