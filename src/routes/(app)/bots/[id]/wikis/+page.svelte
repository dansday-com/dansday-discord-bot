<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const inputClass =
		'bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none';

	function blankDraft() {
		return { id: null as number | null, enabled: true, name: '', api_url: '', site_url: '', description: '' };
	}

	let draft = $state(blankDraft());
	let formOpen = $state(false);
	let saving = $state(false);
	let testing = $state(false);
	let pendingDelete = $state<{ id: number; name: string } | null>(null);
	let deleting = $state(false);

	const isEditing = $derived(draft.id !== null);

	function openCreate() {
		draft = blankDraft();
		formOpen = true;
	}

	function openEdit(wiki: (typeof data.wikis)[number]) {
		draft = {
			id: wiki.id,
			enabled: wiki.enabled,
			name: wiki.name,
			api_url: wiki.api_url,
			site_url: wiki.site_url ?? '',
			description: wiki.description ?? ''
		};
		formOpen = true;
	}

	function closeForm() {
		formOpen = false;
		draft = blankDraft();
	}

	function payload() {
		return {
			...(draft.id !== null ? { id: draft.id } : {}),
			enabled: draft.enabled,
			name: draft.name.trim(),
			api_url: draft.api_url.trim(),
			site_url: draft.site_url.trim(),
			description: draft.description.trim()
		};
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

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/wikis`, {
				method: isEditing ? 'PATCH' : 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload())
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Failed to save wiki', 'error');
				return;
			}
			showToast(isEditing ? 'Wiki updated' : 'Wiki added', 'success');
			closeForm();
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
			showToast('Wiki removed', 'success');
			await invalidateAll();
		} finally {
			deleting = false;
			pendingDelete = null;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<h3 class="text-ash-100 mb-1 text-lg font-semibold">
				<i class="fas fa-book mr-2 text-sky-400"></i>Wiki knowledge
			</h3>
			<p class="text-ash-400 text-sm">
				Game wikis the AI can look things up in. When someone asks about an item, fish, event or mechanic, the bot searches these instead of guessing. Works in
				chat and voice. Any <strong class="text-ash-300">MediaWiki</strong> site works. Restart the bot to apply changes.
			</p>
		</div>
		<button
			type="button"
			onclick={openCreate}
			class="text-ash-100 h-10 shrink-0 rounded-lg bg-violet-600 px-4 text-sm font-medium transition-colors hover:bg-violet-700"
		>
			<i class="fas fa-plus mr-2"></i>Add wiki
		</button>
	</div>

	{#if data.wikis.length === 0}
		<div class="border-ash-700 rounded-lg border border-dashed px-4 py-10 text-center">
			<i class="fas fa-book text-ash-600 mb-3 text-3xl"></i>
			<p class="text-ash-300 text-sm font-medium">No wikis yet</p>
			<p class="text-ash-500 mx-auto mt-1 max-w-md text-xs">
				Add one to give the AI real game knowledge — for example the Fisch wiki at
				<code class="text-ash-400">https://fischipedia.org/w/api.php</code>
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.wikis as wiki (wiki.id)}
				<div class="bg-ash-700/40 border-ash-700 rounded-lg border p-3 sm:p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<p class="text-ash-100 truncate text-sm font-semibold">{wiki.name}</p>
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {wiki.enabled ? 'bg-green-500/15 text-green-300' : 'bg-ash-600/60 text-ash-400'}">
									{wiki.enabled ? 'Active' : 'Off'}
								</span>
							</div>
							{#if wiki.description}
								<p class="text-ash-400 mt-1 text-xs">{wiki.description}</p>
							{/if}
							<p class="text-ash-500 mt-1 truncate font-mono text-[11px]">{wiki.api_url}</p>
						</div>

						<div class="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onclick={() => toggleWiki(wiki, !wiki.enabled)}
								class="bg-ash-700 hover:bg-ash-600 text-ash-300 h-9 rounded-lg px-3 text-xs font-medium transition-colors"
							>
								{wiki.enabled ? 'Disable' : 'Enable'}
							</button>
							<button
								type="button"
								onclick={() => openEdit(wiki)}
								aria-label="Edit {wiki.name}"
								class="bg-ash-700 hover:bg-ash-600 text-ash-300 h-9 w-9 rounded-lg transition-colors"
							>
								<i class="fas fa-pen text-xs"></i>
							</button>
							<button
								type="button"
								onclick={() => (pendingDelete = { id: wiki.id, name: wiki.name })}
								aria-label="Remove {wiki.name}"
								class="bg-ash-700 h-9 w-9 rounded-lg text-red-300 transition-colors hover:bg-red-900/40"
							>
								<i class="fas fa-trash text-xs"></i>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if formOpen}
		<div class="border-ash-700 mt-6 border-t pt-5">
			<h4 class="text-ash-100 mb-4 text-base font-semibold">
				<i class="fas {isEditing ? 'fa-pen' : 'fa-plus'} mr-2 text-violet-400"></i>{isEditing ? 'Edit wiki' : 'Add wiki'}
			</h4>

			<ConfigToggleRow
				label="Enabled"
				description="When off, the AI ignores this wiki."
				labelIconClass="fas fa-book text-sky-400"
				bind:enabled={draft.enabled}
				ariaLabel="Toggle wiki"
			/>

			<div class="mt-5 space-y-4">
				<div class="min-w-0">
					<label for="wiki-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
					<div class="flex gap-2">
						<input
							id="wiki-api-url"
							type="text"
							inputmode="url"
							autocomplete="off"
							maxlength="512"
							bind:value={draft.api_url}
							placeholder="https://fischipedia.org/w/api.php"
							class={inputClass}
						/>
						<button
							type="button"
							onclick={testConnection}
							disabled={testing || !draft.api_url.trim()}
							class="bg-ash-700 hover:bg-ash-600 text-ash-200 h-10 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if testing}
								<i class="fas fa-spinner fa-spin"></i>
							{:else}
								Test
							{/if}
						</button>
					</div>
					<p class="text-ash-500 mt-1.5 text-xs">
						The wiki's <code class="text-ash-300">api.php</code> endpoint, usually at <code class="text-ash-300">/w/api.php</code> or
						<code class="text-ash-300">/api.php</code>. Test fills in the name for you.
					</p>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="min-w-0">
						<label for="wiki-name" class="text-ash-400 mb-1.5 block text-xs font-medium">Name</label>
						<input id="wiki-name" type="text" maxlength="64" autocomplete="off" bind:value={draft.name} placeholder="Fisch" class={inputClass} />
						<p class="text-ash-500 mt-1.5 text-xs">What the AI calls this wiki when choosing one.</p>
					</div>
					<div class="min-w-0">
						<label for="wiki-site-url" class="text-ash-400 mb-1.5 block text-xs font-medium">Site URL <span class="text-ash-600">(optional)</span></label>
						<input
							id="wiki-site-url"
							type="text"
							inputmode="url"
							maxlength="512"
							autocomplete="off"
							bind:value={draft.site_url}
							placeholder="https://fischipedia.org"
							class={inputClass}
						/>
						<p class="text-ash-500 mt-1.5 text-xs">Used when the bot links a page.</p>
					</div>
				</div>

				<div class="min-w-0">
					<label for="wiki-description" class="text-ash-400 mb-1.5 block text-xs font-medium">
						Description <span class="text-ash-600">(optional)</span>
					</label>
					<input
						id="wiki-description"
						type="text"
						maxlength="255"
						autocomplete="off"
						bind:value={draft.description}
						placeholder="Roblox fishing game — rods, fish, bait, locations"
						class={inputClass}
					/>
					<p class="text-ash-500 mt-1.5 text-xs">Tells the AI what this wiki covers, so it picks the right one.</p>
				</div>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={save}
					disabled={saving}
					class="text-ash-100 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if saving}
						<i class="fas fa-spinner fa-spin mr-2"></i>Saving…
					{:else}
						<i class="fas fa-save mr-2"></i>{isEditing ? 'Save changes' : 'Add wiki'}
					{/if}
				</button>
				<button type="button" onclick={closeForm} class="text-ash-400 hover:text-ash-200 px-2 py-2 text-sm font-medium transition-colors">Cancel</button>
			</div>
		</div>
	{/if}
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
