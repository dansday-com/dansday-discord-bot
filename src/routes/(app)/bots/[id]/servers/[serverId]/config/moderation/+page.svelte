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
	let logChannelId = $state(data.settings?.log_channel_id ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.moderation,
					enabled: featureEnabled,
					log_channel_id: logChannelId
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
		<i class="fas fa-gavel text-red-400"></i>Moderation
	</h3>
	<p class="text-ash-400 text-xs">Ban and kick log embeds posted to your chosen channel.</p>

	<ConfigToggleRow
		label="Moderation module"
		description="When off, moderation is disabled for this server, including ban and kick log embeds."
		labelIconClass="fas fa-gavel text-red-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle moderation module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to re-enable moderation and logs.</span>
		</p>
	{/if}

	{#if featureEnabled}
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1 text-emerald-400"></i>Moderation Logs Channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">Where moderation logs will be posted.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={logChannelId} onchange={(id) => (logChannelId = id)} />
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
