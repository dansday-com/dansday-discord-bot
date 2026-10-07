<script lang="ts">
	import { MESSAGE_BUTTON_STYLES, MESSAGE_LIMITS, type MessageButton } from '$lib/messages.js';
	import ActionsEditor from './ActionsEditor.svelte';
	import EmojiField from './EmojiField.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import { FIELD, LABEL } from './styles.js';

	let { button = $bindable() }: { button: MessageButton } = $props();

	const SWATCH: Record<string, string> = {
		secondary: 'bg-[#4e5058]',
		primary: 'bg-[#5865f2]',
		success: 'bg-[#248046]',
		danger: 'bg-[#da373c]',
		link: 'bg-[#4e5058]'
	};

	const hint = $derived(MESSAGE_BUTTON_STYLES.find((style) => style.id === button.style)?.hint ?? '');
</script>

<div class="flex flex-col gap-3">
	<div>
		<span class="{LABEL} mb-1.5 block">Color</span>
		<div class="flex flex-wrap gap-1.5">
			{#each MESSAGE_BUTTON_STYLES as style (style.id)}
				<button
					type="button"
					title={style.hint}
					aria-pressed={button.style === style.id}
					onclick={() => (button.style = style.id)}
					class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors {button.style === style.id
						? 'border-ash-300 bg-ash-600 text-ash-100'
						: 'border-ash-600 text-ash-300 hover:border-ash-500'}"
				>
					<span class="size-3 rounded-sm {SWATCH[style.id]}"></span>{style.label}
					{#if style.id === 'link'}<i class="fas fa-arrow-up-right-from-square text-[9px]"></i>{/if}
				</button>
			{/each}
		</div>
		<p class="text-ash-500 mt-1 text-[11px]">{hint}</p>
	</div>

	<LocalizedField bind:value={button.label} label="Label" max={MESSAGE_LIMITS.label} placeholder="Rules" />
	<EmojiField bind:value={button.emoji} />

	{#if button.style === 'link'}
		<div>
			<span class="{LABEL} mb-1 block">Link</span>
			<input type="url" bind:value={button.url} maxlength={MESSAGE_LIMITS.url} placeholder="https://" aria-label="Link" class={FIELD} />
		</div>
	{:else}
		<ActionsEditor bind:actions={button.actions} />
	{/if}
</div>
