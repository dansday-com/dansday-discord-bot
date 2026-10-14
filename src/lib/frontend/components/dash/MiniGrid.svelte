<script lang="ts">
	import type { Snippet } from 'svelte';

	type GridCols = 1 | 2 | 3 | 4;

	let {
		cols = 2,
		children
	}: {
		cols?: GridCols;
		children: Snippet;
	} = $props();

	const COLS = {
		1: 'grid-cols-1',
		2: 'grid-cols-2',
		3: 'grid-cols-2 sm:grid-cols-3',
		4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
	} as const;
</script>

<div class="grid gap-2 sm:gap-2.5 {COLS[cols]}">
	{@render children()}
</div>
