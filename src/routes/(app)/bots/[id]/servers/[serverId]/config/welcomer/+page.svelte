<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import MessageList from '$lib/frontend/components/MessageList.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled !== false);
	let channels = $state<string[]>(data.settings?.channels ?? []);
	let messages = $state<string[]>(data.settings?.messages ?? []);

	function channelById(id: string) {
		return data.channels.find((c: any) => c.discord_channel_id === id);
	}

	function removeChannel(id: string) {
		channels = channels.filter((c) => c !== id);
	}

	function addChannel(id: string) {
		if (id && !channels.includes(id)) {
			channels = [...channels, id];
		}
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ component: SERVER_SETTINGS.component.welcomer, channels, messages, enabled: featureEnabled })
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
		<i class="fas fa-hand text-sky-400"></i>Welcomer
	</h3>
	<p class="text-ash-400 text-xs">Sent when a new member joins.</p>

	<ConfigToggleRow
		label="Welcomer module"
		description="When off, welcome messages are not sent and related Discord UI is hidden."
		bind:enabled={featureEnabled}
		ariaLabel="Toggle welcomer module"
	/>
	{#if !featureEnabled}
		<p class="text-xs text-amber-200/90">Module is off. Save configuration to apply. Turn the module on to edit the options below.</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1 text-sky-400"></i>Welcome Channels
			</label>
			<p class="text-ash-500 mb-2 text-xs">Channels for welcome messages. Multiple channels allowed. Uses default channel if not set.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={channels[0] ?? ''} onchange={(id) => addChannel(id)} />
			{#if channels.length > 0}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each channels as id}
						{@const ch = channelById(id)}
						<span class="bg-ash-600 text-ash-100 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs">
							#{ch ? ch.name : id}
							<button type="button" onclick={() => removeChannel(id)} class="hover:text-ash-300 ml-0.5 transition-colors">
								<i class="fas fa-times text-xs"></i>
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<MessageList
			label="Welcome Messages"
			iconAccent="text-sky-400"
			iconAccentMuted="text-sky-400/80"
			values={messages}
			placeholder="Welcome {'{user}'} to {'{server}'}!"
			placeholders={[
				{ code: 'user', desc: 'Mentions the new member' },
				{ code: 'server', desc: 'Server name' },
				{ code: 'memberCount', desc: 'Total member count' },
				{ code: 'accountAge', desc: 'Account age' }
			]}
			onchange={(v) => (messages = v)}
		/>
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
