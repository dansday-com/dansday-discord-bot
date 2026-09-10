<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { IMAGE_ACCEPT, IMAGE_FORMATS_LABEL, MEMBER_THEME_MAX_BYTES, imageSizeLabel } from '$lib/images.js';
	import { DEFAULT_ACCENT, type MemberTheme, accentInk, extractAccentFromFile, normalizeAccent, themeImageUrl } from '$lib/themes.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const theme = $derived((data.memberTheme ?? null) as MemberTheme | null);
	const savedImage = $derived(themeImageUrl(theme?.image));

	let pendingFile = $state<File | null>(null);
	let pendingPreview = $state<string | null>(null);
	let pendingAccent = $state<string | null>(null);
	let colorDraft = $state<string | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | undefined>();

	const previewImage = $derived(pendingPreview ?? savedImage);
	const accent = $derived(colorDraft ?? pendingAccent ?? theme?.accent ?? DEFAULT_ACCENT);
	const ink = $derived(accentInk(accent));
	const dirty = $derived(pendingFile != null || (colorDraft != null && colorDraft !== theme?.accent));
	const hasTheme = $derived(theme != null || pendingFile != null);

	async function pickFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) return;

		error = null;

		if (!file.type.startsWith('image/')) {
			error = `Use a ${IMAGE_FORMATS_LABEL} image.`;
			input.value = '';
			return;
		}
		if (file.size > MEMBER_THEME_MAX_BYTES) {
			error = `That image is ${imageSizeLabel(file.size)}. The limit is ${imageSizeLabel(MEMBER_THEME_MAX_BYTES)}.`;
			input.value = '';
			return;
		}

		if (pendingPreview) URL.revokeObjectURL(pendingPreview);
		pendingFile = file;
		pendingPreview = URL.createObjectURL(file);
		colorDraft = null;
		pendingAccent = await extractAccentFromFile(file);
	}

	function discardPending() {
		if (pendingPreview) URL.revokeObjectURL(pendingPreview);
		pendingFile = null;
		pendingPreview = null;
		pendingAccent = null;
		colorDraft = null;
		error = null;
		if (fileInput) fileInput.value = '';
	}

	async function save() {
		if (busy || !dirty) return;
		busy = true;
		error = null;

		try {
			let response: Response;
			if (pendingFile) {
				const form = new FormData();
				form.set('card', String(data.hash));
				form.set('image', pendingFile);
				form.set('accent', colorDraft ?? pendingAccent ?? DEFAULT_ACCENT);
				response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, { method: 'POST', body: form });
			} else {
				response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ card: data.hash, accent: colorDraft, accent_auto: false })
				});
			}

			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				error = body?.error ?? 'Could not save your theme.';
				return;
			}

			discardPending();
			await invalidateAll();
		} catch {
			error = 'Could not save your theme.';
		} finally {
			busy = false;
		}
	}

	async function reset() {
		if (busy) return;
		busy = true;
		error = null;

		try {
			const response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				error = body?.error ?? 'Could not reset your theme.';
				return;
			}

			discardPending();
			await invalidateAll();
		} catch {
			error = 'Could not reset your theme.';
		} finally {
			busy = false;
		}
	}

	async function recolorFromImage() {
		if (!pendingFile) return;
		colorDraft = null;
		pendingAccent = await extractAccentFromFile(pendingFile);
	}

	function onColorInput(event: Event) {
		colorDraft = normalizeAccent((event.currentTarget as HTMLInputElement).value);
	}
</script>

<svelte:head><title>Themes | {data.server.name || data.server.slug} | {APP_NAME} Discord Bot</title></svelte:head>

