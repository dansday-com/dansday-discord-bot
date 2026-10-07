<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { MESSAGE_BLOCK_TYPES, MESSAGE_LIMITS, newMessagePartId, type ContainerBlock, type InnerBlock, type MessageBlock } from '$lib/messages.js';
	import BlockList from './BlockList.svelte';
	import ButtonEditor from './ButtonEditor.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import MediaField from './MediaField.svelte';
	import RowEditor from './RowEditor.svelte';
	import { moveItem } from './editorContext.js';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let {
		block = $bindable(),
		color = '',
		first,
		last,
		onmove,
		onremove
	}: {
		block: MessageBlock;
		color?: string;
		first: boolean;
		last: boolean;
		onmove: (delta: number) => void;
		onremove: () => void;
	} = $props();

	const SIDES = [
		{ id: 'thumbnail', label: 'Small image', icon: 'fa-image' },
		{ id: 'button', label: 'Button', icon: 'fa-hand-pointer' }
	] as const;

	const meta = $derived(MESSAGE_BLOCK_TYPES.find((type) => type.id === block.type)!);
	const inside = {
		get: () => (block as ContainerBlock).blocks as MessageBlock[],
		set: (next: MessageBlock[]) => {
			(block as ContainerBlock).blocks = next as InnerBlock[];
		}
	};

	function setColor(next: string) {
		if (block.type === 'container' && (next === '' || /^#[0-9a-f]{6}$/i.test(next))) block.color = next.toLowerCase();
	}
</script>

<div class="border-ash-600 rounded-lg border {block.type === 'container' ? 'bg-ash-900/40' : 'bg-ash-700/40'}">
	<div class="flex items-center gap-1 px-2.5 py-1.5">
		<i class="fas {meta.icon} text-ash-400 text-xs"></i>
		<span class="text-ash-200 mr-auto text-xs font-semibold">{meta.label}</span>
		<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={first} onclick={() => onmove(-1)}><i class="fas fa-arrow-up"></i></button>
		<button type="button" class={ICON_BUTTON} aria-label="Move down" disabled={last} onclick={() => onmove(1)}><i class="fas fa-arrow-down"></i></button>
		<button type="button" class={ICON_BUTTON} aria-label="Remove {meta.label}" onclick={onremove}><i class="fas fa-trash"></i></button>
	</div>

	<div class="border-ash-600 border-t p-2.5">
		{#if block.type === 'container'}
			<div class="mb-3 flex items-center gap-2">
				<span class={LABEL}>Edge color</span>
				<input
					type="color"
					value={block.color || '#202225'}
					oninput={(e) => setColor(e.currentTarget.value)}
					aria-label="Edge color"
					class="bg-ash-700 border-ash-600 h-8 w-9 cursor-pointer rounded border"
				/>
				<input
					type="text"
					value={block.color}
					oninput={(e) => setColor(e.currentTarget.value.trim())}
					maxlength="7"
					placeholder="None"
					aria-label="Edge color hex"
					class="{FIELD} w-28 font-mono"
				/>
			</div>
			<BlockList bind:blocks={inside.get, inside.set} max={MESSAGE_LIMITS.innerBlocks} nested {color} />
		{:else if block.type === 'text'}
			<LocalizedField
				bind:value={block.text}
				label="Text"
				max={MESSAGE_LIMITS.blockText}
				multiline
				rows={4}
				placeholder="Markdown works here: # Heading, **bold**, -# small text, lists and [links](https://)."
			/>
		{:else if block.type === 'section'}
			{@const section = block}
			<div class="flex flex-col gap-3">
				<LocalizedField bind:value={section.text} label="Text" max={MESSAGE_LIMITS.blockText} multiline rows={3} placeholder="Text on the left" />
				<div>
					<span class="{LABEL} mb-1.5 block">On the right</span>
					<div class="flex gap-1.5">
						{#each SIDES as side (side.id)}
							<button
								type="button"
								aria-pressed={section.accessory === side.id}
								onclick={() => (section.accessory = side.id)}
								class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors {section.accessory === side.id
									? 'border-ash-300 bg-ash-600 text-ash-100'
									: 'border-ash-600 text-ash-300 hover:border-ash-500'}"
							>
								<i class="fas {side.icon}"></i>{side.label}
							</button>
						{/each}
					</div>
				</div>
				{#if section.accessory === 'thumbnail'}
					<MediaField bind:value={section.image} label="Image" />
				{:else}
					<ButtonEditor bind:button={section.button} />
				{/if}
			</div>
		{:else if block.type === 'gallery'}
			{@const gallery = block}
			<div class="flex flex-col gap-2">
				{#each gallery.items as item, i (item.id)}
					<div class="bg-ash-800 border-ash-600 flex flex-col gap-2 rounded-lg border p-2.5">
						<MediaField bind:value={item.media} label="Image or video {i + 1}" video />
						<LocalizedField bind:value={item.caption} label="Description for screen readers" max={MESSAGE_LIMITS.caption} placeholder="Optional" />
						<div class="flex justify-end gap-1">
							<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(gallery.items, i, -1)}>
								<i class="fas fa-arrow-up"></i>
							</button>
							<button
								type="button"
								class={ICON_BUTTON}
								aria-label="Move down"
								disabled={i === gallery.items.length - 1}
								onclick={() => moveItem(gallery.items, i, 1)}
							>
								<i class="fas fa-arrow-down"></i>
							</button>
							<button type="button" class={ICON_BUTTON} aria-label="Remove item" onclick={() => gallery.items.splice(i, 1)}><i class="fas fa-trash"></i></button
							>
						</div>
					</div>
				{/each}
				{#if gallery.items.length < MESSAGE_LIMITS.galleryItems}
					<button type="button" class="{GHOST_BUTTON} self-start" onclick={() => gallery.items.push({ id: newMessagePartId(), media: '', caption: {} })}>
						<i class="fas fa-plus text-emerald-400"></i>Image or video
					</button>
				{/if}
			</div>
		{:else if block.type === 'separator'}
			<div class="flex flex-col gap-3">
				<ConfigToggleRow label="Show a line" description="Off: only leaves a gap." bind:enabled={block.line} />
				<ConfigToggleRow label="Bigger gap" bind:enabled={block.large} />
			</div>
		{:else}
			<RowEditor bind:row={block} />
		{/if}
	</div>
</div>
