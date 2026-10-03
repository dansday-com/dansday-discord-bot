<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import MemberInvitesPanel from '$lib/frontend/components/MemberInvitesPanel.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import { INVITE_FAKE_REASON_LABEL, INVITE_SOURCE_LABEL, INVITE_STATUS_META, type InviteStatus } from '$lib/invites.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TABS = [
		{ id: 'inviters', label: 'Inviters', icon: 'fa-ranking-star' },
		{ id: 'joins', label: 'Joins', icon: 'fa-right-to-bracket' },
		{ id: 'links', label: 'Links', icon: 'fa-link' }
	];
	const INVITER_SORTS = [
		{ value: 'total', label: 'Most invites' },
		{ value: 'joins', label: 'Most joins' },
		{ value: 'left', label: 'Most left' },
		{ value: 'fake', label: 'Most fake' },
		{ value: 'recent', label: 'Latest join' }
	];
	const PAGE_SIZE = 50;
	const STATUS_FILTERS = [{ value: 'all', label: 'Any status' }, ...Object.entries(INVITE_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))];
	const SOURCE_TONE: Record<string, string> = {
		personal: 'text-cyan-300',
		invite: 'text-indigo-300',
		server: 'text-emerald-300',
		vanity: 'text-fuchsia-300',
		manual: 'text-violet-300',
		unknown: 'text-ash-400'
	};

	let tab = $state('inviters');
	let search = $state('');
	let inviterSort = $state('total');
	let sourceFilter = $state('all');
	let statusFilter = $state('all');
	let open = $state<string | null>(null);
	let page = $state(1);

	const s = $derived(data.stats);
	const locked = $derived(new Set(data.lockedIds));
	const q = $derived(search.trim().toLowerCase());

	const tiles = $derived([
		{ icon: 'fa-right-to-bracket', label: 'Joins tracked', value: s?.tracked, tone: 'text-sky-400' },
		{ icon: 'fa-user-check', label: 'Still here', value: s?.active, tone: 'text-emerald-400' },
		{ icon: 'fa-user-minus', label: 'Left', value: s?.left, tone: 'text-amber-400' },
		{ icon: 'fa-user-secret', label: 'Fake', value: s?.fake, tone: 'text-red-400' },
		{ icon: 'fa-hourglass-half', label: 'Waiting payout', value: s?.pending, tone: 'text-sky-300' },
		{ icon: 'fa-star', label: 'XP paid', value: (s?.xp_paid ?? 0) + (s?.share_xp ?? 0), tone: 'text-yellow-400' }
	]);

	const tabCounts = $derived<Record<string, number>>({ inviters: data.inviters.length, joins: data.joins.length, links: s?.codes.length ?? 0 });
	const sourceFilters = $derived([
		{ value: 'all', label: 'Any link' },
		...Object.entries(INVITE_SOURCE_LABEL)
			.map(([value, label]) => ({ value, label, n: data.joins.filter((j) => j.source === value).length }))
			.filter((o) => o.n > 0)
			.map(({ value, label, n }) => ({ value, label: `${label} · ${n.toLocaleString()}` }))
	]);

	const inviters = $derived(
		[...data.inviters]
			.filter((i) => !q || (i.name ?? '').toLowerCase().includes(q) || i.discord_member_id.includes(q))
			.sort((a, b) => {
				if (inviterSort === 'joins') return b.joins - a.joins;
				if (inviterSort === 'left') return b.left - a.left;
				if (inviterSort === 'fake') return b.fake - a.fake;
				if (inviterSort === 'recent') return (dbDateTimeToMs(b.last_join_at) ?? 0) - (dbDateTimeToMs(a.last_join_at) ?? 0);
				return b.total - a.total || b.joins - a.joins;
			})
	);

	const joins = $derived(
		data.joins.filter((j) => {
			if (sourceFilter !== 'all' && j.source !== sourceFilter) return false;
			if (statusFilter !== 'all' && j.status !== statusFilter) return false;
			if (!q) return true;
			return (
				(j.name ?? '').toLowerCase().includes(q) ||
				j.discord_member_id.includes(q) ||
				(j.inviter_name ?? '').toLowerCase().includes(q) ||
				(j.code ?? '').toLowerCase().includes(q)
			);
		})
	);

	const links = $derived((s?.codes ?? []).filter((c) => !q || c.code.toLowerCase().includes(q) || (c.inviter_name ?? '').toLowerCase().includes(q)));

	const listLength = $derived(tab === 'inviters' ? inviters.length : tab === 'joins' ? joins.length : links.length);
	const totalPages = $derived(Math.max(1, Math.ceil(listLength / PAGE_SIZE)));
	const current = $derived(Math.min(page, totalPages));
	const start = $derived((current - 1) * PAGE_SIZE);

	$effect(() => {
		void tab;
		void search;
		void inviterSort;
		void sourceFilter;
		void statusFilter;
		page = 1;
	});

	const openMember = $derived.by(() => {
		if (!open) return null;
		const id = open.slice(open.indexOf(':') + 1);
		const name = data.inviters.find((i) => i.discord_member_id === id)?.name ?? data.joins.find((j) => j.discord_member_id === id)?.name ?? id;
		return { id, name };
	});

	function toggle(key: string) {
		open = open === key ? null : key;
	}

	function statusMeta(status: string) {
		return INVITE_STATUS_META[status as InviteStatus] ?? INVITE_STATUS_META.active;
	}

	function fmt(value: number | null | undefined) {
		return Number(value ?? 0).toLocaleString();
	}
