<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigNumberSelect from '$lib/frontend/components/ConfigNumberSelect.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import { formatDayCount, selectValuesDays1To30 } from '$lib/frontend/numericSelectFormatters.js';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled !== false);
	let admissionChannel = $state<string>(data.settings?.admission_channel_id ?? '');
	let targetChannel = $state<string>(data.settings?.target_channel_id ?? '');
	let cooldownDays = $state<number>(data.settings?.cooldown_days ?? 1);
	let pendingRole = $state<string>(data.settings?.pending_role ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.content_creator,
					admission_channel_id: admissionChannel,
					target_channel_id: targetChannel,
					cooldown_days: cooldownDays,
					pending_role: pendingRole,
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
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-video text-pink-400"></i>Content Creator</h3>
	<p class="text-ash-400 text-xs">Configure content creator admission and TikTok live broadcast behavior.</p>

	<ConfigToggleRow
		label="Content creator module"
		description="When off, content creator admission and related Discord UI are disabled."
		bind:enabled={featureEnabled}
		ariaLabel="Toggle content creator module"
	/>
	{#if !featureEnabled}
		<p class="text-xs text-amber-200/90">Module is off. Save configuration to apply. Turn the module on to edit the options below.</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-inbox mr-1 text-pink-400"></i>Admission Channel</label>
			<p class="text-ash-500 mb-2 text-xs">Staff approval queue channel for pending applications.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={admissionChannel} onchange={(id) => (admissionChannel = id)} />
		</div>

		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-bullhorn mr-1 text-pink-400"></i>Target Broadcast Channel</label>
			<p class="text-ash-500 mb-2 text-xs">Channel for TikTok LIVE notifications from approved creators.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={targetChannel} onchange={(id) => (targetChannel = id)} />
		</div>

		<ConfigNumberSelect
			label="Admission Cooldown (Days)"
			description="How long members must wait before reapplying after a submission."
			labelIconClass="fas fa-clock mr-1 text-pink-400"
			values={selectValuesDays1To30}
			bind:value={cooldownDays}
			formatOption={formatDayCount}
		/>

		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-user-shield mr-1 text-pink-400"></i>Pending Admission Role</label>
			<p class="text-ash-500 mb-2 text-xs">Optional role to mention when a new application arrives.</p>
			<RolePicker roles={data.roles} value={pendingRole} single placeholder="None" onchange={(v) => (pendingRole = v as string)} />
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
