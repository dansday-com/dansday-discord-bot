<script lang="ts">
	type Props = {
		label: string;
		description?: string;
		/** Full classes for the label icon, e.g. `fas fa-clock mr-1 text-orange-400` */
		labelIconClass?: string;
		values: number[];
		value?: number;
		formatOption?: (v: number) => string;
		id?: string;
		disabled?: boolean;
		/** Override trailing chevron classes (default matches ChannelPicker). */
		chevronIconClass?: string;
	};

	let {
		label,
		description = '',
		labelIconClass,
		values,
		value = $bindable(0),
		formatOption = (v: number) => String(v),
		id,
		disabled = false,
		chevronIconClass
	}: Props = $props();

	/** Default matches ChannelPicker (`text-violet-300`) so the row reads like other config pickers. */
	const chevronClass = $derived(chevronIconClass ?? 'fas fa-chevron-down text-xs text-violet-300');

	const selectClass =
		'bg-ash-700 border-ash-600 hover:border-ash-500 text-ash-100 focus:ring-ash-500 w-full cursor-pointer appearance-none rounded-lg border py-2.5 pr-10 pl-3 text-sm transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
</script>

<div>
	<label for={id} class="{NUMERIC_SELECT_ACCENT.label} mb-1.5 block text-xs font-medium">
		{#if labelIconClass}
			<i class={labelIconClass}></i>
		{/if}
		{label}
	</label>
	{#if description}
		<p class="text-ash-500 mb-2 text-xs">{description}</p>
	{/if}
	<div class="relative">
		<select {id} bind:value {disabled} class={selectClass}>
			{#each values as val (val)}
				<option value={val}>{formatOption(val)}</option>
			{/each}
		</select>
		<i class="{chevronClass} pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true"></i>
	</div>
</div>
