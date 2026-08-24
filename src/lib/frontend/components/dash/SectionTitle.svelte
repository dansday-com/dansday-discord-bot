<script lang="ts">
	let {
		icon,
		title,
		tone = 'base'
	}: {
		icon: string;
		title: string;
		tone?: 'base' | 'error' | 'success';
	} = $props();

	const color = $derived(tone === 'error' ? 'text-error' : tone === 'success' ? 'text-success' : 'text-primary');
</script>

<div class="divider my-0 text-[10px] font-semibold tracking-[0.1em] uppercase">
	<span class="text-base-content/60 inline-flex items-center gap-2">
		<i class="fas {icon} {color}"></i>{title}
	</span>
</div>
