<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';

	type Row = {
		id: number;
		name: string;
		layout: string;
		languages: string[];
		summary: string;
		interactive: boolean;
		attachments: number;
		updated_at: string;
		posted: string;
	};

	let {
		title,
		intro,
		empty,
		base,
		apiBase,
		limit,
		messages
	}: {
		title: string;
		intro: string;
		empty: string;
		base: string;
		apiBase: string;
		limit: number;
		messages: Row[];
	} = $props();

	let confirm = $state<Row | null>(null);
	let deleting = $state(false);

	async function remove(message: Row) {
		deleting = true;
		try {
			const res = await fetch(`${apiBase}/${message.id}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not delete the message', 'error', 8000);
			showToast(
				out.stripped ? 'Message deleted.' : 'Message deleted. A bot is offline, so some posted copies keep their buttons until it is back.',
				out.stripped ? 'success' : 'info',
				7000
			);
			await invalidateAll();
		} finally {
			deleting = false;
			confirm = null;
		}
	}
</script>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<div class="flex flex-wrap items-start gap-3">
		<div class="min-w-0 flex-1 basis-64">
			<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-envelope-open-text text-fuchsia-400"></i>{title}</h3>
			<p class="text-ash-400 mt-1 text-xs">{intro}</p>
		</div>
		{#if messages.length < limit}
			<a
				href="{base}/new"
				class="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
			>
				<i class="fas fa-plus"></i>New message
			</a>
		{/if}
	</div>

	<div class="mt-4 flex flex-col gap-2">
		{#each messages as message (message.id)}
			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors">
				<a href="{base}/{message.id}" class="min-w-0 flex-1 basis-64">
					<p class="text-ash-100 truncate text-sm font-semibold">{message.name}</p>
					<p class="text-ash-400 truncate text-xs">{message.summary || 'No text yet'}</p>
					<p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
						<span class="bg-ash-800 text-ash-300 rounded px-1.5 py-0.5">{message.layout === 'components' ? 'Components V2' : 'Standard'}</span>
						{#if message.interactive}<span class="bg-ash-800 rounded px-1.5 py-0.5 text-amber-200">Buttons</span>{/if}
						{#if message.attachments > 0}
							<span class="bg-ash-800 rounded px-1.5 py-0.5 text-sky-200">{message.attachments} {message.attachments === 1 ? 'file' : 'files'}</span>
						{/if}
						{#if message.languages.length > 1}
							<span class="bg-ash-800 rounded px-1.5 py-0.5 text-sky-200">{message.languages.length} languages</span>
						{/if}
						{#if message.posted}
							<span class="bg-ash-800 max-w-full truncate rounded px-1.5 py-0.5 text-emerald-200">Posted in {message.posted}</span>
						{:else}
							<span class="text-ash-500">Not posted yet</span>
						{/if}
						<span class="text-ash-500">· edited <LocalTime value={message.updated_at} /></span>
					</p>
				</a>
				<div class="ml-auto flex shrink-0 gap-1.5">
					<a href="{base}/{message.id}" class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
						<i class="fas fa-pen mr-1"></i>Edit
					</a>
					{#if messages.length < limit}
						<a
							href="{base}/new?copy={message.id}"
							class="bg-ash-800 hover:bg-ash-600 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
						>
							<i class="fas fa-copy mr-1"></i>Duplicate
						</a>
					{/if}
					<button
						type="button"
						onclick={() => (confirm = message)}
						class="bg-ash-800 hover:bg-ash-600 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
					>
						<i class="fas fa-trash mr-1 text-red-300"></i>Delete
					</button>
				</div>
			</div>
		{:else}
			<p class="bg-ash-700/50 border-ash-600 text-ash-400 rounded-lg border border-dashed p-6 text-center text-sm">{empty}</p>
		{/each}
	</div>
</section>

<ConfirmModal
	open={confirm !== null}
	title="Delete this message?"
	message={confirm
		? confirm.posted
			? `"${confirm.name}" is deleted from the panel. Its posted copies stay in Discord, but buttons and dropdowns are taken off because they would stop working.`
			: `"${confirm.name}" is deleted from the panel. This cannot be undone.`
		: ''}
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={() => confirm && remove(confirm)}
	oncancel={() => (confirm = null)}
/>
