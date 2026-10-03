<script lang="ts">
	import type { Snippet } from 'svelte';

	type Field = { name: string; value?: string; inline?: boolean; role?: { name: string; color: string } };
	type Button = { label: string; link?: boolean };

	let {
		color,
		title,
		thumbnail = null,
		fields = [],
		footer = null,
		buttons = [],
		description
	}: {
		color: string;
		title: string;
		thumbnail?: string | null;
		fields?: Field[];
		footer?: string | null;
		buttons?: Button[];
		description?: Snippet;
	} = $props();

	function bold(text: string) {
		return text.split('**').map((part, i) => ({ part, strong: i % 2 === 1 }));
	}
</script>

<div class="bg-ash-800 mt-1 max-w-[440px] rounded border-l-4" style="border-left-color: {color}">
	<div class="flex gap-3 py-2.5 pr-3 pl-3">
		<div class="min-w-0 flex-1">
			<p class="text-ash-50 text-[15px] font-semibold">{title}</p>
			{#if description}
				<p class="text-ash-100 mt-1 text-[13.5px] leading-[1.375]">{@render description()}</p>
			{/if}
			{#if fields.length > 0}
				<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
					{#each fields as field (field.name)}
						<div class={field.inline ? 'min-w-0' : 'col-span-full'}>
							<p class="text-ash-50 text-[13px] leading-[1.375] font-semibold">{field.name}</p>
							<p class="text-ash-100 text-[13px] leading-[1.375] whitespace-pre-line">
								{#each bold(field.value ?? '') as seg, i (i)}{#if seg.strong}<strong class="font-semibold">{seg.part}</strong
										>{:else}{seg.part}{/if}{/each}{#if field.role}<span
										class="rounded-[3px] px-0.5 font-medium"
										style="color: {field.role.color}; background: color-mix(in srgb, {field.role.color} 12%, transparent);">@{field.role.name}</span
									>{/if}
							</p>
						</div>
					{/each}
				</div>
			{/if}
			{#if footer}
				<p class="text-ash-200 mt-2 text-[11.5px]">{footer}</p>
			{/if}
		</div>
		{#if thumbnail}
			<img src={thumbnail} alt="" class="size-12 shrink-0 rounded sm:size-14" loading="lazy" />
		{/if}
	</div>
</div>

{#if buttons.length > 0}
	<div class="mt-1.5 flex flex-wrap gap-2">
		{#each buttons as button (button.label)}
			<span class="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-[#4e5058] px-4 text-[13px] font-medium text-white">
				{button.label}
				{#if button.link}<i class="fas fa-arrow-up-right-from-square text-[10px] opacity-80"></i>{/if}
			</span>
		{/each}
	</div>
{/if}
