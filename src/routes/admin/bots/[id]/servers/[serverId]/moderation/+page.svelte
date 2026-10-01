<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';

	let { data }: PageProps = $props();

	const ACTIONS = [
		{ value: 'warn', label: 'Warn', icon: 'fa-triangle-exclamation', color: 'text-amber-400' },
		{ value: 'timeout', label: 'Timeout', icon: 'fa-volume-xmark', color: 'text-orange-400' },
		{ value: 'untimeout', label: 'Remove timeout', icon: 'fa-volume-high', color: 'text-emerald-400' },
		{ value: 'kick', label: 'Kick', icon: 'fa-door-open', color: 'text-sky-400' },
		{ value: 'ban', label: 'Ban', icon: 'fa-gavel', color: 'text-red-400' },
		{ value: 'tempban', label: 'Temporary ban', icon: 'fa-hourglass-half', color: 'text-rose-400' },
		{ value: 'unban', label: 'Unban', icon: 'fa-dove', color: 'text-emerald-400' },
		{ value: 'clearwarns', label: 'Clear warnings', icon: 'fa-broom', color: 'text-violet-400' }
	];
	const LOG_META: Record<string, { label: string; icon: string; color: string }> = {
		...Object.fromEntries(ACTIONS.map((a) => [a.value, a])),
		unwarn: { label: 'Remove warning', icon: 'fa-eraser', color: 'text-violet-400' }
	};

	let busy = $state(false);
	let filterAction = $state('all');
	let filterStatus = $state('all');
	let search = $state('');
	let confirm = $state<{ title: string; message: string; body: Record<string, unknown> } | null>(null);

	const stats = $derived({
		total: data.logs.length,
		warnings: data.logs.filter((l) => l.action === 'warn' && l.active).length,
		timeouts: data.logs.filter((l) => l.action === 'timeout').length,
		bans: data.logs.filter((l) => (l.action === 'ban' || l.action === 'tempban') && l.active).length
	});

	const filtered = $derived(
		data.logs.filter((l) => {
			if (filterAction !== 'all' && l.action !== filterAction) return false;
			if (filterStatus === 'active' && !l.active) return false;
			if (filterStatus === 'revoked' && !l.revoked_at) return false;
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return (
				String(l.case_number) === q.replace('#', '') ||
				(l.member_name ?? '').toLowerCase().includes(q) ||
				l.discord_member_id.includes(q) ||
				(l.staff_name ?? '').toLowerCase().includes(q) ||
				(l.reason ?? '').toLowerCase().includes(q)
			);
		})
	);

	function duration(seconds: number | null) {
		if (!seconds) return null;
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || `${seconds}s`;
	}

	async function send(body: Record<string, unknown>) {
		busy = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/moderation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Moderation action failed', 'error');
				return false;
			}
			showToast(out.case_number ? `Case #${out.case_number} recorded` : 'Done', 'success');
			await invalidateAll();
			return true;
		} catch {
			showToast('Moderation action failed', 'error');
			return false;
		} finally {
			busy = false;
		}
	}

	function unban(memberId: string, name: string) {
		confirm = { title: 'Unban', message: `Unban ${name}?`, body: { action: 'unban', target_id: memberId } };
	}

	function revoke(caseNumber: number) {
		confirm = { title: 'Remove warning', message: `Remove warning case #${caseNumber}?`, body: { action: 'unwarn', case_number: caseNumber } };
	}

	function clearFor(memberId: string, name: string) {
		confirm = { title: 'Clear warnings', message: `Clear every active warning for ${name}?`, body: { action: 'clearwarns', target_id: memberId } };
	}

	async function runConfirm() {
		const pending = confirm;
		confirm = null;
		if (!pending) return;
		await send(pending.body);
	}
</script>

