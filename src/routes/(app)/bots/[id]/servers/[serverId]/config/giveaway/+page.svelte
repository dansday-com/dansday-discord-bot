<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let giveawayChannel = $state<string>(data.settings?.giveaway_channel ?? '');
	let creatorCanParticipate = $state<boolean>(data.settings?.giveaway_creator_can_participate ?? false);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'giveaway',
					giveaway_channel: giveawayChannel,
					giveaway_creator_can_participate: creatorCanParticipate
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
		<i class="fas fa-gift text-pink-400"></i>Giveaway
	</h3>
	<p class="text-ash-400 text-xs">Choose where giveaways are posted and how entries work.</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">Giveaway Channel</label>
		<p class="text-ash-500 mb-2 text-xs">Channel for giveaways and winner announcements. Uses default channel if not set.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={giveawayChannel} onchange={(id) => (giveawayChannel = id)} />
	</div>

	<div class="flex items-center justify-between">
		<div>
			<label class="text-ash-300 text-xs font-medium">Creator Can Participate</label>
			<p class="text-ash-500 mt-0.5 text-xs">Allow giveaway creators to enter their own giveaways.</p>
		</div>
		<button
			type="button"
			onclick={() => (creatorCanParticipate = !creatorCanParticipate)}
			class="relative h-6 w-10 flex-shrink-0 rounded-full transition-colors {creatorCanParticipate ? 'bg-ash-400' : 'bg-ash-700'}"
		>
			<span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all {creatorCanParticipate ? 'left-5' : 'left-1'}"></span>
		</button>
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
