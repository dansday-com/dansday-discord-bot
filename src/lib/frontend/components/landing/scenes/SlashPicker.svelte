<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { BOT } from './scripts/common.js';
	import { tapping } from './clock.svelte.js';
	import Tap from './Tap.svelte';

	let {
		commands,
		draft,
		t,
		tapAt,
		still = false
	}: { commands: { name: string; desc: string }[]; draft: string; t: number; tapAt?: number; still?: boolean } = $props();
</script>

<div
	class="bg-ash-800 border-ash-950 overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
	transition:fly={{ y: 8, duration: still ? 0 : 200, easing: quintOut }}
>
	<p class="text-ash-200 flex items-center gap-2 px-3 pt-2.5 pb-1.5 text-[11.5px] font-bold tracking-[0.02em] uppercase">
		<img src={BOT.avatar} alt="" class="size-4 rounded-full" loading="lazy" />{BOT.name}
	</p>
	{#each commands as command (command.name)}
		<div class="relative mx-1.5 mb-1.5 rounded-md px-2.5 py-2 transition-colors duration-150 {draft === `/${command.name}` ? 'bg-ash-700' : ''}">
			<p class="text-ash-50 text-[14px] font-semibold">/{command.name}</p>
			<p class="text-ash-200 mt-0.5 line-clamp-2 text-[12.5px] leading-[1.35]">{command.desc}</p>
			{#if tapping(t, tapAt)}<Tap />{/if}
		</div>
	{/each}
</div>
