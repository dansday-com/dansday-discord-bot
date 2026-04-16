<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import AddBotModal from '$lib/frontend/components/AddBotModal.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import { resolveEmbedFooterPlaceholders } from '$lib/utils/embedFooter.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showAddBot = $state(false);
	let sortBy = $state('oldest');

	const botSortOptions: LabeledSelectOption[] = [
		{ value: 'oldest', label: 'Oldest First' },
		{ value: 'newest', label: 'Newest First' },
		{ value: 'name', label: 'Name (A-Z)' }
	];

	type LiveBot = { status: string; uptimeBase: number; uptimeTick: number };
	let liveMap = $state<Record<number, LiveBot>>({});
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let streams: EventSource[] = [];

	const sortedBots = $derived(
		[...data.bots].sort((a: { name: string; created_at: string }, b: { name: string; created_at: string }) => {
			if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
			if (sortBy === 'newest') return dbDateTimeToMs(b.created_at) - dbDateTimeToMs(a.created_at);
			return dbDateTimeToMs(a.created_at) - dbDateTimeToMs(b.created_at);
		})
	);

	onMount(() => {
		const initial: Record<number, LiveBot> = {};
		for (const bot of data.bots) {
			initial[bot.id] = { status: bot.status, uptimeBase: bot.uptime_ms ?? 0, uptimeTick: 0 };
		}
		liveMap = initial;

		for (const bot of data.bots) {
			const es = new EventSource(`/api/bots/${bot.id}/stream`);
			es.onmessage = (e) => {
				const d = JSON.parse(e.data);
				liveMap = {
					...liveMap,
					[bot.id]: { status: d.status, uptimeBase: d.uptime_ms ?? 0, uptimeTick: 0 }
				};
			};
			streams.push(es);
		}

		const base = Date.now();
		tickInterval = setInterval(() => {
			const elapsed = Date.now() - base;
			const next: Record<number, LiveBot> = {};
			for (const [id, live] of Object.entries(liveMap)) {
				next[Number(id)] = live.status === 'running' ? { ...live, uptimeTick: elapsed } : live;
			}
			liveMap = next;
		}, 1000);
	});

	onDestroy(() => {
		streams.forEach((es) => es.close());
		if (tickInterval) clearInterval(tickInterval);
	});

	function getLiveStatus(botId: number, fallback: string) {
		return liveMap[botId]?.status ?? fallback;
	}

	function getLiveUptime(botId: number, fallback: number) {
		const live = liveMap[botId];
		if (!live) return fallback;
		return live.status === 'running' ? live.uptimeBase + live.uptimeTick : 0;
	}

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function formatUptime(ms: number): string {
		if (!ms) return '';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	const MAX_TITLE = 256;
	const MAX_DESC = 4096;
	const MAX_FOOTER = 2048;
	const MAX_TOTAL = 6000;

	let embedTitle = $state('');
	let embedDescription = $state('');
	let embedFooter = $state('Powered by bot.dansday.com {year}');
	let embedColor = $state('#ff0000');
	let embedColorHex = $state('#ff0000');
	let imageMode = $state<'url' | 'upload'>('url');
	let imageUrl = $state('');
	let uploadedImagePath = $state('');
	let imagePreview = $state('');
	let sendingGlobalEmbed = $state(false);

	const embedFooterPreview = $derived(resolveEmbedFooterPlaceholders(embedFooter, '{server}'));
	const embedTotalChars = $derived(embedTitle.length + embedDescription.length + embedFooter.length);

	function charWarning(len: number, max: number) {
		if (len >= max) return 'text-red-400';
		if (len >= max * 0.9) return 'text-yellow-400';
		return 'text-ash-500';
	}

	function totalWarning() {
		if (embedTotalChars >= MAX_TOTAL) return 'text-red-400';
		if (embedTotalChars >= MAX_TOTAL * 0.9) return 'text-yellow-400';
		return 'text-ash-500';
	}

	function syncColor(val: string) {
		embedColor = val;
		embedColorHex = val;
	}

	function syncColorHex(val: string) {
		embedColorHex = val;
		if (/^#[0-9A-Fa-f]{6}$/.test(val)) embedColor = val;
	}

	async function handleImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (uploadedImagePath) {
			await fetch(`/api/admin/delete-embed-image`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ path: uploadedImagePath })
			}).catch(() => {});
		}

		const formData = new FormData();
		formData.append('image', file);

		const res = await fetch(`/api/admin/upload-embed-image`, {
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
		await fetch(`/api/admin/delete-embed-image`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ path: uploadedImagePath })
		});
		uploadedImagePath = '';
		imagePreview = '';
	}

	async function sendGlobalEmbed() {
		if (!embedTitle.trim()) {
			showToast('Title is required', 'error');
			return;
		}
		if (embedTotalChars > MAX_TOTAL) {
			showToast('Total character limit exceeded', 'error');
			return;
		}

		sendingGlobalEmbed = true;
		try {
			const body: Record<string, unknown> = {
				title: embedTitle,
				description: embedDescription,
				footer: embedFooter,
				color: embedColor
			};

			if (imageMode === 'url' && imageUrl) body.image_url = imageUrl;
			else if (imageMode === 'upload' && uploadedImagePath) body.uploaded_image_path = uploadedImagePath;

			const res = await fetch(`/api/admin/send-global-embed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});
			let d: { success?: boolean; error?: string; successCount?: number; failCount?: number } = {};
			try {
				d = await res.json();
			} catch {
				showToast('Could not read the server response. Try again.', 'error');
				return;
			}
			if (d.success) {
				uploadedImagePath = '';
				imagePreview = '';
				embedTitle = '';
				embedDescription = '';
				imageUrl = '';
				showToast(`Global embed sent! Succeeded: ${d.successCount}, Failed: ${d.failCount}`, 'success');
			} else {
				showToast(d.error || 'Failed to send global embed', 'error');
			}
		} finally {
			sendingGlobalEmbed = false;
		}
	}
</script>

<svelte:head>
	<title>Dashboard | &lt;/DANSDAY&gt; Discord Bot</title>
</svelte:head>

<AddBotModal open={showAddBot} onclose={() => (showAddBot = false)} onadded={() => invalidateAll()} />

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	<div class="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
				<i class="fas fa-robot mr-2 text-violet-400"></i>Bots List
			</h2>
			<p class="text-ash-400 text-xs sm:text-sm">
				{data.bots.length === 0 ? 'No bots yet' : `${data.bots.length} bot${data.bots.length === 1 ? '' : 's'}`}
			</p>
		</div>
		<div class="flex items-center gap-2 sm:gap-3">
			<LabeledSelect
				id="dashboard-bots-sort"
				label="Sort by:"
				labelTone="cyan"
				labelIconClass="fas fa-filter text-cyan-300"
				appearance="dashboard"
				options={botSortOptions}
				bind:value={sortBy}
			/>
			{#if data.user.authenticated && data.user.account_source === 'accounts'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
				>
					<i class="fas fa-plus text-xs text-violet-300 sm:text-sm"></i>
					<span class="sm:inline">Add Bot</span>
				</button>
			{/if}
		</div>
	</div>

	{#if sortedBots.length === 0}
		<div class="py-8 text-center sm:py-12">
			<div class="bg-ash-800 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20">
				<i class="fas fa-robot text-3xl text-violet-300 sm:text-4xl"></i>
			</div>
			<h3 class="text-ash-100 mb-2 text-lg font-semibold sm:text-xl">No bots yet</h3>
			<p class="text-ash-400 mb-4 text-sm sm:mb-6 sm:text-base">Get started by adding your first bot</p>
			{#if data.user.authenticated && data.user.account_source === 'accounts'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all duration-200 hover:scale-105 active:scale-95 sm:px-6 sm:py-3 sm:text-base"
				>
					<i class="fas fa-plus text-violet-300"></i>Add Your First Bot
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
			{#each sortedBots as bot (bot.id)}
				<a
					href="/bots/{bot.id}"
					class="bg-ash-800 border-ash-700 hover:border-ash-500 flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
				>
					<div class="flex items-center gap-3">
						<div class="bg-ash-600 flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
							{#if bot.bot_icon}
								<img src={bot.bot_icon} alt={bot.name} class="h-full w-full object-cover" />
							{:else}
								<i class="fas fa-robot text-lg text-violet-300"></i>
							{/if}
						</div>
						<div class="min-w-0">
							<p class="text-ash-100 truncate text-sm font-semibold sm:text-base">{bot.name || `Bot #${bot.id}`}</p>
							<span class="text-ash-400 text-xs">Official</span>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full {statusColor(getLiveStatus(bot.id, bot.status))}"></span>
							<span class="text-ash-300 text-xs capitalize">{getLiveStatus(bot.id, bot.status)}</span>
						</div>
						{#if getLiveStatus(bot.id, bot.status) === 'running'}
							{@const uptime = getLiveUptime(bot.id, bot.uptime_ms ?? 0)}
							{#if uptime}
								<span class="text-ash-500 text-xs">{formatUptime(uptime)}</span>
							{/if}
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}

	{#if data.user.authenticated && data.user.account_type === 'superadmin'}
		<div class="bg-ash-800 border-ash-700 mt-8 mb-4 rounded-xl border p-4 sm:mb-6 sm:p-6">
			<h3 class="text-ash-100 mb-1 text-lg font-semibold">
				<i class="fas fa-bullhorn mr-2 text-violet-400"></i>Global Embed Builder
			</h3>
			<p class="text-ash-400 mb-4 text-sm">
				Send an announcement to all servers across ALL of your bots. It will be posted in each server's configured <strong>Bot Updates Channel</strong>.
			</p>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div class="space-y-4">
					<div class="bg-ash-700 border-ash-600 rounded-xl border p-4 sm:p-5">
						<div class="mb-4">
							<div class="mb-1 flex justify-between">
								<label class="text-ash-300 text-xs font-medium">Title <span class="text-ash-200">*</span></label>
								<span class="text-xs {charWarning(embedTitle.length, MAX_TITLE)}">{embedTitle.length}/{MAX_TITLE}</span>
							</div>
							<input
								type="text"
								bind:value={embedTitle}
								maxlength={MAX_TITLE}
								placeholder="Embed title..."
								class="bg-ash-800 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
							/>
						</div>

						<div class="mb-4">
							<div class="mb-1 flex justify-between">
								<label class="text-ash-300 text-xs font-medium">Description</label>
								<span class="text-xs {charWarning(embedDescription.length, MAX_DESC)}">{embedDescription.length}/{MAX_DESC}</span>
							</div>
							<textarea
								bind:value={embedDescription}
								maxlength={MAX_DESC}
								rows={4}
								placeholder="Embed description..."
								class="bg-ash-800 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
							></textarea>
						</div>

						<div class="mb-4">
							<div class="mb-1 flex justify-between">
								<label class="text-ash-300 text-xs font-medium">Footer</label>
								<span class="text-xs {charWarning(embedFooter.length, MAX_FOOTER)}">{embedFooter.length}/{MAX_FOOTER}</span>
							</div>
							<input
								type="text"
								bind:value={embedFooter}
								maxlength={MAX_FOOTER}
								placeholder="Footer text..."
								class="bg-ash-800 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
							/>
						</div>

						<div class="mb-4">
							<label class="text-ash-300 mb-1 block text-xs font-medium">Color</label>
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={embedColor}
									oninput={(e) => syncColor((e.target as HTMLInputElement).value)}
									class="bg-ash-800 border-ash-600 h-9 w-10 cursor-pointer rounded border"
								/>
								<input
									type="text"
									bind:value={embedColorHex}
									oninput={(e) => syncColorHex((e.target as HTMLInputElement).value)}
									placeholder={embedColorHex}
									class="bg-ash-800 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
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
									class="bg-ash-800 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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

						<p class="text-xs {totalWarning()} text-right">{embedTotalChars}/{MAX_TOTAL} total</p>
					</div>
				</div>

				<div class="bg-ash-700 border-ash-600 self-start rounded-xl border p-4 sm:p-5 lg:sticky lg:top-4">
					<h3 class="text-ash-300 mb-4 flex items-center gap-2 text-sm font-semibold">
						<i class="fas fa-eye text-cyan-400"></i>Preview
					</h3>

					<div class="mb-4 rounded-lg bg-[#313338] p-3">
						<div class="rounded-r-lg border-l-4 bg-[#2b2d31] py-2 pl-3" style="border-color: {embedColor}">
							{#if embedTitle}
								<p class="mb-1 text-sm font-semibold text-white">{embedTitle}</p>
							{:else}
								<p class="mb-1 text-sm text-[#6b7280] italic">No title yet...</p>
							{/if}
							{#if embedDescription}
								<p class="text-xs leading-relaxed whitespace-pre-wrap text-[#dbdee1]">{embedDescription}</p>
							{/if}
							{#if imageMode === 'url' && imageUrl}
								<img src={imageUrl} alt="Embed" class="mt-2 max-w-full rounded" />
							{:else if imageMode === 'upload' && imagePreview}
								<img src={imagePreview} alt="Embed" class="mt-2 max-w-full rounded" />
							{/if}
							{#if embedFooterPreview}
								<p class="mt-2 border-t border-[#3d4045] pt-2 text-xs text-[#949ba4]">{embedFooterPreview}</p>
							{/if}
						</div>
					</div>

					<button
						onclick={sendGlobalEmbed}
						disabled={sendingGlobalEmbed}
						class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if sendingGlobalEmbed}<i class="fas fa-spinner fa-spin text-emerald-300"></i>{:else}<i class="fas fa-paper-plane text-emerald-300"></i>{/if}
						{sendingGlobalEmbed ? 'Sending...' : 'Send Global Embed'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
