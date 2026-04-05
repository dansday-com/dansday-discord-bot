<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let enabled = $state(data.enabled);

	const publicStatsUrl = $derived(enabled && data.publicStatsPath ? `${page.url.origin}${data.publicStatsPath}` : '');
	const leaderboardUrl = $derived(enabled && data.leaderboardPath ? `${page.url.origin}${data.leaderboardPath}` : '');

	async function save() {
		saving = true;
		try {
			const base = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? { ...data.settings } : {};
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.public_statistics,
					...base,
					enabled
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				invalidateAll();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-chart-pie text-amber-400"></i>Public statistics
	</h3>
	<p class="text-ash-400 text-xs">
		Public server overview (members, channels, leveling aggregates, voice totals) and the member leaderboard share one URL prefix. Visitors land on server
		statistics first; the leaderboard is one click away.
	</p>

	<ConfigToggleRow
		label="Public statistics module"
		description="When off, the public pages and in-Discord link to this site are disabled."
		labelIconClass="fas fa-chart-pie text-amber-400"
		bind:enabled
		ariaLabel="Toggle public statistics module"
	/>

	{#if !enabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to see the public URLs.</span>
		</p>
	{/if}

	<div class="space-y-5 transition-opacity" class:pointer-events-none={!enabled} class:opacity-50={!enabled}>
		{#if enabled && data.publicStatsPath}
			<div>
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">
					<i class="fas fa-link mr-1 text-amber-400"></i>Public URL (server statistics)
				</label>
				<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
					<input type="text" readonly value={publicStatsUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
					<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.publicStatsPath || '#'} target="_blank" rel="noreferrer">
						Open
					</a>
				</div>
			</div>
		{/if}
		{#if enabled && data.leaderboardPath}
			<div>
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">
					<i class="fas fa-trophy mr-1 text-amber-400"></i>Leaderboard URL
				</label>
				<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
					<input type="text" readonly value={leaderboardUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
					<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.leaderboardPath || '#'} target="_blank" rel="noreferrer">
						Open
					</a>
				</div>
			</div>
		{/if}
		{#if enabled && (data.publicStatsPath || data.leaderboardPath)}
			<p class="text-ash-500 text-xs">
				Generated from the server name. If there’s a duplicate, we append
				<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">_1</code>,
				<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">_2</code>, etc.
			</p>
		{/if}
	</div>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
