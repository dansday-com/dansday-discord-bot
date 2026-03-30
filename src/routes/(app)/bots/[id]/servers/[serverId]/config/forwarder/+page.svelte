<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Forwarder = { id?: number; source_channel: string; destination_channel: string };

	let saving = $state(false);
	let mode = $state<'production' | 'testing'>(data.settings?.mode ?? 'production');
	let productionForwarders = $state<Forwarder[]>(data.settings?.production ?? []);
	let testingForwarders = $state<Forwarder[]>(data.settings?.testing ?? []);

	const activeForwarders = $derived(mode === 'production' ? productionForwarders : testingForwarders);

	function addForwarder() {
		const entry: Forwarder = { source_channel: '', destination_channel: '' };
		if (mode === 'production') productionForwarders = [...productionForwarders, entry];
		else testingForwarders = [...testingForwarders, entry];
	}

	function removeForwarder(i: number) {
		if (mode === 'production') productionForwarders = productionForwarders.filter((_, idx) => idx !== i);
		else testingForwarders = testingForwarders.filter((_, idx) => idx !== i);
	}

	function updateForwarder(i: number, field: keyof Forwarder, val: string) {
		if (mode === 'production') {
			const next = [...productionForwarders];
			next[i] = { ...next[i], [field]: val };
			productionForwarders = next;
		} else {
			const next = [...testingForwarders];
			next[i] = { ...next[i], [field]: val };
			testingForwarders = next;
		}
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ component: 'forwarder', production: productionForwarders, testing: testingForwarders })
			});
			const d = await res.json();
			if (d.success) { showToast('Saved', 'success'); invalidateAll(); }
			else showToast(d.error || 'Failed to save', 'error');
		} finally { saving = false; }
	}
</script>

<div class="bg-ash-800 border border-ash-700 rounded-xl p-4 sm:p-6 space-y-5">
	<h3 class="text-base font-semibold text-ash-100 flex items-center gap-2">
		<i class="fas fa-forward text-ash-300"></i>Forwarder
	</h3>
	<p class="text-xs text-ash-400">Automatically forward messages from one channel to another.</p>

	<!-- Mode toggle -->
	<div class="flex gap-1 bg-ash-900 rounded-lg p-1 w-fit">
		{#each ['production', 'testing'] as m}
			<button type="button" onclick={() => (mode = m as typeof mode)}
				class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors
					{mode === m ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200'}">
				{m.charAt(0).toUpperCase() + m.slice(1)}
			</button>
		{/each}
	</div>

	<!-- Forwarder list -->
	<div class="space-y-3">
		{#each activeForwarders as fw, i}
			<div class="bg-ash-700 rounded-lg p-3 space-y-2">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-ash-400">Forwarder #{i + 1}</span>
					<button type="button" onclick={() => removeForwarder(i)}
						class="text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors">
						<i class="fas fa-trash"></i>
					</button>
				</div>
				<div>
					<label class="text-xs text-ash-400 block mb-1">Source</label>
					<ChannelPicker channels={data.channels} value={fw.source_channel}
						onchange={(id) => updateForwarder(i, 'source_channel', id)} placeholder="Source channel..." />
				</div>
				<div>
					<label class="text-xs text-ash-400 block mb-1">Destination</label>
					<ChannelPicker channels={data.channels} value={fw.destination_channel}
						onchange={(id) => updateForwarder(i, 'destination_channel', id)} placeholder="Destination channel..." />
				</div>
			</div>
		{/each}
	</div>

	<button type="button" onclick={addForwarder}
		class="w-full py-2 border border-dashed border-ash-600 rounded-lg text-sm text-ash-400 hover:text-ash-200 hover:border-ash-400 transition-colors flex items-center justify-center gap-2">
		<i class="fas fa-plus text-xs"></i>Add Forwarder
	</button>

	<button onclick={save} disabled={saving}
		class="w-full py-2.5 bg-ash-500 hover:bg-ash-400 text-ash-100 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50">
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
