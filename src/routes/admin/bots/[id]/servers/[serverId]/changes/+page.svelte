<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 50;

	let search = $state('');
	let filterComponent = $state('all');
	let filterRole = $state('all');
	let page = $state(1);

	const components = $derived([...new Map(data.logs.map((l) => [l.component, l.component_label])).entries()].sort((a, b) => a[1].localeCompare(b[1])));

	const componentOptions = $derived([{ value: 'all', label: 'All modules' }, ...components.map(([value, label]) => ({ value, label }))]);
	const ROLE_OPTIONS = [
		{ value: 'all', label: 'Any account' },
		{ value: 'Admin', label: 'Admin' },
		{ value: 'Owner', label: 'Owner' },
		{ value: 'Staff', label: 'Staff' }
	];

	const ROLE_CLASS: Record<string, string> = {
		Admin: 'bg-violet-500/15 text-violet-300',
		Owner: 'bg-blue-500/15 text-blue-300',
		Staff: 'bg-emerald-500/15 text-emerald-300'
	};

	const filtered = $derived(
		data.logs.filter((l) => {
			if (filterComponent !== 'all' && l.component !== filterComponent) return false;
			if (filterRole !== 'all' && l.role !== filterRole) return false;
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return (
				(l.who ?? '').toLowerCase().includes(q) ||
				l.component_label.toLowerCase().includes(q) ||
				l.changes.some((c) => c.key.toLowerCase().includes(q) || (c.before ?? '').toLowerCase().includes(q) || (c.after ?? '').toLowerCase().includes(q))
			);
		})
	);

	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const current = $derived(Math.min(page, totalPages));
	const pageLogs = $derived(filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE));

	$effect(() => {
		void search;
		void filterComponent;
		void filterRole;
		page = 1;
	});

	function label(key: string) {
		return key.replace(/_/g, ' ');
	}
</script>

<svelte:head>
	<title>Change Log - {APP_NAME}</title>
</svelte:head>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold"><i class="fas fa-clock-rotate-left text-sky-400"></i>Change log</h3>

	<div class="mb-4 flex flex-col gap-3 sm:flex-row">
		<div class="relative flex-1">
			<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
			<input
				type="text"
				bind:value={search}
				placeholder="Search account, module or setting"
				class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
		<LabeledSelect appearance="members-toolbar" options={componentOptions} bind:value={filterComponent} ariaLabel="Module filter" />
		<LabeledSelect appearance="members-toolbar" options={ROLE_OPTIONS} bind:value={filterRole} ariaLabel="Account filter" />
	</div>

	{#if filtered.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No changes yet.</p>
	{:else}
		<ul class="divide-ash-700 divide-y">
			{#each pageLogs as log (log.id)}
				<li class="py-3">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span class="text-ash-100 font-semibold">{log.component_label}</span>
						<span class="text-ash-500">by</span>
						<span class="text-ash-200 truncate font-medium">{log.who ?? 'Deleted account'}</span>
						{#if log.role}
							<span class="rounded px-1.5 py-0.5 text-xs {ROLE_CLASS[log.role]}">{log.role}</span>
						{/if}
						<span class="text-ash-500 text-xs sm:ml-auto"><LocalTime value={log.created_at} includeSeconds class="inline" /></span>
					</div>
					<ul class="mt-2 space-y-1.5">
						{#each log.changes as change, i (i)}
							<li class="bg-ash-700/50 rounded-lg px-3 py-2 text-xs">
								<div class="text-ash-300 mb-1 font-medium capitalize">{label(change.key)}</div>
								<div class="flex flex-col gap-1 font-mono sm:flex-row sm:items-start sm:gap-2">
									{#if change.before != null}
										<span class="min-w-0 break-all text-red-300/90 line-through decoration-red-400/40">{change.before}</span>
										<i class="fas fa-arrow-right text-ash-500 hidden pt-0.5 sm:inline"></i>
									{/if}
									<span class="min-w-0 break-all text-emerald-300">{change.after ?? '—'}</span>
								</div>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
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
	{/if}
</section>
