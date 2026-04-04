<script lang="ts">
	import { LABELED_SELECT_ACCENT } from '$lib/frontend/controlAccents.js';
	import type { LabeledSelectOption } from './labeledSelect.js';

	type Appearance = 'dashboard' | 'members-toolbar' | 'form-inline';

	type LabelTone = 'neutral' | 'cyan';

	type Props = {
		options: LabeledSelectOption[];
		value?: string;
		/** If set, shows “Sort by:”-style label + icon beside the select */
		label?: string;
		labelIconClass?: string;
		/** When `label` is set, tints label text to match `labelIconClass` (e.g. cyan filter icon). */
		labelTone?: LabelTone;
		appearance?: Appearance;
		/** Extra classes on &lt;select&gt; */
		selectClass?: string;
		id?: string;
		disabled?: boolean;
		/** Use when there is no visible label (e.g. member list) */
		ariaLabel?: string;
	};

	let {
		options,
		value = $bindable(''),
		label = '',
		labelIconClass,
		labelTone = 'neutral',
		appearance = 'members-toolbar',
		selectClass = '',
		id,
		disabled = false,
		ariaLabel
	}: Props = $props();

	const labelTextClass = $derived(labelTone === 'cyan' ? LABELED_SELECT_ACCENT.label : 'text-ash-400');

	const appearanceSelectClass: Record<Appearance, string> = {
		dashboard:
			'bg-ash-800 border-ash-600 text-ash-100 focus:ring-ash-500 rounded-lg border px-2 py-1.5 text-xs transition-all focus:ring-2 focus:outline-none sm:px-4 sm:py-2 sm:text-sm min-w-0',
		'members-toolbar':
			'bg-ash-800 border-ash-700 text-ash-100 focus:ring-ash-500 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none min-w-0 sm:min-w-[12rem]',
		'form-inline':
			'bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:w-36'
	};

	const mergedSelectClass = $derived(`${appearanceSelectClass[appearance]} ${selectClass}`.trim());
</script>

{#if label}
	<div class="flex min-w-0 items-center gap-2 sm:gap-3">
		<label for={id} class="{labelTextClass} flex shrink-0 items-center gap-1 text-xs whitespace-nowrap sm:gap-2 sm:text-sm">
			{#if labelIconClass}
				<i class={labelIconClass}></i>
			{/if}
			<span class="sm:inline">{label}</span>
		</label>
		<select {id} bind:value {disabled} class={mergedSelectClass}>
			{#each options as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
{:else}
	<select {id} bind:value {disabled} class={mergedSelectClass} aria-label={ariaLabel}>
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
{/if}
