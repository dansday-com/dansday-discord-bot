<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		avatar,
		nameColor = null,
		app = false,
		time = 'Today at 21:04',
		continued = false,
		ephemeral = false,
		reply = null,
		used = null,
		children,
		aside
	}: {
		name: string;
		avatar: string;
		nameColor?: string | null;
		app?: boolean;
		time?: string;
		continued?: boolean;
		ephemeral?: boolean;
		reply?: { name: string; avatar: string; text: string } | null;
		used?: { name: string; avatar: string; command: string } | null;
		children: Snippet;
		aside?: Snippet;
	} = $props();
</script>

{#if reply && !continued}
	<div class="text-ash-200 relative mt-3 flex min-w-0 items-center gap-1 pr-4 pl-[72px] text-[12.5px]">
		<span class="border-ash-500 absolute top-1/2 left-9 h-2.5 w-7 rounded-tl-md border-t-2 border-l-2"></span>
		<img src={reply.avatar} alt="" class="size-4 shrink-0 rounded-full" loading="lazy" />
		<span class="text-ash-100 shrink-0 font-medium">@{reply.name}</span>
		<span class="truncate">{reply.text}</span>
	</div>
{:else if used && !continued}
	<div class="text-ash-200 relative mt-3 flex min-w-0 items-center gap-1 pr-4 pl-[72px] text-[12.5px]">
		<span class="border-ash-500 absolute top-1/2 left-9 h-2.5 w-7 rounded-tl-md border-t-2 border-l-2"></span>
		<img src={used.avatar} alt="" class="size-4 shrink-0 rounded-full" loading="lazy" />
		<span class="text-ash-100 shrink-0 font-medium">{used.name}</span>
		<span class="shrink-0">used</span>
		<span class="truncate text-[#00a8fc]">{used.command}</span>
	</div>
{/if}
<div class="relative flex gap-4 px-4 {continued ? 'py-0.5' : reply || used ? 'pt-0.5 pb-0.5' : 'mt-3 pt-0.5 pb-0.5'}">
	{#if continued}
		<span class="w-10 shrink-0"></span>
	{:else}
		<img src={avatar} alt="" class="bg-ash-800 mt-0.5 size-10 shrink-0 rounded-full" loading="lazy" />
	{/if}
	<div class="min-w-0 flex-1">
		{#if !continued}
			<p class="flex items-center gap-1.5 leading-[1.375]">
				<span class="scene-name text-[15px] font-medium" style="color: {nameColor ?? '#f2f3f5'}">{name}</span>
				{#if app}
					<span class="rounded-[3px] bg-[#5865f2] px-1 text-[10px] leading-[15px] font-semibold text-white">APP</span>
				{/if}
				<span class="text-ash-200 text-[12px]">{time}</span>
			</p>
		{/if}
		<div class="text-ash-100 text-[14.5px] leading-[1.375] break-words">{@render children()}</div>
		{#if ephemeral}
			<p class="text-ash-200 mt-1 text-[12px]">
				<i class="fas fa-eye mr-1 text-[11px]"></i>Only you can see this · <span class="text-[#00a8fc]">Dismiss message</span>
			</p>
		{/if}
	</div>
	{@render aside?.()}
</div>

<style>
	.scene-name {
		transition: color 600ms ease;
	}
</style>
