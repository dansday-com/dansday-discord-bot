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

<div class="divider my-0 text-[10px] font-semibold tracking-widest uppercase">
	<span class="text-base-content/60 inline-flex items-center gap-2 text-center">
		<i class="fas {icon} {color} shrink-0"></i>{title}
	</span>
</div>
