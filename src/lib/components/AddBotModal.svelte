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
		if (!botType) { showToast('Please select a bot type', 'error'); return; }
		if (!botToken) { showToast('Bot token is required', 'error'); return; }
		if (botType === 'official') {
			if (!applicationId) { showToast('Application ID is required', 'error'); return; }
			if (!port) { showToast('Port is required', 'error'); return; }
			if (!secretKey) { showToast('Secret key is required', 'error'); return; }
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
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
		role="dialog"
		aria-modal="true"
		aria-label="Add New Bot"
	>
		<div class="bg-ash-800 rounded-2xl border border-ash-700 max-w-lg w-full p-4 sm:p-6 my-4">
			<!-- Header -->
			<div class="flex items-center justify-between mb-4 sm:mb-6">
				<h3 class="text-lg sm:text-xl font-bold text-ash-100 flex items-center gap-2">
					<i class="fas fa-plus-circle text-ash-200"></i>Add New Bot
				</h3>
				<button onclick={close} aria-label="Close modal" class="text-ash-400 hover:text-ash-100 transition-colors p-1">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 sm:space-y-5">
				<!-- Bot Type -->
				<div>
					<label for="botType" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
						<i class="fas fa-tag mr-2"></i>Bot Type <span class="text-ash-200">*</span>
					</label>
					<select
						id="botType"
						bind:value={botType}
						class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base"
					>
						<option value="">Select bot type...</option>
						<option value="official">Official Bot</option>
						<option value="selfbot">Selfbot</option>
					</select>
				</div>

				<!-- Token -->
				<div>
					<label for="botToken" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
						<i class="fas fa-key mr-2"></i>Bot Token <span class="text-ash-200">*</span>
					</label>
					<div class="relative">
						<input
							id="botToken"
							type={showToken ? 'text' : 'password'}
							bind:value={botToken}
							placeholder="Enter bot token"
							class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base pr-10"
						/>
						<button type="button" aria-label={showToken ? 'Hide token' : 'Show token'} onclick={() => (showToken = !showToken)} class="absolute right-3 top-1/2 -translate-y-1/2 text-ash-400 hover:text-ash-300">
							<i class="fas {showToken ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
						</button>
					</div>
				</div>

				<!-- Official Bot Fields -->
				{#if botType === 'official'}
					<div>
						<label for="appId" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
							<i class="fas fa-id-card mr-2"></i>Application ID <span class="text-ash-200">*</span>
						</label>
						<input
							id="appId"
							type="text"
							bind:value={applicationId}
							placeholder="Enter application ID"
							class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base"
						/>
					</div>
					<div>
						<label for="botPort" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
							<i class="fas fa-network-wired mr-2"></i>Port <span class="text-ash-200">*</span>
						</label>
						<input
							id="botPort"
							type="number"
							bind:value={port}
							placeholder="e.g. 7777"
							class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base"
						/>
					</div>
					<div>
						<label for="secretKey" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
							<i class="fas fa-shield-alt mr-2"></i>Secret Key <span class="text-ash-200">*</span>
						</label>
						<div class="relative">
							<input
								id="secretKey"
								type={showSecret ? 'text' : 'password'}
								bind:value={secretKey}
								placeholder="Enter secret key"
								class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base pr-10"
							/>
							<button type="button" aria-label={showSecret ? 'Hide key' : 'Show key'} onclick={() => (showSecret = !showSecret)} class="absolute right-3 top-1/2 -translate-y-1/2 text-ash-400 hover:text-ash-300">
								<i class="fas {showSecret ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
							</button>
						</div>
						<p class="mt-1.5 text-xs text-ash-500">Used to authenticate incoming webhooks to this bot</p>
					</div>
				{/if}

				<!-- Selfbot Fields -->
				{#if botType === 'selfbot'}
					<div>
						<label for="connectTo" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
							<i class="fas fa-link mr-2"></i>Connect To (Official Bot) <span class="text-ash-200">*</span>
						</label>
						<select
							id="connectTo"
							bind:value={connectTo}
							class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm sm:text-base"
						>
							<option value="">Select official bot...</option>
							{#each officialBots as bot}
								<option value={bot.id}>{bot.name || `Bot #${bot.id}`}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Info -->
				<div class="bg-ash-900 border border-ash-600 rounded-lg p-3 sm:p-4">
					<div class="flex items-start gap-2 sm:gap-3">
						<i class="fas fa-info-circle text-ash-300 text-sm mt-0.5 flex-shrink-0"></i>
						<p class="text-xs sm:text-sm text-ash-200">Bot name and icon will be automatically synced from Discord when the bot is running.</p>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex gap-2 sm:gap-3 pt-2">
					<button type="button" onclick={close} class="flex-1 bg-ash-700 hover:bg-ash-600 text-ash-100 py-2.5 sm:py-3 rounded-lg transition-colors text-sm sm:text-base font-medium">
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="flex-1 bg-ash-400 hover:bg-ash-500 text-ash-100 py-2.5 sm:py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
					>
						{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
						{loading ? 'Adding...' : 'Add Bot'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
