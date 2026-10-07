<script lang="ts">
	import { parseMessageEmoji } from '$lib/messages.js';
	import EmojiPicker from './EmojiPicker.svelte';
	import { clickOutside } from './editorContext.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { value = $bindable(''), label = 'Emoji' }: { value: string; label?: string } = $props();

	let open = $state(false);

	const parsed = $derived(parseMessageEmoji(value));
	const invalid = $derived(value.trim() !== '' && !parsed);
</script>

<div class="relative min-w-0" use:clickOutside={() => (open = false)}>
	<span class="{LABEL} mb-1 block">{label}</span>
	<div class="flex items-center gap-2">
		<button
			type="button"
			aria-label="Pick an emoji"
			aria-expanded={open}
			onclick={() => (open = !open)}
			class="bg-ash-700 border-ash-600 hover:border-ash-500 grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border text-lg transition-colors"
		>
			{#if parsed?.id}
				<img src="https://cdn.discordapp.com/emojis/{parsed.id}.{parsed.animated ? 'gif' : 'webp'}?size=48" alt="" class="size-5 object-contain" />
			{:else if parsed}
				{parsed.name}
			{:else}
				<i class="fas fa-face-smile text-ash-400 text-sm"></i>
			{/if}
		</button>
		<button type="button" class="{GHOST_BUTTON} py-2" onclick={() => (open = !open)}>{value ? 'Change' : 'Pick an emoji'}</button>
		{#if value}
			<button type="button" class={ICON_BUTTON} aria-label="Remove emoji" onclick={() => (value = '')}><i class="fas fa-xmark"></i></button>
		{/if}
	</div>
	{#if invalid}
		<p class="mt-1 text-[11px] text-red-400">"{value}" is not an emoji. Pick one from the list.</p>
	{/if}
	{#if open}
		<div class="absolute left-0 z-30 mt-1">
			<EmojiPicker
				onpick={(next) => {
					value = next;
					open = false;
				}}
			/>
		</div>
	{/if}
</div>
