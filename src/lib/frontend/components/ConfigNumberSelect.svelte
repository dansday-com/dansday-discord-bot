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

	const selectClass =
		'bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
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
	<select {id} bind:value {disabled} class={selectClass}>
		{#each values as val (val)}
			<option value={val}>{formatOption(val)}</option>
		{/each}
	</select>
</div>
