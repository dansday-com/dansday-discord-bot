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

<div class="bg-base-200/60 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2">
	<span class="text-base-content/70 flex min-w-0 items-center gap-2 text-sm">
		<i class="fas {icon} shrink-0 text-xs text-[var(--tone)]"></i>
		<span class="truncate">{label}</span>
	</span>
	{#if children}
		{@render children()}
	{:else}
		<span class="text-base-content shrink-0 text-lg font-bold tabular-nums">{value}</span>
	{/if}
</div>
