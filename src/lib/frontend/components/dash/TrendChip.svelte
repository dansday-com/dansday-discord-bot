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
</script>

<span class="badge badge-{size} gap-1.5 border-none font-bold tabular-nums {up ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}">
	<i class="fas fa-arrow-trend-{up ? 'up' : 'down'}"></i>{text}{#if label}&nbsp;{label}{/if}
</span>
