<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let adminRoles = $state<string[]>(data.settings?.admin_roles ?? []);
	let staffRoles = $state<string[]>(data.settings?.staff_roles ?? []);
	let supporterRoles = $state<string[]>(data.settings?.supporter_roles ?? []);
	let memberRoles = $state<string[]>(data.settings?.member_roles ?? []);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'permissions',
					admin_roles: adminRoles,
					staff_roles: staffRoles,
					supporter_roles: supporterRoles,
					member_roles: memberRoles
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
		<i class="fas fa-shield-halved text-blue-400"></i>Permissions
	</h3>
	<p class="text-ash-400 text-xs">Define role groups used for access control and member filtering.</p>

	{#each [{ label: 'Admin Roles', help: 'Full access to all bot features and configuration.', value: adminRoles, onchange: (v: string | string[]) => (adminRoles = v as string[]) }, { label: 'Staff Roles', help: 'Used for staff features and staff-related filtering (if enabled).', value: staffRoles, onchange: (v: string | string[]) => (staffRoles = v as string[]) }, { label: 'Supporter Roles', help: 'Marks members as supporters (for supporter-only features).', value: supporterRoles, onchange: (v: string | string[]) => (supporterRoles = v as string[]) }, { label: 'Member Roles', help: 'Only members with these roles are eligible for leveling XP.', value: memberRoles, onchange: (v: string | string[]) => (memberRoles = v as string[]) }] as group}
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">{group.label}</label>
			<p class="text-ash-500 mb-2 text-xs">{group.help}</p>
			<RolePicker roles={data.roles} value={group.value} onchange={group.onchange} />
		</div>
	{/each}

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
