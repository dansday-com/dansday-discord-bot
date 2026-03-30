<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let inviteType = $state<'admin' | 'moderator'>('moderator');
	let generatedLink = $state<string | null>(null);
	let copyIcon = $state('fa-copy');

	async function generateInvite() {
		const res = await fetch('/api/panel/invite-links', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ account_type: inviteType })
		});
		const d = await res.json();
		if (d.success) {
			generatedLink = d.invite_link;
			showToast('Invite link generated', 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Failed to generate link', 'error');
		}
	}

	async function copyLink() {
		if (!generatedLink) return;
		await navigator.clipboard.writeText(generatedLink);
		copyIcon = 'fa-check';
		setTimeout(() => (copyIcon = 'fa-copy'), 2000);
	}

	async function action(method: string, url: string, successMsg: string) {
		const res = await fetch(url, { method, credentials: 'include' });
		const d = await res.json();
		if (d.success) {
			showToast(d.message || successMsg, 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Action failed', 'error');
		}
	}

	function badgeClass(account: { account_type: string; is_frozen: boolean; email_verified: boolean }) {
		if (account.is_frozen) return 'bg-red-900 text-red-300';
		if (!account.email_verified) return 'bg-yellow-900 text-yellow-300';
		if (account.account_type === 'admin') return 'bg-ash-600 text-ash-200';
		return 'bg-ash-700 text-ash-300';
	}

	function badgeLabel(account: { account_type: string; is_frozen: boolean; email_verified: boolean }) {
		if (account.is_frozen) return 'Frozen';
		if (!account.email_verified) return 'Unverified';
		return account.account_type;
	}
</script>

<svelte:head>
	<title>Account Management | Dansday</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
	<!-- Back -->
	<a href="/" class="inline-flex items-center gap-2 text-ash-400 hover:text-ash-100 transition-colors text-sm mb-6">
		<i class="fas fa-arrow-left"></i>Back to Dashboard
	</a>

	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-6 mb-4 sm:mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-ash-100 flex items-center gap-2 mb-6">
			<i class="fas fa-users text-ash-200"></i>Account Management
		</h2>

		<!-- Generate Invite -->
		<div class="mb-8">
			<h3 class="text-lg font-semibold text-ash-100 mb-3">Generate Invite Link</h3>
			<div class="flex flex-col sm:flex-row gap-2 mb-4">
				<select
					bind:value={inviteType}
					class="flex-1 px-3 sm:px-4 py-2.5 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 focus:outline-none focus:ring-2 focus:ring-ash-500 text-sm"
				>
					<option value="admin">Admin</option>
					<option value="moderator">Moderator</option>
				</select>
				<button
					onclick={generateInvite}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
				>
					<i class="fas fa-link mr-2"></i>Generate Link
				</button>
			</div>

			{#if generatedLink}
				<div class="bg-ash-700 rounded-lg p-3 mb-4">
					<p class="text-sm text-ash-300 mb-2">Invite Link:</p>
					<div class="flex items-center gap-2">
						<input
							type="text"
							readonly
							value={generatedLink}
							class="flex-1 px-3 py-2 bg-ash-800 border border-ash-600 rounded text-ash-100 text-sm"
						/>
						<button
							onclick={copyLink}
							aria-label="Copy invite link"
							class="bg-ash-600 hover:bg-ash-500 text-ash-100 px-3 py-2 rounded text-sm transition-colors"
						>
							<i class="fas {copyIcon}"></i>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Accounts list -->
		<div>
			<h3 class="text-lg font-semibold text-ash-100 mb-3">All Accounts</h3>
			{#if data.accounts.length === 0}
				<p class="text-ash-400 text-sm">No accounts found.</p>
			{:else}
				<div class="space-y-2">
					{#each data.accounts as account (account.id)}
						<div class="flex items-center justify-between gap-3 bg-ash-700 rounded-lg px-4 py-3">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-8 h-8 rounded-full bg-ash-500 flex items-center justify-center flex-shrink-0">
									<i class="fas fa-user text-ash-200 text-xs"></i>
								</div>
								<div class="min-w-0">
									<p class="text-sm font-medium text-ash-100 truncate">{account.username}</p>
									<p class="text-xs text-ash-400 truncate">{account.email}</p>
								</div>
							</div>
							<div class="flex items-center gap-2 flex-shrink-0">
								<span class="text-xs px-2 py-0.5 rounded-full capitalize {badgeClass(account)}">
									{badgeLabel(account)}
								</span>
								<!-- Only show actions for other accounts -->
								{#if account.id !== data.user.account_id}
									<div class="flex items-center gap-1">
										{#if !account.email_verified}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/verify`, 'Account verified')}
												title="Verify account"
												class="text-xs px-2 py-1 rounded bg-ash-600 hover:bg-ash-500 text-ash-200 transition-colors"
											>
												<i class="fas fa-check"></i>
											</button>
										{/if}
										{#if account.is_frozen}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/unfreeze`, 'Account unfrozen')}
												title="Unfreeze account"
												class="text-xs px-2 py-1 rounded bg-ash-600 hover:bg-ash-500 text-ash-200 transition-colors"
											>
												<i class="fas fa-unlock"></i>
											</button>
										{:else}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/freeze`, 'Account frozen')}
												title="Freeze account"
												class="text-xs px-2 py-1 rounded bg-ash-600 hover:bg-ash-500 text-ash-200 transition-colors"
											>
												<i class="fas fa-lock"></i>
											</button>
										{/if}
										<button
											onclick={() => action('DELETE', `/api/panel/accounts/${account.id}`, 'Account deleted')}
											title="Delete account"
											class="text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors"
										>
											<i class="fas fa-trash"></i>
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
