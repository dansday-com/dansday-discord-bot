<script lang="ts">
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import MemberPicker from '$lib/frontend/components/MemberPicker.svelte';
	import { scrollLocked } from '$lib/frontend/scrollLock.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { INVITE_FAKE_REASON_LABEL, INVITE_SOURCE_LABEL, INVITE_STATUS_META, type InviteStatus } from '$lib/invites.js';

	interface Props {
		serverId: number | string;
		member: { id: string; name: string } | null;
		onclose: () => void;
		onchange?: (discordId: string, total: number) => void;
	}

	let { serverId, member, onclose, onchange }: Props = $props();

	type Stats = { joins: number; active: number; left: number; fake: number; pending: number; bonus: number; total: number; xp: number };

	let loading = $state(false);
	let busy = $state(false);
	let stats = $state<Stats | null>(null);
	let inviter = $state<any>(null);
	let invitees = $state<any[]>([]);
	let logs = $state<any[]>([]);
	let amount = $state(1);
	let reason = $state('');
	let assignTo = $state('');

	const statTiles = $derived(
		stats
			? [
					{ icon: 'fa-user-plus', label: 'Total', value: stats.total, tone: 'text-cyan-400' },
					{ icon: 'fa-user-check', label: 'Still here', value: stats.active, tone: 'text-emerald-400' },
					{ icon: 'fa-user-minus', label: 'Left', value: stats.left, tone: 'text-amber-400' },
					{ icon: 'fa-user-secret', label: 'Fake', value: stats.fake, tone: 'text-red-400' },
					{ icon: 'fa-plus-minus', label: 'Bonus', value: stats.bonus, tone: 'text-violet-400' },
					{ icon: 'fa-hourglass-half', label: 'Waiting', value: stats.pending, tone: 'text-sky-400' },
					{ icon: 'fa-star', label: 'XP earned', value: stats.xp, tone: 'text-yellow-400' }
				]
			: []
	);

	const canAssign = $derived(!!inviter && !inviter.inviter_discord_id && !inviter.rewarded_at);

	$effect(() => {
		if (member) {
			amount = 1;
			reason = '';
			assignTo = '';
			void load(member.id);
		} else {
			stats = null;
			inviter = null;
			invitees = [];
			logs = [];
		}
	});

	async function load(discordId: string) {
		loading = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/invites?member=${encodeURIComponent(discordId)}`, { credentials: 'include' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Could not load invites', 'error');
				return;
			}
			stats = out.stats;
			inviter = out.inviter;
			invitees = out.invitees ?? [];
			logs = out.logs ?? [];
		} finally {
			loading = false;
		}
	}

	async function post(payload: Record<string, unknown>) {
		if (!member) return null;
		busy = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ member: member.id, ...payload })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Action failed', 'error');
				return null;
			}
			return out;
		} finally {
			busy = false;
		}
	}

	async function adjust(sign: 1 | -1) {
		if (!member) return;
		const value = Math.trunc(Number(amount)) * sign;
		if (!value) return showToast('Enter an amount', 'error');
		if (!reason.trim()) return showToast('Enter a reason', 'error');
		const out = await post({ action: 'adjust', amount: value, reason: reason.trim() });
		if (!out) return;
		showToast(`${sign > 0 ? 'Added' : 'Removed'} ${Math.abs(value)} invite${Math.abs(value) === 1 ? '' : 's'}`, 'success');
		reason = '';
		onchange?.(member.id, out.stats.total);
		await load(member.id);
	}

	async function assign() {
		if (!member || !assignTo) return;
		const out = await post({ action: 'assign', inviter: assignTo });
		if (!out) return;
		showToast('Inviter saved', 'success');
		await load(member.id);
	}

	function statusMeta(status: string) {
		return INVITE_STATUS_META[(status as InviteStatus) ?? 'active'] ?? INVITE_STATUS_META.active;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !busy) onclose();
	}
</script>

{#if member}
	<div
		use:scrollLocked
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Member invites"
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-lg rounded-2xl border p-4 sm:p-6">
			<div class="mb-4 flex items-center justify-between gap-2">
				<h3 class="text-ash-100 flex min-w-0 items-center gap-2 text-base font-bold sm:text-lg">
					<i class="fas fa-user-plus shrink-0 text-cyan-400"></i><span class="truncate">Invites · {member.name}</span>
				</h3>
				<button onclick={onclose} disabled={busy} aria-label="Close modal" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			{#if loading && !stats}
				<div class="text-ash-400 py-8 text-center text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading…</div>
			{:else if stats}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each statTiles as t (t.label)}
						<div class="bg-ash-700 border-ash-600 flex flex-col items-center gap-0.5 rounded-lg border p-2 text-center">
							<i class="fas {t.icon} text-xs {t.tone}"></i>
							<span class="text-ash-100 text-sm font-bold tabular-nums">{t.value.toLocaleString()}</span>
							<span class="text-ash-400 text-[0.6rem] tracking-wide uppercase">{t.label}</span>
						</div>
					{/each}
				</div>

				<div class="border-ash-700 mt-4 border-t pt-4">
					<p class="text-ash-300 mb-2 text-sm font-medium"><i class="fas fa-right-to-bracket mr-1.5 text-cyan-400"></i>How they joined</p>
					{#if !inviter}
						<p class="text-ash-500 text-xs">Joined before invite tracking started.</p>
					{:else}
						<div class="bg-ash-700 border-ash-600 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-xs">
							<span class="text-ash-100 font-semibold">{inviter.inviter_name ?? 'No inviter'}</span>
							<span class="text-ash-400">{INVITE_SOURCE_LABEL[inviter.source] ?? inviter.source}{inviter.code ? ` · ${inviter.code}` : ''}</span>
							<span class="text-ash-400"><LocalTime value={inviter.created_at} fallback="" /></span>
						</div>
						{#if canAssign}
							<div class="mt-2 flex flex-col gap-2 sm:flex-row">
								<div class="min-w-0 flex-1">
									<MemberPicker serverId={Number(serverId)} value={assignTo} placeholder="Pick who invited them..." onchange={(v) => (assignTo = String(v))} />
								</div>
								<button
									type="button"
									onclick={assign}
									disabled={busy || !assignTo}
									class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
								>
									Set inviter
								</button>
							</div>
							<p class="text-ash-500 mt-1.5 text-xs">Counts as their invite. Pays no XP.</p>
						{/if}
					{/if}
				</div>

				<div class="border-ash-700 mt-4 border-t pt-4">
					<p class="text-ash-300 mb-2 text-sm font-medium"><i class="fas fa-users mr-1.5 text-cyan-400"></i>Members they invited</p>
					{#if invitees.length === 0}
						<p class="text-ash-500 text-xs">Nobody yet.</p>
					{:else}
						<ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
							{#each invitees as i (i.id)}
								{@const meta = statusMeta(i.status)}
								<li class="bg-ash-700 border-ash-600 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
									<i class="fas {meta.icon} {meta.tone} shrink-0"></i>
									<span class="text-ash-100 min-w-0 flex-1 truncate font-medium">{i.name ?? i.discord_member_id}</span>
									<span class="text-ash-400 hidden shrink-0 sm:inline"><LocalTime value={i.created_at} fallback="" /></span>
									<span class="shrink-0 {meta.tone}">
										{i.fake_reason ? (INVITE_FAKE_REASON_LABEL[i.fake_reason] ?? meta.label) : meta.label}
									</span>
									{#if Number(i.xp) > 0}
										<span class="shrink-0 text-yellow-400">+{Number(i.xp).toLocaleString()} XP</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="border-ash-700 mt-4 border-t pt-4">
					<p class="text-ash-300 mb-2 text-sm font-medium"><i class="fas fa-plus-minus mr-1.5 text-violet-400"></i>Bonus invites</p>
					<div class="flex flex-col gap-2">
						<input
							type="number"
							min="1"
							max="10000"
							bind:value={amount}
							aria-label="Amount"
							class="bg-ash-700 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm sm:w-28"
						/>
						<input
							type="text"
							maxlength="500"
							bind:value={reason}
							placeholder="Reason"
							aria-label="Reason"
							class="bg-ash-700 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
						/>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => adjust(1)}
								disabled={busy}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
							>
								<i class="fas fa-plus"></i>Add
							</button>
							<button
								type="button"
								onclick={() => adjust(-1)}
								disabled={busy}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
							>
								<i class="fas fa-minus"></i>Remove
							</button>
						</div>
					</div>
					<p class="text-ash-500 mt-2 text-xs">Bonus changes the invite count only. It pays no XP.</p>

					{#if logs.length > 0}
						<ul class="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
							{#each logs as l (l.id)}
								<li class="bg-ash-700 border-ash-600 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
									<span class="shrink-0 font-bold tabular-nums {Number(l.amount) > 0 ? 'text-emerald-400' : 'text-red-400'}">
										{Number(l.amount) > 0 ? '+' : ''}{Number(l.amount).toLocaleString()}
									</span>
									<span class="text-ash-200 min-w-0 flex-1 truncate">{l.reason ?? ''}</span>
									<span class="text-ash-400 hidden shrink-0 sm:inline">{l.server_account_username ?? l.account_username ?? 'Panel'}</span>
									<span class="text-ash-400 shrink-0"><LocalTime value={l.created_at} fallback="" /></span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
