<script lang="ts">
	let {
		value,
		text,
		label,
		size = 'sm'
	}: {
		value: number;
		text: string;
		label?: string;
		size?: 'xs' | 'sm';
	} = $props();

	const up = $derived(value >= 0);
	const sizeClass = $derived(size === 'xs' ? 'badge-xs' : 'badge-sm');
</script>

<span
	class="badge {sizeClass} h-auto max-w-full gap-1.5 border-none py-0.5 font-bold whitespace-normal tabular-nums {up
		? 'bg-success/15 text-success'
		: 'bg-error/15 text-error'}"
>
	{#if up}
		<i class="fas fa-arrow-trend-up"></i>
	{:else}
		<i class="fas fa-arrow-trend-down"></i>
	{/if}{text}{#if label}&nbsp;{label}{/if}
</span>
