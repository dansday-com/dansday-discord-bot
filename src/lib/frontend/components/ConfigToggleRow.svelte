<script lang="ts">
	type Props = {
		label: string;
		description?: string;
		labelIconClass?: string;
		enabled?: boolean;
		ariaLabel?: string;
		disabled?: boolean;
		onchange?: (value: boolean) => void;
	};

	let { label, description = '', labelIconClass, enabled = $bindable(false), ariaLabel, disabled = false, onchange }: Props = $props();

	function toggle() {
		enabled = !enabled;
		onchange?.(enabled);
	}
</script>

<div class="flex items-start justify-between gap-4">
	<div class="flex min-w-0 flex-1 items-start gap-2">
		{#if labelIconClass}
			<i class="{labelIconClass} mt-0.5 shrink-0 text-sm leading-5" aria-hidden="true"></i>
		{/if}
		<div class="min-w-0">
			<p class="text-ash-300 text-xs font-medium">{label}</p>
			{#if description}
				<p class="text-ash-500 mt-0.5 text-xs">{description}</p>
			{/if}
		</div>
	</div>
	<button
		type="button"
		{disabled}
		onclick={toggle}
		class="focus:ring-ash-500 relative mt-0.5 h-6 w-10 flex-shrink-0 rounded-full transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {enabled
			? 'bg-ash-400'
			: 'bg-ash-700'}"
		aria-pressed={enabled}
		aria-label={ariaLabel ?? label}
		aria-disabled={disabled}
	>
		<span class="pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {enabled ? 'left-5' : 'left-1'}"></span>
	</button>
</div>
