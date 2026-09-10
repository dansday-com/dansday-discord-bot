<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { IMAGE_ACCEPT, IMAGE_FORMATS_LABEL, MEMBER_THEME_MAX_BYTES, MEMBER_THEME_SOURCE_MAX_BYTES, imageSizeLabel } from '$lib/images.js';
	import { EFFECT_SPIN_COST, SPINNABLE_EFFECTS, effectMeta, randomSeed } from '$lib/effects.js';
	import { GameModal, ReelStrip } from '$lib/frontend/components/public';
	import { lockScroll } from '$lib/frontend/scrollLock.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { getContext } from 'svelte';
	import { DEFAULT_ACCENT, type MemberTheme, accentInk, extractAccentFromFile, normalizeAccent, prepareThemeUpload } from '$lib/themes.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const theme = $derived((data.memberTheme ?? null) as MemberTheme | null);
	const savedImage = $derived(theme?.image ?? null);

	let pendingFile = $state<File | null>(null);
	let pendingPreview = $state<string | null>(null);
	let pendingAccent = $state<string | null>(null);
	let colorDraft = $state<string | null>(null);
	let busy = $state(false);
	let converting = $state(false);
	let originalSize = $state<number | null>(null);
	const ctx = getContext('items') as any;

	let reel = $state<string[]>([]);
	let reelOffset = $state(0);
	let reelAnimating = $state(false);
	let reelResult = $state<{ effect: string; seed: number; label: string } | null>(null);
	let reelSeeds = $state<number[]>([]);
	let spinning = $state(false);
	let reelWrapEl = $state<HTMLDivElement | undefined>();
	let playing = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();

	const previewImage = $derived(pendingPreview ?? savedImage);
	const accent = $derived(colorDraft ?? pendingAccent ?? theme?.accent ?? DEFAULT_ACCENT);
	const ink = $derived(accentInk(accent));
	const owned = $derived(theme?.ownedEffect ?? 'none');
	const effectOn = $derived(theme?.effectEnabled !== false);
	const effectSeed = $derived(theme?.effectSeed ?? 0);
	const canSpin = $derived((ctx?.liveXp ?? 0) >= EFFECT_SPIN_COST);
	const dirty = $derived(pendingFile != null || (colorDraft != null && colorDraft !== theme?.accent));
	const hasTheme = $derived(theme != null || pendingFile != null);

	async function pickFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			showToast(`Use a ${IMAGE_FORMATS_LABEL} image.`, 'error');
			input.value = '';
			return;
		}
		if (file.size > MEMBER_THEME_SOURCE_MAX_BYTES) {
			showToast(`That image is ${imageSizeLabel(file.size)}. Pick one under ${imageSizeLabel(MEMBER_THEME_SOURCE_MAX_BYTES)}.`, 'error');
			input.value = '';
			return;
		}

		converting = true;
		try {
			const prepared = await prepareThemeUpload(file);
			if (prepared.file.size > MEMBER_THEME_MAX_BYTES) {
				showToast(`Still ${imageSizeLabel(prepared.file.size)} after optimising. The limit is ${imageSizeLabel(MEMBER_THEME_MAX_BYTES)}.`, 'error');
				input.value = '';
				return;
			}
			if (pendingPreview) URL.revokeObjectURL(pendingPreview);
			pendingFile = prepared.file;
			pendingPreview = URL.createObjectURL(prepared.file);
			originalSize = file.size;
			colorDraft = null;
			pendingAccent = prepared.accent;
		} finally {
			converting = false;
		}
	}

	function discardPending() {
		if (pendingPreview) URL.revokeObjectURL(pendingPreview);
		pendingFile = null;
		pendingPreview = null;
		pendingAccent = null;
		originalSize = null;
		colorDraft = null;
		if (fileInput) fileInput.value = '';
	}

	async function save() {
		if (busy || !dirty) return;
		busy = true;

		try {
			let response: Response;
			if (pendingFile) {
				const form = new FormData();
				form.set('card', String(data.hash));
				form.set('image', pendingFile);
				form.set('accent', colorDraft ?? pendingAccent ?? DEFAULT_ACCENT);
				response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, { method: 'POST', body: form });
			} else {
				const payload: Record<string, unknown> = { card: data.hash };
				if (colorDraft != null) {
					payload.accent = colorDraft;
					payload.accent_auto = false;
				}
				response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				showToast(body?.error ?? 'Could not save your theme.', 'error');
				return;
			}

			discardPending();
			await invalidateAll();
			showToast('Theme saved', 'success');
		} catch {
			showToast('Could not save your theme.', 'error');
		} finally {
			busy = false;
		}
	}

	async function removeImage() {
		if (busy || !savedImage) return;
		busy = true;

		try {
			const response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, image: null })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				showToast(body?.error ?? 'Could not remove the image.', 'error');
				return;
			}

			discardPending();
			await invalidateAll();
			showToast('Background removed', 'success');
		} catch {
			showToast('Could not remove the image.', 'error');
		} finally {
			busy = false;
		}
	}

	async function toggleEffect() {
		if (busy || spinning) return;
		const next = !effectOn;
		busy = true;
		try {
			const response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, effect_enabled: next })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				showToast(body?.error ?? 'Could not change the effect.', 'error');
				return;
			}
			await invalidateAll();
			showToast(next ? 'Effect turned on' : 'Effect turned off', 'success');
		} catch {
			showToast('Could not change the effect.', 'error');
		} finally {
			busy = false;
		}
	}

	async function reset() {
		if (busy) return;
		busy = true;

		try {
			const response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				showToast(body?.error ?? 'Could not reset your theme.', 'error');
				return;
			}

			discardPending();
			await invalidateAll();
			showToast('Theme reset', 'success');
		} catch {
			showToast('Could not reset your theme.', 'error');
		} finally {
			busy = false;
		}
	}

	async function recolorFromImage() {
		if (!pendingFile) return;
		colorDraft = null;
		pendingAccent = await extractAccentFromFile(pendingFile);
	}

	const savedLabel = $derived.by(() => {
		if (!pendingFile) return '';
		const now = imageSizeLabel(pendingFile.size);
		if (originalSize != null && originalSize > pendingFile.size) return `${pendingFile.name} · ${imageSizeLabel(originalSize)} → ${now}`;
		return `${pendingFile.name} · ${now}`;
	});

	function openSpin() {
		playing = true;
		initReel();
	}

	$effect(() => {
		if (!playing) return;
		return lockScroll();
	});

	function randomCells(n: number): string[] {
		return Array.from({ length: n }, () => SPINNABLE_EFFECTS[Math.floor(Math.random() * SPINNABLE_EFFECTS.length)]);
	}

	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('[data-reel-cell]')?.[index];
			if (!cell) return;
			reelOffset = wrapW / 2 - (cell.offsetLeft + cell.offsetWidth / 2);
		});
	}

	function initReel() {
		reel = randomCells(14);
		reelSeeds = reel.map(() => randomSeed());
		reelOffset = 0;
		reelResult = null;
		reelAnimating = false;
		centerCell(2);
	}

	async function spin() {
		if (spinning || busy || !canSpin) return;
		spinning = true;
		reelResult = null;

		try {
			const response = await fetch(`/api/themes/${encodeURIComponent(data.server.slug)}/spin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.success) {
				showToast(body?.error ?? 'Spin failed.', 'error');
				spinning = false;
				return;
			}

			const won = body.result as { effect: string; seed: number; label: string };
			reel = randomCells(40);
			reelSeeds = reel.map(() => randomSeed());
			const landIndex = 32;
			reel[landIndex] = won.effect;
			reelSeeds[landIndex] = won.seed;

			reelAnimating = false;
			reelOffset = 0;
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			reelWrapEl?.offsetHeight;
			centerCell(2);
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			reelAnimating = true;
			centerCell(landIndex);

			setTimeout(async () => {
				reelResult = won;
				ctx?.setLiveXp?.(Math.max(0, (ctx?.liveXp ?? 0) - EFFECT_SPIN_COST));
				spinning = false;
				await invalidateAll();
			}, 7000);
		} catch {
			showToast('Spin failed.', 'error');
			spinning = false;
		}
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
						<span class="text-[11px] font-bold text-white/85">{pendingFile ? savedLabel : 'Saved'}</span>
					</div>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2">
				<button class="btn btn-primary btn-sm" onclick={() => fileInput?.click()} disabled={busy || converting}>
					{#if converting}<span class="loading loading-spinner loading-xs"></span>{:else}<i class="fas fa-arrow-up-from-bracket"></i>{/if}{previewImage
						? 'Replace image'
						: 'Choose image'}
				</button>
				{#if pendingFile}
					<button class="btn btn-ghost btn-sm" onclick={discardPending} disabled={busy}>Discard</button>
				{:else if savedImage}
					<button class="btn btn-ghost btn-sm text-error" onclick={removeImage} disabled={busy}>
						<i class="fas fa-trash-can"></i>Remove image
					</button>
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

	<section class="card border-base-300 bg-base-100/85 overflow-hidden border shadow-sm">
		<div class="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
			<span class="text-base-content flex items-center gap-2 text-[13px] font-bold">
				<i class="fas fa-wand-magic-sparkles text-base-content/45"></i>Effect
			</span>
			<span class="text-base-content/45 text-[11px] font-medium">
				{owned === 'none' ? 'None yet' : effectOn ? effectMeta(owned)?.label : `${effectMeta(owned)?.label} · off`}
			</span>
		</div>

		<div class="flex flex-col gap-3 p-4 sm:p-5">
			<div class="flex flex-wrap items-center gap-2">
				<button
					class="btn btn-sm flex-1 border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] font-black text-white sm:flex-none"
					onclick={openSpin}
					disabled={busy || !canSpin}
				>
					<i class="fas fa-dice"></i>Spin · {EFFECT_SPIN_COST.toLocaleString()} XP
				</button>
				{#if owned !== 'none'}
					<button class="btn btn-ghost btn-sm" onclick={toggleEffect} disabled={busy}>
						<i class="fas {effectOn ? 'fa-eye-slash' : 'fa-eye'}"></i>{effectOn ? 'Disable' : 'Enable'}
					</button>
				{/if}
			</div>

			<p class="text-base-content/45 m-0 text-[11px] font-medium">
				{canSpin ? 'Every spin rolls a fresh effect and a one-of-a-kind variant.' : `You need ${EFFECT_SPIN_COST.toLocaleString()} XP to spin.`}
			</p>
		</div>
	</section>

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

{#if playing}
	<GameModal icon="fa-wand-magic-sparkles" title="Effect spin" state={reelResult ? 'win' : 'idle'} closable={!spinning} onclose={() => (playing = false)}>
		<div class="mb-3.5">
			<ReelStrip
				bind:wrap={reelWrapEl}
				items={reel}
				offset={reelOffset}
				animating={reelAnimating}
				frameWidth={88}
				frameWidthLg={96}
				padLeft="92px"
				padLeftLg="100px"
				cellClass="basis-21 h-[70px] min-[600px]:basis-23 min-[600px]:h-[76px]"
				tone={reelResult ? 'win' : 'idle'}
			>
				{#snippet cell(kind: string, index: number)}
					<div class="border-base-300 bg-base-200 relative isolate grid size-full place-items-center overflow-hidden rounded-xl border">
						<i class="fas {effectMeta(kind)?.icon} text-base-content/70 relative text-[22px]"></i>
					</div>
				{/snippet}

				{#snippet overlay()}
					{#if reelResult}
						<div class="animate-game-verdict bg-base-200 pointer-events-none absolute inset-0 z-6 flex flex-col items-center justify-center gap-0.5">
							<span class="text-success text-[12px] font-black tracking-[0.18em] uppercase">You got</span>
							<span class="text-base-content text-[22px] font-black">{reelResult.label}</span>
						</div>
					{/if}
				{/snippet}
			</ReelStrip>
		</div>

		{#if reelResult}
			<button class="btn btn-sm w-full" onclick={() => (playing = false)}>Done</button>
		{:else}
			<button
				class="btn animate-game-charge w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] font-black text-white"
				onclick={spin}
				disabled={spinning || !canSpin}
			>
				{#if spinning}<span class="loading loading-spinner loading-xs"></span>{:else}<i class="fas fa-dice"></i>{/if}
				Spin · {EFFECT_SPIN_COST.toLocaleString()} XP
			</button>
		{/if}
	</GameModal>
{/if}
