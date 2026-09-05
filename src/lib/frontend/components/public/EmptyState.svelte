<script lang="ts">
	let {
		icon,
		message,
		hint,
		boxed = false
	}: {
		icon: string;
		message: string;
		hint?: string;
		boxed?: boolean;
	} = $props();
</script>

<div
	class="text-base-content/45 flex flex-col items-center justify-center gap-2 py-12 text-center {boxed
		? 'border-base-300 bg-base-100 rounded-2xl border border-dashed px-5'
		: ''}"
>
	<i class="fas {icon} text-4xl opacity-25 sm:text-5xl" aria-hidden="true"></i>
	<p class="text-base-content/70 text-sm font-bold">{message}</p>
	{#if hint}
		<p class="text-xs font-medium">{hint}</p>
	{/if}
</div>
