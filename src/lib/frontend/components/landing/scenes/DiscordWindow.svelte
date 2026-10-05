<script lang="ts">
	import type { Snippet } from 'svelte';
	import Draft from './Draft.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	let {
		server,
		channel,
		draft = '',
		typing = null,
		fade = 1,
		children,
		picker,
		overlay
	}: {
		server: string;
		channel: string;
		draft?: string;
		typing?: string | null;
		fade?: number;
		children: Snippet;
		picker?: Snippet;
		overlay?: Snippet;
	} = $props();
</script>

<div class="bg-ash-900 border-ash-950 relative flex overflow-hidden rounded-xl border shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]" aria-hidden="true">
	<div class="bg-ash-950 hidden w-[60px] shrink-0 flex-col items-center gap-2 py-3 sm:flex">
		<span class="relative">
			<span class="absolute top-1/2 -left-2.5 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white"></span>
			<span class="bg-primary text-primary-content grid size-10 place-items-center rounded-2xl text-[14px] font-bold">{server.slice(0, 1)}</span>
		</span>
		<span class="bg-ash-700 my-0.5 h-0.5 w-8 rounded-full"></span>
		{#each ['G', 'A', 'M'] as letter (letter)}
			<span class="bg-ash-800 text-ash-200 grid size-10 place-items-center rounded-full text-[13px] font-semibold">{letter}</span>
		{/each}
	</div>

	<div class="flex min-w-0 flex-1 flex-col">
		<div class="border-ash-950 flex h-11 shrink-0 items-center gap-2 border-b px-4">
			<i class="fas fa-hashtag text-ash-200 text-[15px]"></i>
			<span class="text-ash-50 text-[14.5px] font-semibold">{channel}</span>
			<span class="text-ash-200 ml-auto hidden truncate text-[12px] sm:block">{server}</span>
		</div>

		<div class="scene-feed @container flex h-[360px] flex-col justify-end overflow-hidden pb-1 sm:h-[400px]" style="opacity: {fade}">
			{@render children()}
		</div>

		<div class="text-ash-200 flex h-6 shrink-0 items-center gap-1.5 px-4 text-[11.5px]">
			<TypingIndicator who={typing} />
		</div>

		<div class="relative shrink-0 px-4 pb-4">
			<div class="absolute inset-x-4 bottom-full z-20 pb-2">{@render picker?.()}</div>
			<div class="bg-ash-700 flex h-11 items-center gap-3 rounded-lg px-4 text-[14px]">
				<i class="fas fa-circle-plus text-ash-200 text-[17px]"></i>
				<Draft {draft} {channel} />
			</div>
		</div>
	</div>
	{@render overlay?.()}
</div>

<style>
	.scene-feed {
		-webkit-mask-image: linear-gradient(to bottom, transparent, #000 40px);
		mask-image: linear-gradient(to bottom, transparent, #000 40px);
	}
</style>
