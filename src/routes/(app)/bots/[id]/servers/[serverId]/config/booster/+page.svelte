<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import MessageList from '$lib/components/server/MessageList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let channels = $state<string[]>(data.settings?.channels ?? []);
	let messages = $state<string[]>(data.settings?.messages ?? []);

	function channelById(id: string) {
		return data.channels.find((c: any) => c.id === id);
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
				body: JSON.stringify({ component: 'booster', channels, messages })
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
		<i class="fas fa-gem text-ash-300"></i>Booster
	</h3>
	<p class="text-ash-400 text-xs">
		Sent when a member boosts the server. Supports <code class="text-ash-200">{'{user}'}</code>, <code class="text-ash-200">{'{server}'}</code> placeholders.
	</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Boost Channels</label>
		<p class="text-ash-500 mb-2 text-xs">Channels for boost messages. Multiple channels allowed. Uses default channel if not set.</p>
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

	<MessageList label="Boost Messages" values={messages} placeholder="Thank you {'{user}'} for boosting {'{server}'}!" onchange={(v) => (messages = v)} />

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
