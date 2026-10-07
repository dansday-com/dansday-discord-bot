<script lang="ts">
	import { EMOJI_GROUPS } from './emojiData.js';
	import { messageEditor } from './editorContext.js';
	import { FIELD } from './styles.js';

	let { onpick }: { onpick: (value: string) => void } = $props();

	const editor = messageEditor();
	let search = $state('');
	let tab = $state(editor.emojis.length > 0 ? 'server' : EMOJI_GROUPS[0].id);

	const query = $derived(search.trim().toLowerCase());
	const serverMatches = $derived(query || tab === 'server' ? editor.emojis.filter((emoji) => emoji.name.toLowerCase().includes(query)).slice(0, 160) : []);
	const standardMatches = $derived(
		query
			? EMOJI_GROUPS.flatMap((group) => group.items).filter((item) => item.name.includes(query))
			: (EMOJI_GROUPS.find((group) => group.id === tab)?.items ?? [])
	);

	const TAB = 'grid size-8 shrink-0 place-items-center rounded-md text-base transition-colors';
	const CELL = 'hover:bg-ash-600 grid aspect-square place-items-center rounded-md text-xl leading-none';

	function emojiUrl(id: string, animated: boolean) {
		return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48`;
	}
</script>

<div class="bg-ash-800 border-ash-600 w-80 max-w-[calc(100vw-2rem)] rounded-xl border p-2 shadow-2xl">
	<input type="text" bind:value={search} placeholder="Search emoji" aria-label="Search emoji" class="{FIELD} mb-2" />
	{#if !query}
		<div class="mb-2 flex gap-0.5 overflow-x-auto">
			{#if editor.emojis.length > 0}
				<button
					type="button"
					title="This server"
					aria-pressed={tab === 'server'}
					class="{TAB} {tab === 'server' ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:bg-ash-700'}"
					onclick={() => (tab = 'server')}
				>
					<i class="fas fa-server text-xs"></i>
				</button>
			{/if}
			{#each EMOJI_GROUPS as group (group.id)}
				<button
					type="button"
					title={group.label}
					aria-pressed={tab === group.id}
					class="{TAB} {tab === group.id ? 'bg-ash-600' : 'hover:bg-ash-700 opacity-70'}"
					onclick={() => (tab = group.id)}
				>
					{group.icon}
				</button>
			{/each}
		</div>
	{/if}
	<div class="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
		{#each serverMatches as emoji (emoji.id)}
			<button type="button" title=":{emoji.name}:" class={CELL} onclick={() => onpick(`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`)}>
				<img src={emojiUrl(emoji.id, emoji.animated)} alt=":{emoji.name}:" class="size-6 object-contain" loading="lazy" />
			</button>
		{/each}
		{#each standardMatches as item (item.emoji)}
			<button type="button" title={item.name} class={CELL} onclick={() => onpick(item.emoji)}>{item.emoji}</button>
		{/each}
		{#if serverMatches.length === 0 && standardMatches.length === 0}
			<p class="text-ash-500 col-span-8 py-4 text-center text-xs">Nothing matches that. Try another word.</p>
		{/if}
	</div>
</div>
