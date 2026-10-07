<script lang="ts">
	import { tick } from 'svelte';
	import { parseMessageEmoji } from '$lib/messages.js';
	import EmojiPicker from './EmojiPicker.svelte';
	import { clickOutside } from './editorContext.js';
	import { ICON_BUTTON, LABEL } from './styles.js';

	let { value = $bindable(''), label = 'Emoji' }: { value: string; label?: string } = $props();

	let open = $state(false);
	let list = $state<HTMLDivElement>();

	const parsed = $derived(parseMessageEmoji(value));
	const invalid = $derived(value.trim() !== '' && !parsed);

	async function toggle() {
		open = !open;
		if (!open) return;
		await tick();
		list?.scrollIntoView({ block: 'nearest' });
	}
</script>

<div class="min-w-0" use:clickOutside={() => (open = false)}>
	<span class="{LABEL} mb-1 block">{label}</span>
	<div class="flex items-center gap-2">
		<button
			type="button"
			aria-expanded={open}
			onclick={toggle}
			class="bg-ash-700 border-ash-600 hover:border-ash-500 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
		>
			{#if parsed?.id}
				<img src="https://cdn.discordapp.com/emojis/{parsed.id}.{parsed.animated ? 'gif' : 'webp'}?size=48" alt="" class="size-5 shrink-0 object-contain" />
				<span class="text-ash-100 truncate">Change emoji</span>
			{:else if parsed}
				<span class="shrink-0 text-lg leading-none">{parsed.name}</span>
				<span class="text-ash-100 truncate">Change emoji</span>
			{:else}
				<i class="fas fa-face-smile text-ash-400 shrink-0"></i>
				<span class="text-ash-400 truncate">Add an emoji</span>
			{/if}
			<i class="fas fa-chevron-down text-ash-400 ml-auto text-[10px] transition-transform {open ? 'rotate-180' : ''}"></i>
		</button>
		{#if value}
			<button type="button" class={ICON_BUTTON} aria-label="Remove emoji" title="Remove emoji" onclick={() => (value = '')}><i class="fas fa-xmark"></i></button
			>
		{/if}
	</div>
	{#if invalid}
		<p class="mt-1 text-[11px] text-red-400">"{value}" is not an emoji. Pick one from the list.</p>
	{/if}
	{#if open}
		<div class="mt-2" bind:this={list}>
			<EmojiPicker
				onpick={(next) => {
					value = next;
					open = false;
				}}
			/>
		</div>
	{/if}
</div>
