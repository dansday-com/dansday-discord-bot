<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let mainChannel = $state(data.settings?.main_channel ?? '');
	let defaultColor = $state(data.settings?.color ?? '#5865F2');
	let defaultFooter = $state(data.settings?.footer ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'main_config',
					main_channel: mainChannel,
					color: defaultColor,
					footer: defaultFooter
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
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Main channel</label>
		<ChannelPicker channels={data.channels} categories={data.categories} value={mainChannel} onchange={(id) => (mainChannel = id)} />
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
		<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-align-left mr-1.5"></i>Default Footer</label>
		<p class="text-ash-500 mb-2 text-xs">Footer text displayed at the bottom of all bot messages and embeds.</p>
		<input
			type="text"
			bind:value={defaultFooter}
			placeholder="Enter footer text..."
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
		/>
		<div class="bg-ash-900 border-ash-600 mt-2 rounded-lg border p-3">
			<p class="text-ash-200 mb-2 text-xs font-medium">Available placeholders:</p>
			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="text-ash-300 flex items-center gap-2">
					<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">{'{server}'}</code>
					<span>Server name</span>
				</div>
				<div class="text-ash-300 flex items-center gap-2">
					<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">{'{year}'}</code>
					<span>Current year</span>
				</div>
			</div>
		</div>
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
