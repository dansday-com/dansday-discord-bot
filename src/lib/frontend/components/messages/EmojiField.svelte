<script lang="ts">
	import { parseMessageEmoji } from '$lib/messages.js';
	import { messageEditor } from './editorContext.js';
	import { FIELD, LABEL } from './styles.js';

	let { value = $bindable(''), label = 'Emoji' }: { value: string; label?: string } = $props();

	const editor = messageEditor();
	let open = $state(false);
	let search = $state('');

	const parsed = $derived(parseMessageEmoji(value));
	const invalid = $derived(value.trim() !== '' && !parsed);
	const matches = $derived(editor.emojis.filter((emoji) => emoji.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 120));

	function emojiUrl(id: string, animated = false) {
		return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48`;
	}
</script>

<div class="relative min-w-0">
	<span class="{LABEL} mb-1 block">{label}</span>
	<div class="flex items-center gap-2">
		<span class="bg-ash-700 border-ash-600 grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border text-base">
			{#if parsed?.id}
				<img src={emojiUrl(parsed.id, parsed.animated)} alt="" class="size-5 object-contain" />
			{:else if parsed}
				{parsed.name}
			{:else}
				<i class="fas fa-face-smile text-ash-500 text-sm"></i>
			{/if}
		</span>
		<input
			type="text"
			bind:value
			maxlength="64"
			placeholder="Paste an emoji"
			aria-label={label}
			class="{FIELD} min-w-0 flex-1 {invalid ? 'border-red-500/70' : ''}"
		/>
		{#if editor.emojis.length > 0}
			<button
				type="button"
				class="bg-ash-700 border-ash-600 hover:border-ash-500 text-ash-200 shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				Server emoji
			</button>
		{/if}
	</div>
	{#if invalid}
		<p class="mt-1 text-[11px] text-red-400">That is not an emoji. Paste one, or pick a server emoji.</p>
	{/if}
	{#if open}
		<div class="bg-ash-800 border-ash-600 absolute right-0 z-20 mt-1 w-72 max-w-full rounded-lg border p-2 shadow-xl">
			<input type="text" bind:value={search} placeholder="Search server emoji" aria-label="Search server emoji" class="{FIELD} mb-2" />
			<div class="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">
				{#each matches as emoji (emoji.id)}
					<button
						type="button"
						title=":{emoji.name}:"
						class="hover:bg-ash-600 grid aspect-square place-items-center rounded-md"
						onclick={() => {
							value = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
							open = false;
						}}
					>
						<img src={emojiUrl(emoji.id, emoji.animated)} alt=":{emoji.name}:" class="size-6 object-contain" loading="lazy" />
					</button>
				{:else}
					<p class="text-ash-500 col-span-8 py-3 text-center text-xs">No server emoji match that.</p>
				{/each}
			</div>
		</div>
	{/if}
</div>
