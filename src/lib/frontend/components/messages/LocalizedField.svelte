<script lang="ts">
	import type { Localized } from '$lib/messages.js';
	import { serverLanguageLabel } from '$lib/languages.js';
	import { messageEditor } from './editorContext.js';
	import { FIELD, LABEL } from './styles.js';

	let {
		value = $bindable(),
		label = '',
		max,
		placeholder = '',
		multiline = false,
		rows = 3
	}: {
		value: Localized;
		label?: string;
		max: number;
		placeholder?: string;
		multiline?: boolean;
		rows?: number;
	} = $props();

	const editor = messageEditor();
	const translating = $derived(editor.lang !== editor.base);
	const current = $derived(value[editor.lang] ?? '');
	const original = $derived(translating ? (value[editor.base] ?? '') : '');
	const tone = $derived(current.length >= max ? 'text-red-400' : current.length >= max * 0.9 ? 'text-yellow-400' : 'text-ash-500');

	function set(next: string) {
		if (next) value[editor.lang] = next;
		else delete value[editor.lang];
	}
</script>

<div class="min-w-0">
	<div class="mb-1 flex items-baseline justify-between gap-2">
		<span class={LABEL}>{label}</span>
		<span class="shrink-0 text-[11px] tabular-nums {tone}">{current.length}/{max}</span>
	</div>
	{#if multiline}
		<textarea
			value={current}
			oninput={(e) => set(e.currentTarget.value)}
			maxlength={max}
			{rows}
			aria-label={label}
			placeholder={original || placeholder}
			class="{FIELD} resize-y"
		></textarea>
	{:else}
		<input
			type="text"
			value={current}
			oninput={(e) => set(e.currentTarget.value)}
			maxlength={max}
			aria-label={label}
			placeholder={original || placeholder}
			class={FIELD}
		/>
	{/if}
	{#if translating && original && !current}
		<p class="text-ash-500 mt-1 text-[11px]">Left empty, so members see the {serverLanguageLabel(editor.base)} text.</p>
	{/if}
</div>
