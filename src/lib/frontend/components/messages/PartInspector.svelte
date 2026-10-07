<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { MESSAGE_LIMITS, newMessagePartId, type MessageDoc } from '$lib/messages.js';
	import ButtonEditor from './ButtonEditor.svelte';
	import EmbedEditor from './EmbedEditor.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import MediaField from './MediaField.svelte';
	import SelectEditor from './SelectEditor.svelte';
	import { moveItem } from './editorContext.js';
	import { PART_LABELS, locatePart, removePart, type Selection } from './selection.js';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { doc = $bindable(), selection = $bindable(), nonce }: { doc: MessageDoc; selection: Selection; nonce: number } = $props();

	const SIDES = [
		{ id: 'thumbnail', label: 'Small image', icon: 'fa-image' },
		{ id: 'button', label: 'Button', icon: 'fa-hand-pointer' }
	] as const;

	const part = $derived(selection ? locatePart(doc, selection.id) : null);
	const meta = $derived(part ? PART_LABELS[part.kind] : null);
	const position = $derived(part && part.list.length > 1 ? ` ${part.index + 1} of ${part.list.length}` : '');

	$effect(() => {
		if (selection && selection.id !== 'text' && !part) selection = null;
	});

	function setColor(next: string) {
		if (part && (next === '' || /^#[0-9a-f]{6}$/i.test(next))) part.item.color = next.toLowerCase();
	}

	function remove() {
		if (part) removePart(part);
		selection = null;
	}
</script>

{#if part && meta}
	<div class="mb-3 flex items-center gap-1">
		<i class="fas {meta.icon} text-ash-400 text-xs"></i>
		<h3 class="text-ash-100 mr-auto truncate text-sm font-semibold">{meta.label}<span class="text-ash-500 font-normal">{position}</span></h3>
		<button
			type="button"
			class={ICON_BUTTON}
			aria-label={part.sideways ? 'Move left' : 'Move up'}
			title={part.sideways ? 'Move left' : 'Move up'}
			disabled={part.index === 0}
			onclick={() => moveItem(part.list, part.index, -1)}
		>
			<i class="fas {part.sideways ? 'fa-arrow-left' : 'fa-arrow-up'}"></i>
		</button>
		<button
			type="button"
			class={ICON_BUTTON}
			aria-label={part.sideways ? 'Move right' : 'Move down'}
			title={part.sideways ? 'Move right' : 'Move down'}
			disabled={part.index === part.list.length - 1}
			onclick={() => moveItem(part.list, part.index, 1)}
		>
			<i class="fas {part.sideways ? 'fa-arrow-right' : 'fa-arrow-down'}"></i>
		</button>
		<button type="button" class="{ICON_BUTTON} hover:text-red-300" aria-label="Remove {meta.label}" title="Remove" onclick={remove}>
			<i class="fas fa-trash"></i>
		</button>
		<button type="button" class={ICON_BUTTON} aria-label="Close" title="Close" onclick={() => (selection = null)}><i class="fas fa-xmark"></i></button>
	</div>

	{#key part.item.id}
		{#if part.kind === 'embed'}
			<EmbedEditor bind:embed={part.list[part.index]} focus={selection?.focus ?? ''} {nonce} />
		{:else if part.kind === 'button'}
			<ButtonEditor bind:button={part.list[part.index]} />
		{:else if part.kind === 'select'}
			<SelectEditor bind:select={part.list[part.index]} />
		{:else if part.kind === 'attachment'}
			<div class="flex flex-col gap-3">
				<MediaField bind:value={part.item.file} video link={false} />
				<ConfigToggleRow label="Hide behind a spoiler" description="Members click it to reveal the photo or video." bind:enabled={part.item.spoiler} />
			</div>
		{:else if part.kind === 'text'}
			<LocalizedField
				bind:value={part.item.text}
				label="Text"
				max={MESSAGE_LIMITS.blockText}
				multiline
				rows={7}
				placeholder="Markdown works here: # Heading, **bold**, -# small text, lists and [links](https://)."
			/>
		{:else if part.kind === 'section'}
			<div class="flex flex-col gap-3">
				<LocalizedField bind:value={part.item.text} label="Text on the left" max={MESSAGE_LIMITS.blockText} multiline rows={4} placeholder="Write something" />
				<div>
					<span class="{LABEL} mb-1.5 block">On the right</span>
					<div class="flex gap-1.5">
						{#each SIDES as side (side.id)}
							<button
								type="button"
								aria-pressed={part.item.accessory === side.id}
								onclick={() => (part.item.accessory = side.id)}
								class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors {part.item.accessory === side.id
									? 'border-ash-300 bg-ash-600 text-ash-100'
									: 'border-ash-600 text-ash-300 hover:border-ash-500'}"
							>
								<i class="fas {side.icon}"></i>{side.label}
							</button>
						{/each}
					</div>
				</div>
				{#if part.item.accessory === 'thumbnail'}
					<MediaField bind:value={part.item.image} label="Image" />
				{:else}
					<ButtonEditor bind:button={part.item.button} />
				{/if}
			</div>
		{:else if part.kind === 'gallery'}
			<div class="flex flex-col gap-2">
				{#each part.item.items as item, i (item.id)}
					<div class="bg-ash-700/50 border-ash-600 flex flex-col gap-2 rounded-lg border p-2.5">
						<MediaField bind:value={item.media} label="Image or video {i + 1}" video />
						<LocalizedField bind:value={item.caption} label="Description for screen readers" max={MESSAGE_LIMITS.caption} placeholder="Optional" />
						<div class="flex justify-end gap-1">
							<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(part.item.items, i, -1)}>
								<i class="fas fa-arrow-up"></i>
							</button>
							<button
								type="button"
								class={ICON_BUTTON}
								aria-label="Move down"
								disabled={i === part.item.items.length - 1}
								onclick={() => moveItem(part.item.items, i, 1)}
							>
								<i class="fas fa-arrow-down"></i>
							</button>
							<button type="button" class={ICON_BUTTON} aria-label="Remove item" onclick={() => part.item.items.splice(i, 1)}
								><i class="fas fa-trash"></i></button
							>
						</div>
					</div>
				{/each}
				{#if part.item.items.length < MESSAGE_LIMITS.galleryItems}
					<button type="button" class="{GHOST_BUTTON} self-start" onclick={() => part.item.items.push({ id: newMessagePartId(), media: '', caption: {} })}>
						<i class="fas fa-plus text-emerald-400"></i>Image or video
					</button>
				{/if}
			</div>
		{:else if part.kind === 'separator'}
			<div class="flex flex-col gap-3">
				<ConfigToggleRow label="Show a line" description="Off: only leaves a gap." bind:enabled={part.item.line} />
				<ConfigToggleRow label="Bigger gap" bind:enabled={part.item.large} />
			</div>
		{:else if part.kind === 'container'}
			<div class="flex flex-col gap-3">
				<div>
					<span class="{LABEL} mb-1 block">Edge color</span>
					<div class="flex items-center gap-2">
						<input
							type="color"
							value={part.item.color || '#202225'}
							oninput={(e) => setColor(e.currentTarget.value)}
							aria-label="Edge color"
							class="bg-ash-700 border-ash-600 h-9 w-10 cursor-pointer rounded border"
						/>
						<input
							type="text"
							value={part.item.color}
							oninput={(e) => setColor(e.currentTarget.value.trim())}
							maxlength="7"
							placeholder="None"
							aria-label="Edge color hex"
							class="{FIELD} w-28 font-mono"
						/>
					</div>
				</div>
				<p class="text-ash-400 text-xs">Use "Add inside this box" in the message to put text, images or buttons in it. Click any of them to edit it.</p>
			</div>
		{/if}
	{/key}
{/if}
