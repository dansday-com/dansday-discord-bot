<script lang="ts">
	import Rich from './Rich.svelte';
	import type { SceneButton, SceneEmbed } from './types.js';

	let { embed, roles = {}, t = 0 }: { embed: SceneEmbed; roles?: Record<string, string>; t?: number } = $props();

	const TONES: Record<NonNullable<SceneButton['tone']>, string> = {
		grey: '#4e5058',
		blurple: '#5865f2',
		green: '#248046',
		red: '#da373c'
	};

	const pressed = (b: SceneButton) => b.pressAt !== undefined && t >= b.pressAt && t < b.pressAt + 220;
</script>

<div class="bg-ash-800 mt-1 max-w-110 rounded border-l-4" style="border-left-color: {embed.color}">
	<div class="flex gap-3 py-2.5 pr-3 pl-3">
		<div class="min-w-0 flex-1">
			{#if embed.author}
				<p class="text-ash-50 mb-1 text-[12.5px] font-semibold">{embed.author}</p>
			{/if}
			{#if embed.title}
				<p class="text-ash-50 text-[15px] font-semibold"><Rich text={embed.title} {roles} /></p>
			{/if}
			{#if embed.description}
				<p class="text-ash-100 mt-1 text-[13.5px] leading-[1.375] whitespace-pre-line"><Rich text={embed.description} {roles} /></p>
			{/if}
			{#if embed.fields?.length}
				<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
					{#each embed.fields as field (field.name)}
						<div class={field.inline ? 'min-w-0' : 'col-span-full'}>
							<p class="text-ash-50 text-[13px] leading-[1.375] font-semibold">{field.name}</p>
							<p class="text-ash-100 text-[13px] leading-[1.375] whitespace-pre-line"><Rich text={field.value} {roles} /></p>
						</div>
					{/each}
				</div>
			{/if}
			{#if embed.image}
				<div class="relative mt-3 grid aspect-video w-full max-w-75 place-items-center overflow-hidden rounded" style="background: {embed.image.background}">
					{#if embed.image.icon}<i class="fas {embed.image.icon} text-[34px] text-white/85"></i>{/if}
					{#if embed.image.badge}
						<span class="absolute top-2 left-2 rounded-[3px] bg-[#e91916] px-1.5 text-[11px] leading-[18px] font-bold text-white">{embed.image.badge}</span>
					{/if}
				</div>
			{/if}
			{#if embed.footer}
				<p class="text-ash-200 mt-2 text-[11.5px]">{embed.footer}</p>
			{/if}
		</div>
		{#if embed.thumbnail}
			<img src={embed.thumbnail} alt="" class="size-12 shrink-0 rounded object-cover sm:size-14" loading="lazy" />
		{:else if embed.thumbnailArt}
			<span class="grid size-12 shrink-0 place-items-center rounded sm:size-14" style="background: {embed.thumbnailArt.background}">
				{#if embed.thumbnailArt.icon}<i class="fas {embed.thumbnailArt.icon} text-[22px] text-white/90"></i>{/if}
			</span>
		{/if}
	</div>
</div>

{#if embed.buttons?.length}
	<div class="mt-1.5 flex flex-wrap gap-2">
		{#each embed.buttons as button (button.label)}
			<span
				class="scene-button inline-flex h-8 items-center gap-1.5 rounded-[3px] px-4 text-[13px] font-medium text-white"
				class:scene-button-pressed={pressed(button)}
				style="background: {TONES[button.tone ?? 'grey']}"
			>
				{button.label}
				{#if button.link}<i class="fas fa-arrow-up-right-from-square text-[10px] opacity-80"></i>{/if}
			</span>
		{/each}
	</div>
{/if}

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
