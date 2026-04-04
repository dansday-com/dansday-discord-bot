<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { isValidQuestHttpProxyUrl } from '$lib/utils/questHttpProxyUrl.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let testing = $state(false);
	let featureEnabled = $state(data.settings.enabled !== false);
	let channelId = $state(data.settings.channel_id || '');
	let httpProxyUrl = $state(data.settings.http_proxy_url || '');

	async function save() {
		if (!isValidQuestHttpProxyUrl(httpProxyUrl)) {
			showToast('HTTP proxy must be a valid http:// or https:// URL (or leave empty)', 'error');
			return;
		}
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.discord_quest_notifier,
					enabled: featureEnabled,
					channel_id: channelId,
					http_proxy_url: httpProxyUrl.trim() || ''
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

	async function testNotifier() {
		testing = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/quest-notifier/test`, {
				method: 'POST',
				credentials: 'include'
			});
			let d: { success?: boolean; error?: string; quest?: { name?: string } } = {};
			try {
				d = await res.json();
			} catch {
				showToast('Could not read the server response. Try again.', 'error');
				return;
			}
			if (d.success) {
				showToast(`Test sent: ${d.quest?.name || 'quest'}`, 'success');
			} else {
				showToast(d.error || 'Test failed', 'error');
			}
		} catch {
			showToast('Network error — could not reach the server.', 'error');
		} finally {
			testing = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-gem text-sky-400"></i>Discord Quest notifier
	</h3>
	<p class="text-ash-400 text-xs">
		Orb quest alerts from this server’s selfbot; not the same as <strong class="text-ash-200">Channel notification</strong>.
	</p>

	<ConfigToggleRow
		label="Quest notifier module"
		description="When off, orb quest polling and posts are disabled. Requires a running selfbot when enabled."
		labelIconClass="fas fa-gem text-sky-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle quest notifier module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to edit channel and proxy below.</span>
		</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1.5 text-sky-400"></i>Notification channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">Where the official bot posts quest embeds.</p>
			<ChannelPicker
				channels={data.channels}
				categories={data.categories}
				value={channelId}
				placeholder="Select channel…"
				onchange={(v) => (channelId = typeof v === 'string' ? v : '')}
			/>
		</div>

		<div>
			<label for="questHttpProxy" class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-network-wired mr-1.5 text-sky-400"></i>HTTP(S) proxy <span class="text-ash-500">(optional)</span>
			</label>
			<p class="text-ash-500 mb-2 text-xs">For <code class="text-ash-400">/quests/@me</code> only. Leave empty for direct connection.</p>
			<input
				id="questHttpProxy"
				type="text"
				autocomplete="off"
				bind:value={httpProxyUrl}
				placeholder="http://user:pass@host:8080"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
	</div>

	<button
		onclick={testNotifier}
		disabled={testing || !channelId || !featureEnabled}
		class="border-ash-600 text-ash-100 hover:bg-ash-700 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if testing}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-vial text-sky-400"></i>{/if}
		{testing ? 'Testing…' : 'Test — latest orb quest'}
	</button>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
