<script lang="ts">
	let {
		icon,
		value,
		label,
		dir
	}: {
		icon: string;
		value: string;
		label: string;
		dir?: 'up' | 'down';
	} = $props();

	const valueTone = $derived(dir === 'up' ? 'text-success' : dir === 'down' ? 'text-error' : 'text-base-content');
</script>

<div
	class="border-base-300 bg-base-200/50 flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors hover:border-[var(--tone)]"
>
	<i class="fas {icon} text-sm text-[var(--tone)]"></i>
	<span class="text-[0.95rem] font-extrabold tabular-nums {valueTone}">{value}</span>
	<span class="text-base-content/45 text-[9px] leading-tight font-semibold tracking-[0.06em] uppercase">{label}</span>
</div>
