<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function blankDraft() {
		return { id: null as number | null, name: '', api_url: '', site_url: '', description: '' };
	}

	let draft = $state(blankDraft());
	let saving = $state(false);
	let testing = $state(false);
	let pendingDelete = $state<{ id: number; name: string } | null>(null);
	let deleting = $state(false);

	const isEditing = $derived(draft.id !== null);

	function openEdit(wiki: (typeof data.wikis)[number]) {
		draft = {
			id: wiki.id,
			name: wiki.name,
			api_url: wiki.api_url,
			site_url: wiki.site_url ?? '',
			description: wiki.description ?? ''
		};
	}

	function resetDraft() {
		draft = blankDraft();
	}

	async function testConnection() {
		testing = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/wikis/test`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ api_url: draft.api_url.trim() })
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Could not reach that wiki', 'error');
				return;
			}
			if (!draft.name.trim() && d.sitename) draft.name = String(d.sitename).slice(0, 64);
			if (!draft.site_url.trim() && d.site_url) draft.site_url = new URL(d.site_url).origin;
			showToast(`Connected to ${d.sitename}`, 'success');
		} finally {
			testing = false;
		}
	}

	async function saveWiki() {
		saving = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/wikis`, {
				method: isEditing ? 'PATCH' : 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(draft.id !== null ? { id: draft.id } : {}),
					enabled: true,
					name: draft.name.trim(),
					api_url: draft.api_url.trim(),
					site_url: draft.site_url.trim(),
					description: draft.description.trim()
				})
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Failed to save wiki', 'error');
				return;
			}
			showToast(isEditing ? 'Wiki updated' : 'Wiki added', 'success');
			resetDraft();
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function toggleWiki(wiki: (typeof data.wikis)[number], enabled: boolean) {
		const res = await fetch(`/api/bots/${data.bot.id}/wikis`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: wiki.id,
				enabled,
				name: wiki.name,
				api_url: wiki.api_url,
				site_url: wiki.site_url ?? '',
				description: wiki.description ?? ''
			})
		});
		const d = await res.json();
		if (!res.ok) {
			showToast(d.error || 'Failed to update wiki', 'error');
			return;
		}
		await invalidateAll();
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		deleting = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/wikis`, {
				method: 'DELETE',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: pendingDelete.id })
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Failed to delete wiki', 'error');
				return;
			}
			if (draft.id === pendingDelete.id) resetDraft();
			showToast('Wiki removed', 'success');
			await invalidateAll();
		} finally {
			deleting = false;
			pendingDelete = null;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 mb-1 text-lg font-semibold">
		<i class="fas fa-book mr-2 text-violet-400"></i>Wiki knowledge
	</h3>
	<p class="text-ash-400 mb-4 text-sm">
		Game wikis the AI looks things up in instead of guessing. Works in chat and voice. Any <strong class="text-ash-300">MediaWiki</strong> site works, including Fandom.
		Restart the bot to apply changes.
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<label for="wiki-api-url" class="text-ash-400 mb-1 block text-xs">API URL</label>
			<p class="text-ash-500 mb-1 text-xs">The wiki's api.php endpoint, usually /w/api.php or /api.php. Test checks it and fills in the name.</p>
			<div class="flex gap-2">
				<input
					id="wiki-api-url"
					type="text"
					inputmode="url"
					autocomplete="off"
					maxlength="512"
					bind:value={draft.api_url}
					placeholder="https://fischipedia.org/w/api.php"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
				<button
					type="button"
					onclick={testConnection}
					disabled={testing || !draft.api_url.trim()}
					class="bg-ash-700 hover:bg-ash-600 text-ash-200 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if testing}
						<i class="fas fa-spinner fa-spin"></i>
					{:else}
						Test
					{/if}
				</button>
			</div>
		</div>

		<div class="min-w-0">
			<label for="wiki-name" class="text-ash-400 mb-1 block text-xs">Name</label>
			<input
				id="wiki-name"
				type="text"
				maxlength="64"
				autocomplete="off"
				bind:value={draft.name}
				placeholder="Fisch"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>

		<div class="min-w-0">
			<label for="wiki-site-url" class="text-ash-400 mb-1 block text-xs">Site URL</label>
			<input
				id="wiki-site-url"
				type="text"
				inputmode="url"
				maxlength="512"
				autocomplete="off"
				bind:value={draft.site_url}
				placeholder="https://fischipedia.org"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>

		<div class="sm:col-span-2">
			<label for="wiki-description" class="text-ash-400 mb-1 block text-xs">Description</label>
			<p class="text-ash-500 mb-1 text-xs">What this wiki covers, so the AI picks the right one when you add several.</p>
			<input
				id="wiki-description"
				type="text"
				maxlength="255"
				autocomplete="off"
				bind:value={draft.description}
				placeholder="Roblox fishing game — rods, fish, bait, locations"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={saveWiki}
			disabled={saving}
			class="text-ash-100 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if saving}
				<i class="fas fa-spinner fa-spin mr-2"></i>Saving…
			{:else}
				<i class="fas fa-save mr-2"></i>{isEditing ? 'Save changes' : 'Add wiki'}
			{/if}
		</button>
		{#if isEditing}
			<button type="button" onclick={resetDraft} class="text-ash-400 hover:text-ash-200 px-2 py-2 text-sm font-medium transition-colors">Cancel</button>
		{/if}
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-list mr-2 text-violet-400"></i>Added wikis
		</h4>
		<p class="text-ash-400 mb-4 text-sm">Disabled wikis stay saved but are ignored by chat and voice.</p>

		{#if data.wikis.length === 0}
			<p class="text-ash-500 text-sm">No wikis yet.</p>
		{:else}
			<div class="space-y-2">
				{#each data.wikis as wiki (wiki.id)}
					<div class="bg-ash-700 border-ash-600 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 shrink-0 rounded-full {wiki.enabled ? 'bg-green-500' : 'bg-ash-500'}"></span>
								<p class="text-ash-100 truncate text-sm font-medium">{wiki.name}</p>
							</div>
							<p class="text-ash-500 mt-0.5 truncate text-xs">{wiki.description || wiki.api_url}</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onclick={() => toggleWiki(wiki, !wiki.enabled)}
								class="bg-ash-600 hover:bg-ash-500 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
							>
								{wiki.enabled ? 'Disable' : 'Enable'}
							</button>
							<button
								type="button"
								onclick={() => openEdit(wiki)}
								class="bg-ash-600 hover:bg-ash-500 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
							>
								Edit
							</button>
							<button
								type="button"
								onclick={() => (pendingDelete = { id: wiki.id, name: wiki.name })}
								class="bg-ash-600 rounded-lg px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
							>
								Remove
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<ConfirmModal
	open={pendingDelete !== null}
	title="Remove Wiki"
	message="Remove &quot;{pendingDelete?.name ?? ''}&quot;? The AI will stop looking things up there."
	confirmLabel="Remove"
	dangerous
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>
