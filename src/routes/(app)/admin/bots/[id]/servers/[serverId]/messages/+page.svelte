<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.messages)[number];

	let confirm = $state<Row | null>(null);
	let deleting = $state(false);

	const base = $derived(page.url.pathname.replace(/\/$/, ''));

	async function remove(message: Row) {
		deleting = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/messages/${message.id}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not delete the message', 'error', 8000);
			showToast(
				out.stripped ? 'Message deleted.' : 'Message deleted. The bot is offline, so the posted copies keep their buttons until it is back.',
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

<svelte:head>
	<title>Messages - {APP_NAME}</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6">
	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<div class="flex flex-wrap items-start gap-3">
			<div class="min-w-0 flex-1 basis-64">
				<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-envelope-open-text text-fuchsia-400"></i>Messages</h3>
				<p class="text-ash-400 mt-1 text-xs">
					Write as the bot: plain posts with photos and videos, embeds, or a full Components V2 layout. Add buttons and dropdowns that show another message
					privately or hand out roles. Saving a message edits every copy already posted.
				</p>
			</div>
			{#if data.messages.length < data.limit}
				<a
					href="{base}/new"
					class="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
				>
					<i class="fas fa-plus"></i>New message
				</a>
			{/if}
		</div>

		<div class="mt-4 flex flex-col gap-2">
			{#each data.messages as message (message.id)}
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
							{#if message.channels.length > 0}
								<span class="bg-ash-800 max-w-full truncate rounded px-1.5 py-0.5 text-emerald-200">
									Posted in {message.channels.map((channel) => `#${channel}`).join(', ')}
								</span>
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
						{#if data.messages.length < data.limit}
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
				<p class="bg-ash-700/50 border-ash-600 text-ash-400 rounded-lg border border-dashed p-6 text-center text-sm">
					No messages yet. Create one to post as the bot, build a rules panel, or set up role buttons.
				</p>
			{/each}
		</div>
	</section>
</div>

<ConfirmModal
	open={confirm !== null}
	title="Delete this message?"
	message={confirm
		? confirm.channels.length > 0
			? `"${confirm.name}" is deleted from the panel. Its posted copies stay in Discord, but buttons and dropdowns are taken off because they would stop working.`
			: `"${confirm.name}" is deleted from the panel. This cannot be undone.`
		: ''}
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={() => confirm && remove(confirm)}
	oncancel={() => (confirm = null)}
/>
