<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled !== false);
	let roleStart = $state<string>(data.settings?.role_start ?? '');
	let roleEnd = $state<string>(data.settings?.role_end ?? '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.custom_supporter_role,
					role_start: roleStart,
					role_end: roleEnd,
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
		<i class="fas fa-star text-yellow-400"></i>Custom Supporter Role
	</h3>
	<p class="text-ash-400 text-xs">Define the role range where custom supporter roles will be created.</p>

	<ConfigToggleRow
		label="Custom supporter role module"
		description="When off, custom supporter role creation from the bot is disabled."
		labelIconClass="fas fa-star text-yellow-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle custom supporter role module"
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
				<i class="fas fa-arrow-up mr-1 text-yellow-400"></i>Role Start (Top / Highest Position)
			</label>
			<p class="text-ash-500 mb-2 text-xs">Highest role position where custom supporter roles will be created. Roles will be placed below this.</p>
			<RolePicker roles={data.roles} value={roleStart} single placeholder="Select role..." onchange={(v) => (roleStart = v as string)} />
		</div>

		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-arrow-down mr-1 text-yellow-400"></i>Role End (Bottom / Lowest Position)
			</label>
			<p class="text-ash-500 mb-2 text-xs">Lowest role position where custom supporter roles will be created. Roles will be placed above this.</p>
			<RolePicker roles={data.roles} value={roleEnd} single placeholder="Select role..." onchange={(v) => (roleEnd = v as string)} />
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
