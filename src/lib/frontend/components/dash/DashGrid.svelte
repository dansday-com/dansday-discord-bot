<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		cols = 'auto',
		children
	}: {
		cols?: 'auto' | 1 | 2 | 3 | 4;
		children: Snippet;
	} = $props();

	const COLS = {
		auto: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
		1: 'grid-cols-1',
		2: 'grid-cols-1 md:grid-cols-2',
		3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
		4: 'grid-cols-2 lg:grid-cols-4'
	} as const;
</script>

<div class="grid items-start gap-4 sm:gap-5 {COLS[cols]}">
	{@render children()}
</div>
