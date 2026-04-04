<script lang="ts">
	import { NUMERIC_SELECT_ACCENT } from '$lib/frontend/controlAccents.js';

	type Props = {
		label: string;
		description?: string;
		labelIconClass?: string;
		values: number[];
		value?: number;
		formatOption?: (v: number) => string;
		id?: string;
		disabled?: boolean;
	};

	let {
		label,
		description = '',
		labelIconClass,
		values,
		value = $bindable(0),
		formatOption = (v: number) => String(v),
		id,
		disabled = false
	}: Props = $props();
</script>

<div>
	<label for={id} class="text-ash-300 mb-1.5 block text-xs font-medium">
		{#if labelIconClass}
			<i class={labelIconClass}></i>
		{/if}
		{label}
	</label>
	{#if description}
		<p class="text-ash-500 mb-2 text-xs">{description}</p>
	{/if}
	<div
		class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors {disabled
			? 'opacity-50'
			: ''}"
	>
		<select
			{id}
			bind:value
			{disabled}
			class="text-ash-100 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent focus:outline-none disabled:cursor-not-allowed"
		>
			{#each values as val (val)}
				<option value={val}>{formatOption(val)}</option>
			{/each}
		</select>
		<i class={NUMERIC_SELECT_ACCENT.chevron}></i>
	</div>
</div>
