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
		<i class="fas fa-forward text-ash-300"></i>Forwarder
	</h3>
	<p class="text-ash-400 text-xs">Automatically forward messages from one channel to another.</p>

	<!-- Mode toggle -->
	<div class="bg-ash-900 flex w-fit gap-1 rounded-lg p-1">
		{#each ['production', 'testing'] as m}
			<button
				type="button"
				onclick={() => (mode = m as typeof mode)}
				class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors
					{mode === m ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200'}"
			>
				{m.charAt(0).toUpperCase() + m.slice(1)}
			</button>
		{/each}
	</div>

	<!-- Forwarder list -->
	<div class="space-y-3">
		{#each activeForwarders as fw, i}
			<div class="bg-ash-700 space-y-2 rounded-lg p-3">
				<div class="mb-1 flex items-center justify-between">
					<span class="text-ash-400 text-xs">Forwarder #{i + 1}</span>
					<button type="button" onclick={() => removeForwarder(i)} class="rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800">
						<i class="fas fa-trash"></i>
					</button>
				</div>
				<div>
					<label class="text-ash-400 mb-1 block text-xs">Source</label>
					<ChannelPicker
						channels={data.channels}
						categories={data.categories}
						value={fw.source_channel}
						onchange={(id) => updateForwarder(i, 'source_channel', id)}
						placeholder="Source channel..."
					/>
				</div>
				<div>
					<label class="text-ash-400 mb-1 block text-xs">Destination</label>
					<ChannelPicker
						channels={data.channels}
						categories={data.categories}
						value={fw.destination_channel}
						onchange={(id) => updateForwarder(i, 'destination_channel', id)}
						placeholder="Destination channel..."
					/>
				</div>
			</div>
		{/each}
	</div>

	<button
		type="button"
		onclick={addForwarder}
		class="border-ash-600 text-ash-400 hover:text-ash-200 hover:border-ash-400 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm transition-colors"
	>
		<i class="fas fa-plus text-xs"></i>Add Forwarder
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
