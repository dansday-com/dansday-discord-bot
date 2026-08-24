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

<section class="card border-base-300 bg-base-100 border shadow-sm transition-colors hover:border-[var(--tone)]" style={toneVars(tone)}>
	<div class="card-body gap-0 p-4 sm:p-5">
		<div class="flex items-center gap-3">
			<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--tone-soft)] text-lg text-[var(--tone)]">
				<i class="fas {icon}"></i>
			</span>
			<h2 class="card-title text-base-content grow text-[0.95rem] font-bold tracking-tight">{title}</h2>
			{#if actions}{@render actions()}{/if}
		</div>

		{#if note}
			<p class="text-base-content/55 mt-2 text-xs leading-relaxed">{note}</p>
		{/if}

		<div class="mt-3.5 flex flex-col gap-3.5">
			{@render children()}
		</div>
	</div>
</section>
