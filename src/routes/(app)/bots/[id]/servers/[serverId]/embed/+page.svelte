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
		return data.channels.find((c: { id: string; name: string }) => c.id === id)?.name ?? id;
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
		if (!title.trim()) { showToast('Title is required', 'error'); return; }
		if (selectedChannels.length === 0) { showToast('Select at least one channel', 'error'); return; }
		if (totalChars > MAX_TOTAL) { showToast('Total character limit exceeded', 'error'); return; }

		sending = true;
		try {
			const body: Record<string, unknown> = {
				title,
				description,
				footer,
				color,
				channels: selectedChannels,
				role_mentions: selectedRoles
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

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
	<!-- Form -->
	<div class="space-y-4">
		<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
			<h3 class="text-sm font-semibold text-ash-300 mb-4 flex items-center gap-2">
				<i class="fas fa-pen text-ash-400"></i>Embed Content
			</h3>

			<!-- Title -->
			<div class="mb-4">
				<div class="flex justify-between mb-1">
					<label class="text-xs font-medium text-ash-300">Title <span class="text-ash-200">*</span></label>
					<span class="text-xs {charWarning(title.length, MAX_TITLE)}">{title.length}/{MAX_TITLE}</span>
				</div>
				<input
					type="text"
					bind:value={title}
					maxlength={MAX_TITLE}
					placeholder="Embed title..."
					class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500"
				/>
			</div>

			<!-- Description -->
			<div class="mb-4">
				<div class="flex justify-between mb-1">
					<label class="text-xs font-medium text-ash-300">Description</label>
					<span class="text-xs {charWarning(description.length, MAX_DESC)}">{description.length}/{MAX_DESC}</span>
				</div>
				<textarea
					bind:value={description}
					maxlength={MAX_DESC}
					rows={4}
					placeholder="Embed description..."
					class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500 resize-none"
				></textarea>
			</div>

			<!-- Footer -->
			<div class="mb-4">
				<div class="flex justify-between mb-1">
					<label class="text-xs font-medium text-ash-300">Footer</label>
					<span class="text-xs {charWarning(footer.length, MAX_FOOTER)}">{footer.length}/{MAX_FOOTER}</span>
				</div>
				<input
					type="text"
					bind:value={footer}
					maxlength={MAX_FOOTER}
					placeholder="Footer text..."
					class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500"
				/>
			</div>

			<!-- Color -->
			<div class="mb-4">
				<label class="text-xs font-medium text-ash-300 block mb-1">Color</label>
				<div class="flex items-center gap-2">
					<input
						type="color"
						value={color}
						oninput={(e) => syncColor((e.target as HTMLInputElement).value)}
						class="w-10 h-9 rounded cursor-pointer bg-ash-700 border border-ash-600"
					/>
					<input
						type="text"
						value={colorHex}
						oninput={(e) => syncColorHex((e.target as HTMLInputElement).value)}
						placeholder="#5865F2"
						class="flex-1 px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ash-500"
					/>
				</div>
			</div>

			<!-- Image -->
			<div class="mb-4">
				<label class="text-xs font-medium text-ash-300 block mb-2">Image</label>
				<div class="flex gap-2 mb-2">
					<button
						onclick={() => (imageMode = 'url')}
						class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
							{imageMode === 'url' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}"
					>URL</button>
					<button
						onclick={() => (imageMode = 'upload')}
						class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
							{imageMode === 'upload' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}"
					>Upload</button>
				</div>
				{#if imageMode === 'url'}
					<input
						type="url"
						bind:value={imageUrl}
						placeholder="https://..."
						class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500"
					/>
				{:else}
					<input type="file" accept="image/*" onchange={handleImageUpload} class="w-full text-sm text-ash-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-ash-600 file:text-ash-100 hover:file:bg-ash-500" />
					{#if imagePreview}
						<div class="mt-2 relative inline-block">
							<img src={imagePreview} alt="Preview" class="h-20 rounded-lg object-cover" />
							<button onclick={deleteUploadedImage} class="absolute -top-1 -right-1 w-5 h-5 bg-red-900 rounded-full flex items-center justify-center text-red-300 text-xs hover:bg-red-800">
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
		<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
			<h3 class="text-sm font-semibold text-ash-300 mb-4 flex items-center gap-2">
				<i class="fas fa-paper-plane text-ash-400"></i>Send To
			</h3>

			<!-- Channels -->
			<div class="mb-4">
				<label class="text-xs font-medium text-ash-300 block mb-2">Channels <span class="text-ash-200">*</span></label>
				<button
					onclick={() => (showChannelPicker = !showChannelPicker)}
					class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-left text-sm text-ash-300 hover:border-ash-500 transition-colors"
				>
					{selectedChannels.length === 0 ? 'Select channels...' : `${selectedChannels.length} channel${selectedChannels.length !== 1 ? 's' : ''} selected`}
					<i class="fas fa-chevron-{showChannelPicker ? 'up' : 'down'} float-right mt-0.5 text-xs"></i>
				</button>
				{#if showChannelPicker}
					<div class="mt-1 bg-ash-700 border border-ash-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
						{#each data.channels as ch}
							<button
								onclick={() => toggleChannel(ch.id)}
								class="w-full px-3 py-2 text-left text-sm hover:bg-ash-600 flex items-center gap-2 transition-colors
									{selectedChannels.includes(ch.id) ? 'text-ash-100' : 'text-ash-300'}"
							>
								<i class="fas {selectedChannels.includes(ch.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} text-xs w-3"></i>
								<span class="text-ash-500">#</span>{ch.name}
							</button>
						{/each}
					</div>
				{/if}
				{#if selectedChannels.length > 0}
					<div class="flex flex-wrap gap-1 mt-2">
						{#each selectedChannels as id}
							<span class="text-xs bg-ash-700 text-ash-200 px-2 py-0.5 rounded flex items-center gap-1">
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
					<label class="text-xs font-medium text-ash-300 block mb-2">Role Mentions</label>
					<button
						onclick={() => (showRolePicker = !showRolePicker)}
						class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-left text-sm text-ash-300 hover:border-ash-500 transition-colors"
					>
						{selectedRoles.length === 0 ? 'Select roles to mention...' : `${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''} selected`}
						<i class="fas fa-chevron-{showRolePicker ? 'up' : 'down'} float-right mt-0.5 text-xs"></i>
					</button>
					{#if showRolePicker}
						<div class="mt-1 bg-ash-700 border border-ash-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
							{#each (data.roles as { id: string; name: string; color: string }[]) as role}
								<button
									onclick={() => toggleRole(role.id)}
									class="w-full px-3 py-2 text-left text-sm hover:bg-ash-600 flex items-center gap-2 transition-colors"
								>
									<i class="fas {selectedRoles.includes(role.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} text-xs w-3"></i>
									<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{role.color && role.color !== '#000000' ? role.color : '#6b7280'}"></span>
									<span class="{selectedRoles.includes(role.id) ? 'text-ash-100' : 'text-ash-300'}">{role.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<button
				onclick={sendEmbed}
				disabled={sending}
				class="w-full py-2.5 bg-ash-500 hover:bg-ash-400 text-ash-100 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if sending}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-paper-plane"></i>{/if}
				{sending ? 'Sending...' : 'Send Embed'}
			</button>
		</div>
	</div>

	<!-- Preview -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5 lg:sticky lg:top-4 self-start">
		<h3 class="text-sm font-semibold text-ash-300 mb-4 flex items-center gap-2">
			<i class="fas fa-eye text-ash-400"></i>Preview
		</h3>

		<!-- Discord-style embed preview -->
		<div class="bg-[#313338] rounded-lg p-3">
			<div
				class="rounded-r-lg border-l-4 pl-3 py-2 bg-[#2b2d31]"
				style="border-color: {color}"
			>
				{#if title}
					<p class="text-white font-semibold text-sm mb-1">{title}</p>
				{:else}
					<p class="text-[#6b7280] text-sm italic mb-1">No title yet...</p>
				{/if}
				{#if description}
					<p class="text-[#dbdee1] text-xs whitespace-pre-wrap leading-relaxed">{description}</p>
				{/if}
				{#if imageMode === 'url' && imageUrl}
					<img src={imageUrl} alt="Embed" class="mt-2 max-w-full rounded" />
				{:else if imageMode === 'upload' && imagePreview}
					<img src={imagePreview} alt="Embed" class="mt-2 max-w-full rounded" />
				{/if}
				{#if footer}
					<p class="text-[#949ba4] text-xs mt-2 pt-2 border-t border-[#3d4045]">{footer}</p>
				{/if}
			</div>
			{#if selectedRoles.length > 0}
				<p class="text-xs text-[#949ba4] mt-2">
					{selectedRoles.map(roleName).map((n) => `@${n}`).join(' ')}
				</p>
			{/if}
		</div>

		{#if selectedChannels.length > 0}
			<div class="mt-3 text-xs text-ash-500">
				Sending to: {selectedChannels.map(channelName).map((n) => `#${n}`).join(', ')}
			</div>
		{/if}
	</div>
</div>
