<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'ghost';

	let {
		href = undefined,
		variant = 'primary' as Variant,
		compact = false,
		type = 'button',
		class: extra = '',
		children,
		...rest
	}: {
		href?: string;
		variant?: Variant;
		compact?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap no-underline cursor-pointer border-0 transition-transform hover:-translate-y-px active:translate-y-0';
	const size = $derived(compact ? 'px-4 py-2 text-base' : 'px-5 py-3 text-base');
	const look = $derived(
		variant === 'primary'
			? 'bg-gradient-to-br from-chili-peach to-chili-hot text-white shadow-[0_4px_14px_rgba(36,95,115,0.35)] hover:shadow-[0_6px_20px_rgba(36,95,115,0.45)]'
			: 'bg-chili-surface text-lb-text border border-lb-border hover:bg-chili-surface-mid'
	);
	const cls = $derived(`${base} ${size} ${look} ${extra}`);
</script>

{#if href}
	<a {href} class={cls} {...rest}>{@render children()}</a>
{:else}
	<button {type} class={cls} {...rest}>{@render children()}</button>
{/if}
