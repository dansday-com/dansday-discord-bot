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
		if (account.account_type === 'superadmin') return 'bg-ash-600 text-ash-200';
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

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	<!-- Back -->
	<a href="/" class="text-ash-400 hover:text-ash-100 mb-6 inline-flex items-center gap-2 text-sm transition-colors">
		<i class="fas fa-arrow-left"></i>Back to Dashboard
	</a>

	<div class="bg-ash-800 border-ash-700 mb-4 rounded-xl border p-4 sm:mb-6 sm:p-6">
		<h2 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold sm:text-2xl">
			<i class="fas fa-users text-ash-200"></i>Account Management
		</h2>

		<!-- Generate Invite -->
		<div class="mb-8">
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">Generate Invite Link</h3>
			<div class="mb-4 flex flex-col gap-2 sm:flex-row">
				<select
					bind:value={inviteType}
					class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4"
				>
					<option value="admin">Admin</option>
					<option value="moderator">Moderator</option>
				</select>
				<button onclick={generateInvite} class="bg-ash-400 hover:bg-ash-500 text-ash-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-all">
					<i class="fas fa-link mr-2"></i>Generate Link
				</button>
			</div>

			{#if generatedLink}
				<div class="bg-ash-700 mb-4 rounded-lg p-3">
					<p class="text-ash-300 mb-2 text-sm">Invite Link:</p>
					<div class="flex items-center gap-2">
						<input type="text" readonly value={generatedLink} class="bg-ash-800 border-ash-600 text-ash-100 flex-1 rounded border px-3 py-2 text-sm" />
						<button
							onclick={copyLink}
							aria-label="Copy invite link"
							class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded px-3 py-2 text-sm transition-colors"
						>
							<i class="fas {copyIcon}"></i>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Accounts list -->
		<div>
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">All Accounts</h3>
			{#if data.accounts.length === 0}
				<p class="text-ash-400 text-sm">No accounts found.</p>
			{:else}
				<div class="space-y-2">
					{#each data.accounts as account (account.id)}
						<div class="bg-ash-700 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
							<div class="flex min-w-0 items-center gap-3">
								<div class="bg-ash-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
									<i class="fas fa-user text-ash-200 text-xs"></i>
								</div>
								<div class="min-w-0">
									<p class="text-ash-100 truncate text-sm font-medium">{account.username}</p>
									<p class="text-ash-400 truncate text-xs">{account.email}</p>
								</div>
							</div>
							<div class="flex flex-shrink-0 items-center gap-2">
								<span class="rounded-full px-2 py-0.5 text-xs capitalize {badgeClass(account)}">
									{badgeLabel(account)}
								</span>
								<!-- Only show actions for other accounts -->
								{#if account.id !== data.user.account_id}
									<div class="flex items-center gap-1">
										{#if !account.email_verified}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/verify`, 'Account verified')}
												title="Verify account"
												class="bg-ash-600 hover:bg-ash-500 text-ash-200 rounded px-2 py-1 text-xs transition-colors"
											>
												<i class="fas fa-check"></i>
											</button>
										{/if}
										{#if account.is_frozen}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/unfreeze`, 'Account unfrozen')}
												title="Unfreeze account"
												class="bg-ash-600 hover:bg-ash-500 text-ash-200 rounded px-2 py-1 text-xs transition-colors"
											>
												<i class="fas fa-unlock"></i>
											</button>
										{:else}
											<button
												onclick={() => action('PUT', `/api/panel/accounts/${account.id}/freeze`, 'Account frozen')}
												title="Freeze account"
												class="bg-ash-600 hover:bg-ash-500 text-ash-200 rounded px-2 py-1 text-xs transition-colors"
											>
												<i class="fas fa-lock"></i>
											</button>
										{/if}
										<button
											onclick={() => action('DELETE', `/api/panel/accounts/${account.id}`, 'Account deleted')}
											title="Delete account"
											class="rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800"
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
