<script lang="ts">
	import { LABELED_SELECT_ACCENT } from '$lib/frontend/controlAccents.js';
	import type { LabeledSelectOption } from './labeledSelect.js';

	type Appearance = 'dashboard' | 'members-toolbar' | 'form-inline';

	type LabelTone = 'neutral' | 'cyan';

	type Props = {
		options: LabeledSelectOption[];
		value?: string;
		label?: string;
		labelIconClass?: string;
		labelTone?: LabelTone;
		appearance?: Appearance;
		selectClass?: string;
		id?: string;
		disabled?: boolean;
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

	const rowClass: Record<Appearance, string> = {
		dashboard:
			'bg-ash-800 border-ash-600 hover:border-ash-500 flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition-colors sm:px-4 sm:py-2',
		'members-toolbar':
			'bg-ash-800 border-ash-700 hover:border-ash-600 flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors sm:min-w-[12rem]',
		'form-inline':
			'bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors sm:w-36'
	};

	const selectTextClass: Record<Appearance, string> = {
		dashboard: 'text-xs sm:text-sm',
		'members-toolbar': 'text-sm',
		'form-inline': 'text-sm'
	};

	const selectInner =
		'min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-ash-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
	const mergedSelect = $derived(`${selectInner} ${selectTextClass[appearance]} ${selectClass}`.trim());
</script>

{#if label}
	<div class="flex min-w-0 items-center gap-2 sm:gap-3">
		<label for={id} class="{labelTextClass} flex shrink-0 items-center gap-1 text-xs whitespace-nowrap sm:gap-2 sm:text-sm">
			{#if labelIconClass}
				<i class={labelIconClass}></i>
			{/if}
			<span class="sm:inline">{label}</span>
		</label>
		<div class="{rowClass[appearance]} {disabled ? 'opacity-50' : ''}">
			<select {id} bind:value {disabled} class={mergedSelect}>
				{#each options as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			<i class={LABELED_SELECT_ACCENT.chevron}></i>
		</div>
	</div>
{:else}
	<div class="w-full shrink-0 sm:w-auto {rowClass[appearance]} {disabled ? 'opacity-50' : ''}">
		<select {id} bind:value {disabled} class={mergedSelect} aria-label={ariaLabel}>
			{#each options as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		<i class={LABELED_SELECT_ACCENT.chevron}></i>
	</div>
{/if}
