<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import MessageList from '$lib/components/server/MessageList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let channel = $state(data.settings?.channel ?? '');
	let messages = $state<string[]>(data.settings?.messages ?? []);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ component: 'booster', channel, messages })
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
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Boost Channel</label>
		<ChannelPicker channels={data.channels} value={channel} onchange={(id) => (channel = id)} />
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
