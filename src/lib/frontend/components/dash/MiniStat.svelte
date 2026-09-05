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
	class="border-base-300 bg-base-200/50 flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2.5 text-center transition-colors hover:border-(--tone) sm:gap-1 sm:px-2 sm:py-3"
>
	<i class="fas {icon} text-xs text-(--tone) sm:text-sm"></i>
	<span class="w-full text-sm font-extrabold break-all tabular-nums sm:text-[0.95rem] {valueTone}">{value}</span>
	<span class="text-base-content/45 w-full text-[9px] leading-tight font-semibold tracking-[0.04em] uppercase">{label}</span>
</div>
