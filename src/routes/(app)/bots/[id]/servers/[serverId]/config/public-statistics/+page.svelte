<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let enabled = $state(data.enabled);
	let itemsEnabled = $state(data.settings?.items_enabled === true);
	let minigamesEnabled = $state(data.settings?.minigames_enabled === true);
	let assetsEnabled = $state(data.settings?.assets_enabled === true);
	let itemsChannel = $state<string>(data.settings?.ITEMS_CHANNEL_ID ?? '');
	let minigamesChannel = $state<string>(data.settings?.MINIGAMES_CHANNEL_ID ?? '');

	const publicStatsUrl = $derived(enabled && data.publicStatsPath ? `${page.url.origin}${data.publicStatsPath}` : '');

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
					enabled,
					items_enabled: itemsEnabled,
					minigames_enabled: minigamesEnabled,
					assets_enabled: assetsEnabled,
					ITEMS_CHANNEL_ID: itemsChannel,
					MINIGAMES_CHANNEL_ID: minigamesChannel
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
		The public server pages (statistics, leaderboard, members, member account) all live under this module. When off, none of them are reachable and the
		in-Discord link is hidden.
	</p>

	<ConfigToggleRow
		label="Public statistics module"
		description="Master switch. When off, the public pages and in-Discord link to this site are disabled."
		labelIconClass="fas fa-chart-pie text-amber-400"
		bind:enabled
		ariaLabel="Toggle public statistics module"
	/>

	{#if !enabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to see the public URLs and account features.</span>
		</p>
	{/if}

	<div class="space-y-5 transition-opacity" class:pointer-events-none={!enabled} class:opacity-50={!enabled}>
		{#if enabled && data.publicStatsPath}
			<div>
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">
					<i class="fas fa-link mr-1 text-amber-400"></i>Public URL
				</label>
				<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
					<input type="text" readonly value={publicStatsUrl} class="text-ash-100 w-full bg-transparent text-xs focus:outline-none" />
					<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.publicStatsPath || '#'} target="_blank" rel="noreferrer">
						Open
					</a>
				</div>
			</div>
		{/if}

		<div class="border-ash-700 space-y-5 border-t pt-5">
			<p class="text-ash-300 text-xs font-semibold">Account features</p>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Items"
					description="Spend XP on boosts, shields and PvP items."
					labelIconClass="fas fa-store text-teal-400"
					bind:enabled={itemsEnabled}
					ariaLabel="Toggle items"
				/>
				{#if itemsEnabled}
					<div class="pl-1">
						<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1 text-teal-400"></i>Item events channel</label>
						<p class="text-ash-500 mb-2 text-xs">Where item announcements are posted. If unset, item events are not announced.</p>
						<ChannelPicker channels={data.channels} categories={data.categories} value={itemsChannel} onchange={(id) => (itemsChannel = id)} />
					</div>
				{/if}
			</div>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Minigames"
					description="Free-to-play games where members wager XP."
					labelIconClass="fas fa-dice text-purple-400"
					bind:enabled={minigamesEnabled}
					ariaLabel="Toggle minigames"
				/>
				{#if minigamesEnabled}
					<div class="pl-1">
						<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1 text-purple-400"></i>Minigame events channel</label>
						<p class="text-ash-500 mb-2 text-xs">Where win and loss announcements are posted. If unset, results are not announced.</p>
						<ChannelPicker channels={data.channels} categories={data.categories} value={minigamesChannel} onchange={(id) => (minigamesChannel = id)} />
					</div>
				{/if}
			</div>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Assets"
					description="XP crypto trading. Posts nothing to Discord."
					labelIconClass="fas fa-chart-line text-sky-400"
					bind:enabled={assetsEnabled}
					ariaLabel="Toggle assets"
				/>
			</div>
		</div>
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
