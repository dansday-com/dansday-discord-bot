<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import EmbedForm from '$lib/frontend/components/EmbedForm.svelte';
	import { resolveEmbedFooterPlaceholders } from '$lib/utils/embedFooter.js';
	import { DEFAULT_MAIN_EMBED_COLOR, DEFAULT_MAIN_EMBED_FOOTER } from '$lib/utils/mainConfigSettings.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let title = $state('');
	let description = $state('');
	let footer = $state(data.mainConfig?.footer ?? DEFAULT_MAIN_EMBED_FOOTER);
	let color = $state(data.mainConfig?.color ?? DEFAULT_MAIN_EMBED_COLOR);
	let imageMode = $state<'url' | 'upload'>('url');
	let imageUrl = $state('');
	let uploadedImagePath = $state('');
	let imagePreview = $state('');
	let selectedChannels = $state<string[]>([]);
	let selectedRoles = $state<string[]>([]);
	let sending = $state(false);

	const footerPreview = $derived(resolveEmbedFooterPlaceholders(footer, data.serverName ?? 'Server'));

	onDestroy(() => {
		const path = uploadedImagePath;
		const sid = data.serverId;
		if (!path || sid == null || sid === '') return;
		fetch(`/api/servers/${sid}/delete-embed-image`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ path })
		}).catch(() => {});
	});

	function channelName(id: string) {
		return data.channels.find((c) => c.discord_channel_id === id)?.name ?? id;
	}

	function roleName(id: string) {
		return (data.roles as { discord_role_id: string; name: string }[]).find((r) => r.discord_role_id === id)?.name ?? id;
	}

	async function sendEmbed() {
		if (selectedChannels.length === 0) {
			showToast('Select at least one channel', 'error');
			return;
		}

		sending = true;
		try {
			const body: Record<string, unknown> = {
				title,
				description,
				footer,
				color,
				channel_ids: selectedChannels,
				role_ids: selectedRoles
			};

			if (imageMode === 'url' && imageUrl) body.image_url = imageUrl;
			else if (imageMode === 'upload' && uploadedImagePath) body.uploaded_image_path = uploadedImagePath;

			const res = await fetch(`/api/servers/${data.serverId ?? ''}/send-embed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});
			let d: { success?: boolean; error?: string } = {};
			try {
				d = await res.json();
			} catch {
				showToast('Could not read the server response. Try again.', 'error');
				return;
			}
			if (d.success) {
				uploadedImagePath = '';
				imagePreview = '';
				showToast('Embed sent!', 'success');
			} else {
				showToast(d.error || 'Failed to send embed', 'error');
			}
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>Embed Builder | {APP_NAME} Discord Bot</title>
</svelte:head>

{#snippet sendToContent()}
	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-5">
		<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
			<i class="fas fa-paper-plane text-emerald-400"></i>Send To
		</h3>

		<div class="mb-4">
			<label class="text-ash-300 mb-2 block text-xs font-medium">Channels <span class="text-ash-200">*</span></label>
			<ChannelPicker
				channels={data.channels as any}
				categories={data.categories as any}
				value={selectedChannels}
				multi={true}
				placeholder="Select channels..."
				onchange={(v) => (selectedChannels = v as string[])}
			/>
		</div>

		{#if (data.roles as unknown[]).length > 0}
			<div class="mb-4">
				<label class="text-ash-300 mb-2 block text-xs font-medium">Role Mentions</label>
				<RolePicker
					roles={data.roles as any}
					value={selectedRoles}
					placeholder="Select roles to mention..."
					onchange={(v) => (selectedRoles = v as string[])}
				/>
			</div>
		{/if}

		<button
			onclick={sendEmbed}
			disabled={sending}
			class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if sending}<i class="fas fa-spinner fa-spin text-emerald-300"></i>{:else}<i class="fas fa-paper-plane text-emerald-300"></i>{/if}
			{sending ? 'Sending...' : 'Send Embed'}
		</button>

		{#if selectedRoles.length > 0}
			<div class="mt-4 rounded-lg bg-[#313338] p-3">
				<p class="text-xs text-[#949ba4]">
					{selectedRoles
						.map(roleName)
						.map((n) => `@${n}`)
						.join(' ')}
				</p>
			</div>
		{/if}

		{#if selectedChannels.length > 0}
			<div class="text-ash-500 mt-3 text-xs">
				Sending to: {selectedChannels
					.map(channelName)
					.map((n) => `#${n}`)
					.join(', ')}
			</div>
		{/if}
	</div>
{/snippet}

<EmbedForm
	bind:title
	bind:description
	bind:footer
	bind:color
	bind:imageMode
	bind:imageUrl
	bind:uploadedImagePath
	bind:imagePreview
	defaultFooter={data.mainConfig?.footer ?? DEFAULT_MAIN_EMBED_FOOTER}
	defaultColor={data.mainConfig?.color ?? DEFAULT_MAIN_EMBED_COLOR}
	{footerPreview}
	uploadEndpoint={`/api/servers/${data.serverId ?? ''}/upload-embed-image`}
	deleteEndpoint={`/api/servers/${data.serverId ?? ''}/delete-embed-image`}
	{sending}
	onsubmit={sendEmbed}
	sendToSnippet={sendToContent}
	submitLabel="Send Embed"
/>
