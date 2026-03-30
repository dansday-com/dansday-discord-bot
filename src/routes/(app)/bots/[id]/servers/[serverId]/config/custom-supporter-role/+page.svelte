<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import RolePicker from '$lib/components/server/RolePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let roles = $state<string[]>(data.settings?.roles ?? []);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ component: 'custom_supporter_role', roles })
			});
			const d = await res.json();
			if (d.success) { showToast('Saved', 'success'); invalidateAll(); }
			else showToast(d.error || 'Failed to save', 'error');
		} finally { saving = false; }
	}
</script>

<div class="bg-ash-800 border border-ash-700 rounded-xl p-4 sm:p-6 space-y-5">
	<h3 class="text-base font-semibold text-ash-100 flex items-center gap-2">
		<i class="fas fa-star text-ash-300"></i>Custom Supporter Role
	</h3>
	<p class="text-xs text-ash-400">Roles that grant custom supporter designation in this server.</p>

	<div>
		<label class="text-xs font-medium text-ash-300 block mb-1.5">Supporter Roles</label>
		<RolePicker roles={data.roles} value={roles} onchange={(v) => (roles = v)} />
	</div>

	<button onclick={save} disabled={saving}
		class="w-full py-2.5 bg-ash-500 hover:bg-ash-400 text-ash-100 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50">
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