<svelte:head>
	<title>Moderation - {APP_NAME}</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each [{ label: 'Cases', value: stats.total, icon: 'fa-folder-open', color: 'text-sky-400' }, { label: 'Active warnings', value: stats.warnings, icon: 'fa-triangle-exclamation', color: 'text-amber-400' }, { label: 'Timeouts', value: stats.timeouts, icon: 'fa-volume-xmark', color: 'text-orange-400' }, { label: 'Active bans', value: stats.bans, icon: 'fa-gavel', color: 'text-red-400' }] as tile (tile.label)}
			<div class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-4">
				<div class="text-ash-400 flex items-center gap-2 text-xs"><i class="fas {tile.icon} {tile.color}"></i>{tile.label}</div>
				<div class="text-ash-100 mt-1 text-xl font-bold sm:text-2xl">{tile.value}</div>
			</div>
		{/each}
	</div>

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold"><i class="fas fa-scroll text-sky-400"></i>Moderation logs</h3>

		<div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
			<input
				bind:value={search}
				placeholder="Search member, staff, reason or #case"
				class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm"
			/>
			<select bind:value={filterAction} aria-label="Action filter" class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm">
				<option value="all">All actions</option>
				{#each Object.entries(LOG_META) as [value, meta] (value)}
					<option {value}>{meta.label}</option>
				{/each}
			</select>
			<select bind:value={filterStatus} aria-label="Status filter" class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm">
				<option value="all">Any status</option>
				<option value="active">Active</option>
				<option value="revoked">Revoked</option>
			</select>
		</div>

		{#if filtered.length === 0}
			<p class="text-ash-400 py-8 text-center text-sm">No moderation cases yet.</p>
		{:else}
			<ul class="divide-ash-700 divide-y">
				{#each filtered as log (log.id)}
					{@const meta = LOG_META[log.action] ?? { label: log.action, icon: 'fa-circle', color: 'text-ash-400' }}
					<li class="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
						<div class="flex min-w-0 flex-1 items-start gap-3">
							<div class="bg-ash-700 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
								{#if log.member_avatar}
									<img src={log.member_avatar} alt="" class="h-full w-full object-cover" />
								{:else}
									<i class="fas fa-user text-ash-400 text-sm"></i>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
									<span class="text-ash-400 font-mono text-xs">#{log.case_number}</span>
									<span class="inline-flex items-center gap-1 font-semibold {meta.color}"><i class="fas {meta.icon}"></i>{meta.label}</span>
									<span class="text-ash-100 truncate font-medium">{log.member_name || log.discord_member_id}</span>
									{#if log.duration_seconds}
										<span class="bg-ash-700 text-ash-300 rounded px-1.5 py-0.5 text-xs">{duration(log.duration_seconds)}</span>
									{/if}
									{#if log.revoked_at}
										<span class="bg-ash-700 text-ash-400 rounded px-1.5 py-0.5 text-xs">Revoked</span>
									{:else if log.active && ['warn', 'timeout', 'ban', 'tempban'].includes(log.action)}
										<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">Active</span>
									{/if}
								</div>
								<p class="text-ash-300 mt-1 text-sm break-words">{log.reason || 'No reason provided'}</p>
								<p class="text-ash-500 mt-1 text-xs">
									{log.staff_name || (log.source === 'panel' ? 'Panel' : log.source === 'auto' ? 'Automatic' : 'Unknown')} · {log.source} ·
									<LocalTime value={log.created_at} class="inline" />
								</p>
							</div>
						</div>
						{#if (log.action === 'ban' || log.action === 'tempban') && log.active}
							<div class="flex shrink-0 gap-2 sm:flex-col">
								<button
									type="button"
									disabled={busy}
									onclick={() => unban(log.discord_member_id, log.member_name || log.discord_member_id)}
									class="border-ash-600 text-ash-200 hover:bg-ash-700 flex-1 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
								>
									<i class="fas fa-dove mr-1 text-emerald-400"></i>Unban
								</button>
							</div>
						{/if}
						{#if log.action === 'warn' && log.active}
							<div class="flex shrink-0 gap-2 sm:flex-col">
								<button
									type="button"
									disabled={busy}
									onclick={() => revoke(log.case_number)}
									class="border-ash-600 text-ash-200 hover:bg-ash-700 flex-1 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
								>
									<i class="fas fa-eraser mr-1 text-violet-400"></i>Remove
								</button>
								<button
									type="button"
									disabled={busy}
									onclick={() => clearFor(log.discord_member_id, log.member_name || log.discord_member_id)}
									class="border-ash-600 text-ash-200 hover:bg-ash-700 flex-1 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
								>
									<i class="fas fa-broom mr-1 text-violet-400"></i>Clear all
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<ConfirmModal
	open={confirm !== null}
	dangerous={true}
	title={confirm?.title ?? ''}
	message={confirm?.message ?? ''}
	onconfirm={runConfirm}
	oncancel={() => (confirm = null)}
/>
