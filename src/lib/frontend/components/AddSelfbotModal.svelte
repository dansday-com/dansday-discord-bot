<script lang="ts">
	import { showToast } from '$lib/frontend/toast.svelte';

	interface Props {
		open: boolean;
		serverId: number;
		onclose: () => void;
		onadded: () => void;
	}

	let { open, serverId, onclose, onadded }: Props = $props();

	let loading = $state(false);
	let token = $state('');
	let showToken = $state(false);

	function reset() {
		token = '';
		showToken = false;
	}

	function close() {
		reset();
		onclose();
	}

	async function handleSubmit() {
		if (!token) {
			showToast('Token is required', 'error');
			return;
		}

		loading = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/selfbot`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ token })
			});

			const data = await res.json();
			if (res.ok && data.success !== false) {
				showToast('Selfbot added!', 'success');
				close();
				onadded();
			} else {
				showToast(data.error || 'Failed to add selfbot', 'error');
			}
		} catch (_) {
			showToast('Failed to add selfbot. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Add Selfbot"
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-lg rounded-2xl border p-4 sm:p-6">
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-plus-circle text-ash-200"></i>Add Selfbot
				</h3>
				<button onclick={close} aria-label="Close modal" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-4 sm:space-y-5"
			>
				<div>
					<label for="selfbotToken" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-key mr-2"></i>User Token <span class="text-ash-200">*</span>
					</label>
					<div class="relative">
						<input
							id="selfbotToken"
							type={showToken ? 'text' : 'password'}
							bind:value={token}
							placeholder="Enter user token"
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
						/>
						<button
							type="button"
							aria-label={showToken ? 'Hide token' : 'Show token'}
							onclick={() => (showToken = !showToken)}
							class="text-ash-400 hover:text-ash-300 absolute top-1/2 right-3 -translate-y-1/2"
						>
							<i class="fas {showToken ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
						</button>
					</div>
				</div>

				<div class="bg-ash-900 border-ash-600 rounded-lg border p-3 sm:p-4">
					<div class="flex items-start gap-2 sm:gap-3">
						<i class="fas fa-info-circle text-ash-300 mt-0.5 shrink-0 text-sm"></i>
						<p class="text-ash-200 text-xs sm:text-sm">Name will be automatically synced from Discord when the selfbot is running.</p>
					</div>
				</div>

				<div class="flex gap-2 pt-2 sm:gap-3">
					<button
						type="button"
						onclick={close}
						class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors sm:py-3 sm:text-base"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
					>
						{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
						{loading ? 'Adding...' : 'Add Selfbot'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
