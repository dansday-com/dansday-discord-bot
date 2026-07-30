<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { DASHBOARD_PATH, isBotSectionPath } from '$lib/frontend/redirect.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.bot.id}`);

	const tabs = $derived([
		{ label: 'Servers', icon: 'fa-server', iconClass: 'text-violet-400', href: base },
		{ label: 'Presence', icon: 'fa-circle-notch', iconClass: 'text-sky-400', href: `${base}/presence` },
		{ label: 'AI', icon: 'fa-robot', iconClass: 'text-emerald-400', href: `${base}/ai` }
	]);

	function isActive(href: string) {
		if (href === base) return page.url.pathname.replace(/\/$/, '') === base;
		return page.url.pathname.startsWith(href);
	}

	const isBotSection = $derived(isBotSectionPath(page.url.pathname));

	let _liveBotOverride: typeof data.bot | null = $state(null);
	const liveBot = $derived(_liveBotOverride ?? data.bot);
	let uptimeBase = $state(0);
	let uptimeTick = $state(0);
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let es: EventSource | null = null;

	const displayUptime = $derived(liveBot.status === 'running' ? uptimeBase + uptimeTick : 0);

	function startTick() {
		if (tickInterval) return;
		const base = Date.now();
		tickInterval = setInterval(() => {
			uptimeTick = Date.now() - base;
		}, 1000);
	}

	function stopTick() {
		if (tickInterval) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
		uptimeTick = 0;
	}

	onMount(() => {
		if (!isBotSection) return;

		_liveBotOverride = { ...data.bot };
		if (data.bot.status === 'running') {
			uptimeBase = data.bot.uptime_ms ?? 0;
			startTick();
		}

		es = new EventSource(`/api/bots/${data.bot.id}/stream`);
		es.onmessage = (e) => {
			const d = JSON.parse(e.data);
			_liveBotOverride = { ...liveBot, status: d.status, process_id: d.process_id ?? liveBot.process_id };
			if (d.status === 'running') {
				uptimeBase = d.uptime_ms ?? 0;
				uptimeTick = 0;
				startTick();
			} else {
				uptimeBase = 0;
				stopTick();
			}
		};
	});

	onDestroy(() => {
		es?.close();
		stopTick();
	});

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function statusTextColor(status: string) {
		if (status === 'running') return 'text-green-400';
		if (status === 'starting' || status === 'stopping') return 'text-yellow-400';
		return 'text-ash-400';
	}

	function formatUptime(ms: number): string {
		if (!ms) return '—';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	async function botAction(action: 'start' | 'stop' | 'restart') {
		const res = await fetch(`/api/bots/${data.bot.id}/${action}`, {
			method: 'POST',
			credentials: 'include'
		});
		const d = await res.json();
		if (d.success || res.ok) {
			showToast(`Bot ${action} initiated`, 'success');
			invalidateAll();
		} else {
			showToast(d.error || `Failed to ${action} bot`, 'error');
		}
	}

	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	async function deleteBot() {
		deleting = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			const d = await res.json();
			if (d.success) {
				showToast('Bot deleted', 'success');
				goto(DASHBOARD_PATH);
			} else {
				showToast(d.error || 'Failed to delete bot', 'error');
			}
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}

	const isRunning = $derived(liveBot.status === 'running');
	const isBusy = $derived(liveBot.status === 'starting' || liveBot.status === 'stopping');
	const canStart = $derived(!isRunning && !isBusy);
	const canStop = $derived(isRunning || isBusy);
	const isAdmin = $derived(data.user.authenticated && data.user.account_source === 'accounts');
</script>

{#if !isBotSection}
	{@render children()}
{:else}
	<svelte:head>
		<title>{data.bot.name || `Bot #${data.bot.id}`} | {APP_NAME} Discord Bot</title>
	</svelte:head>

	<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
		<a href={DASHBOARD_PATH} class="text-ash-400 hover:text-ash-100 mb-6 inline-flex items-center gap-2 text-sm transition-colors">
			<i class="fas fa-arrow-left text-violet-300"></i>Back to Dashboard
		</a>

	<div class="bg-ash-800 border-ash-700 mb-4 rounded-xl border p-4 sm:mb-6 sm:p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<div class="flex min-w-0 flex-1 items-center gap-4">
				<div class="bg-ash-600 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-20 sm:w-20">
					{#if data.bot.bot_icon}
						<img src={data.bot.bot_icon} alt={data.bot.name} class="h-full w-full object-cover" />
					{:else}
						<i class="fas fa-robot text-2xl text-violet-300 sm:text-3xl"></i>
					{/if}
				</div>
				<div class="min-w-0">
					<h2 class="text-ash-100 truncate text-xl font-bold sm:text-2xl">
						{data.bot.name || `Bot #${data.bot.id}`}
					</h2>
				</div>
			</div>

			{#if isAdmin}
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					{#if canStart}
						<button
							onclick={() => botAction('start')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-green-700 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-play text-sm text-green-200 sm:text-base"></i>
							<span>Start</span>
						</button>
					{/if}
					{#if canStop}
						<button
							onclick={() => botAction('stop')}
							class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all hover:scale-105 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-stop text-sm text-rose-200 sm:text-base"></i>
							<span>Stop</span>
						</button>
						<button
							onclick={() => botAction('restart')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-yellow-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-yellow-700 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-redo text-sm text-yellow-200 sm:text-base"></i>
							<span>Restart</span>
						</button>
					{/if}
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-red-800 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
					>
						<i class="fas fa-trash text-sm text-red-300 sm:text-base"></i>
						<span class="hidden sm:inline">Delete</span>
					</button>
				</div>
			{/if}
		</div>

		<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="bg-ash-700 rounded-lg p-3">
				<p class="text-ash-400 mb-1 text-xs">Status</p>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full {statusColor(liveBot.status)}"></span>
					<span class="text-sm font-medium capitalize {statusTextColor(liveBot.status)}">{liveBot.status}</span>
				</div>
			</div>

			{#if isRunning}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-ash-400 mb-1 text-xs">Uptime</p>
					<p class="text-ash-100 text-sm font-medium">{formatUptime(displayUptime)}</p>
				</div>
			{/if}

			{#if liveBot.process_id}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-ash-400 mb-1 text-xs">Process ID</p>
					<p class="text-ash-100 text-sm font-medium">{liveBot.process_id}</p>
				</div>
			{/if}

			{#if data.bot.port}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-ash-400 mb-1 text-xs">Port</p>
					<p class="text-ash-100 text-sm font-medium">{data.bot.port}</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="bg-ash-800 border-ash-700 mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1">
		{#each tabs as tab}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				data-sveltekit-preload-data="hover"
				class="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all sm:px-4
					{active ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} {tab.iconClass} {active ? '' : 'opacity-75'} text-xs"></i>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>

	{@render children()}
	</div>

	<ConfirmModal
		open={showDeleteConfirm}
		title="Delete Bot"
		message="Delete &quot;{data.bot.name || `Bot #${data.bot.id}`}&quot;? This cannot be undone."
		confirmLabel="Delete"
		dangerous
		loading={deleting}
		onconfirm={deleteBot}
		oncancel={() => (showDeleteConfirm = false)}
	/>
{/if}
