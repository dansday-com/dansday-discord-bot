<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import ThemeEffect from '$lib/frontend/components/ThemeEffect.svelte';
	import { DEFAULT_ACCENT, normalizeAccent, prepareThemeUpload } from '$lib/themes.js';
	import { IMAGE_ACCEPT, IMAGE_FORMATS_LABEL, MEMBER_THEME_MAX_BYTES, imageExtension, imageSizeLabel } from '$lib/images.js';
	import { EFFECTS, normalizeEffect, normalizeSeed, randomSeed } from '$lib/effects.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let itemsEnabled = $state(data.settings?.items_enabled !== false);
	let minigamesEnabled = $state(data.settings?.minigames_enabled !== false);
	let marketEnabled = $state(data.settings?.market_enabled !== false);
	let tasksEnabled = $state(data.settings?.tasks_enabled !== false);
	let inviteEnabled = $state(data.settings?.invite_enabled !== false);
	let itemsChannel = $state<string>(data.settings?.ITEMS_CHANNEL_ID ?? '');
	let minigamesChannel = $state<string>(data.settings?.MINIGAMES_CHANNEL_ID ?? '');
	let inviteImageKey = $state<string | null>(data.settings?.invite_theme_image ?? null);
	let inviteImageUrl = $state<string | null>(data.inviteThemeImageUrl ?? null);
	let inviteAccent = $state<string>(normalizeAccent(data.settings?.invite_theme_accent) ?? DEFAULT_ACCENT);
	let inviteEffect = $state<string>(normalizeEffect(data.settings?.invite_theme_effect));
	let inviteEffectSeed = $state<number>(normalizeSeed(data.settings?.invite_theme_effect_seed));
	let uploadingBackground = $state(false);

	const effectOptions = [{ value: 'none', label: 'No effect' }, ...EFFECTS.map((e) => ({ value: e.id, label: e.label }))];

	let lastEffect = inviteEffect;
	$effect(() => {
		if (inviteEffect === lastEffect) return;
		lastEffect = inviteEffect;
		inviteEffectSeed = randomSeed();
	});

	async function uploadBackground(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files?.[0];
		input.value = '';
		if (!picked) return;
		if (!imageExtension(picked.type)) {
			showToast(`Use a ${IMAGE_FORMATS_LABEL} image.`, 'error');
			return;
		}
		if (picked.size > MEMBER_THEME_MAX_BYTES) {
			showToast(`That image is ${imageSizeLabel(picked.size)}. Pick one under ${imageSizeLabel(MEMBER_THEME_MAX_BYTES)}.`, 'error');
			return;
		}
		uploadingBackground = true;
		try {
			const prepared = await prepareThemeUpload(picked);
			if (prepared.file.size > MEMBER_THEME_MAX_BYTES) {
				showToast(`Still ${imageSizeLabel(prepared.file.size)} after optimising. The limit is ${imageSizeLabel(MEMBER_THEME_MAX_BYTES)}.`, 'error');
				return;
			}
			const form = new FormData();
			form.append('image', prepared.file);
			form.append('accent', prepared.accent);
			const res = await fetch(`/api/servers/${data.serverId}/invite-theme`, { method: 'POST', body: form, credentials: 'include' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.success) {
				showToast(out.error || 'Could not upload the background', 'error');
				return;
			}
			inviteImageKey = out.key ?? inviteImageKey;
			inviteImageUrl = out.image ?? null;
			if (out.accent) inviteAccent = out.accent;
			showToast('Background saved', 'success');
			invalidateAll();
		} finally {
			uploadingBackground = false;
		}
	}

	async function removeBackground() {
		const res = await fetch(`/api/servers/${data.serverId}/invite-theme`, { method: 'DELETE', credentials: 'include' });
		const out = await res.json().catch(() => ({}));
		if (!res.ok || !out.success) {
			showToast(out.error || 'Could not remove the background', 'error');
			return;
		}
		inviteImageKey = null;
		inviteImageUrl = null;
		showToast('Background removed', 'success');
		invalidateAll();
	}

	const publicStatsUrl = $derived(data.publicStatsPath ? `${page.url.origin}${data.publicStatsPath}` : '');

	async function save() {
		saving = true;
		try {
			const base = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? { ...data.settings } : {};
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.public,
					...base,
					items_enabled: itemsEnabled,
					minigames_enabled: minigamesEnabled,
					market_enabled: marketEnabled,
					tasks_enabled: tasksEnabled,
					invite_enabled: inviteEnabled,
					invite_theme_image: inviteImageKey,
					invite_theme_accent: inviteAccent,
					invite_theme_effect: inviteEffect,
					invite_theme_effect_seed: inviteEffectSeed,
					ITEMS_CHANNEL_ID: itemsChannel,
					MINIGAMES_CHANNEL_ID: minigamesChannel
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				invalidateAll();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-chart-pie text-amber-400"></i>Public
	</h3>
	<p class="text-ash-400 text-xs">
		The public server pages (statistics, leaderboard, members, member account) are always on. Use the toggles below to choose which account features appear.
	</p>

	<div class="space-y-5">
		{#if data.publicStatsPath}
			<div>
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">
					<i class="fas fa-link mr-1 text-amber-400"></i>Public URL
				</label>
				<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
					<input type="text" readonly value={publicStatsUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
					<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.publicStatsPath || '#'} target="_blank" rel="noreferrer">
						Open
					</a>
				</div>
			</div>
		{/if}

		{#if data.publicStatsSubdomainUrl}
			<div>
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">
					<i class="fas fa-globe mr-1 text-amber-400"></i>Short URL
				</label>
				<p class="text-ash-500 mb-2 text-xs">This server's own subdomain. Serves the same pages as the public URL above.</p>
				<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
					<input type="text" readonly value={data.publicStatsSubdomainUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
					<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.publicStatsSubdomainUrl} target="_blank" rel="noreferrer">
						Open
					</a>
				</div>
			</div>
		{/if}

		<div class="space-y-3">
			<ConfigToggleRow
				label="Server invite"
				description="Shows a Join button on the public pages and the bot menu, and lists the server's join page in the sitemap."
				labelIconClass="fas fa-user-plus text-amber-400"
				bind:enabled={inviteEnabled}
				ariaLabel="Toggle server invite"
			/>
			{#if inviteEnabled && data.inviteUrl}
				<div class="pl-1">
					<label class="text-ash-300 mb-1.5 block text-xs font-medium">
						<i class="fas fa-link mr-1 text-amber-400"></i>Invite URL
					</label>
					<p class="text-ash-500 mb-2 text-xs">
						{data.inviteReady
							? 'Opens the join page for this server. Joins through it credit no member.'
							: 'The bot creates this server’s invite within 30 minutes. It needs the Create Invite permission.'}
					</p>
					<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
						<input type="text" readonly value={data.inviteUrl} class="text-ash-100 w-full bg-transparent font-mono text-xs focus:outline-none" />
						<a class="text-ash-200 hover:text-ash-100 text-xs font-medium underline" href={data.inviteUrl} target="_blank" rel="noreferrer">Open</a>
					</div>
				</div>
			{/if}
			{#if inviteEnabled}
				<div class="space-y-4 pl-1">
					<div>
						<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-image mr-1 text-amber-400"></i>Invite page background</label>
						<p class="text-ash-500 mb-2 text-xs">
							Fills the join page behind the invite card. The tone below is picked from it. {IMAGE_FORMATS_LABEL} · max {imageSizeLabel(
								MEMBER_THEME_MAX_BYTES
							)}.
						</p>
						<div
							class="border-ash-600 relative isolate mb-2 h-28 overflow-hidden rounded-lg border bg-cover bg-center"
							style="background-color: {inviteAccent}; {inviteImageUrl ? `background-image: url('${inviteImageUrl}')` : ''}"
						>
							<ThemeEffect effect={inviteEffect} seed={inviteEffectSeed} accent={inviteAccent} />
						</div>
						<div class="flex flex-wrap gap-2">
							<label class="bg-ash-600 hover:bg-ash-500 text-ash-100 cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors">
								<i class="fas {uploadingBackground ? 'fa-spinner fa-spin' : 'fa-upload'} mr-1"></i>{inviteImageUrl ? 'Change image' : 'Upload image'}
								<input type="file" accept={IMAGE_ACCEPT} class="hidden" disabled={uploadingBackground} onchange={uploadBackground} />
							</label>
							{#if inviteImageUrl}
								<button
									type="button"
									onclick={removeBackground}
									class="bg-ash-700 hover:bg-ash-600 text-ash-200 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
								>
									<i class="fas fa-trash mr-1 text-red-300"></i>Remove
								</button>
							{/if}
						</div>
					</div>

					<div>
						<label class="text-ash-300 mb-1.5 block text-xs font-medium" for="invite-tone"
							><i class="fas fa-palette mr-1 text-amber-400"></i>Invite page tone</label
						>
						<p class="text-ash-500 mb-2 text-xs">Recolours buttons and accents on the join page.</p>
						<div class="flex items-center gap-2">
							<input id="invite-tone" type="color" bind:value={inviteAccent} class="border-ash-600 h-9 w-12 cursor-pointer rounded border bg-transparent" />
							<span class="text-ash-300 font-mono text-xs">{inviteAccent}</span>
						</div>
					</div>

					<div>
						<span class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-wand-magic-sparkles mr-1 text-amber-400"></i>Invite page effect</span>
						<p class="text-ash-500 mb-2 text-xs">An animated effect on the invite card. Each pick rolls its own variant.</p>
						<LabeledSelect appearance="field" options={effectOptions} bind:value={inviteEffect} ariaLabel="Invite page effect" />
					</div>
				</div>
			{/if}
		</div>

		<div class="border-ash-700 space-y-5 border-t pt-5">
			<p class="text-ash-300 text-xs font-semibold">Account features</p>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Items"
					description="Spend XP on boosts, shields and PvP items."
					labelIconClass="fas fa-store text-teal-400"
					bind:enabled={itemsEnabled}
					ariaLabel="Toggle items"
				/>
				{#if itemsEnabled}
					<div class="pl-1">
						<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1 text-teal-400"></i>Item events channel</label>
						<p class="text-ash-500 mb-2 text-xs">Where item announcements are posted. If unset, item events are not announced.</p>
						<ChannelPicker channels={data.channels} categories={data.categories} value={itemsChannel} onchange={(id) => (itemsChannel = id)} />
					</div>
				{/if}
			</div>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Minigames"
					description="Free-to-play games where members wager XP."
					labelIconClass="fas fa-dice text-purple-400"
					bind:enabled={minigamesEnabled}
					ariaLabel="Toggle minigames"
				/>
				{#if minigamesEnabled}
					<div class="pl-1">
						<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1 text-purple-400"></i>Minigame events channel</label>
						<p class="text-ash-500 mb-2 text-xs">Where win and loss announcements are posted. If unset, results are not announced.</p>
						<ChannelPicker channels={data.channels} categories={data.categories} value={minigamesChannel} onchange={(id) => (minigamesChannel = id)} />
					</div>
				{/if}
			</div>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Market"
					description="XP crypto trading. Posts nothing to Discord."
					labelIconClass="fas fa-chart-line text-sky-400"
					bind:enabled={marketEnabled}
					ariaLabel="Toggle market"
				/>
			</div>

			<div class="space-y-3">
				<ConfigToggleRow
					label="Daily tasks"
					description="Auto-generated daily goals and streaks. Rewards XP or shop items. Milestone streaks post to the item events channel."
					labelIconClass="fas fa-list-check text-emerald-400"
					bind:enabled={tasksEnabled}
					ariaLabel="Toggle daily tasks"
				/>
			</div>
		</div>
	</div>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
