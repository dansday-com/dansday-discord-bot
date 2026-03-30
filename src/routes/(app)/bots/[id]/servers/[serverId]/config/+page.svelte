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
		<i class="fas fa-gear text-ash-300"></i>Main Config
	</h3>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Production Channel</label>
		<ChannelPicker channels={data.channels} value={productionChannel} onchange={(id) => (productionChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Testing Channel</label>
		<ChannelPicker channels={data.channels} value={testingChannel} onchange={(id) => (testingChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Default Color</label>
		<div class="flex items-center gap-2">
			<input
				type="color"
				bind:value={defaultColor}
				oninput={(e) => (defaultColor = (e.target as HTMLInputElement).value)}
				class="bg-ash-700 border-ash-600 h-9 w-10 cursor-pointer rounded border"
			/>
			<input
				type="text"
				bind:value={defaultColor}
				placeholder="#5865F2"
				class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Default Footer</label>
		<input
			type="text"
			bind:value={defaultFooter}
			placeholder="Footer text..."
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
