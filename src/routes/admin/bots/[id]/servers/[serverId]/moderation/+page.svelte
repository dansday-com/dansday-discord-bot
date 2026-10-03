<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import ModerationMemberRecord from '$lib/frontend/components/ModerationMemberRecord.svelte';
	import ModerationRules from '$lib/frontend/components/ModerationRules.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { DURATION_UNITS, MODERATION_ACTION_META, MODERATION_REASON_OPTIONAL, MODERATION_TIMED_ACTIONS, moderateEach } from '$lib/frontend/moderation.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 50;
	const MEMBER_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'clearwarns', 'role_add', 'role_remove'];
	const BAN_ACTIONS = ['unban'];
	const ROLE_ACTIONS = ['role_add', 'role_remove'];
	const WHO_OPTIONS = [
		{ value: 'all', label: 'Everyone' },
		{ value: 'with', label: 'Members with role' },
		{ value: 'without', label: 'Members without role' }
	];

	let tab = $state<'all' | 'warned' | 'timedout' | 'banned'>('all');
	let search = $state('');
	let roleFilter = $state('');
	let page = $state(1);
	let selected = $state<Set<string>>(new Set());
	let expanded = $state<string | null>(null);

	let action = $state('warn');
	let reason = $state('');
	let preset = $state('');
	let amount = $state(10);
	let unit = $state('60');
	let actionRoleId = $state('');
	let busy = $state(false);
	let progress = $state<{ done: number; total: number } | null>(null);
	let confirm = $state<{ title: string; message: string; run: () => Promise<void> } | null>(null);

	let unbanReason = $state('');
	let warnsReason = $state('');
	let roleAction = $state('role_add');
	let roleId = $state('');
	let roleWho = $state('all');
	let whoRoleId = $state('');

	const locked = $derived(new Set(data.lockedIds));
	const q = $derived(search.trim().toLowerCase());
	const warnedCount = $derived(data.members.filter((m) => m.warnings > 0).length);
	const timedOutCount = $derived(data.members.filter((m) => m.timeout_until).length);

	const tabs = $derived([
		{ id: 'all' as const, label: 'All members', count: data.members.length },
		{ id: 'warned' as const, label: 'Warned', count: warnedCount },
		{ id: 'timedout' as const, label: 'Timed out', count: timedOutCount },
		{ id: 'banned' as const, label: 'Banned', count: data.bans.length }
	]);

	const memberRows = $derived(
		data.members.filter((m) => {
			if (tab === 'warned' && m.warnings === 0) return false;
			if (tab === 'timedout' && !m.timeout_until) return false;
			if (roleFilter && !m.role_ids.includes(roleFilter)) return false;
			if (!q) return true;
			return m.name.toLowerCase().includes(q) || (m.username ?? '').toLowerCase().includes(q) || m.id.includes(q);
		})
	);
	const banRows = $derived(data.bans.filter((b) => !q || (b.name ?? '').toLowerCase().includes(q) || b.discord_member_id.includes(q)));
	const rowIds = $derived(tab === 'banned' ? banRows.map((b) => b.discord_member_id) : memberRows.map((m) => m.id));
	const totalPages = $derived(Math.max(1, Math.ceil(rowIds.length / PAGE_SIZE)));
	const pageStart = $derived((Math.min(page, totalPages) - 1) * PAGE_SIZE);
	const pageMembers = $derived(memberRows.slice(pageStart, pageStart + PAGE_SIZE));
	const pageBans = $derived(banRows.slice(pageStart, pageStart + PAGE_SIZE));
	const pageIds = $derived(rowIds.slice(pageStart, pageStart + PAGE_SIZE).filter((id) => !locked.has(id)));
	const matchingIds = $derived(rowIds.filter((id) => !locked.has(id)));
	const pageAllSelected = $derived(pageIds.length > 0 && pageIds.every((id) => selected.has(id)));

	const actionOptions = $derived((tab === 'banned' ? BAN_ACTIONS : MEMBER_ACTIONS).map((value) => ({ value, label: MODERATION_ACTION_META[value].label })));
	const roleFilterOptions = $derived([{ value: '', label: 'Any role' }, ...data.roles.map((r) => ({ value: r.id, label: r.name }))]);
	const manageableRoleOptions = $derived([
		{ value: '', label: 'Pick a role' },
		...data.roles.filter((r) => r.manageable).map((r) => ({ value: r.id, label: r.name }))
	]);
	const whoRoleOptions = $derived([{ value: '', label: 'Pick a role to filter by' }, ...data.roles.map((r) => ({ value: r.id, label: r.name }))]);
	const presetOptions = $derived([{ value: '', label: 'Use a preset…' }, ...data.rules.reason_presets.map((p) => ({ value: p, label: p }))]);
	const roleName = (id: string) => data.roles.find((r) => r.id === id)?.name ?? 'that role';

	$effect(() => {
		if (preset) {
			reason = preset;
			preset = '';
		}
	});

	function switchTab(next: typeof tab) {
		tab = next;
		page = 1;
		selected = new Set();
		expanded = null;
		action = next === 'banned' ? 'unban' : next === 'timedout' ? 'untimeout' : next === 'warned' ? 'clearwarns' : 'warn';
	}

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function togglePage() {
		const next = new Set(selected);
		if (pageAllSelected) for (const id of pageIds) next.delete(id);
		else for (const id of pageIds) next.add(id);
		selected = next;
	}

	function roleColor(color: string | null) {
		return color && color !== '#000000' ? `color: ${color}` : undefined;
	}

	function apply() {
		const ids = [...selected];
		if (ids.length === 0) return;
		const meta = MODERATION_ACTION_META[action];
		const isRole = ROLE_ACTIONS.includes(action);
		if (isRole && !actionRoleId) return showToast('Pick a role', 'error');
		if (!MODERATION_REASON_OPTIONAL.includes(action) && !reason.trim()) return showToast('Enter a reason', 'error');
		if (MODERATION_TIMED_ACTIONS.includes(action) && (!amount || amount < 1)) return showToast('Enter a duration', 'error');
		const who = `${ids.length.toLocaleString()} ${ids.length === 1 ? 'member' : 'members'}`;
		confirm = {
			title: meta.label,
			message: isRole ? `${meta.label} ${roleName(actionRoleId)} ${action === 'role_add' ? 'to' : 'from'} ${who}?` : `${meta.label}: ${who}?`,
			run: () => (isRole ? runRoles(ids) : runEach(ids))
		};
	}

	async function runEach(ids: string[]) {
		busy = true;
		progress = { done: 0, total: ids.length };
		try {
			const out = await moderateEach(
				data.serverId,
				ids,
				{
					action,
					reason: reason.trim() || null,
					duration_seconds: MODERATION_TIMED_ACTIONS.includes(action) ? Math.round(amount * Number(unit)) : null
				},
				(done) => (progress = { done, total: ids.length })
			);
			const parts = [`Done for ${out.done.toLocaleString()}`];
			if (out.escalated > 0) parts.push(`${out.escalated} auto-escalated`);
			if (out.failed > 0) parts.push(`${out.failed} failed: ${out.error}`);
			showToast(parts.join(' · '), out.failed > 0 && out.done === 0 ? 'error' : 'success');
			if (out.done > 0) {
				selected = new Set();
				reason = '';
			}
			await invalidateAll();
		} finally {
			busy = false;
			progress = null;
		}
	}

	async function runRoles(ids: string[]) {
		const ok = await postBulk({ action, role_id: actionRoleId, filter: 'selected', target_ids: ids });
		if (ok) selected = new Set();
	}

	async function postBulk(body: Record<string, unknown>) {
		busy = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/moderation/bulk`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Bulk action failed', 'error');
				return false;
			}
			showToast(`Started for ${Number(out.queued ?? 0).toLocaleString()}. The result goes to the moderation log channel.`, 'success');
			await invalidateAll();
			return true;
		} catch {
			showToast('Bulk action failed', 'error');
			return false;
		} finally {
			busy = false;
		}
	}

	function unbanAll() {
		confirm = {
			title: 'Unban everyone',
			message: 'Unban every banned user in this server?',
			run: async () => void (await postBulk({ action: 'unban_all', reason: unbanReason.trim() || null }))
		};
	}

	function clearAllWarns() {
		confirm = {
			title: 'Clear all warnings',
			message: `Clear all ${data.activeWarnings.toLocaleString()} active warnings?`,
			run: async () => void (await postBulk({ action: 'clear_warns', reason: warnsReason.trim() || null }))
		};
	}

	function bulkRoles() {
		if (!roleId) return showToast('Pick a role', 'error');
		if (roleWho !== 'all' && !whoRoleId) return showToast('Pick the role to filter by', 'error');
		const who = roleWho === 'all' ? 'everyone' : `everyone ${roleWho === 'with' ? 'with' : 'without'} ${roleName(whoRoleId)}`;
		confirm = {
			title: roleAction === 'role_add' ? 'Give role' : 'Take role',
			message: `${roleAction === 'role_add' ? 'Give' : 'Take'} ${roleName(roleId)} ${roleAction === 'role_add' ? 'to' : 'from'} ${who}?`,
			run: async () => void (await postBulk({ action: roleAction, role_id: roleId, filter: roleWho, filter_role_id: roleWho === 'all' ? null : whoRoleId }))
		};
	}

	async function runConfirm() {
		const pending = confirm;
		confirm = null;
		if (pending) await pending.run();
	}
</script>

<svelte:head>
	<title>Moderation - {APP_NAME}</title>
</svelte:head>

{#snippet avatar(src: string | null)}
	<div class="bg-ash-600 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
		{#if src}
			<img {src} alt="" class="h-full w-full object-cover" />
		{:else}
			<i class="fas fa-user text-ash-400 text-sm"></i>
		{/if}
	</div>
{/snippet}

{#snippet pick(id: string, name: string)}
	{#if locked.has(id)}
		<span class="flex h-5 w-5 shrink-0 items-center justify-center text-amber-300" title={data.deniedReason}><i class="fas fa-lock text-xs"></i></span>
	{:else}
		<input type="checkbox" class="checkbox checkbox-sm shrink-0" checked={selected.has(id)} onchange={() => toggle(id)} aria-label="Select {name}" />
	{/if}
{/snippet}

{#snippet record(id: string)}
	{#if expanded === id}
		<div class="border-ash-600 border-t p-2 sm:p-3">
			<ModerationMemberRecord
				serverId={data.serverId}
				memberId={id}
				canEdit={!locked.has(id)}
				deniedReason={data.deniedReason}
				presets={data.rules.reason_presets}
				onchange={() => invalidateAll()}
			/>
		</div>
	{/if}
{/snippet}

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each [{ label: 'Active warnings', value: data.activeWarnings, icon: 'fa-triangle-exclamation', color: 'text-amber-400' }, { label: 'Warned members', value: warnedCount, icon: 'fa-user-shield', color: 'text-amber-300' }, { label: 'Timed out', value: timedOutCount, icon: 'fa-volume-xmark', color: 'text-orange-400' }, { label: 'Banned', value: data.bans.length, icon: 'fa-gavel', color: 'text-red-400' }] as tile (tile.label)}
			<div class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-4">
				<div class="text-ash-400 flex items-center gap-2 text-xs"><i class="fas {tile.icon} {tile.color}"></i>{tile.label}</div>
				<div class="text-ash-100 mt-1 text-xl font-bold tabular-nums sm:text-2xl">{tile.value.toLocaleString()}</div>
			</div>
		{/each}
	</div>

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-4 flex items-center gap-2 text-xl font-bold"><i class="fas fa-gavel text-red-400"></i>Members</h3>

		<div class="bg-ash-900/40 border-ash-700 mb-4 grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4">
			{#each tabs as t (t.id)}
				<button
					type="button"
					onclick={() => switchTab(t.id)}
					class="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors {tab === t.id
						? 'bg-ash-600 text-ash-100'
						: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
				>
					{t.label}<span class="text-ash-400 text-xs tabular-nums">{t.count.toLocaleString()}</span>
				</button>
			{/each}
		</div>

		<div class="mb-3 flex flex-col gap-3 sm:flex-row">
			<div class="relative flex-1">
				<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
				<input
					type="text"
					bind:value={search}
					oninput={() => (page = 1)}
					placeholder="Search name, username or ID"
					class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
				/>
			</div>
			{#if tab !== 'banned'}
				<LabeledSelect appearance="members-toolbar" options={roleFilterOptions} bind:value={roleFilter} ariaLabel="Role filter" />
			{/if}
		</div>

		<div class="text-ash-300 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" checked={pageAllSelected} disabled={pageIds.length === 0} onchange={togglePage} />
				Select page
			</label>
			{#if selected.size > 0}
				<span class="text-ash-100 font-semibold">{selected.size.toLocaleString()} selected</span>
				{#if selected.size < matchingIds.length}
					<button type="button" class="text-sky-400 hover:text-sky-300" onclick={() => (selected = new Set(matchingIds))}>
						Select all {matchingIds.length.toLocaleString()}
					</button>
				{/if}
				<button type="button" class="text-ash-400 hover:text-ash-200" onclick={() => (selected = new Set())}>Clear</button>
			{/if}
		</div>

		{#if selected.size > 0}
			<div class="bg-ash-700 border-ash-600 mb-4 flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					<LabeledSelect appearance="field" options={actionOptions} bind:value={action} ariaLabel="Action" />
					{#if ROLE_ACTIONS.includes(action)}
						<LabeledSelect appearance="field" options={manageableRoleOptions} bind:value={actionRoleId} ariaLabel="Role" />
					{/if}
					{#if MODERATION_TIMED_ACTIONS.includes(action)}
						<div class="flex gap-2">
							<input
								type="number"
								min="1"
								bind:value={amount}
								aria-label="Duration amount"
								class="bg-ash-700 border-ash-600 text-ash-100 h-10 w-20 rounded-lg border px-3 text-sm"
							/>
							<div class="min-w-0 flex-1">
								<LabeledSelect appearance="field" options={DURATION_UNITS} bind:value={unit} ariaLabel="Duration unit" />
							</div>
						</div>
					{/if}
					{#if !ROLE_ACTIONS.includes(action) && data.rules.reason_presets.length > 0}
						<LabeledSelect appearance="field" options={presetOptions} bind:value={preset} ariaLabel="Reason preset" />
					{/if}
				</div>
				{#if !ROLE_ACTIONS.includes(action)}
					<input
						type="text"
						maxlength="1000"
						bind:value={reason}
						placeholder={MODERATION_REASON_OPTIONAL.includes(action) ? 'Reason (optional)' : 'Reason'}
						aria-label="Reason"
						class="bg-ash-800 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
					/>
				{/if}
				<button
					type="button"
					onclick={apply}
					disabled={busy}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 sm:w-auto sm:self-start"
				>
					{#if progress}
						<i class="fas fa-spinner fa-spin"></i>Working {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
					{:else}
						<i class="fas {MODERATION_ACTION_META[action]?.icon ?? 'fa-gavel'}"></i>{MODERATION_ACTION_META[action]?.label ?? 'Apply'} · {selected.size.toLocaleString()}
					{/if}
				</button>
			</div>
		{/if}

		{#if rowIds.length === 0}
			<p class="text-ash-400 py-8 text-center text-sm">{tab === 'all' ? 'No members match.' : 'Nobody here.'}</p>
		{:else if tab === 'banned'}
			<ul class="space-y-2">
				{#each pageBans as b (b.discord_member_id)}
					{@const meta = MODERATION_ACTION_META[b.action] ?? MODERATION_ACTION_META.ban}
					<li class="bg-ash-700 border-ash-600 overflow-hidden rounded-lg border {selected.has(b.discord_member_id) ? 'ring-1 ring-sky-500/60' : ''}">
						<div class="flex items-center gap-3 p-3">
							{@render pick(b.discord_member_id, b.name ?? b.discord_member_id)}
							<button
								type="button"
								onclick={() => (expanded = expanded === b.discord_member_id ? null : b.discord_member_id)}
								class="flex min-w-0 flex-1 items-center gap-3 text-left"
							>
								{@render avatar(b.avatar)}
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm font-semibold">{b.name ?? b.discord_member_id}</p>
									<p class="text-ash-300 truncate text-xs">{b.reason || 'No reason provided'}</p>
								</div>
								<div class="shrink-0 text-right text-xs">
									<p class={meta.color}><i class="fas {meta.icon} mr-1"></i>{meta.label}</p>
									<p class="text-ash-500 mt-0.5 text-[0.65rem]">
										{#if b.expires_at}Ends <LocalTime value={b.expires_at} fallback="" class="inline" />{:else}<LocalTime
												value={b.created_at}
												fallback=""
												class="inline"
											/>{/if}
									</p>
								</div>
								<i class="fas fa-chevron-down text-ash-400 shrink-0 text-xs transition-transform {expanded === b.discord_member_id ? 'rotate-180' : ''}"></i>
							</button>
						</div>
						{@render record(b.discord_member_id)}
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="space-y-2">
				{#each pageMembers as m (m.id)}
					<li class="bg-ash-700 border-ash-600 overflow-hidden rounded-lg border {selected.has(m.id) ? 'ring-1 ring-sky-500/60' : ''}">
						<div class="flex items-center gap-3 p-3">
							{@render pick(m.id, m.name)}
							<button type="button" onclick={() => (expanded = expanded === m.id ? null : m.id)} class="flex min-w-0 flex-1 items-center gap-3 text-left">
								{@render avatar(m.avatar)}
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm font-semibold">{m.name}</p>
									<p class="text-ash-400 truncate text-xs">
										{#if m.username}@{m.username}{/if}{#if m.top_role}
											· <span style={roleColor(m.top_role.color)}>{m.top_role.name}</span>{/if}
									</p>
								</div>
								<div class="flex shrink-0 flex-col items-end gap-0.5 text-xs">
									{#if m.warnings > 0}<span class="text-amber-400"><i class="fas fa-triangle-exclamation mr-1"></i>{m.warnings}</span>{/if}
									{#if m.timeout_until}<span class="text-orange-400"><i class="fas fa-volume-xmark mr-1"></i>Timed out</span>{/if}
								</div>
								<i class="fas fa-chevron-down text-ash-400 shrink-0 text-xs transition-transform {expanded === m.id ? 'rotate-180' : ''}"></i>
							</button>
						</div>
						{@render record(m.id)}
					</li>
				{/each}
			</ul>
		{/if}

		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-center gap-3">
				<button
					onclick={() => (page = Math.max(1, page - 1))}
					disabled={page <= 1}
					class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
				</button>
				<span class="text-ash-400 text-sm">Page {Math.min(page, totalPages)} of {totalPages}</span>
				<button
					onclick={() => (page = Math.min(totalPages, page + 1))}
					disabled={page >= totalPages}
					class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
				</button>
			</div>
		{/if}
	</section>

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-1 flex items-center gap-2 text-xl font-bold"><i class="fas fa-users-gear text-orange-400"></i>Mass moderation</h3>
		<p class="text-ash-400 mb-4 text-xs">Runs in the background. Members you can't act on are skipped. The result goes to the moderation log channel.</p>

		<div class="grid gap-3 lg:grid-cols-3">
			<div class="bg-ash-700 border-ash-600 flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
				<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-dove text-emerald-400"></i>Unban everyone</p>
				<input
					type="text"
					maxlength="1000"
					bind:value={unbanReason}
					placeholder="Reason (optional)"
					aria-label="Unban reason"
					class="bg-ash-800 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onclick={unbanAll}
					disabled={busy}
					class="mt-auto flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
				>
					<i class="fas fa-dove"></i>Unban all
				</button>
			</div>

			<div class="bg-ash-700 border-ash-600 flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
				<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold">
					<i class="fas fa-broom text-violet-400"></i>Clear all warnings<span class="text-ash-400 ml-auto text-xs font-normal"
						>{data.activeWarnings.toLocaleString()} active</span
					>
				</p>
				<input
					type="text"
					maxlength="1000"
					bind:value={warnsReason}
					placeholder="Reason (optional)"
					aria-label="Clear warnings reason"
					class="bg-ash-800 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onclick={clearAllWarns}
					disabled={busy || data.activeWarnings === 0}
					class="mt-auto flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
				>
					<i class="fas fa-broom"></i>Clear all
				</button>
			</div>

			<div class="bg-ash-700 border-ash-600 flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
				<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-user-tag text-sky-400"></i>Bulk roles</p>
				<LabeledSelect
					appearance="field"
					options={[
						{ value: 'role_add', label: 'Give role' },
						{ value: 'role_remove', label: 'Take role' }
					]}
					bind:value={roleAction}
					ariaLabel="Give or take"
				/>
				<LabeledSelect appearance="field" options={manageableRoleOptions} bind:value={roleId} ariaLabel="Role" />
				<LabeledSelect appearance="field" options={WHO_OPTIONS} bind:value={roleWho} ariaLabel="Who" />
				{#if roleWho !== 'all'}
					<LabeledSelect appearance="field" options={whoRoleOptions} bind:value={whoRoleId} ariaLabel="Filter role" />
				{/if}
				<button
					type="button"
					onclick={bulkRoles}
					disabled={busy || !roleId}
					class="mt-auto flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
				>
					<i class="fas fa-user-tag"></i>{roleAction === 'role_add' ? 'Give role' : 'Take role'}
				</button>
				{#if data.roles.some((r) => !r.manageable)}
					<p class="text-ash-500 text-xs">Staff and admin roles are hidden. {data.deniedReason}</p>
				{/if}
			</div>
		</div>
	</section>

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-4 flex items-center gap-2 text-xl font-bold"><i class="fas fa-scale-balanced text-emerald-400"></i>Rules</h3>
		<ModerationRules serverId={data.serverId} rules={data.rules} onsaved={() => invalidateAll()} />
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
