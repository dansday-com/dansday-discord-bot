<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);
	let channelId = $state(data.settings?.channel_id || '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.roblox_catalog_notifier,
					enabled: featureEnabled,
					channel_id: channelId
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
		<i class="fas fa-cube text-emerald-400"></i>Roblox catalog notifier
	</h3>
	<p class="text-ash-400 text-xs">Posts alerts when new free, limited, or official Roblox catalog items are detected.</p>

	<ConfigToggleRow
		label="Roblox catalog module"
		description="When off, Roblox catalog polling and posts are disabled."
		labelIconClass="fas fa-cube text-emerald-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle Roblox catalog notifier module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply.</span>
		</p>
	{/if}

	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1.5 text-emerald-400"></i>Notification channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">Where the bot posts Roblox catalog embeds.</p>
			<ChannelPicker
				channels={data.channels}
				categories={data.categories}
				value={channelId}
				placeholder="Select channel…"
				onchange={(v) => (channelId = typeof v === 'string' ? v : '')}
			/>
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
