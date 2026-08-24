<script lang="ts">
	let {
		percents,
		selected = $bindable(),
		custom = $bindable(),
		max,
		disabled = false,
		customPlaceholder = 'Enter XP to wager'
	}: {
		percents: number[];
		selected: number | 'custom';
		custom: number | null;
		max: number;
		disabled?: boolean;
		customPlaceholder?: string;
	} = $props();

	const ACTIVE = 'border-transparent bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white shadow-[0_4px_12px_-5px_rgba(184,134,11,0.8)]';
</script>

<div class="mb-2.5 grid grid-cols-5 gap-1.5">
	{#each percents as p}
		<button
			type="button"
			class="btn btn-sm border-base-300 bg-base-200 text-base-content h-9 px-0 text-[13.5px] font-bold {selected === p ? ACTIVE : ''}"
			{disabled}
			onclick={() => (selected = p)}
		>
			{p}%
		</button>
	{/each}
	<button
		type="button"
		class="btn btn-sm border-base-300 bg-base-200 text-base-content h-9 px-0 text-[13.5px] font-bold {selected === 'custom' ? ACTIVE : ''}"
		{disabled}
		onclick={() => (selected = 'custom')}
	>
		Custom
	</button>
</div>

{#if selected === 'custom'}
	<input
		class="input border-base-300 bg-base-200 mb-2.5 w-full text-center text-sm font-bold tabular-nums"
		type="number"
		min="1"
		{max}
		placeholder={customPlaceholder}
		bind:value={custom}
		{disabled}
	/>
{/if}
