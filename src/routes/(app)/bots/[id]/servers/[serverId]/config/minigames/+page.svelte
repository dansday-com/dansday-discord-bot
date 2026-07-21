<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);
	let minigamesChannel = $state<string>(data.settings?.MINIGAMES_CHANNEL_ID ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.minigames,
					enabled: featureEnabled,
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
		<i class="fas fa-dice text-purple-400"></i>Minigames
	</h3>
	<p class="text-ash-400 text-xs">
		Let members wager XP on a multiplier bet: pick a multiplier up to 10×, and the win chance is set fairly from it (2× = 50%, 4× = 25%). Free to play — members
		open it from the bot menu or the public site.
	</p>

	<ConfigToggleRow
		label="Minigames module"
		description="When off, the Minigames button and all play actions are disabled for this server."
		labelIconClass="fas fa-dice text-purple-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle minigames module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply.</span>
		</p>
	{:else}
		<p class="text-ash-500 flex items-start gap-2 text-xs">
			<i class="fas fa-circle-info mt-0.5 shrink-0 text-purple-400/90" aria-hidden="true"></i>
			<span>Members wager XP earned above their current level, so a bad run never drops their level or leaderboard rank.</span>
		</p>

		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1 text-purple-400"></i>Minigame Events Channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">
				Where win and loss announcements are posted. Keep it separate from your level channel to avoid clutter. If unset, results are not announced.
			</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={minigamesChannel} onchange={(id) => (minigamesChannel = id)} />
		</div>
	{/if}

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
