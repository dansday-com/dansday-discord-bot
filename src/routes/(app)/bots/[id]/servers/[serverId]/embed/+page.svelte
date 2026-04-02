<script lang="ts">
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const MAX_TITLE = 256;
	const MAX_DESC = 4096;
	const MAX_FOOTER = 2048;
	const MAX_TOTAL = 6000;

	let title = $state('');
	let description = $state('');
	let footer = $state(data.mainConfig?.default_footer ?? '');
	let color = $state(data.mainConfig?.default_color ?? '#5865F2');
	let colorHex = $state(data.mainConfig?.default_color ?? '#5865F2');
	let imageMode = $state<'url' | 'upload'>('url');
	let imageUrl = $state('');
	let uploadedImageUrl = $state('');
	let imagePreview = $state('');
	let selectedChannels = $state<string[]>([]);
	let selectedRoles = $state<string[]>([]);
	let showChannelPicker = $state(false);
	let showRolePicker = $state(false);
	let sending = $state(false);

	const totalChars = $derived(title.length + description.length + footer.length);

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

	function toggleChannel(id: string) {
		if (selectedChannels.includes(id)) {
			selectedChannels = selectedChannels.filter((c) => c !== id);
		} else {
			selectedChannels = [...selectedChannels, id];
		}
	}

	function toggleRole(id: string) {
		if (selectedRoles.includes(id)) {
			selectedRoles = selectedRoles.filter((r) => r !== id);
		} else {
			selectedRoles = [...selectedRoles, id];
		}
	}

	function channelName(id: string) {
		return data.channels.find((c: { discord_channel_id: string; name: string }) => c.discord_channel_id === id)?.name ?? id;
	}

	function roleName(id: string) {
		return (data.roles as { id: string; name: string }[]).find((r) => r.id === id)?.name ?? id;
	}

	async function handleImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('image', file);

		const res = await fetch(`/api/servers/${data.serverId ?? ''}/upload-embed-image`, {
			method: 'POST',
			credentials: 'include',
			body: formData
		});
		const d = await res.json();
		if (d.success) {
			uploadedImageUrl = d.url;
			imagePreview = d.url;
			showToast('Image uploaded', 'success');
		} else {
			showToast(d.error || 'Upload failed', 'error');
		}
	}

	async function deleteUploadedImage() {
		await fetch(`/api/servers/${data.serverId ?? ''}/delete-embed-image`, {
			method: 'DELETE',
			credentials: 'include'
		});
		uploadedImageUrl = '';
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
			else if (imageMode === 'upload' && uploadedImageUrl) body.image_url = uploadedImageUrl;

			const res = await fetch(`/api/servers/${data.serverId ?? ''}/send-embed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});
			const d = await res.json();
			if (d.success) {
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
	<title>Embed Builder | Dansday</title>
</svelte:head>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	<!-- Form -->
	<div class="space-y-4">
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-5">
			<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
				<i class="fas fa-pen text-ash-400"></i>Embed Content
			</h3>

			<!-- Title -->
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

			<!-- Description -->
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

			<!-- Footer -->
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

			<!-- Color -->
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
						placeholder="#5865F2"
						class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
					/>
				</div>
			</div>

			<!-- Image -->
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

			<!-- Total chars -->
			<p class="text-xs {totalWarning()} text-right">{totalChars}/{MAX_TOTAL} total</p>
		</div>

		<!-- Channels & Roles -->
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-5">
			<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
				<i class="fas fa-paper-plane text-ash-400"></i>Send To
			</h3>

			<!-- Channels -->
			<div class="mb-4">
				<label class="text-ash-300 mb-2 block text-xs font-medium">Channels <span class="text-ash-200">*</span></label>
				<button
					onclick={() => (showChannelPicker = !showChannelPicker)}
					class="bg-ash-700 border-ash-600 text-ash-300 hover:border-ash-500 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors"
				>
					{selectedChannels.length === 0 ? 'Select channels...' : `${selectedChannels.length} channel${selectedChannels.length !== 1 ? 's' : ''} selected`}
					<i class="fas fa-chevron-{showChannelPicker ? 'up' : 'down'} float-right mt-0.5 text-xs"></i>
				</button>
				{#if showChannelPicker}
					<div class="bg-ash-700 border-ash-600 mt-1 max-h-48 overflow-hidden overflow-y-auto rounded-lg border">
						{#each data.channels as ch}
							<button
								onclick={() => toggleChannel(ch.discord_channel_id)}
								class="hover:bg-ash-600 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
									{selectedChannels.includes(ch.discord_channel_id) ? 'text-ash-100' : 'text-ash-300'}"
							>
								<i class="fas {selectedChannels.includes(ch.discord_channel_id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} w-3 text-xs"></i>
								<span class="text-ash-500">#</span>{ch.name}
							</button>
						{/each}
					</div>
				{/if}
				{#if selectedChannels.length > 0}
					<div class="mt-2 flex flex-wrap gap-1">
						{#each selectedChannels as id}
							<span class="bg-ash-700 text-ash-200 flex items-center gap-1 rounded px-2 py-0.5 text-xs">
								<span class="text-ash-500">#</span>{channelName(id)}
								<button onclick={() => toggleChannel(id)} class="text-ash-500 hover:text-ash-300 ml-0.5"><i class="fas fa-times text-xs"></i></button>
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Role Mentions -->
			{#if (data.roles as unknown[]).length > 0}
				<div class="mb-4">
					<label class="text-ash-300 mb-2 block text-xs font-medium">Role Mentions</label>
					<button
						onclick={() => (showRolePicker = !showRolePicker)}
						class="bg-ash-700 border-ash-600 text-ash-300 hover:border-ash-500 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors"
					>
						{selectedRoles.length === 0 ? 'Select roles to mention...' : `${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''} selected`}
						<i class="fas fa-chevron-{showRolePicker ? 'up' : 'down'} float-right mt-0.5 text-xs"></i>
					</button>
					{#if showRolePicker}
						<div class="bg-ash-700 border-ash-600 mt-1 max-h-48 overflow-hidden overflow-y-auto rounded-lg border">
							{#each data.roles as { id: string; name: string; color: string }[] as role}
								<button
									onclick={() => toggleRole(role.id)}
									class="hover:bg-ash-600 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
								>
									<i class="fas {selectedRoles.includes(role.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} w-3 text-xs"></i>
									<span class="h-2 w-2 flex-shrink-0 rounded-full" style="background:{role.color && role.color !== '#000000' ? role.color : '#6b7280'}"></span>
									<span class={selectedRoles.includes(role.id) ? 'text-ash-100' : 'text-ash-300'}>{role.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<button
				onclick={sendEmbed}
				disabled={sending}
				class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if sending}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-paper-plane"></i>{/if}
				{sending ? 'Sending...' : 'Send Embed'}
			</button>
		</div>
	</div>

	<!-- Preview -->
	<div class="bg-ash-800 border-ash-700 self-start rounded-xl border p-4 sm:p-5 lg:sticky lg:top-4">
		<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
			<i class="fas fa-eye text-ash-400"></i>Preview
		</h3>

		<!-- Discord-style embed preview -->
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
					<p class="mt-2 border-t border-[#3d4045] pt-2 text-xs text-[#949ba4]">{footer}</p>
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
