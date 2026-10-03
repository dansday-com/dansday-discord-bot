<script lang="ts">
	import type { Snippet } from 'svelte';
	import Draft from './Draft.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	let {
		channel,
		draft = '',
		typing = null,
		fade = 1,
		children
	}: { channel: string; draft?: string; typing?: string | null; fade?: number; children: Snippet } = $props();
</script>

<div class="border-ash-950 flex h-12 shrink-0 items-center gap-3 border-b px-4">
	<i class="fas fa-chevron-left text-ash-200 text-[15px]"></i>
	<span class="text-ash-50 flex min-w-0 items-center gap-1.5 text-[16px] font-bold">
		<i class="fas fa-hashtag text-ash-300 text-[14px]"></i><span class="truncate">{channel}</span>
	</span>
	<span class="text-ash-200 ml-auto flex items-center gap-4 text-[15px]"><i class="fas fa-magnifying-glass"></i><i class="fas fa-user-group"></i></span>
</div>

<div class="scene-feed @container flex min-h-0 flex-1 flex-col justify-end overflow-hidden pb-1" style="opacity: {fade}">
	{@render children()}
</div>

<div class="text-ash-200 flex h-6 shrink-0 items-center gap-1.5 px-4 text-[11.5px]">
	<TypingIndicator who={typing} />
</div>

<div class="flex shrink-0 items-center gap-2 px-3 pb-1">
	<span class="bg-ash-700 text-ash-200 grid size-9 shrink-0 place-items-center rounded-full"><i class="fas fa-plus"></i></span>
	<span class="bg-ash-700 text-ash-200 grid size-9 shrink-0 place-items-center rounded-full"><i class="fas fa-gift"></i></span>
	<div class="bg-ash-700 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-[14px]">
		<Draft {draft} {channel} />
		<i class="fas fa-face-smile text-ash-300 ml-auto shrink-0"></i>
	</div>
	<span class="bg-ash-700 text-ash-200 grid size-9 shrink-0 place-items-center rounded-full"><i class="fas fa-microphone"></i></span>
</div>

<style>
	.scene-feed {
		-webkit-mask-image: linear-gradient(to bottom, transparent, #000 40px);
		mask-image: linear-gradient(to bottom, transparent, #000 40px);
	}
</style>
