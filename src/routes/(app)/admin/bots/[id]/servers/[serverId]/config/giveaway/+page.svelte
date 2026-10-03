<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ConfigNumberSelect from '$lib/frontend/components/ConfigNumberSelect.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);
	let giveawayChannel = $state<string>(data.settings?.giveaway_channel ?? '');
	let creatorCanParticipate = $state<boolean>(data.settings?.giveaway_creator_can_participate ?? false);
	let minInvites = $state<number>(Number(data.settings?.giveaway_min_invites) || 0);

	const minInviteValues = [0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 50];

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.giveaway,
					giveaway_channel: giveawayChannel,
					giveaway_creator_can_participate: creatorCanParticipate,
					giveaway_min_invites: minInvites,
					enabled: featureEnabled
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

	<ConfigToggleRow
		label="Giveaway module"
		description="When off, giveaways and related Discord UI are disabled."
		labelIconClass="fas fa-gift text-pink-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle giveaway module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to edit the options below.</span>
		</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1 text-pink-400"></i>Giveaway Channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">Channel for giveaways and winner announcements.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={giveawayChannel} onchange={(id) => (giveawayChannel = id)} />
		</div>

		<ConfigToggleRow
			label="Creator can participate"
			description="Allow giveaway creators to enter their own giveaways."
			labelIconClass="fas fa-user-plus text-pink-400"
			bind:enabled={creatorCanParticipate}
			ariaLabel="Allow giveaway creator to participate"
		/>

		<ConfigNumberSelect
			label="Invites needed to enter"
			description="Members need this many invites to join a giveaway. 0 means no requirement. Applies to giveaways created after you save."
			labelIconClass="fas fa-user-plus mr-1 text-pink-400"
			values={minInviteValues}
			bind:value={minInvites}
			formatOption={(v) => (v === 0 ? 'No requirement' : `${v} invite${v === 1 ? '' : 's'}`)}
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
