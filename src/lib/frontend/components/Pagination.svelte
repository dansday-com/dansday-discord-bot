<script lang="ts">
	interface Props {
		page: number;
		totalPages: number;
	}

	let { page = $bindable(), totalPages }: Props = $props();

	const current = $derived(Math.min(page, totalPages));
	const button =
		'bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';
</script>

{#if totalPages > 1}
	<div class="mt-4 flex items-center justify-center gap-3">
		<button type="button" onclick={() => (page = Math.max(1, current - 1))} disabled={current <= 1} class={button}>
			<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
		</button>
		<span class="text-ash-400 text-sm">Page {current} of {totalPages}</span>
		<button type="button" onclick={() => (page = Math.min(totalPages, current + 1))} disabled={current >= totalPages} class={button}>
			Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
		</button>
	</div>
{/if}
