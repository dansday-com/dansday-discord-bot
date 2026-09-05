<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal } from './reveal';

	let {
		id,
		icon,
		heading,
		lead,
		children
	}: {
		id?: string;
		/** Full Font Awesome class, e.g. `fas fa-bolt`. */
		icon: string;
		heading: string;
		lead?: string;
		children: Snippet;
	} = $props();
</script>

<section {id} class="translate-y-5 opacity-0 transition-all duration-500 ease-out" use:reveal>
	<h2 class="text-base-content mb-1.5 flex items-center gap-2.5 text-lg font-extrabold">
		<i class="{icon} text-primary"></i>{heading}
	</h2>
	{#if lead}
		<p class="text-base-content/60 mb-4.5 text-[13.5px] leading-relaxed">{lead}</p>
	{/if}
	{@render children()}
</section>
