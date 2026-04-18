<script lang="ts">
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { Snippet } from 'svelte';

	let {
		title = $bindable(''),
		description = $bindable(''),
		footer = $bindable(''),
		color = $bindable('#ff0000'),
		imageMode = $bindable<'url' | 'upload'>('url'),
		imageUrl = $bindable(''),
		uploadedImagePath = $bindable(''),
		imagePreview = $bindable(''),
		defaultFooter = '',
		defaultColor = '#ff0000',
		footerPreview = '',
		uploadEndpoint,
		deleteEndpoint,
		sending = false,
		onsubmit,
		sendToSnippet,
		submitLabel = 'Send Embed',
		serverId = null
	}: {
		title: string;
		description: string;
		footer: string;
		color: string;
		imageMode: 'url' | 'upload';
		imageUrl: string;
		uploadedImagePath: string;
		imagePreview: string;
		defaultFooter?: string;
		defaultColor?: string;
		footerPreview: string;
		uploadEndpoint: string;
		deleteEndpoint: string;
		sending: boolean;
		onsubmit: () => void | Promise<void>;
		sendToSnippet?: Snippet;
		submitLabel?: string;
		serverId?: string | number | null;
	} = $props();

	const MAX_TITLE = 256;
	const MAX_DESC = 4096;
	const MAX_FOOTER = 2048;
	const MAX_TOTAL = 6000;

	let colorHex = $state(color);

	$effect(() => {
		if (color !== colorHex && /^#[0-9A-Fa-f]{6}$/.test(color)) {
			colorHex = color;
		}
	});

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

	async function handleImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (uploadedImagePath) {
			await fetch(deleteEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ path: uploadedImagePath })
			}).catch(() => {});
		}

		const formData = new FormData();
		formData.append('image', file);

		const res = await fetch(uploadEndpoint, {
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
		await fetch(deleteEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ path: uploadedImagePath })
		});
		uploadedImagePath = '';
		imagePreview = '';
	}

	function handleSubmit() {
		if (!title.trim()) {
			showToast('Title is required', 'error');
			return;
		}
		if (totalChars > MAX_TOTAL) {
			showToast('Total character limit exceeded', 'error');
			return;
		}
		onsubmit();
	}
</script>

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
					placeholder={defaultFooter || 'Footer text...'}
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
						placeholder={defaultColor || '#ff0000'}
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
							{imageMode === 'url' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}"
					>
						URL
					</button>
					<button
						onclick={() => (imageMode = 'upload')}
						class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
							{imageMode === 'upload' ? 'bg-ash-500 text-ash-100' : 'bg-ash-700 text-ash-400 hover:text-ash-200'}"
					>
						Upload
					</button>
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

		{#if sendToSnippet}
			{@render sendToSnippet()}
		{/if}

		{#if !sendToSnippet}
			<button
				onclick={handleSubmit}
				disabled={sending}
				class="bg-ash-500 hover:bg-ash-400 text-ash-100 mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if sending}<i class="fas fa-spinner fa-spin text-emerald-300"></i>{:else}<i class="fas fa-paper-plane text-emerald-300"></i>{/if}
				{sending ? 'Sending...' : submitLabel}
			</button>
		{/if}
	</div>

	<div class="bg-ash-800 border-ash-700 self-start rounded-xl border p-4 sm:p-5 lg:sticky lg:top-4">
		<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
			<i class="fas fa-eye text-cyan-400"></i>Preview
		</h3>

		<div class="mb-4 rounded-lg bg-[#313338] p-3">
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
				{#if footerPreview}
					<p class="mt-2 border-t border-[#3d4045] pt-2 text-xs text-[#949ba4]">{footerPreview}</p>
				{/if}
			</div>
		</div>

		{#if sendToSnippet}
			<button
				onclick={handleSubmit}
				disabled={sending}
				class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if sending}<i class="fas fa-spinner fa-spin text-emerald-300"></i>{:else}<i class="fas fa-paper-plane text-emerald-300"></i>{/if}
				{sending ? 'Sending...' : submitLabel}
			</button>
		{/if}
	</div>
</div>
