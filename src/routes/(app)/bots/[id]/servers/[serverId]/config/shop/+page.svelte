<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.shop,
					enabled: featureEnabled
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
		<i class="fas fa-store text-teal-400"></i>Shop
	</h3>
	<p class="text-ash-400 text-xs">
		Let members spend XP on items: boosts, shields, and PvP (steal, bomb, leech). Items are managed globally. Members open the shop from the bot menu or the
		public site.
	</p>

	<ConfigToggleRow
		label="Shop module"
		description="When off, the shop button and all buy/use actions are disabled for this server."
		labelIconClass="fas fa-store text-teal-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle shop module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply.</span>
		</p>
	{:else}
		<p class="text-ash-500 flex items-start gap-2 text-xs">
			<i class="fas fa-circle-info mt-0.5 shrink-0 text-teal-400/90" aria-hidden="true"></i>
			<span>Members must use the bot menu's Shop button (opens the website) to browse and buy. PvP actions affect this server's XP only.</span>
		</p>
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
