<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import { resolveEmbedFooterPlaceholders } from '$lib/utils/embedFooter.js';
	import { DEFAULT_MAIN_EMBED_COLOR, DEFAULT_MAIN_EMBED_FOOTER } from '$lib/utils/mainConfigSettings.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const MAX_TITLE = 256;
	const MAX_DESC = 4096;
	const MAX_FOOTER = 2048;
	const MAX_TOTAL = 6000;

	let title = $state('');
	let description = $state('');
	let footer = $state(data.mainConfig?.footer ?? DEFAULT_MAIN_EMBED_FOOTER);
	let color = $state(data.mainConfig?.color ?? DEFAULT_MAIN_EMBED_COLOR);
	let colorHex = $state(data.mainConfig?.color ?? DEFAULT_MAIN_EMBED_COLOR);
	let imageMode = $state<'url' | 'upload'>('url');
	let imageUrl = $state('');
	let uploadedImagePath = $state('');
	let imagePreview = $state('');
	let selectedChannels = $state<string[]>([]);
	let selectedRoles = $state<string[]>([]);
	let sending = $state(false);

	const footerPreview = $derived(resolveEmbedFooterPlaceholders(footer, data.serverName ?? 'Server'));

	const totalChars = $derived(title.length + description.length + footer.length);

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

	function charWarning(len: number, max: number) {
		if (len >= max) return 'text-red-400';
		if (len >= max * 0.9) return 'text-yellow-400';
		return 'text-ash-500';
	}

	function totalWarning() {
		if (totalChars >= MAX_TOTAL) return 'text-red-400';
		if (totalChars >= MAX_TOTAL * 0.9) return 'text-yellow-400';
		return 'text-ash-500';
	}

	function syncColor(val: string) {
		color = val;
		colorHex = val;
	}

	function syncColorHex(val: string) {
		colorHex = val;
		if (/^#[0-9A-Fa-f]{6}$/.test(val)) color = val;
	}

	function channelName(id: string) {
		return data.channels.find((c) => c.discord_channel_id === id)?.name ?? id;
	}

	function roleName(id: string) {
		return (data.roles as { discord_role_id: string; name: string }[]).find((r) => r.discord_role_id === id)?.name ?? id;
	}

	async function handleImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (uploadedImagePath && data.serverId != null && data.serverId !== '') {
			await fetch(`/api/servers/${data.serverId}/delete-embed-image`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ path: uploadedImagePath })
			}).catch(() => {});
		}

		const formData = new FormData();
		formData.append('image', file);

		const res = await fetch(`/api/servers/${data.serverId ?? ''}/upload-embed-image`, {
			method: 'POST',
			credentials: 'include',
			body: formData
		});
		const d = await res.json();
		if (d.success) {
			uploadedImagePath = d.path;
			imagePreview = d.url;
			showToast('Image uploaded', 'success');
		} else {
			showToast(d.error || 'Upload failed', 'error');
		}
	}

	async function deleteUploadedImage() {
		await fetch(`/api/servers/${data.serverId ?? ''}/delete-embed-image`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ path: uploadedImagePath })
		});
		uploadedImagePath = '';
		imagePreview = '';
	}

	async function sendEmbed() {
		if (!title.trim()) {
			showToast('Title is required', 'error');
			return;
		}
		if (selectedChannels.length === 0) {
			showToast('Select at least one channel', 'error');
			return;
		}
		if (totalChars > MAX_TOTAL) {
			showToast('Total character limit exceeded', 'error');
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

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	<div class="space-y-4">
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-5">
			<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
				<i class="fas fa-pen text-violet-400"></i>Embed Content
			</h3>

			<div class="mb-4">
				<div class="mb-1 flex justify-between">
					<label class="text-ash-300 text-xs font-medium">Title <span class="text-ash-200">*</span></label>
					<span class="text-xs {charWarning(title.length, MAX_TITLE)}">{title.length}/{MAX_TITLE}</span>
				</div>
				<input
					type="text"
					bind:value={title}
					maxlength={MAX_TITLE}
					placeholder="Embed title..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
				/>
			</div>

			<div class="mb-4">
				<div class="mb-1 flex justify-between">
					<label class="text-ash-300 text-xs font-medium">Description</label>
					<span class="text-xs {charWarning(description.length, MAX_DESC)}">{description.length}/{MAX_DESC}</span>
				</div>
				<textarea
					bind:value={description}
					maxlength={MAX_DESC}
					rows={4}
					placeholder="Embed description..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
				></textarea>
			</div>

			<div class="mb-4">
				<div class="mb-1 flex justify-between">
					<label class="text-ash-300 text-xs font-medium">Footer</label>
					<span class="text-xs {charWarning(footer.length, MAX_FOOTER)}">{footer.length}/{MAX_FOOTER}</span>
				</div>
				<input
					type="text"
					bind:value={footer}
					maxlength={MAX_FOOTER}
					placeholder="Footer text..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
				/>
			</div>

			<div class="mb-4">
				<label class="text-ash-300 mb-1 block text-xs font-medium">Color</label>
				<div class="flex items-center gap-2">
					<input
						type="color"
						value={color}
						oninput={(e) => syncColor((e.target as HTMLInputElement).value)}
						class="bg-ash-700 border-ash-600 h-9 w-10 cursor-pointer rounded border"
					/>
					<input
						type="text"
						value={colorHex}
						oninput={(e) => syncColorHex((e.target as HTMLInputElement).value)}
						placeholder={DEFAULT_MAIN_EMBED_COLOR}
						class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
					/>
				</div>
			</div>

			<div class="mb-4">
				<label class="text-ash-300 mb-2 block text-xs font-medium">Image</label>
				<div class="mb-2 flex gap-2">
					<button
						onclick={() => (imageMode = 'url')}
						class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
							{imageMode === 'url' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}">URL</button
					>
					<button
						onclick={() => (imageMode = 'upload')}
						class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
							{imageMode === 'upload' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}">Upload</button
					>
				</div>
				{#if imageMode === 'url'}
					<input
						type="url"
						bind:value={imageUrl}
						placeholder="https://..."
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
					/>
				{:else}
					<input
						type="file"
						accept="image/*"
						onchange={handleImageUpload}
						class="text-ash-300 file:bg-ash-600 file:text-ash-100 hover:file:bg-ash-500 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs"
					/>
					{#if imagePreview}
						<div class="relative mt-2 inline-block">
							<img src={imagePreview} alt="Preview" class="h-20 rounded-lg object-cover" />
							<button
								onclick={deleteUploadedImage}
								class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-900 text-xs text-red-300 hover:bg-red-800"
							>
								<i class="fas fa-times"></i>
							</button>
						</div>
					{/if}
				{/if}
			</div>

			<p class="text-xs {totalWarning()} text-right">{totalChars}/{MAX_TOTAL} total</p>
		</div>

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
		</div>
	</div>

	<div class="bg-ash-800 border-ash-700 self-start rounded-xl border p-4 sm:p-5 lg:sticky lg:top-4">
		<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
			<i class="fas fa-eye text-cyan-400"></i>Preview
		</h3>

		<div class="rounded-lg bg-[#313338] p-3">
			<div class="rounded-r-lg border-l-4 bg-[#2b2d31] py-2 pl-3" style="border-color: {color}">
				{#if title}
					<p class="mb-1 text-sm font-semibold text-white">{title}</p>
				{:else}
					<p class="mb-1 text-sm text-[#6b7280] italic">No title yet...</p>
				{/if}
				{#if description}
					<p class="text-xs leading-relaxed whitespace-pre-wrap text-[#dbdee1]">{description}</p>
				{/if}
				{#if imageMode === 'url' && imageUrl}
					<img src={imageUrl} alt="Embed" class="mt-2 max-w-full rounded" />
				{:else if imageMode === 'upload' && imagePreview}
					<img src={imagePreview} alt="Embed" class="mt-2 max-w-full rounded" />
				{/if}
				{#if footer}
					<p class="mt-2 border-t border-[#3d4045] pt-2 text-xs text-[#949ba4]">{footerPreview}</p>
				{/if}
			</div>
			{#if selectedRoles.length > 0}
				<p class="mt-2 text-xs text-[#949ba4]">
					{selectedRoles
						.map(roleName)
						.map((n) => `@${n}`)
						.join(' ')}
				</p>
			{/if}
		</div>

		{#if selectedChannels.length > 0}
			<div class="text-ash-500 mt-3 text-xs">
				Sending to: {selectedChannels
					.map(channelName)
					.map((n) => `#${n}`)
					.join(', ')}
			</div>
		{/if}
	</div>
</div>
