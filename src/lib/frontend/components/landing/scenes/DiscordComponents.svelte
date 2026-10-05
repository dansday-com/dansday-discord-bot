<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { tapping } from './clock.svelte.js';
	import Tap from './Tap.svelte';
	import type { SceneButton, SceneRow, SceneSelect } from './types.js';

	let { rows, t = 0, still = false }: { rows: SceneRow[]; t?: number; still?: boolean } = $props();

	const TONES: Record<NonNullable<SceneButton['tone']>, string> = {
		grey: '#4e5058',
		blurple: '#5865f2',
		green: '#248046',
		red: '#da373c'
	};

	const pressed = (b: SceneButton) => b.pressAt !== undefined && t >= b.pressAt && t < b.pressAt + 220;
	const isOpen = (s: SceneSelect) => s.openAt !== undefined && t >= s.openAt && (s.pickAt === undefined || t < s.pickAt + 180);
	const chosen = (s: SceneSelect) => (s.pickAt !== undefined && t >= s.pickAt ? s.pick : s.selected);
	const hovered = (s: SceneSelect, i: number) => i === s.pick && s.pickAt !== undefined && t >= s.pickAt - 520;
</script>

{#each rows as row, r (r)}
	{#if Array.isArray(row)}
		<div class="mt-1.5 flex flex-wrap gap-2">
			{#each row as button (button.label)}
				<span
					class="scene-button relative inline-flex h-8 items-center gap-1.5 rounded-[3px] px-4 text-[13px] font-medium text-white"
					class:scene-button-pressed={pressed(button)}
					style="background: {TONES[button.tone ?? 'grey']}"
				>
					{button.label}
					{#if button.link}<i class="fas fa-arrow-up-right-from-square text-[10px] opacity-80"></i>{/if}
					{#if tapping(t, button.pressAt)}<Tap />{/if}
				</span>
			{/each}
		</div>
	{:else}
		{@const open = isOpen(row)}
		{@const pick = chosen(row)}
		<div class="relative mt-1.5 max-w-110">
			<div
				class="bg-ash-950 relative flex h-10 items-center gap-2 rounded-[4px] border px-3 text-[14px] transition-colors duration-150 {open
					? 'border-[#5865f2]'
					: 'border-ash-950'}"
			>
				{#if pick !== undefined}
					{@const option = row.options[pick]}
					{#if option.avatar}<img src={option.avatar} alt="" class="size-5 shrink-0 rounded-full" loading="lazy" />{/if}
					<span class="text-ash-50 truncate">{option.label}</span>
				{:else}
					<span class="text-ash-200 truncate">{row.placeholder}</span>
				{/if}
				<i class="fas fa-chevron-down text-ash-200 ml-auto text-[12px] transition-transform duration-200 {open ? 'rotate-180' : ''}"></i>
				{#if tapping(t, row.openAt)}<Tap />{/if}
			</div>
			{#if open}
				<ul
					class="bg-ash-800 border-ash-950 absolute right-0 bottom-full left-0 z-10 mb-1 overflow-hidden rounded-[4px] border py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
					transition:fly={{ y: 6, duration: still ? 0 : 180, easing: quintOut }}
				>
					{#each row.options as option, i (option.label)}
						<li
							class="relative flex h-8 items-center gap-2 px-3 text-[13.5px] transition-colors duration-150 {hovered(row, i)
								? 'bg-ash-700 text-ash-50'
								: 'text-ash-100'}"
						>
							{#if option.avatar}<img src={option.avatar} alt="" class="size-5 shrink-0 rounded-full" loading="lazy" />{/if}
							<span class="truncate">{option.label}</span>
							{#if i === pick && pick !== undefined}<i class="fas fa-circle-check ml-auto text-[13px] text-[#5865f2]"></i>{/if}
							{#if i === row.pick && tapping(t, row.pickAt)}<Tap />{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/each}

<style>
	.scene-button {
		transition:
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
			filter 160ms ease;
	}

	.scene-button-pressed {
		transform: scale(0.95);
		filter: brightness(1.25);
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-button {
			transition: none;
		}
	}
</style>
