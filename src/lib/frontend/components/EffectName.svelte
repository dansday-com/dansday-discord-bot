<script lang="ts">
	import { effectVariant, normalizeEffect } from '$lib/effects.js';

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
</script>

{#if family === 'none'}
	<span class={cls} {title}>{name}</span>
{:else}
	<span class="fx-text fx-live {cls}" data-fx={family} data-fx-text={name} {style} {title}>{name}</span>
{/if}
