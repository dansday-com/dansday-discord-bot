<script lang="ts">
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { PageProps } from './$types';

	type PendingAction = 'freeze' | 'unfreeze' | 'delete';
	type ActionCopy = {
		method: 'PATCH' | 'DELETE';
		isFrozen: boolean | null;
		title: string;
		confirmLabel: string;
		done: string;
		message: (label: string) => string;
	};

	const ACTIONS: Record<PendingAction, ActionCopy> = {
		freeze: {
			method: 'PATCH',
			isFrozen: true,
			title: 'Freeze Account',
			confirmLabel: 'Freeze',
			done: 'Account frozen',
			message: (label) => `Freeze "${label}" on every server? They won't be able to open any of them until unfrozen.`
		},
		unfreeze: {
			method: 'PATCH',
			isFrozen: false,
			title: 'Unfreeze Account',
			confirmLabel: 'Unfreeze',
			done: 'Account unfrozen',
			message: (label) => `Unfreeze "${label}" on every server? They regain access immediately.`
		},
		delete: {
			method: 'DELETE',
			isFrozen: null,
			title: 'Delete Account',
			confirmLabel: 'Delete',
			done: 'Account deleted',
			message: (label) => `Delete "${label}" from every server? They lose access to all of them immediately.`
		}
	};

	let { data }: PageProps = $props();

	let pending = $state<{ type: PendingAction; accountId: number; label: string } | null>(null);
	let isConfirming = $state(false);

	const pendingAction = $derived(pending ? ACTIONS[pending.type] : null);

	function isAllFrozen(account: (typeof data.accounts)[number]) {
		return account.servers.every((s) => s.is_frozen);
	}

	async function confirmPending() {
		if (!pending) {
			return;
		}
		const action = ACTIONS[pending.type];
		const { accountId } = pending;
		isConfirming = true;
		try {
			const res = await fetch(`/api/admin/accounts/${accountId}`, {
				method: action.method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: action.isFrozen === null ? undefined : JSON.stringify({ is_frozen: action.isFrozen })
			});
			const d = await res.json();
			if (d.success) {
				showToast(action.done, 'success');
				invalidateAll();
			} else {
				showToast(d.error || 'Failed to update account', 'error');
			}
		} finally {
			isConfirming = false;
			pending = null;
		}
	}
</script>

<svelte:head>
	<title>Accounts | {APP_NAME} Discord Bot</title>
</svelte:head>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-6">
	<h3 class="text-ash-100 mb-1 text-lg font-semibold"><i class="fas fa-users mr-2 text-amber-400"></i>Accounts</h3>
	<p class="text-ash-400 mb-4 text-xs">Owner and staff accounts on your servers. Freeze or delete here applies to every server at once.</p>

	{#if data.accounts.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No accounts yet.</p>
	{:else}
		<div class="space-y-2">
			{#each data.accounts as account (account.id)}
				{@const areAllFrozen = isAllFrozen(account)}
				<div class="bg-ash-700 flex flex-col gap-3 rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:justify-between {areAllFrozen ? 'opacity-60' : ''}">
					<div class="flex min-w-0 items-center gap-3">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
							<i class="fas fa-user text-xs text-amber-400"></i>
						</div>
						<div class="min-w-0">
							<p class="text-ash-100 truncate text-sm font-medium">{account.username}</p>
							<p class="text-ash-400 truncate text-xs">{account.email}</p>
							{#if account.ip_address}
								<p class="text-ash-500 truncate text-xs"><i class="fas fa-network-wired mr-1 text-cyan-400/80"></i>{account.ip_address}</p>
							{/if}
							<div class="mt-1.5 flex flex-wrap gap-1">
								{#each account.servers as server (server.server_id)}
									<span class="rounded-full px-2 py-0.5 text-xs {server.is_frozen ? 'bg-red-900 text-red-300' : 'bg-ash-600 text-ash-300'}">
										{server.server_name || 'Unnamed Server'} · <span class="capitalize">{server.account_type}</span>{server.is_frozen ? ' · Frozen' : ''}
									</span>
								{/each}
							</div>
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<button
							onclick={() => (pending = { type: areAllFrozen ? 'unfreeze' : 'freeze', accountId: account.id, label: account.username })}
							title={areAllFrozen ? 'Unfreeze on every server' : 'Freeze on every server'}
							class="rounded px-2 py-1 text-xs transition-colors {areAllFrozen
								? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
								: 'bg-ash-600 text-ash-300 hover:bg-ash-500'}"
						>
							<i class="fas {areAllFrozen ? 'fa-unlock text-yellow-300' : 'fa-lock text-ash-300'}"></i>
						</button>
						<button
							onclick={() => (pending = { type: 'delete', accountId: account.id, label: account.username })}
							title="Delete from every server"
							class="rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800"
						>
							<i class="fas fa-trash text-red-300"></i>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<ConfirmModal
	open={pending !== null}
	title={pendingAction?.title ?? ''}
	message={pending && pendingAction ? pendingAction.message(pending.label) : ''}
	confirmLabel={pendingAction?.confirmLabel}
	dangerous={pending?.type === 'delete'}
	loading={isConfirming}
	onconfirm={confirmPending}
	oncancel={() => (pending = null)}
/>
