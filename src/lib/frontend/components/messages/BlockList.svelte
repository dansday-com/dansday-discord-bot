<script lang="ts">
	import { MESSAGE_BLOCK_TYPES, newMessageBlock, type MessageBlock, type MessageBlockType } from '$lib/messages.js';
	import BlockEditor from './BlockEditor.svelte';
	import { moveItem } from './editorContext.js';
	import { GHOST_BUTTON } from './styles.js';

	let {
		blocks = $bindable(),
		max,
		nested = false,
		color = ''
	}: {
		blocks: MessageBlock[];
		max: number;
		nested?: boolean;
		color?: string;
	} = $props();

	const types = $derived(MESSAGE_BLOCK_TYPES.filter((type) => !nested || type.id !== 'container'));

	function add(type: MessageBlockType) {
		blocks.push(newMessageBlock(type, color));
	}
</script>

<div class="flex flex-col gap-2">
	{#each blocks as block, i (block.id)}
		<BlockEditor
			bind:block={blocks[i]}
			{color}
			first={i === 0}
			last={i === blocks.length - 1}
			onmove={(delta) => moveItem(blocks, i, delta)}
			onremove={() => blocks.splice(i, 1)}
		/>
	{:else}
		<p class="bg-ash-700/40 border-ash-600 text-ash-400 rounded-lg border border-dashed p-4 text-center text-sm">
			{nested ? 'This container is empty. Add a block inside it.' : 'Nothing here yet. Add your first block.'}
		</p>
	{/each}
</div>

{#if blocks.length < max}
	<div class="mt-3 flex flex-wrap gap-1.5">
		{#each types as type (type.id)}
			<button type="button" class={GHOST_BUTTON} title={type.hint} onclick={() => add(type.id)}>
				<i class="fas {type.icon} text-emerald-400"></i>{type.label}
			</button>
		{/each}
	</div>
{/if}