</script>

<svelte:head>
	<title>Invites - {APP_NAME}</title>
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

{#snippet detail(key: string)}
	{#if open === key && openMember}
		<div class="border-ash-600 border-t p-2 sm:p-3">
			<MemberInvitesPanel
				serverId={data.serverId}
				member={openMember}
				canEdit={!locked.has(openMember.id)}
				deniedReason={data.deniedReason}
				onchange={() => invalidateAll()}
			/>
		</div>
	{/if}
{/snippet}

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
		{#each tiles as tile (tile.label)}
			<div class="bg-ash-800 border-ash-700 rounded-xl border p-3">
				<div class="text-ash-400 flex items-center gap-1.5 text-xs"><i class="fas {tile.icon} {tile.tone}"></i><span class="truncate">{tile.label}</span></div>
				<div class="text-ash-100 mt-1 text-lg font-bold tabular-nums sm:text-xl">{fmt(tile.value)}</div>
			</div>
		{/each}
	</div>

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<div class="bg-ash-900/40 border-ash-700 mb-4 grid grid-cols-3 gap-1 rounded-lg border p-1">
			{#each TABS as t (t.id)}
				<button
					type="button"
					onclick={() => {
						tab = t.id;
						open = null;
					}}
					class="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors {tab === t.id
						? 'bg-ash-600 text-ash-100'
						: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
				>
					<i class="fas {t.icon} text-xs text-cyan-400"></i>{t.label}<span class="text-ash-400 text-xs tabular-nums">{fmt(tabCounts[t.id])}</span>
				</button>
			{/each}
		</div>

		<div class="mb-4 flex flex-col gap-3 sm:flex-row">
			<div class="relative flex-1">
				<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
				<input
					type="text"
					bind:value={search}
					placeholder={tab === 'links' ? 'Search code or owner' : tab === 'joins' ? 'Search member, inviter or code' : 'Search inviter'}
					class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
				/>
			</div>
			{#if tab === 'inviters'}
				<LabeledSelect appearance="members-toolbar" options={INVITER_SORTS} bind:value={inviterSort} ariaLabel="Sort inviters" />
			{:else if tab === 'joins'}
				<LabeledSelect appearance="members-toolbar" options={sourceFilters} bind:value={sourceFilter} ariaLabel="Link filter" />
				<LabeledSelect appearance="members-toolbar" options={STATUS_FILTERS} bind:value={statusFilter} ariaLabel="Status filter" />
			{/if}
		</div>

		{#if tab === 'inviters'}
			{#if inviters.length === 0}
				<p class="text-ash-400 py-8 text-center text-sm">No inviters yet.</p>
			{:else}
				<ul class="space-y-2">
					{#each inviters.slice(start, start + PAGE_SIZE) as i (i.discord_member_id)}
						{@const key = `i:${i.discord_member_id}`}
						<li class="bg-ash-700 border-ash-600 overflow-hidden rounded-lg border">
							<button
								type="button"
								onclick={() => toggle(key)}
								aria-expanded={open === key}
								class="hover:bg-ash-600/40 flex w-full items-center gap-3 p-3 text-left"
							>
								{@render avatar(i.avatar)}
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold">
										<span class="truncate">{i.name ?? i.discord_member_id}</span>
										{#if i.left_server}
											<span class="bg-ash-600 text-ash-300 shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-medium">Left server</span>
										{/if}
									</p>
									<p class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
										<span class="text-emerald-400">{fmt(i.active)} still here</span>
										{#if i.left > 0}<span class="text-amber-400">{fmt(i.left)} left</span>{/if}
										{#if i.fake > 0}<span class="text-red-400">{fmt(i.fake)} fake</span>{/if}
										{#if i.pending > 0}<span class="text-sky-300">{fmt(i.pending)} waiting</span>{/if}
										{#if i.bonus !== 0}<span class="text-violet-400">{i.bonus > 0 ? '+' : ''}{fmt(i.bonus)} bonus</span>{/if}
									</p>
									<p class="text-ash-400 mt-0.5 truncate text-[0.65rem]">
										<span class={SOURCE_TONE.personal}>{fmt(i.personal)} personal</span> ·
										<span class={SOURCE_TONE.invite}>{fmt(i.discord)} Discord</span>{#if i.xp > 0}
											· <span class="text-yellow-400">+{fmt(i.xp)} XP</span>{/if}
									</p>
								</div>
								<div class="shrink-0 text-right">
									<div class="text-ash-100 text-lg font-bold tabular-nums">{fmt(i.total)}</div>
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">invites</div>
								</div>
								<i class="fas fa-chevron-down text-ash-400 shrink-0 text-xs transition-transform {open === key ? 'rotate-180' : ''}"></i>
							</button>
							{@render detail(key)}
						</li>
					{/each}
				</ul>
			{/if}
		{:else if tab === 'joins'}
			{#if joins.length === 0}
				<p class="text-ash-400 py-8 text-center text-sm">No joins match.</p>
			{:else}
				<ul class="space-y-2">
					{#each joins.slice(start, start + PAGE_SIZE) as j (j.id)}
						{@const key = `j:${j.discord_member_id}`}
						{@const meta = statusMeta(j.status)}
						<li class="bg-ash-700 border-ash-600 overflow-hidden rounded-lg border">
							<button
								type="button"
								onclick={() => toggle(key)}
								aria-expanded={open === key}
								class="hover:bg-ash-600/40 flex w-full items-center gap-3 p-3 text-left"
							>
								{@render avatar(j.avatar)}
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm font-semibold">{j.name ?? j.discord_member_id}</p>
									<p class="text-ash-300 truncate text-xs">{j.inviter_name ? `Invited by ${j.inviter_name}` : 'No inviter'}</p>
									<p class="truncate text-[0.65rem] {SOURCE_TONE[j.source] ?? SOURCE_TONE.unknown}">
										{INVITE_SOURCE_LABEL[j.source] ?? j.source}{j.code ? ` · ${j.code}` : ''}
									</p>
								</div>
								<div class="shrink-0 text-right text-xs">
									<p class={meta.tone}>
										<i class="fas {meta.icon} mr-1"></i>{j.fake_reason ? (INVITE_FAKE_REASON_LABEL[j.fake_reason] ?? meta.label) : meta.label}
									</p>
									<p class="text-ash-500 mt-0.5 text-[0.65rem]"><LocalTime value={j.joined_at} fallback="" /></p>
								</div>
								<i class="fas fa-chevron-down text-ash-400 shrink-0 text-xs transition-transform {open === key ? 'rotate-180' : ''}"></i>
							</button>
							{@render detail(key)}
						</li>
					{/each}
				</ul>
				{#if data.joins.length >= data.joinLimit}
					<p class="text-ash-500 mt-3 text-center text-xs">Showing the latest {data.joinLimit.toLocaleString()} joins.</p>
				{/if}
			{/if}
		{:else if links.length === 0}
			<p class="text-ash-400 py-8 text-center text-sm">No invite links used yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each links.slice(start, start + PAGE_SIZE) as c (c.code)}
					<li class="bg-ash-700 border-ash-600 flex items-center gap-3 rounded-lg border p-3">
						<i class="fas fa-link shrink-0 {SOURCE_TONE[c.source ?? 'unknown'] ?? SOURCE_TONE.unknown}"></i>
						<div class="min-w-0 flex-1">
							<p class="text-ash-100 truncate font-mono text-sm">{c.code}</p>
							<p class="truncate text-xs">
								<span class={SOURCE_TONE[c.source ?? 'unknown'] ?? SOURCE_TONE.unknown}>{INVITE_SOURCE_LABEL[c.source ?? 'unknown'] ?? 'Unknown'}</span>
								<span class="text-ash-400">· {c.inviter_name ?? 'No owner'}</span>
							</p>
						</div>
						<div class="shrink-0 text-right">
							<div class="text-ash-100 text-sm font-bold tabular-nums">{fmt(c.active)} / {fmt(c.joins)}</div>
							<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">still here / joins</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-center gap-3">
				<button
					onclick={() => (page = Math.max(1, current - 1))}
					disabled={current <= 1}
					class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
				</button>
				<span class="text-ash-400 text-sm">Page {current} of {totalPages}</span>
				<button
					onclick={() => (page = Math.min(totalPages, current + 1))}
					disabled={current >= totalPages}
					class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
				</button>
			</div>
		{/if}
	</section>
</div>
