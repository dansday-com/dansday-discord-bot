<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { MESSAGE_LIMITS, newMessagePartId, type MessageEmbed } from '$lib/messages.js';
	import LocalizedField from './LocalizedField.svelte';
	import MediaField from './MediaField.svelte';
	import { messageEditor, moveItem } from './editorContext.js';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { embed = $bindable(), focus = '', nonce = 0 }: { embed: MessageEmbed; focus?: string; nonce?: number } = $props();

	const editor = messageEditor();
	let root = $state<HTMLDivElement>();

	const GROUP = 'border-ash-700 border-t pt-3';
	const SUMMARY = 'text-ash-200 flex cursor-pointer items-center gap-2 text-xs font-semibold select-none';

	$effect(() => {
		nonce;
		const target = focus ? root?.querySelector<HTMLElement>(`[data-part="${focus}"]`) : null;
		if (!target) return;
		const group = target.closest('details');
		if (group) group.open = true;
		target.querySelector<HTMLElement>('input:not([type="file"]):not([type="color"]), textarea')?.focus({ preventScroll: true });
		target.scrollIntoView({ block: 'nearest' });
	});

	function setColor(next: string) {
		if (next === '' || /^#[0-9a-f]{6}$/i.test(next)) embed.color = next.toLowerCase();
	}
</script>

<div class="flex flex-col gap-3" bind:this={root}>
	<div data-part="title">
		<LocalizedField bind:value={embed.title} label="Title" max={MESSAGE_LIMITS.title} placeholder="Server rules" />
	</div>
	<div data-part="description">
		<LocalizedField
			bind:value={embed.description}
			label="Description"
			max={MESSAGE_LIMITS.description}
			multiline
			quiet
			rows={5}
			placeholder="Markdown works here: **bold**, *italic*, [links](https://), lists and # headings."
		/>
	</div>

	<div class="flex flex-wrap items-end gap-3">
		<div>
			<span class="{LABEL} mb-1 block">Color bar</span>
			<div class="flex items-center gap-2">
				<input
					type="color"
					value={embed.color || '#202225'}
					oninput={(e) => setColor(e.currentTarget.value)}
					aria-label="Color"
					class="bg-ash-700 border-ash-600 h-9 w-10 cursor-pointer rounded border"
				/>
				<input
					type="text"
					value={embed.color}
					oninput={(e) => setColor(e.currentTarget.value.trim())}
					maxlength="7"
					placeholder="None"
					aria-label="Color hex"
					class="{FIELD} w-28 font-mono"
				/>
			</div>
		</div>
		<div class="min-w-0 flex-1 basis-40">
			<span class="{LABEL} mb-1 block">Title link</span>
			<input type="url" bind:value={embed.url} maxlength={MESSAGE_LIMITS.url} placeholder="https:// (optional)" aria-label="Title link" class={FIELD} />
		</div>
	</div>
	{#if editor.colorNote}
		<p class="text-ash-500 -mt-1 text-[11px]">{editor.colorNote}</p>
	{/if}

	<details class={GROUP} open={!!embed.image || !!embed.thumbnail}>
		<summary class={SUMMARY}><i class="fas fa-image text-sky-300"></i>Images</summary>
		<div class="mt-3 flex flex-col gap-3">
			<div data-part="image"><MediaField bind:value={embed.image} label="Large image, under the text" /></div>
			<div data-part="thumbnail"><MediaField bind:value={embed.thumbnail} label="Small image, top right" /></div>
		</div>
	</details>

	<details class={GROUP} open={embed.fields.length > 0} data-part="fields">
		<summary class={SUMMARY}
			><i class="fas fa-table-cells text-violet-300"></i>Fields <span class="text-ash-500 font-normal">{embed.fields.length}</span></summary
		>
		<div class="mt-3 flex flex-col gap-2">
			{#each embed.fields as field, i (field.id)}
				<div class="bg-ash-700/50 border-ash-600 flex flex-col gap-2 rounded-lg border p-2.5">
					<LocalizedField bind:value={field.name} label="Name" max={MESSAGE_LIMITS.fieldName} placeholder="Field name" />
					<LocalizedField bind:value={field.value} label="Value" max={MESSAGE_LIMITS.fieldValue} multiline quiet rows={2} placeholder="Field text" />
					<div class="flex items-center gap-1">
						<label class="text-ash-300 mr-auto flex cursor-pointer items-center gap-2 text-xs">
							<input type="checkbox" bind:checked={field.inline} class="accent-ash-300 size-3.5" />Side by side with other fields
						</label>
						<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(embed.fields, i, -1)}>
							<i class="fas fa-arrow-up"></i>
						</button>
						<button
							type="button"
							class={ICON_BUTTON}
							aria-label="Move down"
							disabled={i === embed.fields.length - 1}
							onclick={() => moveItem(embed.fields, i, 1)}
						>
							<i class="fas fa-arrow-down"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Remove field" onclick={() => embed.fields.splice(i, 1)}><i class="fas fa-trash"></i></button>
					</div>
				</div>
			{/each}
			{#if embed.fields.length < MESSAGE_LIMITS.fields}
				<button
					type="button"
					class="{GHOST_BUTTON} self-start"
					onclick={() => embed.fields.push({ id: newMessagePartId(), name: {}, value: {}, inline: false })}
				>
					<i class="fas fa-plus text-emerald-400"></i>Field
				</button>
			{/if}
		</div>
	</details>

	<details class={GROUP} open={Object.keys(embed.author).length > 0} data-part="author">
		<summary class={SUMMARY}><i class="fas fa-user text-amber-300"></i>Small line above the title</summary>
		<div class="mt-3 flex flex-col gap-3">
			<LocalizedField bind:value={embed.author} label="Text" max={MESSAGE_LIMITS.author} placeholder="Zenith Studio" />
			<MediaField bind:value={embed.author_icon} label="Icon" />
			<div>
				<span class="{LABEL} mb-1 block">Link</span>
				<input
					type="url"
					bind:value={embed.author_url}
					maxlength={MESSAGE_LIMITS.url}
					placeholder="https:// (optional)"
					aria-label="Author link"
					class={FIELD}
				/>
			</div>
		</div>
	</details>

	<details class={GROUP} open={Object.keys(embed.footer).length > 0 || embed.timestamp} data-part="footer">
		<summary class={SUMMARY}><i class="fas fa-shoe-prints text-emerald-300"></i>Footer</summary>
		<div class="mt-3 flex flex-col gap-3">
			<LocalizedField bind:value={embed.footer} label="Footer text" max={MESSAGE_LIMITS.footer} placeholder={'Powered by {server} {year}'} />
			<MediaField bind:value={embed.footer_icon} label="Icon" />
			<ConfigToggleRow label="Show the time" description="Adds when the message was sent or last edited next to the footer." bind:enabled={embed.timestamp} />
		</div>
	</details>
</div>
