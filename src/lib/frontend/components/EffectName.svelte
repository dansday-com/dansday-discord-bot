<script lang="ts">
	import { effectVariant, normalizeEffect } from '$lib/effects.js';
	import { observeVisibility } from '$lib/frontend/fx/visible.js';

	type Props = {
		name: string;
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		class?: string;
		title?: string;
	};

	let { name, effect: effectId = null, seed = 0, accent = null, class: cls = '', title }: Props = $props();

	const family = $derived(normalizeEffect(effectId));
	const style = $derived(family === 'none' ? '' : effectVariant(family, seed, accent).style);

	let node = $state<HTMLSpanElement | undefined>();
	let live = $state(false);

	$effect(() => {
		const el = node;
		if (!el || family === 'none') return;
		return observeVisibility(el, (visible) => {
			live = visible;
		});
	});
</script>

{#if family === 'none'}
	<span class={cls} {title}>{name}</span>
{:else}
	<span bind:this={node} class="fx-text {live ? 'fx-live' : ''} {cls}" data-fx={family} data-fx-text={name} {style} {title}>{name}</span>
{/if}
