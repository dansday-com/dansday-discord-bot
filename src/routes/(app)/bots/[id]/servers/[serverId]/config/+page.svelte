<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import { DEFAULT_MAIN_EMBED_COLOR, DEFAULT_MAIN_EMBED_FOOTER } from '$lib/utils/mainConfigSettings.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let defaultColor = $state(data.settings?.color ?? DEFAULT_MAIN_EMBED_COLOR);
	let defaultFooter = $state(data.settings?.footer ?? DEFAULT_MAIN_EMBED_FOOTER);
	let botUpdatesChannel = $state(data.settings?.bot_updates_channel_id ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.main,
					color: defaultColor,
					footer: defaultFooter,
					bot_updates_channel_id: botUpdatesChannel
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
		<i class="fas fa-gear text-emerald-400"></i>Main
	</h3>
	<p class="text-ash-400 text-xs">Set the embed style used across the bot.</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-palette mr-1.5 text-emerald-400"></i>Default Color
		</label>
		<p class="text-ash-500 mb-2 text-xs">Embed accent color used by default (hex).</p>
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
				placeholder={DEFAULT_MAIN_EMBED_COLOR}
				class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-align-left mr-1.5 text-emerald-400"></i>Default Footer</label>
		<p class="text-ash-500 mb-2 text-xs">Footer text shown on most bot embeds.</p>
		<input
			type="text"
			bind:value={defaultFooter}
			placeholder={DEFAULT_MAIN_EMBED_FOOTER}
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

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-bullhorn mr-1.5 text-emerald-400"></i>Bot Updates Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channel to receive announcements and changelogs from the bot developers.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={botUpdatesChannel} onchange={(id) => (botUpdatesChannel = id)} />
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
