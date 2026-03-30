<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let productionChannel = $state(data.settings?.production_channel ?? '');
	let testingChannel = $state(data.settings?.testing_channel ?? '');
	let defaultColor = $state(data.settings?.default_color ?? '#5865F2');
	let defaultFooter = $state(data.settings?.default_footer ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'main_config',
					production_channel: productionChannel,
					testing_channel: testingChannel,
					default_color: defaultColor,
					default_footer: defaultFooter
				})
			});
			const d = await res.json();
			if (d.success) { showToast('Saved', 'success'); invalidateAll(); }
			else showToast(d.error || 'Failed to save', 'error');
		} finally { saving = false; }
	}
</script>

<div class="bg-ash-800 border border-ash-700 rounded-xl p-4 sm:p-6 space-y-5">
	<h3 class="text-base font-semibold text-ash-100 flex items-center gap-2">
		<i class="fas fa-gear text-ash-300"></i>Main Config
	</h3>

	<div>
		<label class="text-xs font-medium text-ash-300 block mb-1.5">Production Channel</label>
		<ChannelPicker channels={data.channels} value={productionChannel} onchange={(id) => (productionChannel = id)} />
	</div>

	<div>
		<label class="text-xs font-medium text-ash-300 block mb-1.5">Testing Channel</label>
		<ChannelPicker channels={data.channels} value={testingChannel} onchange={(id) => (testingChannel = id)} />
	</div>

	<div>
		<label class="text-xs font-medium text-ash-300 block mb-1.5">Default Color</label>
		<div class="flex items-center gap-2">
			<input type="color" bind:value={defaultColor}
				oninput={(e) => (defaultColor = (e.target as HTMLInputElement).value)}
				class="w-10 h-9 rounded cursor-pointer bg-ash-700 border border-ash-600" />
			<input type="text" bind:value={defaultColor} placeholder="#5865F2"
				class="flex-1 px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ash-500" />
		</div>
	</div>

	<div>
		<label class="text-xs font-medium text-ash-300 block mb-1.5">Default Footer</label>
		<input type="text" bind:value={defaultFooter} placeholder="Footer text..."
			class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500" />
	</div>

	<button onclick={save} disabled={saving}
		class="w-full py-2.5 bg-ash-500 hover:bg-ash-400 text-ash-100 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50">
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
