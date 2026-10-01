<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';

	let { data }: PageProps = $props();

	let search = $state('');
	let filterComponent = $state('all');
	let filterRole = $state('all');

	const components = $derived([...new Map(data.logs.map((l) => [l.component, l.component_label])).entries()].sort((a, b) => a[1].localeCompare(b[1])));

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

	function label(key: string) {
		return key.replace(/_/g, ' ');
	}
</script>

<svelte:head>
	<title>Change Log - {APP_NAME}</title>
</svelte:head>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 mb-6 flex items-center gap-2 text-xl font-bold"><i class="fas fa-clock-rotate-left text-sky-400"></i>Configuration changes</h3>

	<div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
		<input
			bind:value={search}
			placeholder="Search account, module or setting"
			class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm"
		/>
		<select bind:value={filterComponent} aria-label="Module filter" class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm">
			<option value="all">All modules</option>
			{#each components as [value, name] (value)}
				<option {value}>{name}</option>
			{/each}
		</select>
		<select bind:value={filterRole} aria-label="Account filter" class="bg-ash-700 border-ash-600 text-ash-100 rounded-lg border px-3 py-2 text-sm">
			<option value="all">Any account</option>
			<option value="Admin">Admin</option>
			<option value="Owner">Owner</option>
			<option value="Staff">Staff</option>
		</select>
	</div>

	{#if filtered.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No configuration changes yet.</p>
	{:else}
		<ul class="divide-ash-700 divide-y">
			{#each filtered as log (log.id)}
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
									<span class="min-w-0 break-all text-red-300/90 line-through decoration-red-400/40">{change.before ?? '—'}</span>
									<i class="fas fa-arrow-right text-ash-500 hidden pt-0.5 sm:inline"></i>
									<span class="min-w-0 break-all text-emerald-300">{change.after ?? '—'}</span>
								</div>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	{/if}
</section>
