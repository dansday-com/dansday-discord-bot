<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import { isValidQuestHttpProxyUrl } from '$lib/utils/questHttpProxyUrl.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let testing = $state(false);
	let enabled = $state(data.settings.enabled === true);
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
					component: 'discord_quest_notifier',
					enabled,
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
			const d = await res.json();
			if (d.success) {
				showToast(`Test sent: ${d.quest?.name || 'quest'}`, 'success');
			} else {
				showToast(d.error || 'Test failed', 'error');
			}
		} catch {
			showToast('Test request failed', 'error');
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

	<div class="flex items-center justify-between gap-4">
		<div class="min-w-0">
			<label class="text-ash-300 text-xs font-medium">Enable notifier</label>
			<p class="text-ash-500 mt-0.5 text-xs">Requires a running selfbot (Selfbots).</p>
		</div>
		<button
			type="button"
			onclick={() => (enabled = !enabled)}
			class="relative h-6 w-10 flex-shrink-0 rounded-full transition-colors {enabled ? 'bg-ash-400' : 'bg-ash-700'}"
			aria-pressed={enabled}
			aria-label="Enable quest notifier"
		>
			<span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {enabled ? 'left-5' : 'left-1'}"></span>
		</button>
	</div>

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

	<button
		onclick={testNotifier}
		disabled={testing || !channelId}
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
