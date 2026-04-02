<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let enabled = $state(Boolean(data.enabled));

	const publicUrl = $derived(enabled && data.leaderboardPath ? `${page.url.origin}${data.leaderboardPath}` : '');

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'leaderboard',
					enabled
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
		<i class="fas fa-trophy text-ash-300"></i>Leaderboards
	</h3>

	<div class="flex items-center justify-between gap-4">
		<div>
			<div class="text-ash-200 text-sm font-medium">Enable public leaderboard</div>
			<div class="text-ash-500 text-xs">Turns on the server’s public leaderboard page.</div>
		</div>
		<label class="relative inline-flex cursor-pointer items-center">
			<input type="checkbox" class="peer sr-only" bind:checked={enabled} />
			<div
				class="peer bg-ash-700 peer-checked:bg-ash-500 h-6 w-11 rounded-full after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"
			></div>
		</label>
	</div>

	{#if enabled}
		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">Public URL</label>
			<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
				<input type="text" readonly value={publicUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
				<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.leaderboardPath || '#'} target="_blank" rel="noreferrer"> Open </a>
			</div>
			<p class="text-ash-500 mt-2 text-xs">
				The URL is generated from the server name (no slug is saved in the database). If another server has the same name, we add
				<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">_1</code>,
				<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">_2</code>, etc.
			</p>
		</div>
	{/if}

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
