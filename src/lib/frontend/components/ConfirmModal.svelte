<script lang="ts">
	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		dangerous?: boolean;
		loading?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open,
		title = 'Are you sure?',
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		dangerous = false,
		loading = false,
		onconfirm,
		oncancel
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

{#if open}
	
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-md rounded-2xl border p-4 sm:p-6">
			
			<div class="mb-4 flex items-center justify-between sm:mb-5">
				<h3 class="text-ash-100 flex items-center gap-2 text-base font-bold sm:text-lg">
					{#if dangerous}
						<i class="fas fa-triangle-exclamation text-red-400"></i>
					{:else}
						<i class="fas fa-circle-question text-ash-300"></i>
					{/if}
					{title}
				</h3>
				<button onclick={oncancel} aria-label="Close modal" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			
			<p class="text-ash-200 mb-5 text-sm sm:text-base">{message}</p>

			
			<div class="flex gap-2 sm:gap-3">
				<button
					type="button"
					onclick={oncancel}
					disabled={loading}
					class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50 sm:py-3 sm:text-base"
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					onclick={onconfirm}
					disabled={loading}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base
						{dangerous ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-ash-400 hover:bg-ash-500 text-ash-100'}"
				>
					{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
					{loading ? 'Please wait...' : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