<div class="flex flex-col gap-4 pb-12">
	<section class="card border-base-300 bg-base-100/85 overflow-hidden border shadow-sm">
		<div class="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
			<span class="text-base-content flex items-center gap-2 text-[13px] font-bold">
				<i class="fas fa-image text-base-content/45"></i>Background
			</span>
			<span class="text-base-content/45 text-[11px] font-medium">{IMAGE_FORMATS_LABEL} · max {imageSizeLabel(MEMBER_THEME_MAX_BYTES)}</span>
		</div>

		<div class="flex flex-col gap-4 p-4 sm:p-5">
			<div
				class="border-base-300 relative flex h-40 items-end overflow-hidden rounded-xl border bg-cover bg-center sm:h-48"
				style={previewImage ? `background-image: url('${previewImage}')` : `background: ${accent}`}
			>
				{#if !previewImage}
					<div class="grid size-full place-items-center">
						<span class="text-[13px] font-semibold" style="color: {ink}">No background yet</span>
					</div>
				{:else}
					<div class="w-full bg-linear-to-t from-black/65 to-transparent px-3.5 py-2.5">
						<span class="text-[11px] font-bold text-white/85">{pendingFile ? `${pendingFile.name} · ${imageSizeLabel(pendingFile.size)}` : 'Saved'}</span>
					</div>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2">
				<button class="btn btn-primary btn-sm" onclick={() => fileInput?.click()} disabled={busy}>
					<i class="fas fa-arrow-up-from-bracket"></i>{previewImage ? 'Replace image' : 'Choose image'}
				</button>
				{#if pendingFile}
					<button class="btn btn-ghost btn-sm" onclick={discardPending} disabled={busy}>Discard</button>
				{/if}
				<input bind:this={fileInput} type="file" accept={IMAGE_ACCEPT} class="hidden" onchange={pickFile} />
			</div>
		</div>
	</section>

	<section class="card border-base-300 bg-base-100/85 overflow-hidden border shadow-sm">
		<div class="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
			<span class="text-base-content flex items-center gap-2 text-[13px] font-bold">
				<i class="fas fa-droplet text-base-content/45"></i>Accent colour
			</span>
			<span class="text-base-content/45 text-[11px] font-medium">
				{colorDraft ? 'Custom' : theme?.accentAuto === false ? 'Custom' : 'From your image'}
			</span>
		</div>

		<div class="flex flex-col gap-4 p-4 sm:p-5">
			<div class="flex flex-wrap items-center gap-3">
				<label
					class="border-base-300 relative size-13 shrink-0 cursor-pointer overflow-hidden rounded-xl border shadow-sm"
					style="background: {accent}"
					aria-label="Pick accent colour"
				>
					<input type="color" value={accent} class="absolute inset-0 cursor-pointer opacity-0" oninput={onColorInput} disabled={busy} />
				</label>

				<div class="min-w-0 flex-1">
					<div class="text-base-content text-sm font-bold tabular-nums">{accent}</div>
					<div class="text-base-content/45 mt-0.5 text-[11px] font-medium">Used on your wallet card, page and leaderboard row</div>
				</div>

				{#if pendingFile}
					<button class="btn btn-ghost btn-sm" onclick={recolorFromImage} disabled={busy}>
						<i class="fas fa-wand-magic-sparkles"></i>Auto
					</button>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2">
				<span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold" style="background: {accent}; color: {ink}">
					<i class="fas fa-star"></i>Level 12
				</span>
				<span
					class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
					style="background: color-mix(in srgb, {accent} 14%, transparent); color: {accent}"
				>
					<i class="fas fa-ranking-star"></i>Rank #3
				</span>
			</div>
		</div>
	</section>

	{#if error}
		<div class="alert alert-error text-[13px]">
			<i class="fas fa-triangle-exclamation"></i><span>{error}</span>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-2">
		<button class="btn btn-primary btn-sm" onclick={save} disabled={busy || !dirty}>
			{#if busy}<span class="loading loading-spinner loading-xs"></span>{/if}Save theme
		</button>
		{#if hasTheme}
			<button class="btn btn-ghost btn-sm" onclick={reset} disabled={busy}>Reset to default</button>
		{/if}
		{#if dirty}
			<span class="text-base-content/45 text-[11px] font-medium">Unsaved changes</span>
		{/if}
	</div>
</div>
