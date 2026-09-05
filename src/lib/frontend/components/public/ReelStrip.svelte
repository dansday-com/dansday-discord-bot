<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		items,
		offset,
		animating,
		cellClass,
		frameWidth,
		frameWidthLg,
		frameWidthSm,
		padLeft = '50%',
		padLeftLg,
		tone = 'idle',
		glow = false,
		wrap = $bindable(),
		cell,
		overlay
	}: {
		items: T[];
		offset: number;
		animating: boolean;
		cellClass: string;
		frameWidth: number;
		frameWidthLg?: number;
		frameWidthSm?: number;
		padLeft?: string;
		padLeftLg?: string;
		tone?: 'idle' | 'win' | 'lose';
		glow?: boolean;
		wrap?: HTMLDivElement;
		cell: Snippet<[T, number]>;
		overlay?: Snippet;
	} = $props();

	const frameCls = $derived([frameWidthLg ? 'min-[600px]:w-(--fw-lg)' : '', frameWidthSm ? 'max-[680px]:w-(--fw-sm)' : ''].filter(Boolean).join(' '));

	const border = $derived(tone === 'win' ? 'border-success/60' : tone === 'lose' ? 'border-error/60' : 'border-base-300');
</script>

<div
	bind:this={wrap}
	class="bg-base-200 relative overflow-hidden rounded-2xl border py-3 transition-[border-color,box-shadow] duration-250 {border} {glow
		? 'shadow-[inset_0_0_30px_-6px_rgba(184,134,11,0.35)]'
		: ''}"
>
	<div
		class="pointer-events-none absolute top-1.5 bottom-1.5 left-1/2 z-3 w-(--fw) -translate-x-1/2 rounded-[13px] border-2 border-[rgba(184,134,11,0.55)] shadow-[0_0_18px_2px_rgba(184,134,11,0.35)] {frameCls}"
		style="--fw: {frameWidth}px; --fw-lg: {frameWidthLg ?? frameWidth}px; --fw-sm: {frameWidthSm ?? frameWidth}px"
	></div>
	<div
		class="pointer-events-none absolute -top-0.5 left-1/2 z-4 size-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-[#d9a528] drop-shadow-[0_0_6px_rgba(184,134,11,0.9)]"
	></div>

	<div
		class="flex gap-2 pl-(--pl) will-change-transform min-[600px]:pl-(--pl-lg)"
		style="--pl: {padLeft}; --pl-lg: {padLeftLg ?? padLeft}; transform: translateX({offset}px); transition: {animating
			? 'transform 6.8s cubic-bezier(0.06, 0.72, 0.06, 1)'
			: 'none'};"
	>
		{#each items as item, i (i)}
			<div data-reel-cell class="shrink-0 {cellClass}">
				{@render cell(item, i)}
			</div>
		{/each}
	</div>

	{#if overlay}{@render overlay()}{/if}
</div>
