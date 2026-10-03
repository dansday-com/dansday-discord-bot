<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		avatar,
		nameColor = null,
		app = false,
		time = 'Today at 21:04',
		continued = false,
		children,
		aside
	}: {
		name: string;
		avatar: string;
		nameColor?: string | null;
		app?: boolean;
		time?: string;
		continued?: boolean;
		children: Snippet;
		aside?: Snippet;
	} = $props();
</script>

<div class="relative flex gap-4 px-4 {continued ? 'py-0.5' : 'mt-3 pt-0.5 pb-0.5'}">
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
				<span class="text-ash-300 text-[12px]">{time}</span>
			</p>
		{/if}
		<div class="text-ash-100 text-[14.5px] leading-[1.375] break-words">{@render children()}</div>
	</div>
	{@render aside?.()}
</div>

<style>
	.scene-name {
		transition: color 600ms ease;
	}
</style>
