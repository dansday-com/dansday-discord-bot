<script lang="ts">
	import Rich from './Rich.svelte';
	import type { SceneEmbed } from './types.js';

	let { embed }: { embed: SceneEmbed } = $props();
</script>

<div class="bg-ash-800 mt-1 max-w-110 rounded border-l-4" style="border-left-color: {embed.color}">
	<div class="flex gap-3 py-2.5 pr-3 pl-3">
		<div class="min-w-0 flex-1">
			{#if embed.title}
				<p class="text-ash-50 text-[15px] font-semibold"><Rich text={embed.title} /></p>
			{/if}
			{#if embed.description}
				<p class="text-ash-100 mt-1 text-[13.5px] leading-[1.375] whitespace-pre-line"><Rich text={embed.description} /></p>
			{/if}
			{#if embed.fields?.length}
				<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 @md:grid-cols-3">
					{#each embed.fields as field (field.name)}
						<div class={field.inline ? 'min-w-0' : 'col-span-full'}>
							<p class="text-ash-50 text-[13px] leading-[1.375] font-semibold">{field.name}</p>
							<p class="text-ash-100 text-[13px] leading-[1.375] whitespace-pre-line"><Rich text={field.value} /></p>
						</div>
					{/each}
				</div>
			{/if}
			{#if embed.footer}
				<p class="text-ash-200 mt-2 text-[11.5px]">{embed.footer}</p>
			{/if}
		</div>
		{#if embed.thumbnail}
			<img src={embed.thumbnail} alt="" class="size-12 shrink-0 rounded object-cover @md:size-14" loading="lazy" />
		{/if}
	</div>
</div>
