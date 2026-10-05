<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import { TYPE_MS, tapping, typed } from './clock.svelte.js';
	import Tap from './Tap.svelte';
	import type { SceneField, SceneModal } from './types.js';

	let { modal, t, sheet = false, still = false }: { modal: SceneModal | null; t: number; sheet?: boolean; still?: boolean } = $props();

	const ms = $derived(still ? 0 : 220);
	const focused = (f: SceneField) => f.typeFrom !== undefined && t >= f.typeFrom && t < f.typeFrom + Array.from(f.value).length * TYPE_MS + 500;
	const submitting = $derived(modal !== null && t >= modal.submitAt && t < modal.submitAt + 220);

	const enter = (node: Element) =>
		sheet ? fly(node, { y: 80, duration: ms + 80, easing: quintOut }) : scale(node, { start: 0.94, duration: ms, easing: quintOut });
</script>

{#snippet fields(m: SceneModal)}
	<div class="flex flex-col gap-4">
		{#each m.fields as field (field.label)}
			{@const value = typed(field.value, t, field.typeFrom)}
			<div>
				<p class="text-ash-100 mb-2 text-[13px] font-semibold">{field.label}</p>
				<div
					class="bg-ash-950 relative flex h-10 items-center rounded-[4px] border px-3 text-[14px] transition-colors duration-150 {focused(field)
						? 'border-[#5865f2]'
						: 'border-ash-950'}"
				>
					{#if value}
						<span class="text-ash-50 min-w-0 truncate"
							>{value}{#if focused(field) && !field.select}<span class="scene-caret"></span>{/if}</span
						>
					{:else}
						<span class="text-ash-300 min-w-0 truncate">{field.placeholder ?? ''}</span>
					{/if}
					{#if field.select}<i class="fas fa-chevron-down text-ash-200 ml-auto text-[12px]"></i>{/if}
					{#if tapping(t, field.typeFrom)}<Tap />{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet submit(full: boolean)}
	<span
		class="scene-submit relative inline-flex h-10 items-center justify-center rounded-[4px] bg-[#5865f2] px-5 text-[14px] font-medium text-white {full
			? 'w-full rounded-lg'
			: ''}"
		class:scene-submit-pressed={submitting}
	>
		Submit
		{#if modal && tapping(t, modal.submitAt)}<Tap />{/if}
	</span>
{/snippet}

{#if modal}
	<div class="absolute inset-0 z-30 bg-black/60 {sheet ? 'flex flex-col justify-end' : 'grid place-items-center p-6'}" transition:fade={{ duration: ms }}>
		<div
			class="bg-ash-900 {sheet ? 'rounded-t-2xl px-4 pt-2.5 pb-6' : 'w-full max-w-[420px] overflow-hidden rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.5)]'}"
			transition:enter
		>
			{#if sheet}
				<span class="bg-ash-600 mx-auto mb-4 block h-1 w-10 rounded-full"></span>
				<div class="mb-5 flex items-center gap-3">
					<i class="fas fa-xmark text-ash-200 text-[17px]"></i>
					<p class="text-ash-50 truncate text-[17px] font-bold">{modal.title}</p>
				</div>
				{@render fields(modal)}
				<div class="mt-6">{@render submit(true)}</div>
			{:else}
				<div class="flex items-center gap-3 px-4 pt-4 pb-4">
					<p class="text-ash-50 truncate text-[20px] font-semibold">{modal.title}</p>
					<i class="fas fa-xmark text-ash-200 ml-auto text-[18px]"></i>
				</div>
				<div class="px-4 pb-5">{@render fields(modal)}</div>
				<div class="bg-ash-800 flex items-center justify-end gap-2 px-4 py-3">
					<span class="text-ash-50 inline-flex h-10 items-center px-4 text-[14px]">Cancel</span>
					{@render submit(false)}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scene-caret {
		display: inline-block;
		width: 1px;
		height: 1.05em;
		margin-left: 1px;
		vertical-align: -0.15em;
		background: #f2f3f5;
		animation: scene-caret 1s steps(1) infinite;
	}

	@keyframes scene-caret {
		50% {
			opacity: 0;
		}
	}

	.scene-submit {
		transition:
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
			filter 160ms ease;
	}

	.scene-submit-pressed {
		transform: scale(0.96);
		filter: brightness(1.2);
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-caret {
			animation: none;
		}

		.scene-submit {
			transition: none;
		}
	}
</style>
