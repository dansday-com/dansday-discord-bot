<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import Pagination from '$lib/frontend/components/Pagination.svelte';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import { INVITE_FAKE_REASON_LABEL, INVITE_SOURCE_LABEL, INVITE_SOURCE_TONE, INVITE_STATUS_META, type InviteStatus } from '$lib/invites.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 50;
	const STATUS_FILTERS = [{ value: 'all', label: 'Any status' }, ...Object.entries(INVITE_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))];

	let search = $state('');
	let sourceFilter = $state('all');
	let statusFilter = $state('all');
	let page = $state(1);

	const base = $derived(adminServerSectionPath(data.botId, data.serverId, 'members'));
	const q = $derived(search.trim().toLowerCase());
	const sourceFilters = $derived([
		{ value: 'all', label: 'Any link' },
		...Object.entries(INVITE_SOURCE_LABEL)
			.map(([value, label]) => ({ value, label, n: data.joins.filter((j) => j.source === value).length }))
			.filter((o) => o.n > 0)
			.map(({ value, label, n }) => ({ value, label: `${label} · ${n.toLocaleString()}` }))
	]);
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
	const totalPages = $derived(Math.max(1, Math.ceil(joins.length / PAGE_SIZE)));
	const start = $derived((Math.min(page, totalPages) - 1) * PAGE_SIZE);

	$effect(() => {
		void search;
		void sourceFilter;
		void statusFilter;
		page = 1;
	});
</script>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-6">
	<div class="mb-4 flex flex-col gap-3 lg:flex-row">
		<div class="relative flex-1">
			<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
			<input
				type="text"
				bind:value={search}
				placeholder="Search member, inviter or code"
				class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row">
			<LabeledSelect appearance="members-toolbar" options={sourceFilters} bind:value={sourceFilter} ariaLabel="Link filter" />
			<LabeledSelect appearance="members-toolbar" options={STATUS_FILTERS} bind:value={statusFilter} ariaLabel="Status filter" />
		</div>
	</div>

	{#if joins.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No joins match.</p>
	{:else}
		<ul class="space-y-2">
			{#each joins.slice(start, start + PAGE_SIZE) as j (j.id)}
				{@const meta = INVITE_STATUS_META[j.status as InviteStatus] ?? INVITE_STATUS_META.active}
				<li>
					<a
						href="{base}/{j.discord_member_id}"
						class="bg-ash-700 border-ash-600 hover:border-ash-500 flex items-center gap-2 rounded-lg border p-3 transition-colors sm:gap-3"
					>
						<div class="bg-ash-600 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
							{#if j.avatar}
								<img src={j.avatar} alt="" loading="lazy" class="h-full w-full object-cover" />
							{:else}
								<i class="fas fa-user text-ash-400 text-sm"></i>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-ash-100 truncate text-sm font-semibold">{j.name ?? j.discord_member_id}</p>
							<p class="text-ash-300 truncate text-xs">{j.inviter_name ? `Invited by ${j.inviter_name}` : 'No inviter'}</p>
							<p class="truncate text-[0.65rem] {INVITE_SOURCE_TONE[j.source] ?? INVITE_SOURCE_TONE.unknown}">
								{INVITE_SOURCE_LABEL[j.source] ?? j.source}{j.code ? ` · ${j.code}` : ''}
							</p>
						</div>
						<div class="max-w-[45%] shrink-0 text-right text-xs">
							<p class={meta.tone}>
								<i class="fas {meta.icon} mr-1"></i>{j.fake_reason ? (INVITE_FAKE_REASON_LABEL[j.fake_reason] ?? meta.label) : meta.label}
							</p>
							<p class="text-ash-500 mt-0.5 text-[0.65rem]"><LocalTime value={j.joined_at} fallback="" /></p>
						</div>
						<i class="fas fa-chevron-right text-ash-400 hidden shrink-0 text-xs sm:block"></i>
					</a>
				</li>
			{/each}
		</ul>
		{#if data.joins.length >= data.joinLimit}
			<p class="text-ash-500 mt-3 text-center text-xs">Showing the latest {data.joinLimit.toLocaleString()} joins.</p>
		{/if}
	{/if}

	<Pagination bind:page {totalPages} />
</section>
