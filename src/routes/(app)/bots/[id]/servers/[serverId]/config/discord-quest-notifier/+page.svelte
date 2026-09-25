<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let testing = $state(false);
	let featureEnabled = $state(data.settings.enabled === true);
	let channelId = $state(data.settings.channel_id || '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.discord_quest_notifier,
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
		Discord Quest alerts discovered by the operator's linked accounts (all reward types). Not the same as
		<strong class="text-ash-200">Channel notification</strong>.
	</p>

	<ConfigToggleRow
		label="Quest notifier module"
		description="When off, quest polling and posts are disabled."
		labelIconClass="fas fa-gem text-sky-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle quest notifier module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to edit the channel below.</span>
		</p>
	{/if}
	{#if featureEnabled && !data.hasRunningSelfbot}
		<p class="flex items-start gap-2 rounded-lg border border-red-800/30 bg-red-900/20 p-3 text-xs text-red-200/90">
			<i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-red-400" aria-hidden="true"></i>
			<span>
				{#if !data.hasSelfbots}
					<strong>No linked account available.</strong> The operator has not linked an account, so quests cannot be discovered. Ask them to add one.
				{:else}
					<strong>No linked account running.</strong> An account is linked but not online. Ask the operator to start it.
				{/if}
			</span>
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

		<div class="border-ash-700 bg-ash-800/40 rounded-lg border p-3">
			<p class="text-ash-300 text-xs font-medium">
				<i class="fas fa-bolt mr-1.5 text-sky-400"></i>Auto quest enrollment
				<span class="ml-1.5 rounded px-1.5 py-0.5 text-[10px] {data.autoQuestEnabled ? 'bg-emerald-900/40 text-emerald-300' : 'bg-ash-700 text-ash-400'}">
					{data.autoQuestEnabled ? 'On' : 'Off'}
				</span>
			</p>
			<p class="text-ash-500 mt-1.5 text-xs">Set instance-wide by the operator, not per server. Off by default.</p>
		</div>
	</div>

	<button
		onclick={testNotifier}
		disabled={testing || !channelId || !featureEnabled || !data.hasQuests}
		class="border-ash-600 text-ash-100 hover:bg-ash-700 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if testing}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-vial text-sky-400"></i>{/if}
		{testing ? 'Testing…' : 'Test — latest quest'}
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
