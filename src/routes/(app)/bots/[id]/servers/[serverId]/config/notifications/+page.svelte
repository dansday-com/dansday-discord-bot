<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let channel = $state(data.settings?.channel ?? '');
	let notifyJoin = $state(data.settings?.notify_join ?? false);
	let notifyLeave = $state(data.settings?.notify_leave ?? false);
	let notifyBan = $state(data.settings?.notify_ban ?? false);
	let notifyBoost = $state(data.settings?.notify_boost ?? false);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'notifications',
					channel,
					notify_join: notifyJoin,
					notify_leave: notifyLeave,
					notify_ban: notifyBan,
					notify_boost: notifyBoost
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

	const toggles = [
		{ label: 'Member Join', get: () => notifyJoin, set: (v: boolean) => (notifyJoin = v) },
		{ label: 'Member Leave', get: () => notifyLeave, set: (v: boolean) => (notifyLeave = v) },
		{ label: 'Member Ban', get: () => notifyBan, set: (v: boolean) => (notifyBan = v) },
		{ label: 'Server Boost', get: () => notifyBoost, set: (v: boolean) => (notifyBoost = v) }
	];
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-bell text-ash-300"></i>Notifications
	</h3>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Notification Channel</label>
		<ChannelPicker channels={data.channels} value={channel} onchange={(id) => (channel = id)} />
	</div>

	<div class="space-y-3">
		{#each toggles as t}
			<div class="flex items-center justify-between">
				<label class="text-ash-300 text-xs font-medium">{t.label}</label>
				<button type="button" onclick={() => t.set(!t.get())} class="h-6 w-10 rounded-full transition-colors {t.get() ? 'bg-ash-400' : 'bg-ash-700'} relative">
					<span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {t.get() ? 'left-5' : 'left-1'}"></span>
				</button>
			</div>
		{/each}
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
