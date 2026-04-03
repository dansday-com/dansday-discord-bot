<script lang="ts">
	import { showToast } from '$lib/frontend/toast.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		onadded: () => void;
	}

	let { open, onclose, onadded }: Props = $props();

	let loading = $state(false);
	let botToken = $state('');
	let showToken = $state(false);
	let applicationId = $state('');
	let port = $state('');
	let secretKey = $state('');
	let showSecret = $state(false);

	function reset() {
		botToken = '';
		showToken = false;
		applicationId = '';
		port = '';
		secretKey = '';
		showSecret = false;
	}

	function close() {
		reset();
		onclose();
	}

	async function handleSubmit() {
		if (!botToken) {
			showToast('Bot token is required', 'error');
			return;
		}
		if (!applicationId) {
			showToast('Application ID is required', 'error');
			return;
		}
		if (!port) {
			showToast('Port is required', 'error');
			return;
		}
		if (!secretKey) {
			showToast('Secret key is required', 'error');
			return;
		}

		loading = true;
		try {
			const body: Record<string, unknown> = {
				token: botToken,
				application_id: applicationId,
				port: Number(port),
				secret_key: secretKey
			};

			const res = await fetch('/api/bots', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});

			const data = await res.json();
			if (res.ok && data.success !== false) {
				showToast('Bot added successfully!', 'success');
				close();
				onadded();
			} else {
				showToast(data.error || 'Failed to add bot', 'error');
			}
		} catch (_) {
			showToast('Failed to add bot. Please try again.', 'error');
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
		aria-label="Add New Bot"
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-lg rounded-2xl border p-4 sm:p-6">
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-plus-circle text-ash-200"></i>Add New Bot
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
					<label for="botToken" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-key mr-2"></i>Bot Token <span class="text-ash-200">*</span>
					</label>
					<div class="relative">
						<input
							id="botToken"
							type={showToken ? 'text' : 'password'}
							bind:value={botToken}
							placeholder="Enter bot token"
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

				<div>
					<label for="appId" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-id-card mr-2"></i>Application ID <span class="text-ash-200">*</span>
					</label>
					<input
						id="appId"
						type="text"
						bind:value={applicationId}
						placeholder="Enter application ID"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
					/>
				</div>
				<div>
					<label for="botPort" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-network-wired mr-2"></i>Port <span class="text-ash-200">*</span>
					</label>
					<input
						id="botPort"
						type="number"
						bind:value={port}
						placeholder="e.g. 7777"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
					/>
				</div>
				<div>
					<label for="secretKey" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-shield-alt mr-2"></i>Secret Key <span class="text-ash-200">*</span>
					</label>
					<div class="relative">
						<input
							id="secretKey"
							type={showSecret ? 'text' : 'password'}
							bind:value={secretKey}
							placeholder="Enter secret key"
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
						/>
						<button
							type="button"
							aria-label={showSecret ? 'Hide key' : 'Show key'}
							onclick={() => (showSecret = !showSecret)}
							class="text-ash-400 hover:text-ash-300 absolute top-1/2 right-3 -translate-y-1/2"
						>
							<i class="fas {showSecret ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
						</button>
					</div>
					<p class="text-ash-500 mt-1.5 text-xs">Used to authenticate incoming webhooks to this bot</p>
				</div>

				<div class="bg-ash-900 border-ash-600 rounded-lg border p-3 sm:p-4">
					<div class="flex items-start gap-2 sm:gap-3">
						<i class="fas fa-info-circle text-ash-300 mt-0.5 flex-shrink-0 text-sm"></i>
						<p class="text-ash-200 text-xs sm:text-sm">Bot name and icon will be automatically synced from Discord when the bot is running.</p>
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
						{loading ? 'Adding...' : 'Add Bot'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
