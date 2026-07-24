<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		children
	}: {
		title: string;
		children?: Snippet;
	} = $props();
</script>

<div class="mb-7 text-center">
	<h2 class="text-lb-text m-0 mb-2 text-xl font-extrabold lg:text-2xl">{title}</h2>
	{#if children}
		<p class="text-lb-text-muted m-0 text-base">{@render children()}</p>
	{/if}
</div>
