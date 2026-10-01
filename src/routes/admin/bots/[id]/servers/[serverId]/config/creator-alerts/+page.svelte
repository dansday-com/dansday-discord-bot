<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);
	let targetChannel = $state(data.settings?.target_channel_id || '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.creator_alerts,
					enabled: featureEnabled,
					target_channel_id: targetChannel
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
		<i class="fas fa-tower-broadcast text-rose-400"></i>Creator Alerts
	</h3>
	<p class="text-ash-400 text-xs">Members follow their own YouTube, Twitch and TikTok creators from Notifications and get tagged when they post or go live.</p>

	<ConfigToggleRow
		label="Creator alerts module"
		description="When off, creator polling, alerts and the member follow menu are disabled."
		labelIconClass="fas fa-tower-broadcast text-rose-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle creator alerts module"
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
				<i class="fas fa-bullhorn mr-1.5 text-rose-400"></i>Target Broadcast Channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">
				Where alerts are posted with follower tags. Leave empty to post nothing; members see the last 20 alerts in Notifications instead.
			</p>
			<ChannelPicker
				channels={data.channels}
				categories={data.categories}
				value={targetChannel}
				placeholder="Select channel…"
				onchange={(v) => (targetChannel = typeof v === 'string' ? v : '')}
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
