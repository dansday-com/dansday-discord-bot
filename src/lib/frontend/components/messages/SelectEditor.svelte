<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { MESSAGE_LIMITS, newMessageOption, pickText, type SelectBlock } from '$lib/messages.js';
	import ActionsEditor from './ActionsEditor.svelte';
	import EmojiField from './EmojiField.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import { messageEditor, moveItem } from './editorContext.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { select = $bindable() }: { select: SelectBlock } = $props();

	const editor = messageEditor();
	let open = $state(0);

	function name(index: number) {
		const option = select.options[index];
		const emoji = option.emoji && !option.emoji.startsWith('<') ? option.emoji : '';
		return [emoji, pickText(option.label, editor.lang, editor.base)].filter(Boolean).join(' ') || `Choice ${index + 1}`;
	}

	function remove(index: number) {
		select.options.splice(index, 1);
		open = Math.max(0, Math.min(open, select.options.length - 1));
	}

	function shift(index: number, delta: number) {
		moveItem(select.options, index, delta);
		open = index + delta;
	}
</script>

<div class="flex flex-col gap-3">
	<LocalizedField bind:value={select.placeholder} label="Text shown before anything is picked" max={MESSAGE_LIMITS.placeholder} placeholder="Pick your roles" />
	<ConfigToggleRow
		label="Let members pick several at once"
		description="Off: one choice per click. On: they can tick several choices and apply them together."
		bind:enabled={select.multiple}
	/>
	<div>
		<span class="{LABEL} mb-1.5 block">Choices</span>
		<div class="flex flex-col gap-1.5">
			{#each select.options as option, i (option.id)}
				<div class="bg-ash-800 border-ash-600 rounded-lg border">
					<div class="flex items-center gap-1 p-1.5">
						<button
							type="button"
							class="text-ash-100 flex min-w-0 flex-1 items-center gap-2 px-1.5 text-left text-sm"
							onclick={() => (open = open === i ? -1 : i)}
						>
							<i class="fas fa-chevron-right text-ash-400 text-[10px] transition-transform {open === i ? 'rotate-90' : ''}"></i>
							<span class="truncate">{name(i)}</span>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => shift(i, -1)}>
							<i class="fas fa-arrow-up"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move down" disabled={i === select.options.length - 1} onclick={() => shift(i, 1)}>
							<i class="fas fa-arrow-down"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Remove choice" onclick={() => remove(i)}><i class="fas fa-trash"></i></button>
					</div>
					{#if open === i}
						<div class="border-ash-600 flex flex-col gap-3 border-t p-3">
							<LocalizedField bind:value={option.label} label="Label" max={MESSAGE_LIMITS.optionLabel} placeholder="Announcements" />
							<EmojiField bind:value={option.emoji} />
							<LocalizedField
								bind:value={option.description}
								label="Small line under the label"
								max={MESSAGE_LIMITS.optionDescription}
								placeholder="Optional"
							/>
							<ActionsEditor bind:actions={option.actions} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
		{#if select.options.length < MESSAGE_LIMITS.options}
			<button
				type="button"
				class="{GHOST_BUTTON} mt-2"
				onclick={() => {
					select.options.push(newMessageOption());
					open = select.options.length - 1;
				}}
			>
				<i class="fas fa-plus text-emerald-400"></i>Choice
			</button>
		{/if}
	</div>
</div>
