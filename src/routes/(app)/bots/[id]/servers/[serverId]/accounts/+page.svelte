<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import MemberPicker from '$lib/frontend/components/MemberPicker.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';

	let { data }: PageProps = $props();

	let inviteType = $state<'owner' | 'moderator'>(data.user.authenticated && data.user.account_source === 'accounts' ? 'owner' : 'moderator');
	let generatedLink = $state<string | null>(null);
	let copyIcon = $state('fa-copy');
	let selectedDiscordMemberIds = $state<string[]>([]);
	let inviting = $state(false);

	const validTypes = $derived(data.user.authenticated && data.user.account_source === 'accounts' ? ['owner', 'moderator'] : ['moderator']);
	const inviteTypeOptions = $derived<LabeledSelectOption[]>(validTypes.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })));
	const canInvite = $derived(
		data.user.authenticated &&
			(data.user.account_source === 'accounts' || (data.user.account_source === 'server_accounts' && data.user.account_type === 'owner'))
	);

	async function sendInvite() {
		if (selectedDiscordMemberIds.length === 0) {
			showToast('Select at least one member', 'error');
			return;
		}
		inviting = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/accounts/invite-dm`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ account_type: inviteType, discord_member_ids: selectedDiscordMemberIds })
			});
			const d = await res.json();
			if (d.success) {
				generatedLink = d.invite_link ?? null;
				const n = typeof d.sent_count === 'number' ? d.sent_count : selectedDiscordMemberIds.length;
				const failed = Array.isArray(d.failed) ? d.failed : [];
				if (failed.length > 0) {
					const hint = String(failed[0]?.error ?? 'unknown error');
					showToast(`Sent ${n} invite(s); ${failed.length} failed. Example: ${hint}`, 'info');
				} else {
					showToast(n > 1 ? `Sent ${n} invites via DM` : 'Invite sent via DM', 'success');
				}
				selectedDiscordMemberIds = [];
				invalidateAll();
			} else {
				showToast(d.error || 'Failed to send invite', 'error');
			}
		} catch {
			showToast('Failed to send invite', 'error');
		} finally {
			inviting = false;
		}
	}

	async function copyLink() {
		if (!generatedLink) return;
		await navigator.clipboard.writeText(generatedLink);
		copyIcon = 'fa-check';
		setTimeout(() => (copyIcon = 'fa-copy'), 2000);
	}

	type PendingAction =
		| { kind: 'account'; accountId: number; type: 'delete' | 'freeze' | 'unfreeze'; label: string }
		| { kind: 'invite'; inviteId: number; label: string };
	let pending = $state<PendingAction | null>(null);
	let confirming = $state(false);

	function confirmDelete(accountId: number, name: string) {
		pending = { kind: 'account', accountId, type: 'delete', label: name };
	}

	function confirmFreeze(accountId: number, currentlyFrozen: boolean, name: string) {
		pending = { kind: 'account', accountId, type: currentlyFrozen ? 'unfreeze' : 'freeze', label: name };
	}

	function confirmExpireInvite(inviteId: number, label: string) {
		pending = { kind: 'invite', inviteId, label };
	}

	async function executeConfirmed() {
		if (!pending) return;
		confirming = true;
		try {
			if (pending.kind === 'invite') {
				const res = await fetch(`/api/servers/${data.serverId}/accounts/invites/${pending.inviteId}/expire`, {
					method: 'POST',
					credentials: 'include'
				});
				const d = await res.json();
				if (d.success) {
					showToast('Invite link expired', 'success');
					invalidateAll();
				} else showToast(d.error || 'Failed to expire invite', 'error');
			} else if (pending.type === 'delete') {
				const res = await fetch(`/api/servers/${data.serverId}/accounts/${pending.accountId}`, {
					method: 'DELETE',
					credentials: 'include'
				});
				const d = await res.json();
				if (d.success) {
					showToast('Account removed', 'success');
					invalidateAll();
				} else showToast(d.error || 'Failed to remove account', 'error');
			} else {
				const res = await fetch(`/api/servers/${data.serverId}/accounts/${pending.accountId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ is_frozen: pending.type === 'freeze' })
				});
				const d = await res.json();
				if (d.success) {
					showToast(pending.type === 'freeze' ? 'Account frozen' : 'Account unfrozen', 'success');
					invalidateAll();
				} else showToast(d.error || 'Failed to update account', 'error');
			}
		} finally {
			confirming = false;
			pending = null;
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

	function inviteExpiresAtMs(invite: any): number | null {
		const d = invite.expires_at ? parseMySQLDateTimeUtc(invite.expires_at) : null;
		return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
	}

	function inviteStatusClass(invite: any) {
		const endMs = inviteExpiresAtMs(invite);
		if (invite.used_by) return 'bg-green-900 text-green-300';
		if (endMs != null && endMs < Date.now()) return 'bg-red-900 text-red-300';
		return 'bg-yellow-900 text-yellow-300';
	}

	function inviteStatusLabel(invite: any) {
		const endMs = inviteExpiresAtMs(invite);
		if (invite.used_by) return 'Used';
		if (endMs != null && endMs < Date.now()) return 'Expired';
		return 'Pending';
	}

	function isInviteExpired(invite: any): boolean {
		const endMs = inviteExpiresAtMs(invite);
		return endMs != null && endMs < Date.now();
	}
</script>

<svelte:head>
	<title>Server Accounts | Dansday Discord Bot</title>
</svelte:head>

<div class="space-y-6">
	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h2 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold">
			<i class="fas fa-user-shield text-amber-400"></i>Server Accounts
		</h2>

		<div class="mb-8">
			<h3 class="text-ash-100 mb-3 text-lg font-semibold">Send Invite</h3>
			<div class="flex flex-col gap-2 sm:flex-row">
				<LabeledSelect appearance="form-inline" options={inviteTypeOptions} bind:value={inviteType} ariaLabel="Invite account type" />
				<MemberPicker
					serverId={data.serverId}
					single={false}
					showMultiChips={false}
					value={selectedDiscordMemberIds}
					disabled={!canInvite}
					placeholder={canInvite ? 'Select members...' : 'Owner/superadmin only'}
					onchange={(ids) => (selectedDiscordMemberIds = ids as string[])}
				/>
				<button
					type="button"
					disabled={!canInvite || inviting || selectedDiscordMemberIds.length === 0}
					onclick={sendInvite}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if inviting}<i class="fas fa-spinner fa-spin text-amber-300"></i>{:else}<i class="fas fa-paper-plane text-amber-300"></i>{/if}
					Send DM
				</button>
			</div>
			<p class="text-ash-500 mt-2 text-xs">DM will be sent with the invite link. If DMs are closed, sending may fail.</p>

			{#if generatedLink}
				<div class="bg-ash-700 mt-3 rounded-lg p-3">
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
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
									<i class="fas fa-user text-xs text-amber-400"></i>
								</div>
								<div class="min-w-0">
									<p class="text-ash-100 truncate text-sm font-medium">{account.username}</p>
									<p class="text-ash-400 truncate text-xs">{isSuperadmin ? account.email : maskEmail(account.email)}</p>
									{#if account.ip_address && isSuperadmin}
										<p class="text-ash-500 truncate text-xs"><i class="fas fa-network-wired mr-1 text-cyan-400/80"></i>{account.ip_address}</p>
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
								{#if isSuperadmin || (isOwner && account.account_type === 'moderator' && account.id !== data.user.account_id)}
									<button
										onclick={() => confirmFreeze(account.id, account.is_frozen, account.username)}
										title={account.is_frozen ? 'Unfreeze account' : 'Freeze account'}
										class="rounded px-2 py-1 text-xs transition-colors {account.is_frozen
											? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
											: 'bg-ash-600 text-ash-300 hover:bg-ash-500'}"
									>
										<i class="fas {account.is_frozen ? 'fa-unlock text-yellow-300' : 'fa-lock text-ash-300'}"></i>
									</button>
									<button
										onclick={() => confirmDelete(account.id, account.username)}
										title="Remove account"
										class="rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800"
									>
										<i class="fas fa-trash text-red-300"></i>
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
						<div class="bg-ash-700 flex flex-col gap-2 rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
							<div class="min-w-0 flex-1">
								<p class="text-ash-100 text-sm font-medium capitalize">{invite.account_type} invite</p>
								<p class="text-ash-400 text-xs">
									Created by {invite.creator_username ?? invite.creator_admin_username ?? 'Unknown'}
								</p>
								<p class="text-ash-300 mt-1 text-xs">
									<i class="fas fa-clock mr-1 text-amber-400/80"></i>
									{#if invite.used_by}
										Used — expiry was {#if invite.expires_at}<LocalTime value={invite.expires_at} includeSeconds class="inline" />{:else}no expiry{/if}
									{:else if isInviteExpired(invite)}
										Expired at {#if invite.expires_at}<LocalTime value={invite.expires_at} includeSeconds class="inline" />{:else}—{/if}
									{:else}
										Expires {#if invite.expires_at}<LocalTime value={invite.expires_at} includeSeconds class="inline" />{:else}no expiry set{/if}
									{/if}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<span class="rounded-full px-2 py-0.5 text-xs {inviteStatusClass(invite)}">
									{inviteStatusLabel(invite)}
								</span>
								{#if canInvite && !invite.used_by && !isInviteExpired(invite)}
									<button
										type="button"
										title="Expire this link (it cannot be used to register)"
										onclick={() => confirmExpireInvite(invite.id, `${invite.account_type} invite`)}
										class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded px-2 py-1 text-xs transition-colors"
									>
										<i class="fas fa-ban mr-1 text-amber-300"></i>Expire
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmModal
	open={pending !== null}
	title={pending?.kind === 'invite'
		? 'Expire invite link'
		: pending?.type === 'delete'
			? 'Remove Account'
			: pending?.type === 'freeze'
				? 'Freeze Account'
				: 'Unfreeze Account'}
	message={pending?.kind === 'invite'
		? `Expire ${pending.label}? The link will stop working; the row stays in the list for reference.`
		: pending?.type === 'delete'
			? `Remove "${pending.label}"? They will lose access immediately.`
			: pending?.type === 'freeze'
				? `Freeze "${pending?.label}"? They won't be able to log in until unfrozen.`
				: `Unfreeze "${pending?.label}"? They will regain access immediately.`}
	confirmLabel={pending?.kind === 'invite' ? 'Expire link' : pending?.type === 'delete' ? 'Remove' : pending?.type === 'freeze' ? 'Freeze' : 'Unfreeze'}
	dangerous={pending?.kind === 'invite' ? false : pending?.type === 'delete'}
	loading={confirming}
	onconfirm={executeConfirmed}
	oncancel={() => (pending = null)}
/>
