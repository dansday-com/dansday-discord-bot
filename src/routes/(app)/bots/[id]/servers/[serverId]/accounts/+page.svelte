<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';
	import MemberPicker from '$lib/components/server/MemberPicker.svelte';

	let { data }: PageProps = $props();

	let inviteType = $state<'owner' | 'moderator'>(data.user.authenticated && data.user.account_source === 'accounts' ? 'owner' : 'moderator');
	let generatedLink = $state<string | null>(null);
	let copyIcon = $state('fa-copy');

	const validTypes = $derived(data.user.authenticated && data.user.account_source === 'accounts' ? ['owner', 'moderator'] : ['moderator']);
	const canInvite = $derived(
		data.user.authenticated &&
			(data.user.account_source === 'accounts' || (data.user.account_source === 'server_accounts' && data.user.account_type === 'owner'))
	);

	let selectedDiscordMemberId = $state('');
	let dmSending = $state(false);

	async function generateInvite() {
		const res = await fetch(`/api/servers/${data.serverId}/accounts`, {
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

	async function sendInviteDm() {
		if (!selectedDiscordMemberId) {
			showToast('Select a member first', 'error');
			return;
		}
		dmSending = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/accounts/invite-dm`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ account_type: inviteType, discord_member_id: selectedDiscordMemberId })
			});
			const d = await res.json();
			if (d.success) {
				showToast('Invite sent via DM', 'success');
				selectedDiscordMemberId = '';
				invalidateAll();
			} else {
				showToast(d.error || 'Failed to send DM invite', 'error');
			}
		} catch {
			showToast('Failed to send DM invite', 'error');
		} finally {
			dmSending = false;
		}
	}

	async function copyLink() {
		if (!generatedLink) return;
		await navigator.clipboard.writeText(generatedLink);
		copyIcon = 'fa-check';
		setTimeout(() => (copyIcon = 'fa-copy'), 2000);
	}

	async function deleteAccount(accountId: number) {
		const res = await fetch(`/api/servers/${data.serverId}/accounts/${accountId}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		const d = await res.json();
		if (d.success) {
			showToast('Account removed', 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Failed to remove account', 'error');
		}
	}

	async function toggleFreeze(accountId: number, currentlyFrozen: boolean) {
		const res = await fetch(`/api/servers/${data.serverId}/accounts/${accountId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ is_frozen: !currentlyFrozen })
		});
		const d = await res.json();
		if (d.success) {
			showToast(currentlyFrozen ? 'Account unfrozen' : 'Account frozen', 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Failed to update account', 'error');
		}
	}

	const isSuperadmin = $derived(data.user.authenticated && data.user.account_source === 'accounts');
	const isOwner = $derived(data.user.authenticated && data.user.account_source === 'server_accounts' && data.user.account_type === 'owner');

	function maskEmail(email: string) {
		const at = email.indexOf('@');
		if (at <= 0) return email.slice(0, 3) + '***';
		const local = email.slice(0, at);
		const domain = email.slice(at + 1);
		const prefix = local.slice(0, 3);
		return `${prefix}***@${domain}`;
	}

	function typeBadgeClass(type: string) {
		if (type === 'owner') return 'bg-blue-900 text-blue-300';
		return 'bg-ash-700 text-ash-300';
	}

	function inviteStatusClass(invite: any) {
		const expiresAt = invite.expires_at ? new Date(String(invite.expires_at).replace(' ', 'T')) : null;
		if (invite.used_by) return 'bg-green-900 text-green-300';
		if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()) return 'bg-red-900 text-red-300';
		return 'bg-yellow-900 text-yellow-300';
	}

	function inviteStatusLabel(invite: any) {
		const expiresAt = invite.expires_at ? new Date(String(invite.expires_at).replace(' ', 'T')) : null;
		if (invite.used_by) return 'Used';
		if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()) return 'Expired';
		return 'Pending';
	}
</script>

<svelte:head>
	<title>Server Accounts | Dansday</title>
</svelte:head>

<div class="space-y-6">
	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h2 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold">
			<i class="fas fa-user-shield text-ash-200"></i>Server Accounts
		</h2>

		<div class="mb-8">
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">Generate Invite Link</h3>
			<div class="mb-4 flex flex-col gap-2 sm:flex-row">
				<select
					bind:value={inviteType}
					class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none sm:px-4"
				>
					{#each validTypes as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
				<button onclick={generateInvite} class="bg-ash-400 hover:bg-ash-500 text-ash-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-all">
					<i class="fas fa-link mr-2"></i>Generate Link
				</button>
			</div>

			<div class="bg-ash-700 rounded-lg p-3">
				<p class="text-ash-300 mb-2 text-sm">Send invite via DM</p>
				<div class="flex flex-col gap-2 sm:flex-row">
					<MemberPicker
						serverId={data.serverId}
						value={selectedDiscordMemberId}
						disabled={!canInvite}
						placeholder={canInvite ? 'Select member...' : 'Invites are owner/superadmin only'}
						onchange={(id) => (selectedDiscordMemberId = id)}
					/>

					<button
						type="button"
						disabled={!canInvite || dmSending || !selectedDiscordMemberId}
						onclick={sendInviteDm}
						class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if dmSending}<i class="fas fa-spinner fa-spin mr-2"></i>{/if}
						<i class="fas fa-paper-plane mr-2"></i>Send DM
					</button>
				</div>
				<p class="text-ash-400 mt-2 text-xs">If the user has DMs closed or blocked the bot, sending may fail.</p>
			</div>

			{#if generatedLink}
				<div class="bg-ash-700 rounded-lg p-3">
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

		<div class="mb-8">
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">Accounts</h3>
			{#if data.accounts.length === 0}
				<p class="text-ash-400 text-sm">No accounts yet.</p>
			{:else}
				<div class="space-y-2">
					{#each data.accounts as account (account.id)}
						<div class="bg-ash-700 flex items-center justify-between gap-3 rounded-lg px-4 py-3 {account.is_frozen ? 'opacity-60' : ''}">
							<div class="flex min-w-0 items-center gap-3">
								<div class="bg-ash-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
									<i class="fas fa-user text-ash-200 text-xs"></i>
								</div>
								<div class="min-w-0">
									<p class="text-ash-100 truncate text-sm font-medium">{account.username}</p>
									<p class="text-ash-400 truncate text-xs">{isSuperadmin ? account.email : maskEmail(account.email)}</p>
									{#if account.ip_address && isSuperadmin}
										<p class="text-ash-500 truncate text-xs"><i class="fas fa-network-wired mr-1"></i>{account.ip_address}</p>
									{/if}
								</div>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<span class="rounded-full px-2 py-0.5 text-xs capitalize {typeBadgeClass(account.account_type)}">
									{account.account_type}
								</span>
								{#if account.is_frozen}
									<span class="rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-300">Frozen</span>
								{/if}
								{#if account.id !== data.user.account_id && (isSuperadmin || (isOwner && account.account_type !== 'owner'))}
									<button
										onclick={() => toggleFreeze(account.id, account.is_frozen)}
										title={account.is_frozen ? 'Unfreeze account' : 'Freeze account'}
										class="rounded px-2 py-1 text-xs transition-colors {account.is_frozen
											? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
											: 'bg-ash-600 text-ash-300 hover:bg-ash-500'}"
									>
										<i class="fas {account.is_frozen ? 'fa-unlock' : 'fa-lock'}"></i>
									</button>
									<button
										onclick={() => deleteAccount(account.id)}
										title="Remove account"
										class="rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800"
									>
										<i class="fas fa-trash"></i>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div>
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">Invite Links</h3>
			{#if data.invites.length === 0}
				<p class="text-ash-400 text-sm">No invite links generated yet.</p>
			{:else}
				<div class="space-y-2">
					{#each data.invites as invite (invite.id)}
						<div class="bg-ash-700 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
							<div class="min-w-0">
								<p class="text-ash-100 text-sm font-medium capitalize">{invite.account_type} invite</p>
								<p class="text-ash-400 text-xs">By {invite.creator_username ?? 'unknown'}</p>
							</div>
							<span class="shrink-0 rounded-full px-2 py-0.5 text-xs {inviteStatusClass(invite)}">
								{inviteStatusLabel(invite)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
