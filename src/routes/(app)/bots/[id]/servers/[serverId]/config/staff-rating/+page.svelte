<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let roleStart = $state<string>(data.settings?.role_start ?? '');
	let roleEnd = $state<string>(data.settings?.role_end ?? '');
	let cooldownDays = $state<number>(data.settings?.cooldown_days ?? 1);
	let reviewChannel = $state<string>(data.settings?.review_channel_id ?? '');
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
					component: 'staff_rating',
					role_start: roleStart,
					role_end: roleEnd,
					cooldown_days: cooldownDays,
					review_channel_id: reviewChannel,
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
		<i class="fas fa-clipboard-check text-orange-400"></i>Staff Rating
	</h3>
	<p class="text-ash-400 text-xs">Review queue, rating announcements, cooldown, and rating-role placement.</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-up mr-1 text-orange-400"></i>Role Start (Top)
		</label>
		<p class="text-ash-500 mb-2 text-xs">The highest boundary role. Rating roles will be created/updated <strong>below</strong> this.</p>
		<RolePicker roles={data.roles} value={roleStart} single placeholder="Select role..." onchange={(v) => (roleStart = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-down mr-1 text-orange-400"></i>Role End (Bottom)
		</label>
		<p class="text-ash-500 mb-2 text-xs">The lowest boundary role. Rating roles will be created/updated <strong>above</strong> this.</p>
		<RolePicker roles={data.roles} value={roleEnd} single placeholder="Select role..." onchange={(v) => (roleEnd = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-clock mr-1 text-orange-400"></i>Rating Cooldown (Days)
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
			<i class="fas fa-flag mr-1 text-orange-400"></i>Review channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Where submissions go for staff review. Uses the default channel if empty.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={reviewChannel} onchange={(id) => (reviewChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-bell mr-1 text-orange-400"></i>Rating Update Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Where rating updates/announcements are sent. Falls back to the main/default channel if empty.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={ratingChannel} onchange={(id) => (ratingChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-user-shield mr-1 text-orange-400"></i>Pending review role
		</label>
		<p class="text-ash-500 mb-2 text-xs">Role to mention on pending submissions. Optional.</p>
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
