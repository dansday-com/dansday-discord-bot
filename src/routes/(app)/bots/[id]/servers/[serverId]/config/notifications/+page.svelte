<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import CategoryPicker from '$lib/frontend/components/CategoryPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let roleStart = $state<string>(data.settings?.role_start ?? '');
	let roleEnd = $state<string>(data.settings?.role_end ?? '');
	let categoryIds = $state<string[]>(data.settings?.category_ids ?? []);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'notifications',
					role_start: roleStart,
					role_end: roleEnd,
					category_ids: categoryIds
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
		<i class="fas fa-bell text-rose-400"></i>Channel notification roles
	</h3>
	<p class="text-ash-400 text-xs">
		<strong class="text-ash-200">Server channel pings:</strong> create roles from channels in selected categories so members can opt in to pings per channel from
		the bot menu. This is separate from Discord’s in-app Quests or Orbs.
	</p>
	<p class="text-ash-500 text-xs">
		For <strong class="text-ash-300">Discord Quest / Orb</strong> alerts, use <strong class="text-ash-300">Discord Quests</strong> in the sidebar.
	</p>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-up mr-1 text-rose-400"></i>Notification Role Start (Top / Highest Position)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Highest role position where notification roles will be created. Roles will be placed below this.</p>
		<RolePicker roles={data.roles} value={roleStart} single placeholder="Select role..." onchange={(v) => (roleStart = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-arrow-down mr-1 text-rose-400"></i>Notification Role End (Bottom / Lowest Position)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Lowest role position where notification roles will be created. Roles will be placed above this.</p>
		<RolePicker roles={data.roles} value={roleEnd} single placeholder="Select role..." onchange={(v) => (roleEnd = v as string)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-folder mr-1 text-rose-400"></i>Categories
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channels inside these categories will get a notification role (one role per channel). Multiple categories allowed.</p>
		<CategoryPicker categories={data.categories} value={categoryIds} onchange={(v) => (categoryIds = v)} />
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
