<script lang="ts">
	import { showToast } from '$lib/stores/toast.svelte';

	interface Props {
		open: boolean;
		officialBots: { id: number; name: string }[];
		onclose: () => void;
		onadded: () => void;
	}

	let { open, officialBots, onclose, onadded }: Props = $props();

	let loading = $state(false);
	let botType = $state('');
	let botToken = $state('');
	let showToken = $state(false);
	let applicationId = $state('');
	let port = $state('');
	let secretKey = $state('');
	let showSecret = $state(false);
	let connectTo = $state('');

	function reset() {
		botType = '';
		botToken = '';
		showToken = false;
		applicationId = '';
		port = '';
		secretKey = '';
		showSecret = false;
		connectTo = '';
	}

	function close() {
		reset();
		onclose();
	}

	async function handleSubmit() {
		if (!botType) {
			showToast('Please select a bot type', 'error');
			return;
		}
		if (!botToken) {
			showToast('Bot token is required', 'error');
			return;
		}
		if (botType === 'official') {
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
		}
		if (botType === 'selfbot' && !connectTo) {
			showToast('Please select an official bot to connect to', 'error');
			return;
		}

		loading = true;
		try {
			const body: Record<string, unknown> = { bot_type: botType, token: botToken };
			if (botType === 'official') {
				body.application_id = applicationId;
				body.port = Number(port);
				body.secret_key = secretKey;
			}
			if (botType === 'selfbot') body.connect_to = Number(connectTo);

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
		} catch {
			showToast('Failed to add bot. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Add New Bot"
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-lg rounded-2xl border p-4 sm:p-6">
			<!-- Header -->
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
				<!-- Bot Type -->
				<div>
					<label for="botType" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
						<i class="fas fa-tag mr-2"></i>Bot Type <span class="text-ash-200">*</span>
					</label>
					<select
						id="botType"
						bind:value={botType}
						class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
					>
						<option value="">Select bot type...</option>
						<option value="official">Official Bot</option>
						<option value="selfbot">Selfbot</option>
					</select>
				</div>

				<!-- Token -->
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

				<!-- Official Bot Fields -->
				{#if botType === 'official'}
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
				{/if}

				<!-- Selfbot Fields -->
				{#if botType === 'selfbot'}
					<div>
						<label for="connectTo" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
							<i class="fas fa-link mr-2"></i>Connect To (Official Bot) <span class="text-ash-200">*</span>
						</label>
						<select
							id="connectTo"
							bind:value={connectTo}
							class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
						>
							<option value="">Select official bot...</option>
							{#each officialBots as bot}
								<option value={bot.id}>{bot.name || `Bot #${bot.id}`}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Info -->
				<div class="bg-ash-900 border-ash-600 rounded-lg border p-3 sm:p-4">
					<div class="flex items-start gap-2 sm:gap-3">
						<i class="fas fa-info-circle text-ash-300 mt-0.5 flex-shrink-0 text-sm"></i>
						<p class="text-ash-200 text-xs sm:text-sm">Bot name and icon will be automatically synced from Discord when the bot is running.</p>
					</div>
				</div>

				<!-- Actions -->
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
