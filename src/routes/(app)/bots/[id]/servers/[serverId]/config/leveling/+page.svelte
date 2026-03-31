<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import MessageList from '$lib/components/server/MessageList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let enabled = $state(data.settings?.enabled ?? false);
	let channel = $state(data.settings?.channel ?? '');
	let xpMultiplier = $state<number>(data.settings?.xp_multiplier ?? 1);
	let levelUpMessages = $state<string[]>(data.settings?.level_up_messages ?? []);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ component: 'leveling', enabled, channel, xp_multiplier: xpMultiplier, level_up_messages: levelUpMessages })
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
		<i class="fas fa-chart-line text-ash-300"></i>Leveling
	</h3>

	<div class="flex items-center justify-between">
		<label class="text-ash-300 text-xs font-medium">Enable Leveling</label>
		<button type="button" onclick={() => (enabled = !enabled)} class="h-6 w-10 rounded-full transition-colors {enabled ? 'bg-ash-400' : 'bg-ash-700'} relative">
			<span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {enabled ? 'left-5' : 'left-1'}"></span>
		</button>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Level Up Channel</label>
		<ChannelPicker channels={data.channels} value={channel} onchange={(id) => (channel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">XP Multiplier</label>
		<input
			type="number"
			bind:value={xpMultiplier}
			min="0.1"
			max="10"
			step="0.1"
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
		/>
	</div>

	<MessageList
		label="Level Up Messages"
		values={levelUpMessages}
		placeholder="Congrats {'{user}'}, you reached level {'{level}'}!"
		onchange={(v) => (levelUpMessages = v)}
	/>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
