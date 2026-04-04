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
		<strong class="text-ash-200">Discord client Quests only:</strong> posts when a Quest with <strong class="text-ash-200">Orb</strong> rewards appears for your
		watcher account. Unrelated to <strong class="text-ash-200">Channel notifications</strong> in the sidebar (opt-in roles per server channel).
	</p>
	<p class="text-ash-400 text-xs">
		The official bot sends the embed (with an <strong class="text-ash-200">Open quest</strong> link). Polls about every
		<strong class="text-ash-200">minute</strong> with small random spacing between runs.
	</p>
	<p class="text-ash-500 text-xs">
		Optional HTTP(S) proxy below applies only to <code class="text-ash-300">/quests/@me</code> for this server. Leave empty to call Discord directly from the host.
		Does not change Discord ToS risk.
	</p>
	<p class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-400/90">
		<i class="fas fa-robot mr-1.5 text-violet-400"></i>Uses a <strong class="text-ash-200">running selfbot on this server</strong> (lowest id if several).
		Add/start selfbots under <strong class="text-ash-200">Selfbots</strong>.
	</p>

	<div>
		<label for="questHttpProxy" class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-network-wired mr-1.5 text-sky-400"></i>HTTP(S) proxy for quest API <span class="text-ash-500">(optional)</span>
		</label>
		<p class="text-ash-500 mb-2 text-xs">
			Example: <code class="text-ash-400">http://user:pass@host:8080</code>. Leave blank for no proxy.
		</p>
		<input
			id="questHttpProxy"
			type="text"
			autocomplete="off"
			bind:value={httpProxyUrl}
			placeholder="https://proxy.example:3128"
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		/>
	</div>

	<label class="text-ash-200 flex cursor-pointer items-center gap-2 text-sm">
		<input type="checkbox" bind:checked={enabled} class="accent-sky-500" />
		Enable quest notifier
	</label>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-hashtag mr-1.5 text-sky-400"></i>Notification channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Single channel in this server where the official bot posts.</p>
		<ChannelPicker
			channels={data.channels}
			categories={data.categories}
			value={channelId}
			placeholder="Select channel…"
			onchange={(v) => (channelId = typeof v === 'string' ? v : '')}
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
	<p class="text-ash-500 text-xs">Sends one test message using this server’s running selfbot and proxy settings above.</p>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving…' : 'Save configuration'}
	</button>
</div>
