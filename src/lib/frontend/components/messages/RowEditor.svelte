<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { MESSAGE_LIMITS, newMessageButton, newMessageOption, pickText, type RowBlock } from '$lib/messages.js';
	import ActionsEditor from './ActionsEditor.svelte';
	import ButtonEditor from './ButtonEditor.svelte';
	import EmojiField from './EmojiField.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import { messageEditor, moveItem } from './editorContext.js';
	import { GHOST_BUTTON, ICON_BUTTON, SUBPANEL } from './styles.js';

	let { row = $bindable() }: { row: RowBlock } = $props();

	const editor = messageEditor();
	let open = $state(0);

	const TONE: Record<string, string> = {
		secondary: 'bg-[#4e5058]',
		primary: 'bg-[#5865f2]',
		success: 'bg-[#248046]',
		danger: 'bg-[#da373c]',
		link: 'bg-[#4e5058]'
	};

	function name(label: Record<string, string | undefined>, emoji: string, fallback: string) {
		return [emoji && !emoji.startsWith('<') ? emoji : '', pickText(label, editor.lang, editor.base)].filter(Boolean).join(' ') || fallback;
	}

	function remove(items: unknown[], index: number) {
		items.splice(index, 1);
		open = Math.max(0, Math.min(open, items.length - 1));
	}

	function shift(items: unknown[], index: number, delta: number) {
		moveItem(items, index, delta);
		open = index + delta;
	}
</script>

{#if row.type === 'buttons'}
	<div class="flex flex-wrap items-center gap-1.5">
		{#each row.buttons as button, i (button.id)}
			<button
				type="button"
				onclick={() => (open = i)}
				class="max-w-40 truncate rounded-md px-3 py-1.5 text-xs font-medium text-white transition-shadow {TONE[button.style]} {open === i
					? 'ring-ash-100 ring-2'
					: 'opacity-80 hover:opacity-100'}"
			>
				{name(button.label, button.emoji, `Button ${i + 1}`)}
				{#if button.style === 'link'}<i class="fas fa-arrow-up-right-from-square ml-1 text-[9px]"></i>{/if}
			</button>
		{/each}
		{#if row.buttons.length < MESSAGE_LIMITS.buttons}
			<button
				type="button"
				class={GHOST_BUTTON}
				onclick={() => {
					row.buttons.push(newMessageButton());
					open = row.buttons.length - 1;
				}}
			>
				<i class="fas fa-plus text-emerald-400"></i>Button
			</button>
		{/if}
	</div>
	{#if row.buttons[open]}
		<div class="{SUBPANEL} mt-3">
			<div class="mb-2 flex items-center gap-1">
				<span class="text-ash-200 mr-auto text-xs font-semibold">Button {open + 1}</span>
				<button type="button" class={ICON_BUTTON} aria-label="Move left" disabled={open === 0} onclick={() => shift(row.buttons, open, -1)}>
					<i class="fas fa-arrow-left"></i>
				</button>
				<button
					type="button"
					class={ICON_BUTTON}
					aria-label="Move right"
					disabled={open === row.buttons.length - 1}
					onclick={() => shift(row.buttons, open, 1)}
				>
					<i class="fas fa-arrow-right"></i>
				</button>
				<button type="button" class={ICON_BUTTON} aria-label="Remove button" onclick={() => remove(row.buttons, open)}><i class="fas fa-trash"></i></button>
			</div>
			{#key row.buttons[open].id}
				<ButtonEditor bind:button={row.buttons[open]} />
			{/key}
		</div>
	{/if}
{:else}
	<div class="flex flex-col gap-3">
		<LocalizedField bind:value={row.placeholder} label="Text shown before anything is picked" max={MESSAGE_LIMITS.placeholder} placeholder="Pick your roles" />
		<ConfigToggleRow
			label="Let members pick several at once"
			description="Off: one choice per click. On: they can tick several choices and apply them together."
			bind:enabled={row.multiple}
		/>
		<div class="flex flex-col gap-1.5">
			{#each row.options as option, i (option.id)}
				<div class="bg-ash-800 border-ash-600 rounded-lg border">
					<div class="flex items-center gap-1 p-1.5">
						<button
							type="button"
							class="text-ash-100 flex min-w-0 flex-1 items-center gap-2 px-1.5 text-left text-sm"
							onclick={() => (open = open === i ? -1 : i)}
						>
							<i class="fas fa-chevron-right text-ash-400 text-[10px] transition-transform {open === i ? 'rotate-90' : ''}"></i>
							<span class="truncate">{name(option.label, option.emoji, `Choice ${i + 1}`)}</span>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => shift(row.options, i, -1)}>
							<i class="fas fa-arrow-up"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move down" disabled={i === row.options.length - 1} onclick={() => shift(row.options, i, 1)}>
							<i class="fas fa-arrow-down"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Remove choice" onclick={() => remove(row.options, i)}><i class="fas fa-trash"></i></button>
					</div>
					{#if open === i}
						<div class="border-ash-600 flex flex-col gap-3 border-t p-3">
							<div class="grid gap-3 sm:grid-cols-2">
								<LocalizedField bind:value={option.label} label="Label" max={MESSAGE_LIMITS.optionLabel} placeholder="Announcements" />
								<EmojiField bind:value={option.emoji} />
							</div>
							<LocalizedField
								bind:value={option.description}
								label="Description"
								max={MESSAGE_LIMITS.optionDescription}
								placeholder="Optional line under the label"
							/>
							<ActionsEditor bind:actions={option.actions} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
		{#if row.options.length < MESSAGE_LIMITS.options}
			<button
				type="button"
				class="{GHOST_BUTTON} self-start"
				onclick={() => {
					row.options.push(newMessageOption());
					open = row.options.length - 1;
				}}
			>
				<i class="fas fa-plus text-emerald-400"></i>Choice
			</button>
		{/if}
	</div>
{/if}
