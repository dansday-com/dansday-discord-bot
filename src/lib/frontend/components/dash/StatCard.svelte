<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toneVars, type Tone } from './tones';

	let {
		icon,
		title,
		tone = 'teal',
		note,
		actions,
		children
	}: {
		icon: string;
		title: string;
		tone?: Tone;
		note?: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="card border-base-300 bg-base-100 h-full border shadow-sm transition-colors hover:border-(--tone)" style={toneVars(tone)}>
	<div class="card-body gap-0 p-3.5 sm:p-4 lg:p-5">
		<div class="flex items-center gap-2.5 sm:gap-3">
			<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-(--tone-soft) text-base text-(--tone) sm:size-10 sm:text-lg">
				<i class="fas {icon}"></i>
			</span>
			<h2 class="card-title text-base-content min-w-0 grow text-sm font-bold tracking-tight sm:text-[0.95rem]">{title}</h2>
			{#if actions}{@render actions()}{/if}
		</div>

		{#if note}
			<p class="text-base-content/55 mt-2 text-xs leading-relaxed">{note}</p>
		{/if}

		<div class="mt-3 flex flex-col gap-3 sm:gap-3.5">
			{@render children()}
		</div>
	</div>
</section>
