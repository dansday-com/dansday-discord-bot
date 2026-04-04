<script lang="ts">
	type Props = {
		label: string;
		description?: string;
		enabled?: boolean;
		ariaLabel?: string;
		disabled?: boolean;
	};

	let { label, description = '', enabled = $bindable(false), ariaLabel, disabled = false }: Props = $props();
</script>

<div class="flex items-center justify-between gap-4">
	<div class="min-w-0">
		<p class="text-ash-300 text-xs font-medium">{label}</p>
		{#if description}
			<p class="text-ash-500 mt-0.5 text-xs">{description}</p>
		{/if}
	</div>
	<button
		type="button"
		{disabled}
		onclick={() => (enabled = !enabled)}
		class="focus:ring-ash-500 relative h-6 w-10 flex-shrink-0 rounded-full transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {enabled
			? 'bg-ash-400'
			: 'bg-ash-700'}"
		aria-pressed={enabled}
		aria-label={ariaLabel ?? label}
		aria-disabled={disabled}
	>
		<span class="pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {enabled ? 'left-5' : 'left-1'}"></span>
	</button>
</div>
