<script lang="ts">
	import { effectMeta, effectVariant, normalizeEffect } from '$lib/effects.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
	};

	let { effect = null, seed = 0, accent = null, always = false }: Props = $props();

	const family = $derived(normalizeEffect(effect));
	const variant = $derived(effectVariant(family, seed, accent));
	const dotted = $derived(effectMeta(family)?.particles === true);

	let host = $state<HTMLDivElement | undefined>();
	let live = $state(false);

	$effect(() => {
		if (family === 'none') return;
		if (always || typeof IntersectionObserver === 'undefined') {
			live = true;
			return;
		}
		const node = host;
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) live = entry.isIntersecting;
			},
			{ rootMargin: '200px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	});
</script>

{#if family !== 'none'}
	<div bind:this={host} class="fx fx-{family} {dotted ? 'fx-dots' : ''} {live ? 'fx-live' : ''}" style={variant.style} aria-hidden="true"></div>
{/if}
