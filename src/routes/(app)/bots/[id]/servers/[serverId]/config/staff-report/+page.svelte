<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import ChannelPicker from '$lib/components/server/ChannelPicker.svelte';
	import RolePicker from '$lib/components/server/RolePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let roleStart = $state<string>(data.settings?.role_start ?? '');
	let roleEnd = $state<string>(data.settings?.role_end ?? '');
	let cooldownDays = $state<number>(data.settings?.cooldown_days ?? 1);
	let reportChannel = $state<string>(data.settings?.report_channel_id ?? '');
	let ratingChannel = $state<string>(data.settings?.rating_channel_id ?? '');
	let pendingRole = $state<string>(data.settings?.pending_role ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'staff_report_rating',
					role_start: roleStart,
					role_end: roleEnd,
					cooldown_days: cooldownDays,
					report_channel_id: reportChannel,
					rating_channel_id: ratingChannel,
					pending_role: pendingRole
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
		<i class="fas fa-clipboard-check text-ash-300"></i>Staff Report & Rating
	</h3>
	<p class="text-ash-400 text-xs">Configure how staff reporting and rating roles behave across your server.</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-up mr-1"></i>Role Start (Top / Highest Position)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Highest role position where staff rating roles will be created. Roles will be placed below this.</p>
		<RolePicker roles={data.roles} value={roleStart} single placeholder="Select role..." onchange={(v) => (roleStart = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-down mr-1"></i>Role End (Bottom / Lowest Position)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Lowest role position where staff rating roles will be created. Roles will be placed above this.</p>
		<RolePicker roles={data.roles} value={roleEnd} single placeholder="Select role..." onchange={(v) => (roleEnd = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-clock mr-1"></i>Rating Cooldown (Days)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Days a member must wait before rating the same staff member again (1–30 days).</p>
		<select
			bind:value={cooldownDays}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each Array.from({ length: 30 }, (_, i) => i + 1) as day}
				<option value={day}>{day} {day === 1 ? 'day' : 'days'}</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-flag mr-1"></i>Staff Report Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channel for detailed staff reports. Uses default channel if not set.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={reportChannel} onchange={(id) => (reportChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-bell mr-1"></i>Rating Update Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channel for staff rating updates. Uses default channel if not set.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={ratingChannel} onchange={(id) => (ratingChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-user-shield mr-1"></i>Pending Report Role
		</label>
		<p class="text-ash-500 mb-2 text-xs">Role to mention when a pending report is posted. Optional.</p>
		<RolePicker roles={data.roles} value={pendingRole} single placeholder="None" onchange={(v) => (pendingRole = v as string)} />
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
